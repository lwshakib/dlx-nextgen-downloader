"use client";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Download,
  Image as ImageIcon,
  Loader2,
  Search,
  Video,
} from "lucide-react";
import Image from "next/image";
import { useState } from "react";

interface Resolution {
  url: string;
  width: number;
  height: number;
  quality: string;
  format: string;
}

interface VideoData {
  title: string;
  thumbnail: string;
  resolutions: Resolution[];
}

export default function FacebookPage() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<VideoData | null>(null);
  const [imageError, setImageError] = useState(false);
  const [downloadingId, setDownloadingId] = useState<number | null>(null);

  const handleCrawl = async () => {
    if (!url.trim()) return;

    setLoading(true);
    setError(null);
    setVideoData(null);
    setImageError(false);

    try {
      const response = await fetch("/api/crawl/facebook", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url: url.trim() }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Failed to crawl Facebook URL");
      }

      // Set video data to display
      setVideoData(data);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "An unexpected error occurred";
      setError(errorMessage);
      console.error("Error crawling Facebook URL:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleDownload = async (resolution: Resolution, index: number) => {
    setDownloadingId(index);

    try {
      // Use proxy API to avoid CORS issues
      const proxyUrl = `/api/download?url=${encodeURIComponent(
        resolution.url
      )}`;

      // Fetch the video file through our proxy
      const response = await fetch(proxyUrl);

      if (!response.ok) {
        throw new Error("Failed to download video");
      }

      // Get the blob
      const blob = await response.blob();

      // Create a download link
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;

      // Generate filename
      const sanitizedTitle =
        videoData?.title
          .replace(/[^a-z0-9]/gi, "_")
          .toLowerCase()
          .substring(0, 50) || "facebook_video";
      const filename = `${sanitizedTitle}_${resolution.quality}.${resolution.format}`;

      a.download = filename;
      document.body.appendChild(a);
      a.click();

      // Cleanup
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      const errorMessage =
        err instanceof Error ? err.message : "Failed to download video";
      setError(errorMessage);
      console.error("Error downloading video:", err);
    } finally {
      setDownloadingId(null);
    }
  };

  return (
    <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-12 overflow-x-hidden">
      <div className="max-w-4xl mx-auto w-full">
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50 mb-8">
            Facebook Video Downloader
          </h1>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm overflow-hidden space-y-4">
            <div className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-md p-4 text-sm text-blue-900 dark:text-blue-100 space-y-2">
              <p className="font-medium">How to get the Facebook video URL:</p>
              <ol className="list-decimal list-inside space-y-1">
                <li>
                  Open Facebook and navigate to the video you want to download.
                </li>
                <li>
                  Click the share button and choose “Copy link” (or copy the URL
                  from the browser bar).
                </li>
                <li>
                  Ensure the URL looks like{" "}
                  <span className="font-mono text-xs break-all">
                    https://www.facebook.com/.../videos/...
                  </span>
                  .
                </li>
                <li>Paste the copied link below and click Crawl.</li>
              </ol>
            </div>
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative min-w-0">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Enter Facebook URL..."
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
                disabled={!url.trim() || loading}
              >
                {loading ? "Crawling..." : "Crawl"}
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

          {/* Loading Skeleton */}
          {loading && (
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

          {/* Video Data Display */}
          {videoData && !loading && (
            <div className="mt-6 w-full overflow-hidden">
              <Card className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 overflow-hidden">
                <CardHeader className="overflow-hidden">
                  <div className="flex items-start gap-4 min-w-0">
                    {videoData.thumbnail && !imageError && (
                      <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0">
                        <Image
                          src={videoData.thumbnail}
                          alt={videoData.title}
                          width={128}
                          height={80}
                          className="w-full h-full object-cover"
                          onError={() => setImageError(true)}
                          unoptimized
                        />
                      </div>
                    )}
                    {(!videoData.thumbnail || imageError) && (
                      <div className="relative w-32 h-20 rounded-lg overflow-hidden bg-zinc-100 dark:bg-zinc-800 shrink-0 flex items-center justify-center">
                        <ImageIcon className="h-8 w-8 text-zinc-400" />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 overflow-hidden">
                      <CardTitle className="text-lg font-semibold text-black dark:text-zinc-50 mb-2 line-clamp-2 wrap-break-word">
                        {videoData.title}
                      </CardTitle>
                      <p className="text-sm text-zinc-600 dark:text-zinc-400 wrap-break-word">
                        {videoData.resolutions.length} quality option
                        {videoData.resolutions.length !== 1 ? "s" : ""}{" "}
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
                    <div className="grid gap-3 w-full">
                      {videoData.resolutions.map((resolution, index) => (
                        <div
                          key={index}
                          className="flex items-center justify-between p-4 rounded-lg border border-zinc-200 dark:border-zinc-800 bg-zinc-50 dark:bg-zinc-800/50 hover:bg-zinc-100 dark:hover:bg-zinc-800 transition-colors gap-3 min-w-0 overflow-hidden"
                        >
                          <div className="flex-1 min-w-0 overflow-hidden">
                            <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
                              <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300 shrink-0">
                                {resolution.quality}
                              </span>
                              <span className="text-sm text-zinc-600 dark:text-zinc-400 whitespace-nowrap">
                                {resolution.width} × {resolution.height}
                              </span>
                              <span className="text-sm text-zinc-500 dark:text-zinc-500 whitespace-nowrap">
                                {resolution.format.toUpperCase()}
                              </span>
                            </div>
                          </div>
                          <Button
                            size="sm"
                            onClick={() => handleDownload(resolution, index)}
                            className="shrink-0"
                            disabled={downloadingId === index}
                          >
                            {downloadingId === index ? (
                              <>
                                <Loader2 className="h-4 w-4 sm:mr-2 animate-spin" />
                                <span className="hidden sm:inline">
                                  Downloading...
                                </span>
                              </>
                            ) : (
                              <>
                                <Download className="h-4 w-4 sm:mr-2" />
                                <span className="hidden sm:inline">
                                  Download
                                </span>
                              </>
                            )}
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </div>
          )}
      </div>
    </main>
  );
}
