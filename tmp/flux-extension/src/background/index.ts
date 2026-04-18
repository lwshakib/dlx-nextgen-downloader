// Background service worker to intercept downloads and send to desktop app

const DESKTOP_APP_PORT = 8765;
const DESKTOP_APP_URL = `http://127.0.0.1:${DESKTOP_APP_PORT}/download`;

// Track intercepted downloads to avoid duplicates
const interceptedDownloads = new Set<number>();

// Helper function to get original source from blob URL
async function getOriginalSourceFromBlobUrl(
  blobUrl: string,
  tabId?: number
): Promise<string | null> {
  try {
    // Try to get the tab ID if not provided
    let targetTabId = tabId;
    if (!targetTabId) {
      const tabs = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });
      if (tabs[0]?.id) {
        targetTabId = tabs[0].id;
      }
    }

    if (!targetTabId) {
      console.log("No tab ID available to query for original source");
      return null;
    }

    // Send message to content script to get original source
    const response = await chrome.tabs.sendMessage(targetTabId, {
      type: "GET_ORIGINAL_SOURCE",
      blobUrl: blobUrl,
    });

    return response?.originalSource || null;
  } catch (error) {
    console.log("Could not get original source from content script:", error);
    return null;
  }
}

// Intercept downloads as early as possible - when filename is being determined
chrome.downloads.onDeterminingFilename.addListener(
  async (downloadItem, suggest) => {
    try {
      // Get download details first
      let url = downloadItem.finalUrl || downloadItem.url;
      const downloadId = downloadItem.id;

      // Mark as intercepted
      interceptedDownloads.add(downloadId);

      console.log("Download intercepted (onDeterminingFilename):", url);

      // CRITICAL: Cancel the Chrome download IMMEDIATELY and synchronously
      // This must happen before any async operations to prevent Chrome's download UI
      chrome.downloads.cancel(downloadId).catch(() => {
        // Ignore errors - download might already be canceled
      });

      // Call suggest() immediately with empty filename to prevent Chrome UI
      // This must be called synchronously, before any async work
      suggest({ filename: "", conflictAction: "uniquify" });

      // Now do async work to get the original source if needed
      if (url.startsWith("blob:")) {
        console.log("Blob URL detected, attempting to get original source...");
        const tabId = (downloadItem as any).tabId;
        const originalSource = await getOriginalSourceFromBlobUrl(url, tabId);
        if (originalSource) {
          console.log("Found original source:", originalSource);
          url = originalSource;
        } else {
          console.warn(
            "Could not find original source for blob URL, blob URL will not be downloadable"
          );
          // Still proceed but the desktop app won't be able to download it
        }
      }

      // Extract filename and title from download item
      let title: string | null = null;
      let suggestedFilename: string | null = null;
      const filename =
        downloadItem.filename ||
        (downloadItem as any).suggestedFilename ||
        null;

      if (filename) {
        // Extract just the filename (without path)
        const fileNameOnly = filename.split(/[/\\]/).pop() || filename;
        suggestedFilename = fileNameOnly;

        // Remove extension for title
        const nameWithoutExt = fileNameOnly.replace(/\.[^/.]+$/, "");
        title = nameWithoutExt || null;
      }

      // Try to extract filename from URL if not available
      if (!suggestedFilename && url && !url.startsWith("blob:")) {
        try {
          const urlObj = new URL(url);
          const pathname = urlObj.pathname;
          const urlFileName = pathname.split("/").pop();
          if (urlFileName && urlFileName.includes(".")) {
            suggestedFilename = urlFileName;
            if (!title) {
              title = urlFileName.replace(/\.[^/.]+$/, "");
            }
          }
        } catch (e) {
          // URL parsing failed, skip
        }
      }

      // Try to get page title from the tab if available (as fallback)
      if (!title) {
        try {
          // Get all tabs and find the one that matches the download URL
          const tabs = await chrome.tabs.query({});
          for (const tab of tabs) {
            if (tab.url) {
              try {
                const tabUrl = new URL(tab.url);
                const downloadUrl = new URL(url);
                if (tabUrl.hostname === downloadUrl.hostname) {
                  if (tab.title) {
                    title = tab.title;
                    break;
                  }
                }
              } catch (e) {
                // URL parsing failed, skip
              }
            }
          }

          // Fallback to active tab
          if (!title) {
            const activeTabs = await chrome.tabs.query({
              active: true,
              currentWindow: true,
            });
            if (activeTabs[0]?.title) {
              title = activeTabs[0].title;
            }
          }
        } catch (error) {
          console.log("Could not get tab title:", error);
        }
      }

      // Send to desktop app (only if we have a valid non-blob URL)
      if (!url.startsWith("blob:")) {
        sendToDesktopApp({
          url,
          title,
          filename: suggestedFilename, // Include the full filename with extension
          cookies: null, // Cookies will be handled by the desktop app if needed
        }).catch((err) => console.error("Failed to send to desktop app:", err));
      } else {
        console.error(
          "Cannot send blob URL to desktop app - original source not found"
        );
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("public/icons/icon48.png"),
          title: "Flux Downloader",
          message:
            "Cannot download blob URL. Please try downloading the file directly.",
        });
      }
    } catch (error) {
      console.error("Error intercepting download:", error);
    }
  }
);

