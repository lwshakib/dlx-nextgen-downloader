import { useEffect, useRef, useState } from "react";
import "./App.css";

// Store mapping of blob URLs to original video sources
const blobUrlToSource = new Map<string, string>();

// Listen for messages from background script requesting original source
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type === 'GET_ORIGINAL_SOURCE' && message.blobUrl) {
    const originalSource = blobUrlToSource.get(message.blobUrl);
    sendResponse({ originalSource: originalSource || null });
    return true; // Keep channel open for async response
  }
  return false;
});

interface VideoElement {
  element: HTMLVideoElement;
  id: string;
}

interface Resolution {
  url: string;
  qualityLabel: string;
  width: number;
  height: number;
  mimeType: string;
}

interface Audio {
  url: string;
  mimeType: string;
  bitrate?: number;
  audioQuality?: string;
  audioSampleRate?: string;
}

interface YouTubeData {
  status: string;
  videoId: string;
  title: string;
  thumbnail: string;
  resolutions: Resolution[];
  audio: Audio;
}

interface FacebookResolution {
  url: string;
  quality: string;
  width: number;
  height: number;
  format: string;
}

interface FacebookData {
  title: string;
  thumbnail: string;
  resolutions: FacebookResolution[];
}

interface TikTokResolution {
  qualityType: number;
  qualityLabel: string;
  bitrate: number;
  codec: string;
  width: number;
  height: number;
  url: string;
}

interface TikTokData {
  title: string;
  thumbnail: string;
  resolutions: TikTokResolution[];
  tokens?: {
    msToken?: string | null;
    ttChainToken?: string | null;
  } | null;
}

