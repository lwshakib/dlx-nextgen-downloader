import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Logo } from "@workspace/ui/components/logo"
import { HiDownload, HiMenu, HiMoon, HiOutlineChevronRight, HiOutlineLightningBolt, HiShieldCheck, HiSun } from "react-icons/hi"
import { FaDiscord, FaFacebook, FaGithub, FaSquareXTwitter, FaTiktok, FaYoutube } from "react-icons/fa6"
import { BiGlobe } from "react-icons/bi"
import { useTheme } from "@workspace/ui/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { useState } from "react"
import { 
    Sheet, 
    SheetClose, 
    SheetContent, 
    SheetHeader, 
    SheetTitle,
    SheetTrigger
} from "@workspace/ui/components/sheet"
import { crawlUrlAction } from "../lib/actions"

export const Route = createFileRoute("/")({ component: LandingPage })

function LandingPage() {
  const [url, setUrl] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [videoData, setVideoData] = useState<any>(null)

  const handleCrawl = async () => {
    if (!url.trim() || isLoading) return
    setIsLoading(true)
    setError(null)
    setVideoData(null)
    
    try {
        const result = await crawlUrlAction({ data: url })
        setVideoData(result)
    } catch (err) {
        setError(err instanceof Error ? err.message : "Unable to crawl video. Please check the URL.")
    } finally {
        setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans selection:bg-primary/20 scroll-smooth">
      {/* Detailed Header */}
      <nav className="sticky top-0 z-50 w-full bg-background/50 backdrop-blur-xl border-b transition-all duration-300">
        <div className="container mx-auto flex h-20 items-center justify-between px-6">
          <div className="flex items-center gap-3">
            <Logo size={36} className="text-primary" />
            <div className="flex items-baseline gap-2">
                <span className="text-2xl font-black tracking-tighter text-foreground">DLX</span>
                <span className="text-[10px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Next Gen</span>
            </div>
          </div>
          
          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-10">
            <NavLinks />
          </div>

          <div className="flex items-center gap-2 md:gap-4">
            <ModeToggle />
            <MobileNav />
          </div>
        </div>
      </nav>

      <section className="relative overflow-hidden pt-20 pb-16 lg:pt-32 lg:pb-24">
        {/* Glow Effects */}
        <div className="absolute top-0 left-1/2 -z-10 h-[600px] w-[600px] -translate-x-1/2 rounded-full bg-primary/20 blur-[120px]" />
        
        <div className="container mx-auto px-6 text-center">
          <Badge variant="outline" className="mb-6 px-4 py-1.5 border-primary/20 bg-primary/5 text-primary tracking-wide font-semibold">
            ✨ Premium Extraction Logic
          </Badge>
          
          <h1 className="mb-6 text-4xl font-extrabold tracking-tight sm:text-6xl lg:text-7xl">
            Universal <span className="text-primary">Media</span> Extraction
          </h1>
          
          <p className="mx-auto mb-10 max-w-2xl text-lg text-muted-foreground/80 leading-relaxed">
            Native support for YouTube, Facebook and TikTok. Fetch high-quality streams instantly using our parallel processing logic.
          </p>

          {/* Custom Core App Interaction */}
          <div className="mx-auto mt-12 max-w-2xl w-full px-4">
            <div className="group relative transition-all duration-500">
              {/* Subtle Ambient Glow */}
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary/30 to-blue-600/30 rounded-2xl blur opacity-0 group-focus-within:opacity-100 transition duration-1000" />
              
              <div className="relative flex flex-col md:flex-row gap-2 b-2 border border-primary/10 bg-card/80 backdrop-blur-sm p-2 rounded-2xl shadow-2xl shadow-primary/5 group-focus-within:border-primary/30 group-focus-within:shadow-primary/10 transition-all duration-500">
                <div className="relative flex-1 flex items-center">
                  <div className="absolute left-4 text-muted-foreground/40 group-focus-within:text-primary/40 transition-colors">
                    <BiGlobe className="h-5 w-5" />
                  </div>
                  <input 
                    type="url"
                    value={url}
                    onChange={(e) => setUrl(e.target.value)}
                    onKeyDown={(e) => { if (e.key === 'Enter') handleCrawl() }}
                    placeholder="Paste your video URL here..." 
                    className="w-full bg-transparent h-14 pl-12 pr-4 text-base font-medium outline-none placeholder:text-muted-foreground/30 text-foreground"
                    disabled={isLoading}
                  />
                </div>
                
                <button 
                  onClick={handleCrawl}
                  disabled={isLoading || !url.trim()}
                  className="h-14 px-8 bg-primary rounded-xl text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] disabled:opacity-50 disabled:active:scale-100 transition-all shadow-lg shadow-primary/20"
                >
                  {isLoading ? (
                      <div className="flex items-center gap-2">
                        <div className="h-4 w-4 animate-spin rounded-full border-2 border-primary-foreground border-t-transparent" />
                        <span>Crawling...</span>
                      </div>
                  ) : (
                      <>
                        <HiDownload className="h-5 w-5" />
                        <span>Download Now</span>
                      </>
                  )}
                </button>
              </div>
            </div>

            {error && (
                <div className="mt-4 p-4 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive text-sm font-medium">
                    {error}
                </div>
            )}
            
            {/* Download Results */}
            {videoData && (
                <div className="mt-12 text-left bg-card border rounded-3xl p-6 shadow-2xl animate-in fade-in slide-in-from-bottom-5 duration-500">
                    <div className="flex flex-col md:flex-row gap-6">
                        {videoData.thumbnail && (
                            <div className="w-full md:w-48 aspect-video rounded-2xl overflow-hidden bg-muted group relative">
                                <img 
                                    src={videoData.thumbnail} 
                                    className="w-full h-full object-cover transition-transform group-hover:scale-110 duration-500" 
                                    alt="Video preview" 
                                />
                                <div className="absolute top-2 right-2 px-2 py-1 rounded-md bg-black/60 backdrop-blur-md text-[10px] font-bold text-white uppercase tracking-wider">
                                    {videoData.platform}
                                </div>
                            </div>
                        )}
                        <div className="flex-1 min-w-0">
                            <h3 className="text-xl font-bold mb-1 truncate">{videoData.title}</h3>
                            <p className="text-sm text-muted-foreground/60 mb-6 uppercase tracking-wider font-bold">Available qualities</p>
                            
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                {videoData.resolutions?.map((res: any, idx: number) => (
                                    <a 
                                        key={idx}
                                        href={res.url} 
                                        target="_blank"
                                        className="flex flex-col items-center justify-center p-3 rounded-xl bg-muted/50 border hover:bg-primary hover:text-primary-foreground transition-all group"
                                    >
                                        <span className="text-sm font-black">{res.quality || res.qualityLabel}</span>
                                        <span className="text-[10px] opacity-40 group-hover:opacity-100 uppercase font-bold tracking-tighter">
                                            {res.format || res.mimeType?.split(';')[0]?.split('/')[1] || 'video'}
                                        </span>
                                    </a>
                                ))}
                                {videoData.audio && (
                                     <a 
                                        href={videoData.audio.url} 
                                        target="_blank"
                                        className="flex flex-col items-center justify-center p-3 rounded-xl bg-primary/10 border-primary/20 hover:bg-primary hover:text-primary-foreground transition-all group"
                                     >
                                         <span className="text-sm font-black">MP3 Audio</span>
                                         <span className="text-[10px] opacity-40 group-hover:opacity-100 uppercase font-bold tracking-tighter">High Quality</span>
                                     </a>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}
            
            <div className="mt-6 flex flex-wrap justify-center gap-6 text-[10px] font-bold text-muted-foreground/40 uppercase tracking-[0.2em]">
              <span className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-primary" />
                No Account Required
              </span>
              <span className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-primary" />
                4K Quality Supported
              </span>
              <span className="flex items-center gap-2">
                <div className="h-1 w-1 rounded-full bg-primary" />
                High-Speed Servers
              </span>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Support Section */}
      <section id="platforms" className="scroll-mt-32 py-16 border-y border-primary/5 bg-muted/10 blur-sm hover:blur-none transition-all duration-700">
        <div className="container mx-auto px-6">
            <div className="flex flex-wrap justify-center items-center gap-8 md:gap-16 opacity-50 grayscale hover:grayscale-0 transition-all duration-500">
                <div className="flex items-center gap-2">
                    <FaYoutube className="h-6 w-6" />
                    <span className="font-bold text-xl tracking-tighter">YouTube</span>
                </div>
                <div className="flex items-center gap-2">
                    <FaFacebook className="h-6 w-6" />
                    <span className="font-bold text-xl tracking-tighter">Facebook</span>
                </div>
                <div className="flex items-center gap-2">
                    <FaTiktok className="h-6 w-6" />
                    <span className="font-bold text-xl tracking-tighter">TikTok</span>
                </div>
            </div>
        </div>
      </section>

      {/* Minimal Feature Highlights */}
      <section id="features" className="scroll-mt-32 py-24">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            <FeatureItem 
                icon={<HiShieldCheck className="text-primary" />}
                title="Private Video Access"
                description="Easily download private Facebook videos with our specialized extractor. No complex technical steps required."
            />
            <FeatureItem 
                icon={<HiOutlineLightningBolt className="text-primary" />}
                title="16x Parallel Speed"
                description="HLS streams are fetched in segments using multi-threaded logic, making your downloads significantly faster."
            />
            <FeatureItem 
                icon={<BiGlobe className="text-primary" />}
                title="Clean Metadata"
                description="Automatic tagging and high-quality merging via FFmpeg ensures your videos are perfectly containerized."
            />
          </div>
        </div>
      </section>

      {/* Detailed Footer */}
      <footer id="resources" className="scroll-mt-32 mt-auto border-t py-16 bg-card/30">
        <div className="container mx-auto px-6">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-16">
                {/* Brand & Description */}
                <div className="space-y-6">
                    <div className="flex items-center gap-3">
                        <Logo size={32} className="text-primary" />
                        <div className="flex items-baseline gap-2">
                        <span className="text-xl font-black tracking-tighter">DLX</span>
                        <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Next Gen</span>
                    </div>
                    </div>
                    <p className="text-sm text-muted-foreground/80 leading-relaxed max-w-xs">
                        The ultimate media extraction toolkit for the modern web. 
                        Safe, fast, and private video downloads across all major platforms.
                    </p>
                    <div className="flex gap-4">
                        <SocialLink href="#" icon={<FaSquareXTwitter />} />
                        <SocialLink href="#" icon={<FaDiscord />} />
                        <SocialLink href="#" icon={<FaGithub />} />
                        <SocialLink href="#" icon={<FaFacebook />} />
                        <SocialLink href="#" icon={<FaYoutube />} />
                        <SocialLink href="#" icon={<FaTiktok />} />
                    </div>
                </div>

                {/* Navigation Columns */}
                <div>
                    <h4 className="font-bold text-sm mb-6 uppercase tracking-widest text-primary">Product</h4>
                    <ul className="space-y-4 text-sm text-muted-foreground/80 font-medium">
                        <li><a href="#" className="hover:text-primary transition-colors">Features</a></li>
                        <li><a href="#" className="hover:text-primary transition-colors">Platform Support</a></li>
                        <li><a href="#" className="hover:text-primary transition-colors">CLI Tool</a></li>
                        <li><a href="#" className="hover:text-primary transition-colors">Chrome Extension</a></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold text-sm mb-6 uppercase tracking-widest text-primary">Resources</h4>
                    <ul className="space-y-4 text-sm text-muted-foreground/80 font-medium">
                        <li><a href="#" className="hover:text-primary transition-colors">Documentation</a></li>
                        <li><a href="#" className="hover:text-primary transition-colors">API Reference</a></li>
                        <li><a href="#" className="hover:text-primary transition-colors">Status Page</a></li>
                        <li><a href="#" className="hover:text-primary transition-colors">Community</a></li>
                    </ul>
                </div>

                <div>
                    <h4 className="font-bold text-sm mb-6 uppercase tracking-widest text-primary">Support</h4>
                    <ul className="space-y-4 text-sm text-muted-foreground/80 font-medium">
                        <li><a href="#" className="hover:text-primary transition-colors">Help Center</a></li>
                        <li><a href="#" className="hover:text-primary transition-colors">Discord Server</a></li>
                        <li><a href="#" className="hover:text-primary transition-colors">Contact Us</a></li>
                        <li><a href="#" className="hover:text-primary transition-colors">Sponsorships</a></li>
                    </ul>
                </div>
            </div>

            {/* Bottom Bar */}
            <div className="pt-8 border-t flex flex-col md:flex-row justify-between items-center gap-6">
                <p className="text-xs text-muted-foreground/60 font-medium">
                    © 2026 DLX UNIVERSAL. Open source under MIT License.
                </p>
                <div className="flex gap-8 text-xs font-bold text-muted-foreground/40 uppercase tracking-widest font-mono">
                    <a href="#" className="hover:text-primary transition-colors">Privacy Policy</a>
                    <a href="#" className="hover:text-primary transition-colors">Terms of Service</a>
                    <span className="text-primary/20">BUILD 0.0.1_STABLE</span>
                </div>
            </div>
        </div>
      </footer>
    </div>
  )
}

function NavLinks({ className, itemClassName }: { className?: string, itemClassName?: string }) {
    return (
        <div className={cn("flex items-center gap-10", className)}>
            <a href="#features" className={cn("text-sm font-bold opacity-60 hover:opacity-100 hover:text-primary transition-all", itemClassName)}>Features</a>
            <a href="#platforms" className={cn("text-sm font-bold opacity-60 hover:opacity-100 hover:text-primary transition-all", itemClassName)}>Platforms</a>
            <a href="#resources" className={cn("text-sm font-bold opacity-60 hover:opacity-100 hover:text-primary transition-all", itemClassName)}>Docs</a>
        </div>
    )
}

function MobileNav() {
    return (
        <Sheet>
            <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="md:hidden rounded-full">
                    <HiMenu className="h-6 w-6 text-primary" />
                    <span className="sr-only">Open Menu</span>
                </Button>
            </SheetTrigger>
            <SheetContent side="right" className="w-[300px] sm:w-[400px] border-l-primary/10">
                <SheetHeader className="mb-8">
                    <SheetTitle className="flex items-center gap-3">
                        <Logo size={28} className="text-primary" />
                        <div className="flex items-baseline gap-2">
                            <span className="text-xl font-black tracking-tighter">DLX</span>
                            <span className="text-[8px] font-bold text-muted-foreground uppercase tracking-[0.2em]">Next Gen</span>
                        </div>
                    </SheetTitle>
                </SheetHeader>
                <div className="flex flex-col gap-6 px-4">
                    <SheetClose asChild>
                        <a href="#features" className="text-lg font-bold opacity-60 hover:opacity-100 hover:text-primary transition-all">Features</a>
                    </SheetClose>
                    <SheetClose asChild>
                        <a href="#platforms" className="text-lg font-bold opacity-60 hover:opacity-100 hover:text-primary transition-all">Platforms</a>
                    </SheetClose>
                    <SheetClose asChild>
                        <a href="#resources" className="text-lg font-bold opacity-60 hover:opacity-100 hover:text-primary transition-all">Docs</a>
                    </SheetClose>
                </div>
            </SheetContent>
        </Sheet>
    )
}

function ModeToggle() {
    const { setTheme } = useTheme()

    const toggleTheme = () => {
        const isDark = document.documentElement.classList.contains("dark")
        setTheme(isDark ? "light" : "dark")
    }

    return (
        <Button 
            variant="ghost" 
            size="icon" 
            onClick={toggleTheme}
            className="rounded-full h-10 w-10 transition-all duration-300 hover:bg-primary/10 group relative"
            title="Toggle Theme"
        >
            <HiSun className="h-5 w-5 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0 text-primary group-hover:scale-110 dark:group-hover:scale-0" />
            <HiMoon className="absolute h-5 w-5 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100 text-primary group-hover:scale-0 dark:group-hover:scale-110" />
            <span className="sr-only">Toggle theme</span>
        </Button>
    )
}

function SocialLink({ href, icon }: { href: string, icon: React.ReactNode }) {
    return (
        <a href={href} className="flex h-9 w-9 items-center justify-center rounded-lg bg-muted/50 text-muted-foreground hover:bg-primary hover:text-primary-foreground transition-all duration-300">
            {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<{ className?: string }>, { 
                className: "h-5 w-5" 
            })}
        </a>
    )
}



function FeatureItem({ icon, title, description }: { icon: React.ReactNode, title: string, description: string }) {
  return (
    <div className="flex flex-col gap-4">
      <div className="h-12 w-12 rounded-2xl bg-muted/50 flex items-center justify-center text-primary">
        {React.isValidElement(icon) && React.cloneElement(icon as React.ReactElement<{ className?: string }>, { 
          className: "h-6 w-6" 
        })}
      </div>
      <div>
        <h3 className="font-bold text-lg mb-2">{title}</h3>
        <p className="text-muted-foreground leading-relaxed text-sm">{description}</p>
      </div>
      <Button variant="link" className="p-0 h-auto w-fit text-primary font-bold text-xs group uppercase tracking-widest">
        Learn More <HiOutlineChevronRight className="ml-1 h-3 w-3 group-hover:translate-x-1 transition-transform" />
      </Button>
    </div>
  )
}
