const defaultUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://fluxdownloader.app";

const normalizedUrl = defaultUrl.endsWith("/")
  ? defaultUrl.slice(0, -1)
  : defaultUrl;

export const siteConfig = {
  name: "Flux Video Downloader",
  shortName: "Flux",
  description:
    "Flux is a free video downloader for YouTube, Facebook (public and private), TikTok, and more. Paste a link, pick a quality, and save in seconds.",
  keywords: [
    "video downloader",
    "YouTube downloader",
    "Facebook video downloader",
    "TikTok downloader",
    "Flux",
    "save videos online",
    "download HD video",
  ],
  url: normalizedUrl,
  creator: "Flux",
  ogImage: "/flux-og-image.png",
};

export const canonicalPath = (path = "/") =>
  `${siteConfig.url}${path === "/" ? "" : path}`;

