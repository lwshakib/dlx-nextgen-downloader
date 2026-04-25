import { siteConfig } from "@/lib/site-config";
import {
  Download,
  Facebook,
  Globe,
  Link2,
  Lock,
  Music,
  Shield,
  ShieldCheck,
  Sparkles,
  Star,
  Target,
  Youtube,
  Zap,
} from "lucide-react";
import Link from "next/link";

export default function Home() {
  const platforms = [
    {
      name: "YouTube",
      description: "Download videos from YouTube with ease",
      href: "/youtube",
      icon: Youtube,
      color: "text-red-600 dark:text-red-400",
    },
    {
      name: "Facebook",
      description: "Extract videos from Facebook posts",
      href: "/facebook",
      icon: Facebook,
      color: "text-blue-600 dark:text-blue-400",
    },
    {
      name: "Facebook Private Video",
      description: "Download private Facebook videos",
      href: "/facebook-private-video",
      icon: Lock,
      color: "text-purple-600 dark:text-purple-400",
    },
    {
      name: "TikTok",
      description: "Save TikTok videos quickly",
      href: "/tiktok",
      icon: Music,
      color: "text-pink-600 dark:text-pink-400",
    },
  ];

  const workflow = [
    {
      title: "Paste the link",
      description: "Copy any video URL from your favorite platform.",
      icon: Link2,
    },
    {
      title: "Flux analyzes everything",
      description:
        "Our crawlers fetch every quality that exists automatically.",
      icon: Sparkles,
    },
    {
      title: "Download in one click",
      description: "Choose the resolution you need and save it instantly.",
      icon: Download,
    },
  ];

  const stats = [
    {
      label: "Global reach",
      value: "190+",
      icon: Globe,
    },
    {
      label: "Active creators",
      value: "1.2M",
      icon: ShieldCheck,
    },
    {
      label: "Average rating",
      value: "4.9/5",
      icon: Star,
    },
  ];

  const jsonLd = {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: siteConfig.name,
    url: siteConfig.url,
    description: siteConfig.description,
    applicationCategory: "MultimediaApplication",
    operatingSystem: "Web",
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "USD",
    },
    aggregateRating: {
      "@type": "AggregateRating",
      ratingValue: "4.9",
      reviewCount: "1200",
    },
    potentialAction: {
      "@type": "Action",
      name: "Download video",
      target: `${siteConfig.url}/?link={videoUrl}`,
    },
  };

  return (
    <main>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(jsonLd) }}
      />
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 py-16 sm:py-24">
        <div className="max-w-4xl mx-auto text-center">
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold text-black dark:text-zinc-50 mb-6">
            Download Videos from Any Platform
          </h1>
          <p className="text-xl sm:text-2xl text-zinc-600 dark:text-zinc-400 mb-12 max-w-2xl mx-auto">
            Flux is your all-in-one video downloader. Extract and save videos
            from YouTube, Facebook, TikTok, and more with just a few clicks.
          </p>
        </div>
      </section>

      {/* Platform Cards */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-6xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-zinc-50 mb-8 text-center">
            Supported Platforms
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {platforms.map((platform) => {
              const Icon = platform.icon;
              return (
                <Link
                  key={platform.name}
                  href={platform.href}
                  className="group bg-white dark:bg-zinc-900 rounded-lg border border-zinc-200 dark:border-zinc-800 p-6 hover:border-zinc-300 dark:hover:border-zinc-700 hover:shadow-lg transition-all duration-200"
                >
                  <div className="flex flex-col items-center text-center">
                    <div
                      className={`mb-4 p-3 rounded-lg bg-zinc-100 dark:bg-zinc-800 group-hover:scale-110 transition-transform duration-200 ${platform.color}`}
                    >
                      <Icon className="h-8 w-8" />
                    </div>
                    <h3 className="text-xl font-semibold text-black dark:text-zinc-50 mb-2">
                      {platform.name}
                    </h3>
                    <p className="text-sm text-zinc-600 dark:text-zinc-400">
                      {platform.description}
                    </p>
                  </div>
                </Link>
              );
            })}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-4xl mx-auto">
          <h2 className="text-2xl sm:text-3xl font-bold text-black dark:text-zinc-50 mb-8 text-center">
            Why Choose Flux?
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-yellow-100 dark:bg-yellow-900/20">
                  <Zap className="h-8 w-8 text-yellow-600 dark:text-yellow-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-2">
                Fast & Reliable
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Quick downloads with high success rates
              </p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-blue-100 dark:bg-blue-900/20">
                  <Shield className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-2">
                Secure & Private
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Your data stays safe and private
              </p>
            </div>
            <div className="text-center">
              <div className="flex justify-center mb-4">
                <div className="p-4 rounded-full bg-green-100 dark:bg-green-900/20">
                  <Target className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
              </div>
              <h3 className="text-lg font-semibold text-black dark:text-zinc-50 mb-2">
                Easy to Use
              </h3>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                Simple interface, no technical skills needed
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-12">
            <p className="text-sm font-semibold uppercase tracking-widest text-red-500">
              Three simple steps
            </p>
            <h2 className="mt-2 text-2xl sm:text-3xl font-bold text-black dark:text-zinc-50">
              Download any video in less than a minute
            </h2>
            <p className="mt-3 text-base text-zinc-600 dark:text-zinc-400">
              No extensions, no bulky software. Flux runs in your browser and
              works across every major platform.
            </p>
          </div>
          <div className="grid gap-6 md:grid-cols-3">
            {workflow.map((step, index) => {
              const Icon = step.icon;
              return (
                <div
                  key={step.title}
                  className="relative flex flex-col rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-zinc-900"
                >
                  <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50">
                    <Icon className="h-6 w-6" />
                  </div>
                  <p className="text-sm font-semibold text-red-500">
                    Step {index + 1}
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-black dark:text-white">
                    {step.title}
                  </h3>
                  <p className="mt-2 text-sm text-zinc-600 dark:text-zinc-400">
                    {step.description}
                  </p>
                  <span className="absolute -top-3 -right-3 inline-flex h-8 w-8 items-center justify-center rounded-full border border-zinc-200 bg-white text-sm font-semibold text-zinc-700 dark:border-zinc-700 dark:bg-black dark:text-zinc-200">
                    {index + 1}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </section>

      {/* Testimonials & Stats */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-16">
        <div className="rounded-3xl border border-zinc-200 bg-white px-6 py-10 shadow-sm dark:border-zinc-800 dark:bg-zinc-900 sm:px-10">
          <div className="grid gap-8 md:grid-cols-2">
            <div className="space-y-6">
              <p className="text-sm font-semibold uppercase tracking-widest text-red-500">
                Trusted everywhere
              </p>
              <h2 className="text-3xl font-bold text-black dark:text-white">
                Millions of downloads every week with enterprise-grade security.
              </h2>
              <p className="text-base text-zinc-600 dark:text-zinc-400">
                Flux is engineered for speed, reliability, and privacy.
                Agencies, educators, journalists, and hobbyists rely on us to
                back up their favorite content.
              </p>
              <div className="grid gap-4 sm:grid-cols-3">
                {stats.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div
                      key={item.label}
                      className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4 text-center dark:border-zinc-800 dark:bg-zinc-950"
                    >
                      <Icon className="mx-auto mb-2 h-5 w-5 text-red-500" />
                      <p className="text-2xl font-bold text-black dark:text-white">
                        {item.value}
                      </p>
                      <p className="text-xs uppercase tracking-widest text-zinc-600 dark:text-zinc-400">
                        {item.label}
                      </p>
                    </div>
                  );
                })}
              </div>
            </div>
            <div className="flex flex-col gap-4">
              {[
                {
                  quote:
                    "Flux handles every URL we throw at it. The interface is clean, fast, and delightful to use every single day.",
                  author: "Isabella Hart",
                  role: "Video Producer",
                },
                {
                  quote:
                    "We archive social content for clients and Flux guarantees we never miss a file or quality option. It just works.",
                  author: "Noah Bennett",
                  role: "Digital Strategist",
                },
              ].map((testimonial) => (
                <figure
                  key={testimonial.author}
                  className="rounded-2xl border border-zinc-200 bg-white p-6 shadow-sm dark:border-zinc-800 dark:bg-black"
                >
                  <div className="mb-4 flex items-center gap-1 text-amber-400">
                    {Array.from({ length: 5 }).map((_, idx) => (
                      <Star key={idx} className="h-4 w-4 fill-current" />
                    ))}
                  </div>
                  <blockquote className="text-sm text-zinc-600 dark:text-zinc-400">
                    “{testimonial.quote}”
                  </blockquote>
                  <figcaption className="mt-4">
                    <p className="text-sm font-semibold text-black dark:text-white">
                      {testimonial.author}
                    </p>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400">
                      {testimonial.role}
                    </p>
                  </figcaption>
                </figure>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section className="container mx-auto px-4 sm:px-6 lg:px-8 pb-24">
        <div className="relative overflow-hidden rounded-3xl border border-zinc-200 bg-linear-to-br from-zinc-900 via-zinc-800 to-black px-6 py-12 text-center text-white shadow-xl dark:border-zinc-800">
          <div className="absolute inset-0 opacity-30 bg-[radial-gradient(circle_at_top,#ff4d4d,transparent_50%),radial-gradient(circle_at_bottom,#7c3aed,transparent_50%)]" />
          <div className="relative">
            <p className="text-sm font-semibold uppercase tracking-widest text-amber-300">
              Ready when you are
            </p>
            <h2 className="mt-4 text-3xl sm:text-4xl font-bold">
              Launch Flux and save your next video in seconds
            </h2>
            <p className="mx-auto mt-4 max-w-2xl text-base text-zinc-200">
              No signup required. Just paste a link, pick a quality, and Flux
              delivers a clean download every time.
            </p>
            <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
              <Link
                href="/youtube"
                className="inline-flex w-full items-center justify-center rounded-full bg-white px-6 py-3 text-base font-semibold text-zinc-900 shadow-lg shadow-black/20 transition hover:scale-105 focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-white sm:w-auto"
              >
                Launch Downloader
              </Link>
              <Link
                href="/facebook"
                className="inline-flex w-full items-center justify-center rounded-full border border-white/50 px-6 py-3 text-base font-semibold text-white/90 transition hover:bg-white/10 sm:w-auto"
              >
                Explore Platforms
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
