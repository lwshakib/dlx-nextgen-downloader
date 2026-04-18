export function HomePage() {
  const homeFeatures = [
    {
      title: "Multi-platform support",
      description: "Download content from YouTube, Facebook, TikTok and more.",
    },
    {
      title: "Private video handling",
      description: "Secure helpers guide you through fetching private videos.",
    },
    {
      title: "Lightning fast conversions",
      description: "Optimized pipeline delivers MP4s without waiting around.",
    },
  ];

  return (
    <>
      <div className="mt-4 sm:mt-6 grid gap-3 sm:gap-4 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {homeFeatures.map((feature) => (
          <div
            key={feature.title}
            className="rounded-lg border border-border bg-background p-3 sm:p-4 shadow-sm"
          >
            <h3 className="text-base sm:text-lg font-semibold">{feature.title}</h3>
            <p className="mt-1 text-xs sm:text-sm text-muted-foreground">
              {feature.description}
            </p>
          </div>
        ))}
      </div>
      <div className="mt-4 sm:mt-6 rounded-lg border border-dashed border-border bg-background/80 p-3 sm:p-4 text-xs sm:text-sm text-muted-foreground">
        Tip: Pick a platform from the sidebar to see its dedicated workflow.
      </div>
    </>
  );
}