function DownloadVideoButton({ video }: { video: HTMLVideoElement }) {
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [isVisible, setIsVisible] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [youtubeData, setYoutubeData] = useState<YouTubeData | null>(null);
  const [facebookData, setFacebookData] = useState<FacebookData | null>(null);
  const [tiktokData, setTikTokData] = useState<TikTokData | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const buttonRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const updatePosition = () => {
      const rect = video.getBoundingClientRect();
      setPosition({
        top: rect.top,
        left: rect.left,
      });
    };

    updatePosition();
    const scrollHandler = () => updatePosition();
    const resizeHandler = () => updatePosition();

    window.addEventListener("scroll", scrollHandler, true);
    window.addEventListener("resize", resizeHandler);

    // Also listen for video container changes
    const videoObserver = new MutationObserver(updatePosition);
    if (video.parentElement) {
      videoObserver.observe(video.parentElement, {
        attributes: true,
        attributeFilter: ["style", "class"],
      });
    }

    return () => {
      window.removeEventListener("scroll", scrollHandler, true);
      window.removeEventListener("resize", resizeHandler);
      videoObserver.disconnect();
    };
  }, [video]);

  const isYouTube = () => {
    return (
      window.location.hostname.includes("youtube.com") ||
      window.location.hostname.includes("youtu.be")
    );
  };

  const isFacebook = () => {
    return (
      window.location.hostname.includes("facebook.com") ||
      window.location.hostname.includes("fb.com") ||
      window.location.hostname.includes("m.facebook.com")
    );
  };

  const isTikTok = () => {
    return (
      window.location.hostname.includes("tiktok.com") ||
      window.location.hostname.includes("vm.tiktok.com")
    );
  };

  const getTikTokVideoUrl = (videoElement: HTMLVideoElement) => {
    // First, try to get from current URL
    const currentUrl = window.location.href;
    const pathname = window.location.pathname;
    
    // Check if pathname contains /video/ followed by digits
    const videoMatch = pathname.match(/\/video\/(\d+)/);
    if (videoMatch && videoMatch[1]) {
      // Reconstruct the full URL with protocol and hostname
      const baseUrl = `${window.location.protocol}//${window.location.hostname}${pathname}`;
      return baseUrl.split('?')[0]; // Remove query parameters
    }
    
    // Try alternative pattern: tiktok.com/@username/video/1234567890
    const fullMatch = currentUrl.match(/tiktok\.com\/[^\/]+\/video\/(\d+)/);
    if (fullMatch && fullMatch[1]) {
      return currentUrl.split('?')[0];
    }
    
    // If URL extraction fails, search DOM around the video element
    // Search for video ID in parent elements (id or class attributes)
    let container: HTMLElement | null = videoElement.parentElement;
    const maxDepth = 15; // Search up the DOM tree
    let depth = 0;
    let videoId: string | null = null;
    let username: string | null = null;

    while (container && depth < maxDepth) {
      // Check for video ID in id or class attributes
      const id = container.id || '';
      const className = container.className || '';
      const combined = `${id} ${className}`;
      
      // Look for long numeric ID (TikTok video IDs are typically 19 digits)
      const idMatch = combined.match(/\b(\d{15,20})\b/);
      if (idMatch && idMatch[1]) {
        videoId = idMatch[1];
      }

      // Look for username in href attributes (format: /@username)
      const links = container.querySelectorAll('a[href*="/@"]');
      for (const link of Array.from(links)) {
        const href = link.getAttribute('href');
        if (href) {
          const usernameMatch = href.match(/\/@([^\/\?]+)/);
          if (usernameMatch && usernameMatch[1]) {
            username = usernameMatch[1];
            break;
          }
        }
      }

      // Also check data-e2e="video-author-uniqueid" for username
      if (!username) {
        const authorElement = container.querySelector('[data-e2e="video-author-uniqueid"]');
        if (authorElement) {
          const parentLink = authorElement.closest('a[href*="/@"]');
          if (parentLink) {
            const href = parentLink.getAttribute('href');
            if (href) {
              const usernameMatch = href.match(/\/@([^\/\?]+)/);
              if (usernameMatch && usernameMatch[1]) {
                username = usernameMatch[1];
              }
            }
          }
        }
      }

      // If we found both, we can construct the URL
      if (videoId && username) {
        return `https://www.tiktok.com/@${username}/video/${videoId}`;
      }

      // Move up to parent container
      container = container.parentElement;
      depth++;
    }

    // Fallback: search entire page for video ID and username
    if (!videoId || !username) {
      const pageHtml = document.documentElement.innerHTML;
      
      // Find video ID (long numeric string)
      if (!videoId) {
        const idMatches = pageHtml.match(/\b(\d{15,20})\b/g);
        if (idMatches && idMatches.length > 0) {
          // Prefer the longest match (most likely to be video ID)
          videoId = idMatches.sort((a, b) => b.length - a.length)[0];
        }
      }

      // Find username from href patterns
      if (!username) {
        const usernameMatches = pageHtml.match(/\/@([a-zA-Z0-9._-]+)/g);
        if (usernameMatches && usernameMatches.length > 0) {
          // Get unique usernames and prefer shorter ones (less likely to be part of longer strings)
          const uniqueUsernames = Array.from(new Set(usernameMatches.map(m => m.replace('/@', ''))));
          username = uniqueUsernames[0];
        }
      }

      if (videoId && username) {
        return `https://www.tiktok.com/@${username}/video/${videoId}`;
      }
    }

    // Check for short links (vm.tiktok.com) - these need to be resolved
    if (window.location.hostname.includes('vm.tiktok.com')) {
      return currentUrl.split('?')[0];
    }
    
    return null;
  };

  const getYouTubeVideoUrl = () => {
    const urlParams = new URLSearchParams(window.location.search);
    const videoId = urlParams.get("v");
    if (videoId) {
      return `https://www.youtube.com/watch?v=${videoId}`;
    }
    // Fallback: try to get from current URL
    if (window.location.href.includes("youtube.com/watch")) {
      return window.location.href.split("&")[0]; // Remove extra params
    }
    if (window.location.hostname.includes("youtu.be")) {
      const pathParts = window.location.pathname.split("/");
      const id = pathParts[pathParts.length - 1];
      if (id) {
        return `https://www.youtube.com/watch?v=${id}`;
      }
    }
    return null;
  };

  const getFacebookVideoUrl = (videoElement: HTMLVideoElement) => {
    const currentUrl = window.location.href;

    // First, try to extract video ID from URL parameters (for single video pages)
    const urlParams = new URLSearchParams(window.location.search);
    const videoIdFromUrl = urlParams.get("v");
    if (videoIdFromUrl) {
      return `https://www.facebook.com/watch/?v=${videoIdFromUrl}`;
    }

    // Try to find video ID in the current URL path
    const watchMatch = currentUrl.match(/\/watch\/\?v=(\d+)/);
    if (watchMatch && watchMatch[1]) {
      return `https://www.facebook.com/watch/?v=${watchMatch[1]}`;
    }

    // For feed videos, search the DOM context around this specific video element
    // Start from the video element and traverse up the DOM tree
    let container: HTMLElement | null = videoElement.parentElement;
    const maxDepth = 10; // Limit search depth to avoid going too far up
    let depth = 0;

    while (container && depth < maxDepth) {
      // Get the HTML content of this container
      const containerHtml = container.innerHTML || "";

      // Pattern 1: Find /watch?v= followed by digits in this container
      const watchPattern = /\/watch\/\?v=(\d+)/g;
      const matches: string[] = [];
      let match;

      while ((match = watchPattern.exec(containerHtml)) !== null) {
        const videoId = match[1];
        // Only add if it's a reasonable video ID (at least 10 digits)
        if (videoId && videoId.length >= 10) {
          matches.push(videoId);
        }
      }

      // If we found matches in this container, use the first one
      if (matches.length > 0) {
        // Remove duplicates and prefer longer IDs
        const uniqueMatches = Array.from(new Set(matches));
        const sortedMatches = uniqueMatches.sort((a, b) => b.length - a.length);
        return `https://www.facebook.com/watch/?v=${sortedMatches[0]}`;
      }

      // Pattern 2: Look for video ID in link hrefs within this container
      const links = container.querySelectorAll('a[href*="/watch"]');
      for (const link of Array.from(links)) {
        const href = link.getAttribute("href");
        if (href) {
          const linkMatch = href.match(/\/watch\/\?v=(\d+)/);
          if (linkMatch && linkMatch[1] && linkMatch[1].length >= 10) {
            return `https://www.facebook.com/watch/?v=${linkMatch[1]}`;
          }
        }
      }

      // Pattern 3: Look for video ID in data attributes and other attributes within this container
      const allElements = container.querySelectorAll("*");
      for (const elem of Array.from(allElements)) {
        // Check href attribute
        const href = elem.getAttribute("href");
        if (href) {
          const hrefMatch = href.match(/\/watch\/\?v=(\d+)/);
          if (hrefMatch && hrefMatch[1] && hrefMatch[1].length >= 10) {
            return `https://www.facebook.com/watch/?v=${hrefMatch[1]}`;
          }
        }
        // Check all attributes (including data attributes)
        for (const attr of Array.from(elem.attributes)) {
          if (attr.value && attr.name !== "class" && attr.name !== "id") {
            const attrMatch = attr.value.match(/\/watch\/\?v=(\d+)/);
            if (attrMatch && attrMatch[1] && attrMatch[1].length >= 10) {
              return `https://www.facebook.com/watch/?v=${attrMatch[1]}`;
            }
          }
        }
      }

      // Move up to parent container
      container = container.parentElement;
      depth++;
    }

    // Fallback: search the entire page if nothing found in the video's context
    const htmlContent = document.documentElement.innerHTML;
    const watchPattern = /\/watch\/\?v=(\d+)/g;
    const matches: string[] = [];
    let match;

    while ((match = watchPattern.exec(htmlContent)) !== null) {
      const videoId = match[1];
      if (videoId && videoId.length >= 10) {
        matches.push(videoId);
      }
    }

    if (matches.length > 0) {
      const uniqueMatches = Array.from(new Set(matches));
      const sortedMatches = uniqueMatches.sort((a, b) => b.length - a.length);
      return `https://www.facebook.com/watch/?v=${sortedMatches[0]}`;
    }

    // Final fallback: return current URL
    return currentUrl;
  };

  const fetchYouTubeData = async (videoUrl: string) => {
    const apiUrl = import.meta.env.VITE_WEB_API_URL;
    if (!apiUrl) {
      setError("VITE_WEB_API_URL is not configured");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/crawl/youtube`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: videoUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error || `HTTP error! status: ${response.status}`
        );
      }

      const data: YouTubeData = await response.json();
      if (data.status === "ok") {
        setYoutubeData(data);
        setFacebookData(null);
        setTikTokData(null);
        setShowDropdown(true);
      } else {
        throw new Error("Failed to fetch video data");
      }
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch video data";
      setError(errorMessage);
      console.error("Error fetching YouTube data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchFacebookData = async (videoUrl: string) => {
    const apiUrl = import.meta.env.VITE_WEB_API_URL;
    if (!apiUrl) {
      setError("VITE_WEB_API_URL is not configured");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/crawl/facebook`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: videoUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error || `HTTP error! status: ${response.status}`
        );
      }

      const data: FacebookData = await response.json();
      setFacebookData(data);
      setYoutubeData(null);
      setTikTokData(null);
      setShowDropdown(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch video data";
      setError(errorMessage);
      console.error("Error fetching Facebook data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const fetchTikTokData = async (videoUrl: string) => {
    const apiUrl = import.meta.env.VITE_WEB_API_URL;
    if (!apiUrl) {
      setError("VITE_WEB_API_URL is not configured");
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const response = await fetch(`${apiUrl}/crawl/tiktok`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: videoUrl }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error || `HTTP error! status: ${response.status}`
        );
      }

      const data: TikTokData = await response.json();
      setTikTokData(data);
      setYoutubeData(null);
      setFacebookData(null);
      setShowDropdown(true);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to fetch video data";
      setError(errorMessage);
      console.error("Error fetching TikTok data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async () => {
    if (isYouTube()) {
      const videoUrl = getYouTubeVideoUrl();
      if (videoUrl) {
        await fetchYouTubeData(videoUrl);
      } else {
        setError("Could not extract YouTube video URL");
      }
      return;
    }

    if (isFacebook()) {
      const videoUrl = getFacebookVideoUrl(video);
      if (videoUrl) {
        await fetchFacebookData(videoUrl);
      } else {
        setError("Could not extract Facebook video URL");
      }
      return;
    }

    if (isTikTok()) {
      const videoUrl = getTikTokVideoUrl(video);
      console.log("TikTok URL extraction:", {
        currentUrl: window.location.href,
        pathname: window.location.pathname,
        extractedUrl: videoUrl
      });
      if (videoUrl) {
        await fetchTikTokData(videoUrl);
      } else {
        setError("Could not extract TikTok video URL. Please make sure you're on a TikTok video page.");
      }
      return;
    }

    // Original download logic for non-YouTube/Facebook videos
    try {
      const videoSrc = video.src || video.currentSrc;

      if (!videoSrc) {
        console.error("No video source found");
        return;
      }

      // Check if videoSrc is already a blob URL - if so, try to get original source
      if (videoSrc.startsWith('blob:')) {
        const originalSource = blobUrlToSource.get(videoSrc);
        if (originalSource) {
          // Send directly to desktop app via background script
          chrome.runtime.sendMessage({
            type: 'DOWNLOAD_VIDEO',
            url: originalSource,
            title: null
          });
          return;
        }
      }

      // IMPORTANT: Send directly to desktop app instead of creating blob URL download
      // This prevents Chrome's download dialog from appearing
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_VIDEO',
        url: videoSrc,
        title: null
      });
    } catch (error) {
      console.error("Error downloading video:", error);
      // If sending message fails, show error
      setError("Failed to send download to desktop app");
    }
  };

  const handleDownloadSelection = async (url: string, label: string) => {
    try {
      // IMPORTANT: Send directly to desktop app instead of creating blob URL download
      // This prevents Chrome's download dialog from appearing
      const title = youtubeData?.title || facebookData?.title || tiktokData?.title || "video";
      
      // For TikTok, include tokens if available
      const cookies = tiktokData?.tokens ? {
        msToken: tiktokData.tokens.msToken || null,
        ttChainToken: tiktokData.tokens.ttChainToken || null,
      } : null;
      
      // For YouTube, include audio URL if available
      const audioUrl = youtubeData?.audio?.url || null;
      
      chrome.runtime.sendMessage({
        type: 'DOWNLOAD_VIDEO',
        url: url,
        title: `${title}-${label}`,
        audioUrl: audioUrl,
        cookies: cookies
      }, (response) => {
        if (chrome.runtime.lastError) {
          console.error("Error sending download:", chrome.runtime.lastError);
          setError("Failed to send download to desktop app");
        } else if (response && !response.success) {
          setError(response.error || "Failed to download file");
        } else {
          setShowDropdown(false);
        }
      });
    } catch (error) {
      console.error("Error downloading:", error);
      setError("Failed to download file");
    }
  };

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(event.target as Node) &&
        buttonRef.current &&
        !buttonRef.current.contains(event.target as Node)
      ) {
        setShowDropdown(false);
      }
    };

    if (showDropdown) {
      document.addEventListener("mousedown", handleClickOutside);
      return () => {
        document.removeEventListener("mousedown", handleClickOutside);
      };
    }
  }, [showDropdown]);

  if (!isVisible) return null;

  return (
    <>
      <div
        ref={buttonRef}
        className="flux-download-button"
        style={{
          position: "fixed",
          top: `${position.top + 10}px`,
          left: `${position.left + 10}px`,
        }}
      >
        <button
          onClick={handleDownload}
          className="flux-download-btn"
          title="Download Video"
          disabled={isLoading}
        >
          {isLoading ? (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="flux-spinner"
            >
              <path d="M21 12a9 9 0 1 1-6.219-8.56" />
            </svg>
          ) : (
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
          )}
        </button>
        <button
          onClick={() => setIsVisible(false)}
          className="flux-cancel-btn"
          title="Close"
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="18" y1="6" x2="6" y2="18" />
            <line x1="6" y1="6" x2="18" y2="18" />
          </svg>
        </button>
      </div>

      {showDropdown && (
        <div
          ref={dropdownRef}
          className="flux-dropdown"
          style={{
            position: "fixed",
            top: `${position.top + 50}px`,
            left: `${position.left + 10}px`,
          }}
        >
          <div className="flux-dropdown-header">
            <h3 className="flux-dropdown-title">
              {youtubeData?.title || facebookData?.title || tiktokData?.title || "Select Quality"}
            </h3>
            <button
              onClick={() => setShowDropdown(false)}
              className="flux-dropdown-close"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
              </svg>
            </button>
          </div>
          {error && <div className="flux-dropdown-error">{error}</div>}
          <div className="flux-dropdown-content">
            {/* YouTube resolutions */}
            {youtubeData?.resolutions.map((resolution, index) => (
              <button
                key={`yt-${index}`}
                onClick={() =>
                  handleDownloadSelection(
                    resolution.url,
                    resolution.qualityLabel
                  )
                }
                className="flux-dropdown-item"
              >
                <span className="flux-dropdown-item-label">
                  {resolution.qualityLabel}
                </span>
                <span className="flux-dropdown-item-details">
                  {resolution.width}x{resolution.height}
                </span>
              </button>
            ))}
            {/* Facebook resolutions */}
            {facebookData?.resolutions.map((resolution, index) => (
              <button
                key={`fb-${index}`}
                onClick={() =>
                  handleDownloadSelection(resolution.url, resolution.quality)
                }
                className="flux-dropdown-item"
              >
                <span className="flux-dropdown-item-label">
                  {resolution.quality}
                </span>
                <span className="flux-dropdown-item-details">
                  {resolution.width}x{resolution.height}
                  {resolution.format && ` • ${resolution.format.toUpperCase()}`}
                </span>
              </button>
            ))}
            {/* TikTok resolutions */}
            {tiktokData?.resolutions.map((resolution, index) => (
              <button
                key={`tt-${index}`}
                onClick={() =>
                  handleDownloadSelection(resolution.url, resolution.qualityLabel)
                }
                className="flux-dropdown-item"
              >
                <span className="flux-dropdown-item-label">
                  {resolution.qualityLabel}
                </span>
                <span className="flux-dropdown-item-details">
                  {resolution.width}x{resolution.height}
                  {resolution.codec && ` • ${resolution.codec.toUpperCase()}`}
                  {resolution.bitrate && ` • ${Math.round(resolution.bitrate / 1000)}kbps`}
                </span>
              </button>
            ))}
            {/* YouTube audio */}
            {youtubeData?.audio && (
              <button
                onClick={() =>
                  handleDownloadSelection(youtubeData.audio.url, "Audio")
                }
                className="flux-dropdown-item flux-dropdown-item-audio"
              >
                <span className="flux-dropdown-item-label">Audio</span>
                <span className="flux-dropdown-item-details">
                  {youtubeData.audio.audioQuality || "High Quality"}
                </span>
              </button>
            )}
          </div>
        </div>
      )}
    </>
  );
}

