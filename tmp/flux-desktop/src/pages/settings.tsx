import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type AppSettings = {
  downloadLocation: string;
};

type SettingsPageProps = {
  settings: AppSettings;
  onSettingsChange: (settings: AppSettings) => void;
};

export function SettingsPage({ settings, onSettingsChange }: SettingsPageProps) {
  const [isChoosingLocation, setIsChoosingLocation] = useState(false);

  const handleBrowseLocation = async () => {
    if (!window?.ipcRenderer) return;
    try {
      setIsChoosingLocation(true);
      const selectedPath: string | null = await window.ipcRenderer.invoke(
        "select-download-location"
      );
      if (selectedPath) {
        onSettingsChange({
          ...settings,
          downloadLocation: selectedPath,
        });
      }
    } catch (error) {
      console.error("Failed to select download location", error);
    } finally {
      setIsChoosingLocation(false);
    }
  };

  return (
    <div className="mt-4 sm:mt-6 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2">
      <div className="rounded-lg border border-border bg-background p-3 sm:p-4">
        <h3 className="text-base sm:text-lg font-semibold">Theme preference</h3>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
          Toggle light or dark mode using the button in the header.
        </p>
      </div>
      <div className="rounded-lg border border-border bg-background p-3 sm:p-4">
        <h3 className="text-base sm:text-lg font-semibold">Usage limits</h3>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
          Configure daily crawl quotas and API keys (coming soon).
        </p>
      </div>
      <div className="rounded-lg border border-border bg-background p-3 sm:p-4 sm:col-span-2">
        <h3 className="text-base sm:text-lg font-semibold">Default save location</h3>
        <p className="mt-2 text-xs sm:text-sm text-muted-foreground">
          Choose where downloaded files should be saved.
        </p>
        <div className="mt-3 sm:mt-4 flex flex-col gap-2 sm:flex-row">
          <Input
            value={settings.downloadLocation}
            onChange={(event) =>
              onSettingsChange({
                ...settings,
                downloadLocation: event.target.value,
              })
            }
            placeholder="Downloads folder"
            className="flex-1 text-sm sm:text-base"
          />
          <Button
            type="button"
            variant="outline"
            onClick={handleBrowseLocation}
            disabled={isChoosingLocation}
            className="w-full sm:w-auto text-sm sm:text-base"
          >
            Browse
          </Button>
        </div>
      </div>
    </div>
  );
}

