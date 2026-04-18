import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Info } from "lucide-react";

type FacebookPrivateVideoProps = {
  pageSource: string;
  onPageSourceChange: (value: string) => void;
  onAnalyze: (html: string) => Promise<void>;
  isLoading: boolean;
  error: string | null;
};

export function FacebookPrivateVideo({
  pageSource,
  onPageSourceChange,
  onAnalyze,
  isLoading,
  error,
}: FacebookPrivateVideoProps) {
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pageSource.trim() || isLoading) return;
    await onAnalyze(pageSource.trim());
  };

  return (
    <div className="mt-6 space-y-4 w-full min-w-0 overflow-hidden">
      <Card className="overflow-hidden min-w-0">
        <CardHeader className="overflow-hidden min-w-0">
          <CardTitle className="text-lg sm:text-xl">
            Paste HTML Source Code
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4 overflow-hidden min-w-0 max-w-full">
          <Alert className="overflow-hidden min-w-0">
            <Info className="h-4 w-4 shrink-0" />
            <AlertDescription className="overflow-hidden min-w-0">
              <p className="font-medium mb-2 text-sm sm:text-base">
                How to get the page source:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-xs sm:text-sm">
                <li className="wrap-break-word">
                  Open the Facebook post that contains the private video.
                </li>
                <li className="wrap-break-word">
                  Press <span className="font-mono">Ctrl + U</span> (or
                  right-click → View Page Source).
                </li>
                <li className="wrap-break-word">
                  Select all (<span className="font-mono">Ctrl + A</span>) and
                  copy the HTML (<span className="font-mono">Ctrl + C</span>).
                </li>
                <li className="wrap-break-word">
                  Paste the copied HTML below and click Analyze Source.
                </li>
              </ol>
            </AlertDescription>
          </Alert>
          <form
            onSubmit={handleSubmit}
            className="space-y-4 w-full min-w-0 overflow-hidden"
          >
            <div className="relative h-[200px] sm:h-[300px] md:h-[400px] w-[700px] max-w-full overflow-hidden">
              <Textarea
                value={pageSource}
                onChange={(e) => onPageSourceChange(e.target.value)}
                placeholder="Paste the page source HTML here..."
                className="h-full font-mono text-xs sm:text-sm resize-none w-[700px] max-w-full overflow-auto break-words"
                style={{
                  wordBreak: "break-word",
                  overflowWrap: "anywhere",
                  boxSizing: "border-box",
                }}
                disabled={isLoading}
              />
            </div>
            <div className="flex flex-col sm:flex-row justify-end gap-2 sm:gap-0">
              <Button
                type="submit"
                size="lg"
                className="h-10 sm:h-11 md:h-12 w-full sm:w-auto px-4 sm:px-6 md:px-8 text-sm sm:text-base"
                disabled={!pageSource.trim() || isLoading}
              >
                {isLoading ? "Analyzing..." : "Analyze Source"}
              </Button>
            </div>
          </form>
          {error && (
            <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-md overflow-hidden">
              <p className="text-xs sm:text-sm text-destructive wrap-break-word">
                {error}
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