// Backup: Also intercept downloads when they are created (in case onDeterminingFilename didn't fire)
chrome.downloads.onCreated.addListener(async (downloadItem) => {
  // Skip if already intercepted
  if (interceptedDownloads.has(downloadItem.id)) {
    return;
  }

  try {
    console.log("Download intercepted (onCreated):", downloadItem);

    // Get download details
    let url = downloadItem.finalUrl || downloadItem.url;
    const downloadId = downloadItem.id;

    // Mark as intercepted
    interceptedDownloads.add(downloadId);

    // CRITICAL: Cancel the Chrome download IMMEDIATELY and synchronously
    // This must happen before any async operations to prevent Chrome's download UI
    chrome.downloads.cancel(downloadId).catch(() => {
      // Ignore errors - download might already be canceled
    });

    // Also try to remove the file immediately if it exists
    chrome.downloads.removeFile(downloadId).catch(() => {
      // Ignore errors - file might not exist yet
    });

    // Now do async work to get the original source if needed
    if (url.startsWith("blob:")) {
      console.log("Blob URL detected, attempting to get original source...");
      const tabId = (downloadItem as any).tabId;
      const originalSource = await getOriginalSourceFromBlobUrl(url, tabId);
      if (originalSource) {
        console.log("Found original source:", originalSource);
        url = originalSource;
      } else {
        console.warn(
          "Could not find original source for blob URL, blob URL will not be downloadable"
        );
        // Still proceed but the desktop app won't be able to download it
      }
    }

    // Extract filename and title from download item
    let title: string | null = null;
    let suggestedFilename: string | null = null;
    const filename =
      downloadItem.filename || (downloadItem as any).suggestedFilename || null;

    if (filename) {
      // Extract just the filename (without path)
      const fileNameOnly = filename.split(/[/\\]/).pop() || filename;
      suggestedFilename = fileNameOnly;

      // Remove extension for title
      const nameWithoutExt = fileNameOnly.replace(/\.[^/.]+$/, "");
      title = nameWithoutExt || null;
    }

    // Try to extract filename from URL if not available
    if (!suggestedFilename && url && !url.startsWith("blob:")) {
      try {
        const urlObj = new URL(url);
        const pathname = urlObj.pathname;
        const urlFileName = pathname.split("/").pop();
        if (urlFileName && urlFileName.includes(".")) {
          suggestedFilename = urlFileName;
          if (!title) {
            title = urlFileName.replace(/\.[^/.]+$/, "");
          }
        }
      } catch (e) {
        // URL parsing failed, skip
      }
    }

    // Try to get page title from the tab if available (as fallback)
    if (!title) {
      try {
        // Get all tabs and find the one that matches the download URL
        const tabs = await chrome.tabs.query({});
        for (const tab of tabs) {
          if (tab.url) {
            try {
              const tabUrl = new URL(tab.url);
              const downloadUrl = new URL(url);
              if (tabUrl.hostname === downloadUrl.hostname) {
                if (tab.title) {
                  title = tab.title;
                  break;
                }
              }
            } catch (e) {
              // URL parsing failed, skip
            }
          }
        }

        // Fallback to active tab
        if (!title) {
          const activeTabs = await chrome.tabs.query({
            active: true,
            currentWindow: true,
          });
          if (activeTabs[0]?.title) {
            title = activeTabs[0].title;
          }
        }
      } catch (error) {
        console.log("Could not get tab title:", error);
      }
    }

    // Send to desktop app (only if we have a valid non-blob URL)
    if (!url.startsWith("blob:")) {
      await sendToDesktopApp({
        url,
        title,
        filename: suggestedFilename, // Include the full filename with extension
        cookies: null, // Cookies will be handled by the desktop app if needed
      });
    } else {
      console.error(
        "Cannot send blob URL to desktop app - original source not found"
      );
      chrome.notifications.create({
        type: "basic",
        iconUrl: chrome.runtime.getURL("public/icons/icon48.png"),
        title: "Flux Downloader",
        message:
          "Cannot download blob URL. Please try downloading the file directly.",
      });
    }
  } catch (error) {
    console.error("Error intercepting download:", error);
  }
});

