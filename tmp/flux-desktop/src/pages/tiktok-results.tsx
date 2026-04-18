import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, Video } from "lucide-react";

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

type TikTokResultsProps = {
  data: TikTokCrawlResult | null;
  isLoading: boolean;
  onDownload: (
    url: string,
    title?: string | null,
    cookies?: { msToken?: string | null; ttChainToken?: string | null } | null
  ) => void;
};

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

export function TikTokResults({
  data,
  isLoading,
  onDownload,
}: TikTokResultsProps) {
  if (isLoading) {
    return (
      <div className="mt-6 space-y-4">
        <Card>
          <CardHeader>
            <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
              <Skeleton className="w-full sm:w-32 h-32 sm:h-20 rounded-lg shrink-0" />
              <div className="flex-1 space-y-2 w-full">
                <Skeleton className="h-6 w-full max-w-md" />
                <Skeleton className="h-4 w-32" />
              </div>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="flex items-center gap-2">
              <Skeleton className="h-4 w-4" />
              <Skeleton className="h-4 w-40" />
            </div>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div
                  key={i}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg border bg-muted/50"
                >
                  <div className="flex-1 flex items-center gap-2 sm:gap-3 flex-wrap">
                    <Skeleton className="h-5 w-16 rounded-full" />
                    <Skeleton className="h-4 w-20" />
                    <Skeleton className="h-4 w-12" />
                  </div>
                  <Skeleton className="h-9 w-full sm:w-24" />
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return null;
  }

  return (
    <div className="mt-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            {data.thumbnail ? (
              <img
                src={data.thumbnail}
                alt={data.title || "TikTok video thumbnail"}
                className="w-full sm:w-32 h-auto sm:h-20 rounded-lg object-cover shrink-0"
                onError={(e) => {
                  (e.target as HTMLImageElement).style.display = "none";
                }}
              />
            ) : (
              <div className="w-full sm:w-32 h-32 sm:h-20 rounded-lg bg-muted flex items-center justify-center shrink-0">
                <Video className="h-8 w-8 text-muted-foreground" />
              </div>
            )}
            <div className="flex-1 min-w-0 w-full">
              <CardTitle className="text-base sm:text-lg font-semibold mb-2 line-clamp-2 break-words">
                {data.title || "Untitled TikTok Video"}
              </CardTitle>
              {data.url && (
                <p className="text-xs sm:text-sm text-muted-foreground break-all mb-1">
                  <span className="font-mono text-xs">{data.url}</span>
                </p>
              )}
              <p className="text-xs sm:text-sm text-muted-foreground">
                {data.resolutions.length} quality option
                {data.resolutions.length === 1 ? "" : "s"} available
              </p>
            </div>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <h3 className="text-sm font-medium flex items-center gap-2">
            <Video className="h-4 w-4" />
            Available Resolutions
          </h3>
          {data.resolutions.length > 0 ? (
            <div className="space-y-2">
              {data.resolutions.map((resolution, index) => (
                <div
                  key={`${resolution.qualityLabel ?? resolution.qualityType ?? index}-${index}`}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                    <Badge variant="destructive" className="shrink-0 text-xs">
                      {resolution.qualityLabel ?? resolution.qualityType ?? "Unknown"}
                    </Badge>
                    {resolution.width && resolution.height && (
                      <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                        {resolution.width} × {resolution.height}
                      </span>
                    )}
                    {resolution.codec && (
                      <span className="text-xs sm:text-sm text-muted-foreground/70 whitespace-nowrap">
                        {resolution.codec.toUpperCase()}
                      </span>
                    )}
                    {formatBitrate(resolution.bitrate) && (
                      <span className="text-xs sm:text-sm text-muted-foreground/70 whitespace-nowrap">
                        {formatBitrate(resolution.bitrate)}
                      </span>
                    )}
                  </div>
                  {resolution.url ? (
                    <Button
                      size="sm"
                      onClick={() =>
                        onDownload(
                          resolution.url!,
                          data.title,
                          data.tokens || null
                        )
                      }
                      className="w-full sm:w-auto shrink-0"
                    >
                      <Download className="h-4 w-4 mr-2" />
                      Download
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      disabled
                      className="w-full sm:w-auto shrink-0"
                    >
                      Unavailable
                    </Button>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-md border bg-muted/50 p-4 text-sm text-muted-foreground">
              No downloadable resolutions were found for this video.
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

