import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Logo } from "@workspace/ui/components/logo"
import { HiDownload, HiShieldCheck, HiOutlineLightningBolt, HiOutlineChevronRight, HiSun, HiMoon } from "react-icons/hi"
import { FaYoutube, FaFacebook, FaTiktok, FaGithub, FaDiscord, FaSquareXTwitter } from "react-icons/fa6"
import { BiGlobe } from "react-icons/bi"
import { useTheme } from "@workspace/ui/components/theme-provider"

export const Route = createFileRoute("/")({ component: LandingPage })

function LandingPage() {
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
          <div className="hidden md:flex items-center gap-10">
            <a href="#features" className="text-sm font-bold opacity-60 hover:opacity-100 hover:text-primary transition-all">Features</a>
            <a href="#platforms" className="text-sm font-bold opacity-60 hover:opacity-100 hover:text-primary transition-all">Platforms</a>
            <a href="#resources" className="text-sm font-bold opacity-60 hover:opacity-100 hover:text-primary transition-all">Docs</a>
          </div>
          <div className="flex items-center gap-4">
            <ModeToggle />
          </div>
        </div>
      </nav>

      {/* Hero Section - The Core Utility */}
      <section className="flex flex-1 flex-col items-center justify-center py-20 px-6 text-center lg:py-32">
        <div className="container mx-auto max-w-4xl space-y-8">
          <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 rounded-full font-semibold">
            Speed. Simplicity. Security.
          </Badge>
          
          <h1 className="text-5xl font-extrabold tracking-tight sm:text-7xl leading-tight">
            Universal Media <br />
            <span className="bg-gradient-to-r from-primary to-blue-500 bg-clip-text text-transparent italic">Extraction.</span>
          </h1>
          
          <p className="mx-auto max-w-2xl text-lg text-muted-foreground/80 leading-relaxed">
            Download high-quality video streams from YouTube, Facebook, and TikTok. 
            Native support for private Facebook videos and multi-threaded processing.
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
                    placeholder="Paste your video URL here..." 
                    className="w-full bg-transparent h-14 pl-12 pr-4 text-base font-medium outline-none placeholder:text-muted-foreground/30 text-foreground"
                  />
                </div>
                
                <button className="h-14 px-8 bg-primary rounded-xl text-primary-foreground font-bold flex items-center justify-center gap-2 hover:bg-primary/90 active:scale-[0.98] transition-all shadow-lg shadow-primary/20">
                  <HiDownload className="h-5 w-5" />
                  <span>Download Now</span>
                </button>
              </div>
            </div>
            
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
      <section id="platforms" className="py-16 border-y border-primary/5 bg-muted/10 blur-sm hover:blur-none transition-all duration-700">
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
      <section id="features" className="py-24">
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
      <footer id="resources" className="mt-auto border-t py-16 bg-card/30">
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

function CheckCircleIcon() {
  return (
    <div className="h-4 w-4 bg-primary/10 rounded-full flex items-center justify-center">
        <div className="h-1.5 w-1.5 bg-primary rounded-full" />
    </div>
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
