import { useEffect, useMemo, useState } from "react";

import { AppSidebar } from "@/components/app-sidebar";
import { ModeToggle } from "@/components/mode-toggle";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Separator } from "@/components/ui/separator";
import {
  SidebarInset,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { contentMap, crawlerPages } from "@/constants/content";
import {
  CrawlerPage,
  FacebookPrivateVideo,
  FacebookResults,
  HomePage,
  SettingsPage,
  TikTokResults,
  YoutubeResults,
} from "@/pages";

type AppSettings = {
  downloadLocation: string;
};

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

interface YoutubeCrawlResult {
  status: string;
  videoId: string;
  title: string | null;
  thumbnail: string | null;
  resolutions: Resolution[];
  audio: Audio | null;
}

interface FacebookResolution {
  url: string;
  width: number;
  height: number;
  quality: string;
  format: string;
}

interface FacebookCrawlResult {
  title: string;
  thumbnail: string;
  resolutions: FacebookResolution[];
}

interface TikTokResolution {
  qualityType: string | null;
  qualityLabel: string | null;
  bitrate: number | null;
  codec: string | null;
  width: number | null;
  height: number | null;
  url: string | null;
}

interface TikTokCrawlResult {
  status?: string;
  url?: string;
  title: string | null;
  thumbnail: string | null;
  tokens?: {
    msToken: string | null;
    ttChainToken: string | null;
  };
  resolutions: TikTokResolution[];
}

type CrawlResult = YoutubeCrawlResult | FacebookCrawlResult | TikTokCrawlResult;

const defaultSettings: AppSettings = {
  downloadLocation: "Downloads",
};

function App() {
  const [activeProject, setActiveProject] = useState("home");
  const [searchValue, setSearchValue] = useState("");
  const [pageSource, setPageSource] = useState("");
  const [settings, setSettings] = useState<AppSettings>(defaultSettings);
  const [settingsLoaded, setSettingsLoaded] = useState(false);
  const [crawlData, setCrawlData] = useState<CrawlResult | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const content = useMemo(
    () => contentMap[activeProject] ?? contentMap.home,
    [activeProject]
  );
  const isHome = activeProject === "home";
  const hasCrawler = crawlerPages.includes(activeProject);
  const isSettings = activeProject === "settings";

  const handleCrawl = async (url: string) => {
    const apiUrl = import.meta.env.VITE_WEB_API_URL;
    if (!apiUrl) {
      setCrawlError("VITE_WEB_API_URL is not defined");
      return;
    }

    setIsCrawling(true);
    setCrawlError(null);
    setCrawlData(null);

    try {
      let endpoint = "";
      let body: { url?: string; html?: string } = {};

      if (activeProject === "youtube") {
        endpoint = "/crawl/youtube";
        body = { url };
      } else if (activeProject === "facebook") {
        endpoint = "/crawl/facebook";
        body = { url };
      } else if (activeProject === "tiktok") {
        endpoint = "/crawl/tiktok";
        body = { url };
      } else {
        // TODO: Implement other platforms
        console.log(`Crawling ${activeProject}:`, url);
        setIsCrawling(false);
        return;
      }

      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      setCrawlData(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : `Failed to crawl ${activeProject} video`;
      setCrawlError(errorMessage);
      console.error(`Failed to crawl ${activeProject} video:`, error);
    } finally {
      setIsCrawling(false);
    }
  };

  const handleAnalyzePageSource = async (html: string) => {
    const apiUrl = import.meta.env.VITE_WEB_API_URL;
    if (!apiUrl) {
      setCrawlError("VITE_WEB_API_URL is not defined");
      return;
    }

    setIsCrawling(true);
    setCrawlError(null);
    setCrawlData(null);

    try {
      const response = await fetch(`${apiUrl}/crawl/facebook-private-video`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ html }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData?.error || `HTTP error! status: ${response.status}`
        );
      }

      const data = await response.json();
      setCrawlData(data);
    } catch (error) {
      const errorMessage =
        error instanceof Error
          ? error.message
          : "Failed to analyze page source";
      setCrawlError(errorMessage);
      console.error("Failed to analyze page source:", error);
    } finally {
      setIsCrawling(false);
    }
  };

  const handleDownload = (
    url: string,
    title?: string | null,
    cookies?: { msToken?: string | null; ttChainToken?: string | null } | null,
    audioUrl?: string | null
  ) => {
    if (!window?.ipcRenderer) {
      // Fallback for web - open in new tab
      window.open(url, "_blank");
      return;
    }

    // Send download request to main process
    window.ipcRenderer.invoke("start-download", {
      url,
      title: title || null,
      cookies: cookies || null,
      audioUrl: audioUrl || null,
    });
  };

  useEffect(() => {
    setSearchValue("");
    setPageSource("");
    setCrawlData(null);
    setCrawlError(null);
  }, [activeProject]);
  useEffect(() => {
    if (!window?.ipcRenderer) {
      setSettingsLoaded(true);
      return;
    }

    let isCancelled = false;

    window.ipcRenderer
      .invoke("load-settings")
      .then((loaded) => {
        if (
          !isCancelled &&
          loaded &&
          typeof loaded.downloadLocation === "string"
        ) {
          setSettings({
            downloadLocation: loaded.downloadLocation,
          });
        }
      })
      .catch((error) => {
        console.error("Failed to load settings", error);
      })
      .finally(() => {
        if (!isCancelled) {
          setSettingsLoaded(true);
        }
      });

    return () => {
      isCancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!window?.ipcRenderer || !settingsLoaded) return;

    window.ipcRenderer
      .invoke("save-settings", settings)
      .catch((error) => console.error("Failed to save settings", error));
  }, [settings, settingsLoaded]);

  const handleSettingsChange = (newSettings: AppSettings) => {
    setSettings(newSettings);
  };

  return (
    <SidebarProvider>
      <AppSidebar
        activeProject={activeProject}
        onSelectProject={setActiveProject}
      />
      <SidebarInset className="flex flex-col h-screen overflow-hidden">
        <header className="drag-css flex h-16 shrink-0 items-center gap-2">
          <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4">
            <SidebarTrigger className="-ml-1 no-drag-css" />
            <Separator
              orientation="vertical"
              className="mr-1 sm:mr-2 data-[orientation=vertical]:h-4"
            />
            <div className="no-drag-css">
              <ModeToggle />
            </div>
          </div>
          <div className="ml-auto flex items-center gap-1 sm:gap-2 px-2 sm:px-4">
            <button
              aria-label="Minimize window"
              onClick={() => {
                if (window?.ipcRenderer) {
                  window.ipcRenderer.invoke("window-minimize");
                }
              }}
              className="no-drag-css flex size-7 sm:size-8 cursor-pointer items-center justify-center rounded bg-background text-sm font-semibold text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
            >
              —
            </button>
            <button
              aria-label="Maximize window"
              onClick={() => {
                if (window?.ipcRenderer) {
                  window.ipcRenderer.invoke("window-maximize");
                }
              }}
              className="no-drag-css flex size-7 sm:size-8 cursor-pointer items-center justify-center rounded bg-background text-sm font-semibold text-muted-foreground transition hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-ring"
            >
              ☐
            </button>
            <button
              aria-label="Close window"
              onClick={() => {
                if (window?.ipcRenderer) {
                  window.ipcRenderer.invoke("window-close");
                }
              }}
              className="no-drag-css flex size-8 sm:size-9 cursor-pointer items-center justify-center rounded bg-background text-lg sm:text-xl font-semibold text-muted-foreground transition hover:bg-destructive/10 hover:text-destructive focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 focus-visible:ring-destructive"
            >
              ×
            </button>
          </div>
        </header>
        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col gap-3 sm:gap-4 p-3 sm:p-4 pt-0 min-w-0">
            <div className="bg-muted/50 rounded-lg sm:rounded-xl p-4 sm:p-6 overflow-hidden min-w-0">
              <h2 className="text-xl sm:text-2xl font-semibold capitalize">
                {activeProject.replace(/-/g, " ")}
              </h2>
              <p className="mt-2 text-sm sm:text-base text-muted-foreground">
                {content}
              </p>
              {hasCrawler && (
                <>
                  {activeProject === "facebook-private-video" ? (
                    <FacebookPrivateVideo
                      pageSource={pageSource}
                      onPageSourceChange={setPageSource}
                      onAnalyze={handleAnalyzePageSource}
                      isLoading={isCrawling}
                      error={crawlError}
                    />
                  ) : (
                    <CrawlerPage
                      searchValue={searchValue}
                      onSearchValueChange={setSearchValue}
                      onCrawl={handleCrawl}
                    />
                  )}
                  {crawlError && activeProject !== "facebook-private-video" && (
                    <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md overflow-hidden">
                      <p className="text-xs sm:text-sm text-destructive break-words">
                        {crawlError}
                      </p>
                    </div>
                  )}
                  {activeProject === "youtube" && (
                    <YoutubeResults
                      data={crawlData as YoutubeCrawlResult | null}
                      isLoading={isCrawling}
                      onDownload={handleDownload}
                    />
                  )}
                  {(activeProject === "facebook" ||
                    activeProject === "facebook-private-video") && (
                    <FacebookResults
                      data={crawlData as FacebookCrawlResult | null}
                      isLoading={isCrawling}
                      onDownload={handleDownload}
                    />
                  )}
                  {activeProject === "tiktok" && (
                    <TikTokResults
                      data={crawlData as TikTokCrawlResult | null}
                      isLoading={isCrawling}
                      onDownload={handleDownload}
                    />
                  )}
                </>
              )}
              {isHome && <HomePage />}
              {isSettings && (
                <SettingsPage
                  settings={settings}
                  onSettingsChange={handleSettingsChange}
                />
              )}
            </div>
          </div>
        </ScrollArea>
      </SidebarInset>
    </SidebarProvider>
  );
}

export default App;
