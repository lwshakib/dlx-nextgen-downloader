import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";
import { Download, Video } from "lucide-react";

interface Resolution {
  url: string;
  width: number;
  height: number;
  quality: string;
  format: string;
}

interface FacebookCrawlResult {
  title: string;
  thumbnail: string;
  resolutions: Resolution[];
}

type FacebookResultsProps = {
  data: FacebookCrawlResult | null;
  isLoading: boolean;
  onDownload: (url: string, title?: string | null) => void;
};

export function FacebookResults({
  data,
  isLoading,
  onDownload,
}: FacebookResultsProps) {
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

  if (!data || !data.resolutions || !Array.isArray(data.resolutions)) {
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
                {data.title || "Facebook Video"}
              </CardTitle>
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
                  key={`${resolution.quality}-${resolution.format}-${index}`}
                  className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 p-3 sm:p-4 rounded-lg border bg-muted/50 hover:bg-muted transition-colors"
                >
                  <div className="flex-1 flex items-center gap-2 sm:gap-3 flex-wrap min-w-0">
                    {resolution.quality && (
                      <Badge variant="destructive" className="shrink-0 text-xs">
                        {resolution.quality}
                      </Badge>
                    )}
                    {(resolution.width && resolution.height) && (
                      <span className="text-xs sm:text-sm text-muted-foreground whitespace-nowrap">
                        {resolution.width} × {resolution.height}
                      </span>
                    )}
                    {resolution.format && (
                      <span className="text-xs sm:text-sm text-muted-foreground/70 whitespace-nowrap">
                        {resolution.format.toUpperCase()}
                      </span>
                    )}
                  </div>
                  <Button
                    size="sm"
                    onClick={() => onDownload(resolution.url, data.title)}
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
    </div>
  );
}

