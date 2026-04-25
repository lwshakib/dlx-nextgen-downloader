import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, Music, Video } from "lucide-react";

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

type YoutubeResultsProps = {
  data: YoutubeCrawlResult | null;
  isLoading: boolean;
  onDownload: (url: string, title?: string | null, cookies?: null, audioUrl?: string | null) => void;
};

export function YoutubeResults({
  data,
  isLoading,
  onDownload,
}: YoutubeResultsProps) {
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

  const formatMimeType = (mimeType: string) => {
    return mimeType?.split(";")[0]?.split("/")[1]?.toUpperCase() || "VIDEO";
  };

  return (
    <div className="mt-6 space-y-4">
      <Card>
        <CardHeader>
          <div className="flex flex-col sm:flex-row items-start gap-3 sm:gap-4">
            {data.thumbnail ? (
              <img
                src={data.thumbnail}
                alt={data.title || "Video thumbnail"}
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
                {data.title || "Untitled YouTube Video"}
              </CardTitle>
              <p className="text-xs sm:text-sm text-muted-foreground break-all">
                Video ID: <span className="font-mono text-xs">{data.videoId}</span>
              </p>
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
                  key={`${resolution.qualityLabel}-${index}`}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                    <Badge variant="destructive" className="shrink-0 text-xs">
                      {resolution.qualityLabel}
                    </Badge>
                    <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                      {resolution.width} × {resolution.height}
                    </span>
                    <span className="text-xs sm:text-sm text-muted-foreground/70 whitespace-nowrap">
                      {formatMimeType(resolution.mimeType)}
                    </span>
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onDownload(resolution.url, data.title, null, data.audio?.url || null)}
                    className="w-full sm:w-auto shrink-0"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download
                  </Button>
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

      {data.audio && (
        <Card>
          <CardContent className="pt-6">
            <div className="space-y-3">
              <h3 className="text-sm font-medium flex items-center gap-2">
                <Music className="h-4 w-4" />
                Audio Only
              </h3>
              <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors">
                <div className="flex-1 flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                  <Badge variant="default" className="shrink-0 text-xs">
                    {data.audio.audioQuality || "Best Quality"}
                  </Badge>
                  <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                    {formatMimeType(data.audio.mimeType)}
                  </span>
                  {data.audio.bitrate && (
                    <span className="text-xs sm:text-sm text-muted-foreground/70 whitespace-nowrap">
                      {Math.round(data.audio.bitrate / 1000)} kbps
                    </span>
                  )}
                  {data.audio.audioSampleRate && (
                    <span className="text-xs sm:text-sm text-muted-foreground/70 whitespace-nowrap">
                      {parseInt(data.audio.audioSampleRate) / 1000} kHz
                    </span>
                  )}
                </div>
                <Button
                  size="sm"
                  onClick={() => onDownload(data.audio!.url, data.title)}
                  className="w-full sm:w-auto shrink-0"
                >
                  <Download className="h-4 w-4 mr-2" />
                  Download
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
}

