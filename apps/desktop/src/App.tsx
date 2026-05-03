import { useEffect, useState } from "react";
import { ScrollArea, ScrollBar } from "@workspace/ui/components/scroll-area";
import { TooltipProvider } from "@workspace/ui/components/tooltip";
import { Button } from "@workspace/ui/components/button";
import { Plus, Download, Trash2, ExternalLink } from "lucide-react";
import {
  YoutubeResults,
  FacebookResults,
  TikTokResults,
} from "@/pages";

interface DownloadHistoryItem {
  id: string;
  fileName: string;
  size: string;
  status: string;
  timeLeft: string;
  transferRate: string;
  lastTry: string;
  description: string;
  url: string;
  platform: "youtube" | "facebook" | "tiktok";
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
  const [history, setHistory] = useState<DownloadHistoryItem[]>([]);
  const [crawlData, setCrawlData] = useState<CrawlResult | null>(null);
  const [isCrawling, setIsCrawling] = useState(false);
  const [crawlError, setCrawlError] = useState<string | null>(null);
  const [detectedType, setDetectedType] = useState<"youtube" | "facebook" | "tiktok" | null>(null);
  const [customDownloadPath, setCustomDownloadPath] = useState<string | null>(null);

  // Load history on mount
  useEffect(() => {
    if (window?.ipcRenderer) {
      window.ipcRenderer.invoke("load-history").then((data) => {
        if (data) setHistory(data);
      });

      // Listen for Add URL confirmation (Download Now)
      window.ipcRenderer.on("start-crawl-request", (_event, data) => {
        if (typeof data === "string") {
          handleCrawl(data);
        } else {
          setCustomDownloadPath(data.downloadPath || null);
          handleCrawl(data.url, data.headers, data.body, data.pageHtml);
        }
      });

      // Listen for Save for Later
      window.ipcRenderer.on("save-for-later-request", (_event, data) => {
        const platform = detectPlatform(data.url);
        const newItem: DownloadHistoryItem = {
          id: Date.now().toString(),
          fileName: data.url,
          size: "--",
          status: "Saved",
          timeLeft: "--:--",
          transferRate: "--",
          lastTry: new Date().toLocaleString(),
          description: platformLabel(platform),
          url: data.url,
          platform: platform || "youtube"
        };
        setHistory(prev => [newItem, ...prev]);
      });
    }
  }, []);

  // Save history whenever it changes
  useEffect(() => {
    if (window?.ipcRenderer && history.length > 0) {
      window.ipcRenderer.invoke("save-history", history);
    }
  }, [history]);

  const detectPlatform = (url: string) => {
    if (url.includes("youtube.com") || url.includes("youtu.be")) return "youtube";
    if (url.includes("facebook.com") || url.includes("fb.watch")) return "facebook";
    if (url.includes("tiktok.com")) return "tiktok";
    return null;
  };

