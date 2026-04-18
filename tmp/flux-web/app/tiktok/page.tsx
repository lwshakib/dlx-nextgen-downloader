"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";
import { useState } from "react";

type TikTokResolution = {
  qualityType: string | null;
  qualityLabel: string | null;
  bitrate: number | null;
  codec: string | null;
  width: number | null;
  height: number | null;
  url: string | null;
};

type TikTokVideoData = {
  status?: string;
  url?: string;
  error?: string;
  title: string | null;
  thumbnail: string | null;
  tokens?: {
    msToken: string | null;
    ttChainToken: string | null;
  };
  resolutions: TikTokResolution[];
};

export default function TikTokPage() {
  const [url, setUrl] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [videoData, setVideoData] = useState<TikTokVideoData | null>(null);

  const formatBitrate = (bitrate: number | null) => {
    if (!bitrate || Number.isNaN(bitrate)) {
      return null;
    }

    if (bitrate >= 1_000_000) {
      return `${(bitrate / 1_000_000).toFixed(1)} Mbps`;
    }

    if (bitrate >= 1_000) {
      return `${(bitrate / 1_000).toFixed(0)} Kbps`;
    }

    return `${bitrate} bps`;
  };

  const handleCrawl = async () => {
    if (!url.trim() || isLoading) {
      return;
    }

    setIsLoading(true);
    setError(null);
    setMessage(null);
    setVideoData(null);

    try {
      const response = await fetch("/api/crawl/tiktok", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ url }),
      });

      const data: TikTokVideoData = await response.json();

      if (!response.ok) {
        const errorMessage =
          typeof data?.error === "string"
            ? data.error
            : "Unable to crawl this TikTok URL.";
        setError(errorMessage);
        return;
      }

      setVideoData(data);
      setMessage("TikTok video details loaded.");
    } catch (err) {
      const fallbackMessage =
        err instanceof Error ? err.message : "Unexpected error occurred.";
      setError(fallbackMessage);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="flex-1 container mx-auto px-4 sm:px-6 lg:px-8 py-12">
      <div className="max-w-4xl mx-auto">
          <h1 className="text-3xl font-bold text-black dark:text-zinc-50 mb-8">
            TikTok Video Downloader
          </h1>
          <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
            <div className="flex flex-col sm:flex-row gap-4">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-zinc-400" />
                <Input
                  type="text"
                  placeholder="Enter TikTok URL..."
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="pl-10 h-12 text-base"
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
                className="h-12 px-8"
                disabled={!url.trim() || isLoading}
              >
                {isLoading ? "Crawling..." : "Crawl"}
              </Button>
            </div>
            {error && (
              <p className="mt-4 text-sm text-red-600 dark:text-red-400">
                {error}
              </p>
            )}
            {message && !error && (
              <p className="mt-4 text-sm text-emerald-600 dark:text-emerald-400">
                {message}
              </p>
            )}
          </div>

          {videoData && (
            <div className="mt-8 grid gap-6">
              <div className="bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 shadow-sm">
                <div className="flex flex-col md:flex-row gap-6">
                  {videoData.thumbnail && (
                    <div className="w-full md:w-64 h-64 overflow-hidden rounded-lg border border-zinc-200 dark:border-zinc-800">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={videoData.thumbnail}
                        alt={videoData.title ?? "TikTok video thumbnail"}
                        className="h-full w-full object-cover"
                      />
                    </div>
                  )}
                  <div className="flex-1 space-y-4">
                    <div>
                      <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
                        Video Title
                      </p>
                      <h2 className="text-xl font-semibold text-black dark:text-white">
                        {videoData.title || "Untitled TikTok Video"}
                      </h2>
                    </div>
                    <div>
                      <p className="text-sm uppercase tracking-wide text-zinc-500 dark:text-zinc-400 mb-2">
                        Available Qualities
                      </p>
                      {videoData.resolutions.length === 0 ? (
                        <p className="text-sm text-zinc-600 dark:text-zinc-300">
                          No downloadable streams detected for this video.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {videoData.resolutions.map((resolution, index) => (
                            <div
                              key={`${resolution.qualityLabel ?? "q"}-${index}`}
                              className="flex flex-col sm:flex-row sm:items-center sm:justify-between rounded-lg border border-zinc-200 dark:border-zinc-800 p-4"
                            >
                              <div>
                                <p className="text-base font-medium text-black dark:text-white">
                                  {resolution.qualityLabel ??
                                    resolution.qualityType ??
                                    "Unknown Quality"}
                                </p>
                                <p className="text-sm text-zinc-600 dark:text-zinc-400">
                                  {[
                                    resolution.codec,
                                    resolution.width && resolution.height
                                      ? `${resolution.width}x${resolution.height}`
                                      : null,
                                    formatBitrate(resolution.bitrate),
                                  ]
                                    .filter(Boolean)
                                    .join(" • ")}
                                </p>
                              </div>
                              {resolution.url ? (
                                <Button
                                  asChild
                                  size="sm"
                                  className="mt-3 sm:mt-0"
                                >
                                  <a
                                    href={`/api/download/tiktok?resolutionUrl=${encodeURIComponent(
                                      resolution.url
                                    )}&url=${encodeURIComponent(
                                      url
                                    )}&msToken=${encodeURIComponent(
                                      videoData.tokens?.msToken ?? ""
                                    )}&ttChainToken=${encodeURIComponent(
                                      videoData.tokens?.ttChainToken ?? ""
                                    )}`}
                                  >
                                    Download
                                  </a>
                                </Button>
                              ) : (
                                <Button
                                  size="sm"
                                  className="mt-3 sm:mt-0"
                                  disabled
                                >
                                  Unavailable
                                </Button>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          )}
      </div>
    </main>
  );
}
