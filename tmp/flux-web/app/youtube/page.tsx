"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Image as ImageIcon,
  Music,
  Search,
  Video,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

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

interface CrawlResult {
  status: string;
  videoId: string;
  title: string | null;
  thumbnail: string | null;
  resolutions: Resolution[];
  audio: Audio | null;
}

export default function YoutubePage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<CrawlResult | null>(null);
  const [imageError, setImageError] = useState(false);
  const [previewResolution, setPreviewResolution] = useState<Resolution | null>(
    null
  );
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);

  const hasResolutions = (videoData?.resolutions?.length ?? 0) > 0;

  const handleCrawl = async () => {
    if (!url.trim() || isLoading) return;

    setIsLoading(true);
    setError(null);
    setVideoData(null);
    setImageError(false);

    try {
      const response = await fetch("/api/crawl/youtube", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const payload = await response.json();

      if (!response.ok) {
        throw new Error(payload?.error ?? "Unable to crawl video.");
      }

      setVideoData(payload);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = (resolution: Resolution) => {
    const performDownload = () => {
      const anchor = document.createElement("a");
      anchor.href = resolution.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    };

    performDownload();
  };

  const handleAudioDownload = (audio: Audio) => {
    const performDownload = () => {
      const anchor = document.createElement("a");
      anchor.href = audio.url;
      anchor.target = "_blank";
      anchor.rel = "noopener noreferrer";
      document.body.appendChild(anchor);
      anchor.click();
      document.body.removeChild(anchor);
    };

    performDownload();
  };

  const handlePreview = (resolution: Resolution) => {
    setPreviewResolution(resolution);
    setIsPreviewOpen(true);
  };

  return (
    <>
      <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-12 overflow-x-hidden">
        <div className="max-w-4xl mx-auto w-full">
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50 mb-8">
            YouTube Video Downloader
          </h1>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm overflow-hidden space-y-4">
            <div className="bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md p-4 text-sm text-red-900 dark:text-red-100 space-y-2">
              <p className="font-medium">How to copy the YouTube video URL:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>Open YouTube and navigate to the video you want.</li>
                <li>Click Share → Copy link (or copy the browser URL).</li>
                <li>
                  Ensure the link looks like{" "}
                  <span className="font-mono text-xs break-all">
                    https://www.youtube.com/watch?v=VIDEO_ID
                  </span>
                  .
                </li>
                <li>Paste it below and click Crawl.</li>
              </ol>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Enter YouTube URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10 h-12 text-base w-full"
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      handleCrawl();
                    }
                  }}
                />
              </div>
              <Button
                onClick={handleCrawl}
                size="lg"
                className="h-12 px-8 shrink-0"
                disabled={!url.trim() || isLoading}
              >
                {isLoading ? "Crawling..." : "Crawl"}
              </Button>
            </div>
            {error && (
              <div className="mt-4 p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-md overflow-hidden">
                <p className="text-sm text-red-600 dark:text-red-400 wrap-break-word">
                  {error}
                </p>
              </div>
            )}
          </div>

          {isLoading && (
            <div className="mt-6 w-full overflow-hidden">
              <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <CardHeader className="overflow-hidden">
                  <div className="flex items-start gap-4 min-w-0">
                    <Skeleton className="w-32 h-20 rounded-lg shrink-0" />
                    <div className="flex-1 min-w-0 overflow-hidden space-y-2">
                      <Skeleton className="h-6 w-full max-w-md" />
                      <Skeleton className="h-4 w-32" />
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-hidden">
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <Skeleton className="h-4 w-4 shrink-0" />
                      <Skeleton className="h-4 w-40" />
                    </div>
                    <div className="grid gap-3 w-full">
                      {[1, 2, 3].map((index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 gap-3 min-w-0 overflow-hidden"
                        >
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              <Skeleton className="h-5 w-16 rounded-full" />
                              <Skeleton className="h-4 w-20" />
                              <Skeleton className="h-4 w-12" />
                            </div>
                          </div>
                          <Skeleton className="h-9 w-24 shrink-0" />
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {videoData && !isLoading && (
            <div className="mt-6 w-full overflow-hidden space-y-4">
              <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <CardHeader className="overflow-hidden">
                  <div className="flex items-start gap-4 min-w-0">
                    {videoData.thumbnail && !imageError ? (
                      <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0">
                        <Image
                          src={videoData.thumbnail}
                          alt={videoData.title ?? "Video thumbnail"}
                          width={128}
                          height={80}
                          className="w-full h-full object-cover"
                          unoptimized
                          onError={() => setImageError(true)}
                        />
                      </div>
                    ) : (
                      <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-zinc-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <CardTitle className="text-lg font-semibold text-black dark:text-zinc-50 mb-2 line-clamp-2 wrap-break-word">
                        {videoData.title ?? "Untitled YouTube Video"}
                      </CardTitle>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 wrap-break-word">
                        Video ID:{" "}
                        <span className="font-mono text-xs break-all">
                          {videoData.videoId}
                        </span>
                      </p>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400">
                        {videoData.resolutions.length} quality option
                        {videoData.resolutions.length === 1 ? "" : "s"}{" "}
                        available
                      </p>
                    </div>
                  </div>
                </CardHeader>
                <CardContent className="overflow-hidden">
                  <div className="space-y-3">
                    <h3 className="text-sm font-medium text-black dark:text-zinc-50 flex items-center gap-2">
                      <Video className="h-4 w-4 shrink-0" />
                      Available Resolutions
                    </h3>
                    {hasResolutions ? (
                      <div className="grid gap-3 w-full">
                        {videoData.resolutions.map((resolution, index) => {
                          const mimeLabel =
                            resolution.mimeType?.split(";")[0] ?? "";
                          const formatLabel =
                            mimeLabel.split("/")[1]?.toUpperCase() ??
                            mimeLabel.toUpperCase();

                          return (
                            <div
                              key={`${resolution.qualityLabel}-${resolution.width}-${resolution.mimeType}-${index}`}
                              className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors gap-3 min-w-0 overflow-hidden"
                            >
                              <div className="flex-1 min-w-0 overflow-hidden">
                                <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                                  <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-200 shrink-0">
                                    {resolution.qualityLabel}
                                  </span>
                                  <span className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                    {resolution.width} × {resolution.height}
                                  </span>
                                  <span className="text-sm text-zinc-500 dark:text-zinc-500 whitespace-nowrap">
                                    {formatLabel}
                                  </span>
                                </div>
                              </div>
                              <div className="flex gap-2">
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => handlePreview(resolution)}
                                >
                                  <Video className="h-4 w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">
                                    Preview
                                  </span>
                                </Button>
                                <Button
                                  size="sm"
                                  onClick={() => handleDownload(resolution)}
                                >
                                  <Download className="h-4 w-4 sm:mr-2" />
                                  <span className="hidden sm:inline">
                                    Download
                                  </span>
                                </Button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    ) : (
                      <div className="rounded-md border border-zinc-200 bg-zinc-50 p-4 text-sm text-zinc-600 dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-300">
                        No downloadable resolutions were found for this video.
                      </div>
                    )}
                  </div>
                </CardContent>
              </Card>

              {videoData.audio && (
                <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                  <CardContent className="pt-6 overflow-hidden">
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-black dark:text-zinc-50 flex items-center gap-2">
                        <Music className="h-4 w-4 shrink-0" />
                        Audio Only
                      </h3>
                      <div className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors gap-3 min-w-0 overflow-hidden">
                        <div className="flex-1 min-w-0 overflow-hidden">
                          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                            <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-200 shrink-0">
                              {videoData.audio.audioQuality || "Best Quality"}
                            </span>
                            <span className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                              {videoData.audio.mimeType
                                ?.split(";")[0]
                                ?.split("/")[1]
                                ?.toUpperCase() || "AUDIO"}
                            </span>
                            {videoData.audio.bitrate && (
                              <span className="text-sm text-zinc-500 dark:text-zinc-500 whitespace-nowrap">
                                {Math.round(videoData.audio.bitrate / 1000)}{" "}
                                kbps
                              </span>
                            )}
                            {videoData.audio.audioSampleRate && (
                              <span className="text-sm text-zinc-500 dark:text-zinc-500 whitespace-nowrap">
                                {parseInt(videoData.audio.audioSampleRate) /
                                  1000}{" "}
                                kHz
                              </span>
                            )}
                          </div>
                        </div>
                        <Button
                          size="sm"
                          onClick={() => handleAudioDownload(videoData.audio!)}
                        >
                          <Download className="h-4 w-4 sm:mr-2" />
                          <span className="hidden sm:inline">Download</span>
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>
          )}
        </div>
      </main>
      <Dialog
        open={isPreviewOpen}
        onOpenChange={(open) => {
          setIsPreviewOpen(open);
          if (!open) {
            setPreviewResolution(null);
          }
        }}
      >
        <DialogContent className="max-w-3xl">
          {previewResolution && videoData && (
            <>
              <DialogHeader>
                <DialogTitle className="text-lg font-semibold">
                  {videoData.title ?? "YouTube Video Preview"}
                </DialogTitle>
                <DialogDescription className="text-sm text-zinc-600 dark:text-zinc-400">
                  {previewResolution.qualityLabel} • {previewResolution.width} ×{" "}
                  {previewResolution.height}
                </DialogDescription>
              </DialogHeader>
              <div className="space-y-4">
                <div className="aspect-video w-full overflow-hidden rounded-lg bg-black">
                  <video
                    key={previewResolution.url}
                    src={previewResolution.url}
                    controls
                    autoPlay
                    className="h-full w-full"
                  />
                </div>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <p className="text-sm text-zinc-600 dark:text-zinc-400">
                    Format:{" "}
                    <span className="font-mono">
                      {previewResolution.mimeType}
                    </span>
                  </p>
                  <Button onClick={() => handleDownload(previewResolution)}>
                    <Download className="h-4 w-4 sm:mr-2" />
                    <span className="hidden sm:inline">Download</span>
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
