import { crawlFacebook } from "./facebook";
import { crawlTikTok } from "./tiktok";
import { crawlYouTube } from "./youtube";

export async function crawlUrl(url: string) {
    const trimmedUrl = url.trim();
    if (!trimmedUrl) throw new Error("URL is required.");

    try {
        const urlObj = new URL(trimmedUrl);
        const host = urlObj.hostname.toLowerCase();

        if (host.includes("facebook.com") || host.includes("fb.watch") || host.includes("fb.com")) {
            const data = await crawlFacebook(trimmedUrl);
            return { platform: "facebook", ...data };
        }

        if (host.includes("tiktok.com")) {
            const data = await crawlTikTok(trimmedUrl);
            return { platform: "tiktok", ...data };
        }

        if (host.includes("youtube.com") || host.includes("youtu.be")) {
            const data = await crawlYouTube(trimmedUrl);
            return { platform: "youtube", ...data };
        }

        throw new Error("Unsupported platform. Please provide a YouTube, Facebook, or TikTok URL.");
    } catch (error) {
        if (error instanceof Error) throw error;
        throw new Error("An unexpected error occurred during crawling.");
    }
}