  const handleCrawl = async (url: string, headers?: any, body?: any, pageHtml?: any) => {
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
            data = await window.ipcRenderer.invoke("crawl-youtube", { videoId, headers, body, pageHtml });
          }
        } else if (platform === "facebook") {
          data = await window.ipcRenderer.invoke("crawl-facebook", { url, headers, body });
        } else if (platform === "tiktok") {
          data = await window.ipcRenderer.invoke("crawl-tiktok", { url, headers, body });
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
      downloadPath: customDownloadPath,
    });

    // Add to history
    const newItem: DownloadHistoryItem = {
      id: Date.now().toString(),
      fileName: title || "Unknown Video",
      size: "Calculating...",
      status: "Starting",
      timeLeft: "--:--",
      transferRate: "0 KB/s",
      lastTry: new Date().toLocaleString(),
      description: platformLabel(detectedType),
      url: url,
      platform: detectedType || "youtube"
    };

    setHistory(prev => [newItem, ...prev]);
    setCrawlData(null); // Clear results after starting download
    setCustomDownloadPath(null); // Reset for next download
  };

  const platformLabel = (type: string | null) => {
    if (type === "youtube") return "YouTube Video";
    if (type === "facebook") return "Facebook Video";
    if (type === "tiktok") return "TikTok Video";
    return "Video";
  };

  const openAddUrl = () => {
    if (window?.ipcRenderer) {
      window.ipcRenderer.invoke("open-add-url-window");
    }
  };

  const deleteHistoryItem = (id: string) => {
    setHistory(prev => prev.filter(item => item.id !== id));
  };

  return (
    <TooltipProvider>
      <div className="flex flex-col h-screen overflow-hidden bg-background text-foreground">
        {/* Custom Header */}
        <header className="drag-css flex h-[32px] shrink-0 items-center justify-between px-4 bg-background">
          <div className="flex items-center gap-2">
            <img src="/icons/png/32x32.png" alt="Logo" className="w-4 h-4" />
            <span className="text-xs font-semibold tracking-tight">DLX - Nextgen Downloader</span>
          </div>
          <div className="flex items-center gap-2 no-drag-css pr-32">
          </div>
        </header>

        {/* Toolbar */}
        <div className="flex items-center gap-4 px-4 py-2 bg-background border-b border-border/20">
          <button 
            className="flex flex-col items-center gap-1 group no-drag-css" 
            onClick={openAddUrl}
          >
            <div className="w-10 h-10 flex items-center justify-center border border-border/50 rounded-lg group-hover:bg-muted/50 transition-colors">
              <Plus className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground group-hover:text-foreground transition-colors">Add URL</span>
          </button>

          <button 
            className="flex flex-col items-center gap-1 group no-drag-css opacity-40 cursor-not-allowed" 
            disabled
          >
            <div className="w-10 h-10 flex items-center justify-center border border-border/50 rounded-lg transition-colors">
              <Download className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground">Resume</span>
          </button>

          <button 
            className="flex flex-col items-center gap-1 group no-drag-css opacity-40 cursor-not-allowed" 
            disabled
          >
            <div className="w-10 h-10 flex items-center justify-center border border-border/50 rounded-lg transition-colors">
              <Trash2 className="w-5 h-5" />
            </div>
            <span className="text-[11px] font-semibold text-muted-foreground">Stop</span>
          </button>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {/* Crawl Results (Overlay/Modal style) */}
          {isCrawling && (
            <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
              <div className="flex flex-col items-center gap-4">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
                <p className="text-sm font-medium">Analyzing video source...</p>
              </div>
            </div>
          )}

          {crawlData && (
            <div className="absolute inset-0 z-50 bg-background overflow-auto p-6 sm:p-12">
              <div className="max-w-4xl mx-auto w-full space-y-6">
                <div className="flex items-center justify-between">
                  <h2 className="text-2xl font-bold">Download Options</h2>
                  <Button variant="ghost" size="sm" onClick={() => setCrawlData(null)}>Close</Button>
                </div>
                
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
            </div>
          )}

          {crawlError && (
            <div className="absolute top-20 left-1/2 -translate-x-1/2 z-50 w-full max-w-md p-4 bg-destructive text-destructive-foreground rounded-lg shadow-xl flex items-center justify-between">
              <p className="text-sm">{crawlError}</p>
              <Button variant="ghost" size="sm" className="text-white hover:bg-white/20" onClick={() => setCrawlError(null)}>Dismiss</Button>
            </div>
          )}

          {/* Main Table */}
          <ScrollArea className="flex-1">
            <div className="min-w-[1000px]">
              <table className="w-full text-left border-collapse">
                <thead className="sticky top-0 bg-muted/50 backdrop-blur-md z-10">
                  <tr className="border-b border-border/50">
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">File Name</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Size</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Status</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Time Left</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Transfer Rate</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Last Try Date</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground">Description</th>
                    <th className="px-4 py-2 text-xs font-medium text-muted-foreground w-20">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/30">
                  {history.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="px-4 py-20 text-center text-muted-foreground italic">
                        No download history found. Click "Add URL" to start.
                      </td>
                    </tr>
                  ) : (
                    history.map((item) => (
                      <tr key={item.id} className="hover:bg-muted/30 transition-colors group">
                        <td className="px-4 py-2 text-sm font-medium truncate max-w-[300px]" title={item.fileName}>
                          {item.fileName}
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">{item.size}</td>
                        <td className="px-4 py-2 text-sm">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded text-[10px] font-bold ${item.status === "Saved" ? "bg-amber-500/10 text-amber-500" : "bg-primary/10 text-primary"}`}>
                            {item.status}
                          </span>
                        </td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">{item.timeLeft}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground">{item.transferRate}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground whitespace-nowrap">{item.lastTry}</td>
                        <td className="px-4 py-2 text-sm text-muted-foreground italic">{item.description}</td>
                        <td className="px-4 py-2 text-sm">
                          <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive" onClick={() => deleteHistoryItem(item.id)}>
                              <Trash2 className="w-3.5 h-3.5" />
                            </Button>
                            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => window.open(item.url, "_blank")}>
                              <ExternalLink className="w-3.5 h-3.5" />
                            </Button>
                            {item.status === "Saved" && (
                              <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" onClick={() => handleCrawl(item.url)}>
                                <Download className="w-3.5 h-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
            <ScrollBar orientation="horizontal" />
          </ScrollArea>
        </div>
      </div>
    </TooltipProvider>
  );
}

export default App;
