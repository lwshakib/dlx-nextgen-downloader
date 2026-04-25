import { siteConfig } from "@/lib/site-config";
import type { MetadataRoute } from "next";

const staticRoutes = [
  "/",
  "/youtube",
  "/facebook",
  "/facebook-private-video",
  "/tiktok",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();

  return staticRoutes.map((route) => ({
    url: `${siteConfig.url}${route === "/" ? "" : route}`,
    lastModified,
    changeFrequency: route === "/" ? "daily" : "weekly",
    priority: route === "/" ? 1 : 0.8,
  }));
}