function App() {
  const [videos, setVideos] = useState<VideoElement[]>([]);
  const videosRef = useRef<Set<HTMLVideoElement>>(new Set());

  useEffect(() => {
    const findVideos = () => {
      const videoElements = Array.from(document.querySelectorAll("video"));

      // Filter out videos we've already processed
      const newVideos = videoElements.filter(
        (video) => !videosRef.current.has(video)
      );

      // Remove videos that no longer exist in the DOM
      videosRef.current.forEach((video) => {
        if (!document.contains(video)) {
          videosRef.current.delete(video);
        }
      });

      // Add new videos
      newVideos.forEach((video) => {
        videosRef.current.add(video);
      });

      // Update state with all current videos
      const videoList: VideoElement[] = Array.from(videosRef.current).map(
        (video, index) => ({
          element: video,
          id: `flux-video-${video.src || index}-${video.offsetTop}`,
        })
      );

      setVideos(videoList);
    };

    // Initial find
    findVideos();

    // Watch for new videos added to the DOM
    const observer = new MutationObserver(() => {
      findVideos();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    return () => {
      observer.disconnect();
    };
  }, []);

  return (
    <>
      {videos.map((video) => (
        <DownloadVideoButton key={video.id} video={video.element} />
      ))}
    </>
  );
}

export default App;
