import { useEffect, useState } from "react";
import { ScrollArea } from "@workspace/ui/components/scroll-area";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import {
  CrawlerPage,
  FacebookResults,
  TikTokResults,
  YoutubeResults,
} from "@/pages";

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

function App() {
  const [searchValue, setSearchValue] = useState("");
  const [crawlData, setCrawlData] = useState<CrawlResult | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [detectedType, setDetectedType] = useState<"youtube" | "facebook" | "tiktok" | null>(null);

  const detectPlatform = (url: string) => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    if (url.includes("facebook.com") || url.includes("fb.watch")) return "facebook";
    if (url.includes("tiktok.com")) return "tiktok";
    return null;
  };

  const handleCrawl = async (url: string) => {
    const platform = detectPlatform(url);
    if (!platform) {
      setCrawlError("Unsupported URL. Please provide a YouTube, Facebook, or TikTok link.");
      return;
    }

    setDetectedType(platform);
    setIsCrawling(true);
    setCrawlError(null);
    setCrawlData(null);

    try {
      let data: any = null;

      if (window?.ipcRenderer) {
        if (platform === "youtube") {
          const videoId = url.match(/([\w-]{11})/)?.[1];
          if (videoId) {
            data = await window.ipcRenderer.invoke("crawl-youtube", videoId);
          }
        } else if (platform === "facebook") {
          data = await window.ipcRenderer.invoke("crawl-facebook", url);
        } else if (platform === "tiktok") {
          data = await window.ipcRenderer.invoke("crawl-tiktok", url);
        }

        if (data) {
          setCrawlData(data);
          return;
        }
      }

      // Fallback to Web API
      const apiUrl = import.meta.env.VITE_WEB_API_URL;
      if (!apiUrl) throw new Error("Local scraper failed and API URL is not defined");

      const endpoint = `/crawl/${platform}`;
      const response = await fetch(`${apiUrl}${endpoint}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData?.error || `Error ${response.status}`);
      }

      data = await response.json();
      setCrawlData(data);
    } catch (error) {
      setCrawlError(error instanceof Error ? error.message : "Failed to crawl video");
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
      window.open(url, "_blank");
      return;
    }

    window.ipcRenderer.invoke("start-download", {
      url,
      title: title || null,
      cookies: cookies || null,
      audioUrl: audioUrl || null,
    });
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
        {/* Custom Header */}
        <header className="drag-css flex h-[32px] shrink-0 items-center justify-between px-4 bg-background">
          <div className="flex items-center gap-2">
            <img src="/icons/png/32x32.png" alt="Logo" className="w-5 h-5" />
            <span className="text-sm font-semibold tracking-tight">DLX - Nextgen Downloader</span>
          </div>
          
          <div className="flex items-center gap-2 no-drag-css pr-32">
          </div>
        </header>

        <ScrollArea className="flex-1 min-h-0">
          <div className="flex flex-col items-center max-w-4xl mx-auto w-full p-6 sm:p-12">
            <div className="w-full space-y-8">
              <div className="text-center space-y-2">
                <h1 className="text-3xl font-bold tracking-tight">Universal Downloader</h1>
                <p className="text-muted-foreground">Download videos from YouTube, Facebook, and TikTok instantly.</p>
              </div>

              <div className="bg-card border rounded-xl p-1 shadow-sm">
                <CrawlerPage
                  searchValue={searchValue}
                  onSearchValueChange={setSearchValue}
                  onCrawl={handleCrawl}
                />
              </div>

              {crawlError && (
                <div className="p-4 bg-destructive/10 border border-destructive/20 rounded-lg text-destructive text-sm">
                  {crawlError}
                </div>
              )}

              <div className="mt-8">
                {isCrawling && (
                  <div className="flex flex-col items-center justify-center p-12 space-y-4">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-sm text-muted-foreground">Crawling video information...</p>
                  </div>
                )}

                {crawlData && !isCrawling && (
                  <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
                    {detectedType === "youtube" && (
                      <YoutubeResults
                        data={crawlData as YoutubeCrawlResult}
                        isLoading={false}
                        onDownload={handleDownload}
                      />
                    )}
                    {detectedType === "facebook" && (
                      <FacebookResults
                        data={crawlData as FacebookCrawlResult}
                        isLoading={false}
                        onDownload={handleDownload}
                      />
                    )}
                    {detectedType === "tiktok" && (
                      <TikTokResults
                        data={crawlData as TikTokCrawlResult}
                        isLoading={false}
                        onDownload={handleDownload}
                      />
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </ScrollArea>
      </div>
    </TooltipProvider>
  );
}

export default App;
