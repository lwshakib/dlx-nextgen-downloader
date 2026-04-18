import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Logo } from "@workspace/ui/components/logo"
import { 
  Download, 
  Zap, 
  ShieldCheck, 
  Layers, 
  Terminal, 
  CheckCircle2, 
  Globe,
  Settings,
  MoreVertical,
  Pause,
Play
} from "lucide-react"

export const Route = createFileRoute("/")({ component: LandingPage })

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 w-full border-b bg-background/80 backdrop-blur-md">
        <div className="container mx-auto flex h-16 items-center justify-between px-4 sm:px-6">
          <div className="flex items-center gap-2">
            <Logo size={32} className="text-primary" />
            <span className="text-xl font-bold tracking-tight">DLX <span className="text-muted-foreground uppercase text-sm">Nextgen</span></span>
          </div>
          <div className="hidden md:flex items-center gap-8">
            <a href="#features" className="text-sm font-medium hover:text-primary transition-colors">Features</a>
            <a href="#how-it-works" className="text-sm font-medium hover:text-primary transition-colors">How it Works</a>
            <a href="#faq" className="text-sm font-medium hover:text-primary transition-colors">Documentation</a>
          </div>
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="sm" className="hidden sm:flex">
                <Globe className="mr-2 h-4 w-4" /> Github
            </Button>
            <Button size="sm">Get Started</Button>
            <Badge variant="outline" className="hidden lg:flex text-[10px] uppercase tracking-wider font-bold">Press <kbd className="px-1 font-mono">D</kbd> for Dark Mode</Badge>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="relative overflow-hidden pt-16 pb-24 md:pt-24 md:pb-32">
        <div className="container relative z-10 mx-auto px-4 sm:px-6">
          <div className="grid grid-cols-1 gap-12 lg:grid-cols-2 lg:items-center">
            {/* Left Content */}
            <div className="max-w-2xl">
              <Badge className="mb-4 inline-flex items-center gap-1.5 px-3 py-1 font-medium ring-1 ring-inset ring-primary/20 bg-primary/10 text-primary">
                <Zap className="h-3.5 w-3.5 fill-current" /> High Performance Parallelism
              </Badge>
              <h1 className="text-4xl font-extrabold tracking-tight sm:text-6xl text-balance leading-[1.1]">
                Download HLS Streams at <span className="text-primary italic">Light Speed.</span>
              </h1>
              <p className="mt-6 text-lg text-muted-foreground leading-relaxed">
                The most advanced parallel video downloader ever built. 
                Experience multi-threaded segment fetching, automatic AES-128 decryption, 
                and seamless FFmpeg merging in one beautiful interface.
              </p>
              <div className="mt-8 flex flex-col sm:flex-row gap-4">
                <Button size="lg" className="h-12 px-8 text-base">
                  Try Demo
                </Button>
                <Button size="lg" variant="outline" className="h-12 px-8 text-base">
                  <Terminal className="mr-2 h-4 w-4" /> View CLI Source
                </Button>
              </div>
            </div>

            {/* Right Dashboard Mockup (Component-based) */}
            <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-2xl blur opacity-25 group-hover:opacity-40 transition duration-1000 group-hover:duration-200"></div>
                <Card className="relative border-2 bg-card/50 backdrop-blur-xl shadow-2xl overflow-hidden">
                    <CardHeader className="border-b bg-muted/30 px-4 py-3 flex flex-row items-center justify-between space-y-0">
                        <div className="flex items-center gap-4">
                            <div className="flex gap-1.5">
                                <div className="h-3 w-3 rounded-full bg-red-500/50" />
                                <div className="h-3 w-3 rounded-full bg-yellow-500/50" />
                                <div className="h-3 w-3 rounded-full bg-green-500/50" />
                            </div>
                            <div className="h-6 w-px bg-border" />
                            <div className="text-[11px] font-mono text-muted-foreground uppercase tracking-widest">Active Downloads</div>
                        </div>
                        <Settings className="h-4 w-4 text-muted-foreground" />
                    </CardHeader>
                    <CardContent className="p-0">
                        <div className="p-4 space-y-4">
                            <div className="space-y-2">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <div className="text-xs font-semibold">lecture_01_introduction.m3u8</div>
                                        <div className="text-[10px] text-muted-foreground">Parallel: 16 threads | AES-128 Active</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold text-primary">82%</span>
                                        <div className="text-[10px] text-muted-foreground">12.4 MB/s</div>
                                    </div>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div className="h-full w-[82%] bg-primary rounded-full" />
                                </div>
                            </div>

                            <div className="space-y-2 opacity-60">
                                <div className="flex justify-between items-end">
                                    <div className="space-y-1">
                                        <div className="text-xs font-semibold">advanced_react_v19.mp4</div>
                                        <div className="text-[10px] text-muted-foreground">Wait for merge...</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="text-xs font-bold">100%</span>
                                        <div className="text-[10px] text-green-500 flex items-center gap-1 justify-end"><CheckCircle2 className="h-3 w-3" /> Ready</div>
                                    </div>
                                </div>
                                <div className="h-1.5 w-full bg-muted rounded-full overflow-hidden">
                                    <div className="h-full w-full bg-green-500/50 rounded-full" />
                                </div>
                            </div>

                            <div className="rounded-lg border bg-muted/20 p-3 flex items-center justify-between">
                                <span className="text-[11px] font-mono text-muted-foreground">https://stream.server/v1/master.m3u8</span>
                                <Badge variant="secondary" className="h-6 rounded-md">Analyze</Badge>
                            </div>
                        </div>
                    </CardContent>
                </Card>
            </div>
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-24 bg-muted/30">
        <div className="container mx-auto px-4 sm:px-6">
          <div className="text-center max-w-3xl mx-auto mb-16">
            <h2 className="text-3xl font-bold tracking-tight sm:text-4xl">Built for Professionals.</h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              We've engineered DLX Nextgen with the best-in-class technologies to ensure your video downloads are reliable, fast, and secure.
            </p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            <FeatureCard 
              icon={<Zap className="h-6 w-6" />}
              title="Multi-threaded Core"
              description="Download up to 32 segments simultaneously. Dramatically reduce download time for large 4K video streams."
            />
            <FeatureCard 
              icon={<ShieldCheck className="h-6 w-6" />}
              title="AES-128 Decryption"
              description="Native support for encrypted streams. Automatic key fetching and on-the-fly decryption."
            />
            <FeatureCard 
              icon={<Layers className="h-6 w-6" />}
              title="Smart Merging"
              description="Uses FFmpeg internally to perfectly align and merge video segments into a single, high-quality container."
            />
            <FeatureCard 
              icon={<Globe className="h-6 w-6" />}
              title="Cross-Platform"
              description="Architected as a monorepo. Works seamlessly as a CLI tool or through our web-based dashboard."
            />
            <FeatureCard 
              icon={<CheckCircle2 className="h-6 w-6" />}
              title="Retry Logic"
              description="Fragment corruption? Network glitch? Our robust retry system handles it all without failing the download."
            />
             <FeatureCard 
              icon={<Terminal className="h-6 w-6" />}
              title="Developer API"
              description="Simple API to integrate DLX into your own applications or automated workflows."
            />
          </div>
        </div>
      </section>

      {/* Social proof/CTA */}
      <section className="py-24">
         <div className="container mx-auto px-4 sm:px-6">
            <div className="rounded-3xl bg-primary px-6 py-16 sm:px-16 sm:py-24 text-center text-primary-foreground relative overflow-hidden">
                <div className="absolute top-0 right-0 -translate-y-12 translate-x-12 opacity-10">
                    <Download className="h-96 w-96 transform rotate-12" />
                </div>
                <h2 className="text-3xl font-bold tracking-tight sm:text-5xl">Ready to upgrade your workflow?</h2>
                <p className="mx-auto mt-6 max-w-xl text-lg text-primary-foreground/80">
                    Join thousands of developers and content creators using DLX Nextgen for their video processing needs.
                </p>
                <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
                    <Button size="lg" variant="secondary" className="h-14 px-10 text-lg font-semibold w-full sm:w-auto">
                        Get It Now
                    </Button>
                    <Button size="lg" variant="outline" className="h-14 px-10 text-lg font-semibold border-primary-foreground/20 bg-transparent text-primary-foreground hover:bg-primary-foreground/10 w-full sm:w-auto">
                        Join Discord
                    </Button>
                </div>
            </div>
         </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-12">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-4 sm:px-6 md:flex-row">
            <div className="flex items-center gap-2">
                <Download className="h-5 w-5 text-primary" />
                <span className="text-lg font-bold tracking-tight">DLX <span className="text-muted-foreground uppercase text-xs">Nextgen</span></span>
            </div>
            <p className="text-sm text-muted-foreground">
                © 2026 DLX Nextgen. Open source under MIT License.
            </p>
            <div className="flex gap-6">
                <a href="#" className="text-muted-foreground hover:text-primary transition-colors"><Globe className="h-5 w-5" /></a>
                <a href="#" className="text-sm font-medium hover:text-primary transition-colors">Privacy</a>
                <a href="#" className="text-sm font-medium hover:text-primary transition-colors">Terms</a>
            </div>
        </div>
      </footer>
    </div>
  )
}

function FeatureCard({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <Card className="border-none shadow-none bg-transparent group">
      <CardHeader className="p-0 mb-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-all duration-300">
          {icon}
        </div>
        <CardTitle className="text-xl mt-4">{title}</CardTitle>
      </CardHeader>
      <CardContent className="p-0">
        <p className="text-muted-foreground leading-relaxed">{description}</p>
      </CardContent>
    </Card>
  )
}