// Clean up intercepted downloads when they complete or are removed
chrome.downloads.onChanged.addListener((delta) => {
  if (
    delta.state &&
    (delta.state.current === "complete" ||
      delta.state.current === "interrupted")
  ) {
    interceptedDownloads.delete(delta.id);
  }
});

chrome.downloads.onErased.addListener((downloadId) => {
  interceptedDownloads.delete(downloadId);
});

// Listen for direct download requests from content script
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === "DOWNLOAD_VIDEO" && message.url) {
    // Get title from active tab if available
    chrome.tabs.query({ active: true, currentWindow: true }).then((tabs) => {
      const title = tabs[0]?.title || null;
      sendToDesktopApp({
        url: message.url,
        title: message.title || title,
        audioUrl: message.audioUrl || null, // Include audio URL if provided (for YouTube)
        cookies: message.cookies || null, // Include cookies if provided (for TikTok)
      })
        .then(() => {
          sendResponse({ success: true });
        })
        .catch((err) => {
          console.error("Failed to send to desktop app:", err);
          sendResponse({ success: false, error: err.message });
        });
    });
    return true; // Keep channel open for async response
  }
  return false;
});

// Function to send download request to desktop app with retry logic
async function sendToDesktopApp(
  data: {
    url: string;
    title: string | null;
    filename?: string | null; // Full filename with extension
    audioUrl?: string | null;
    cookies: { msToken?: string | null; ttChainToken?: string | null } | null;
  },
  retries = 3
) {
  for (let attempt = 1; attempt <= retries; attempt++) {
    try {
      const response = await fetch(DESKTOP_APP_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(data),
        // Add timeout
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });

      if (!response.ok) {
        throw new Error(
          `Desktop app responded with status: ${response.status}`
        );
      }

      console.log("Successfully sent download to desktop app:", data.url);
      return; // Success, exit function
    } catch (error) {
      const isLastAttempt = attempt === retries;

      if (isLastAttempt) {
        console.error(
          "Failed to send download to desktop app after",
          retries,
          "attempts:",
          error
        );
        // Show notification to user only on final failure
        chrome.notifications.create({
          type: "basic",
          iconUrl: chrome.runtime.getURL("public/icons/icon48.png"),
          title: "Flux Downloader",
          message:
            "Could not connect to desktop app. Make sure Flux is running and try again.",
        });
      } else {
        console.log(`Attempt ${attempt} failed, retrying in 1 second...`);
        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }
    }
  }
}

console.log("Flux Chrome Extension background service worker loaded");
