import { ArrowLeft, Compass, Download, Globe, RefreshCw } from "lucide-react";
import Link from "next/link";

import { Button } from "@/components/ui/button";
import { siteConfig } from "@/lib/site-config";

export default function NotFound() {
  const quickLinks = [
    {
      name: "Launch Downloader",
      description: "Paste a link and grab every available quality.",
      href: "/youtube",
      icon: Download,
    },
    {
      name: "Facebook Tools",
      description: "Public + private downloaders in one place.",
      href: "/facebook",
      icon: Globe,
    },
    {
      name: "Try TikTok Mode",
      description: "Save watermark-free clips instantly.",
      href: "/tiktok",
      icon: Compass,
    },
  ];

  return (
    <main className="container mx-auto min-h-[70vh] px-4 py-24 sm:px-6 lg:px-8">
      <div className="relative overflow-hidden rounded-3xl border border-zinc-200/70 bg-white/80 px-6 py-16 shadow-2xl dark:border-zinc-800/60 dark:bg-zinc-900/70 sm:px-12">
        <div className="pointer-events-none absolute inset-0 opacity-80 blur-3xl">
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_top,#ff4d4d,transparent_55%),radial-gradient(circle_at_bottom,#7c3aed,transparent_60%)]" />
        </div>

        <div className="relative space-y-8 text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-zinc-200/70 bg-white/90 px-6 py-2 text-xs font-semibold uppercase tracking-[0.35em] text-zinc-600 shadow-sm dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-400">
            <RefreshCw className="h-3.5 w-3.5" />
            404 • Off the map
          </div>

          <div className="space-y-6">
            <p className="text-sm font-semibold uppercase tracking-[0.45em] text-red-500">
              {siteConfig.shortName} can’t find that page
            </p>
            <h1 className="text-4xl font-bold text-black dark:text-white sm:text-5xl">
              You discovered a dead link, but your downloads don’t need to stop.
            </h1>
            <p className="mx-auto max-w-2xl text-base text-zinc-600 dark:text-zinc-400">
              The page you’re looking for doesn’t exist or may have been moved.
              Choose one of the popular areas below or jump back to the
              downloader to keep saving videos.
            </p>
          </div>

          <div className="flex flex-col justify-center gap-3 sm:flex-row">
            <Button asChild size="lg" className="rounded-full">
              <Link href="/">
                <ArrowLeft className="h-4 w-4" />
                Back to homepage
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="rounded-full border-white/60 bg-white/90 text-zinc-900 shadow-md backdrop-blur dark:border-zinc-800 dark:bg-zinc-950/70 dark:text-zinc-100"
            >
              <Link href="/youtube">Launch downloader</Link>
            </Button>
          </div>
        </div>

        <div className="relative mt-16 grid gap-6 md:grid-cols-3">
          {quickLinks.map((link) => {
            const Icon = link.icon;
            return (
              <Link
                key={link.name}
                href={link.href}
                className="group rounded-2xl border border-zinc-200/80 bg-white/90 p-6 text-left shadow-sm transition hover:-translate-y-1 hover:border-zinc-300 hover:shadow-xl dark:border-zinc-800 dark:bg-zinc-900/70 dark:hover:border-zinc-700"
              >
                <div className="mb-4 inline-flex items-center justify-center rounded-xl bg-zinc-100 p-3 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-100">
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="text-lg font-semibold text-black dark:text-white">
                  {link.name}
                </h3>
                <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                  {link.description}
                </p>
                <span className="mt-4 inline-flex items-center text-sm font-semibold text-red-500">
                  Explore
                  <ArrowLeft className="ml-2 h-4 w-4 rotate-180 transition group-hover:translate-x-1" />
                </span>
              </Link>
            );
          })}
        </div>
      </div>
    </main>
  );
}
