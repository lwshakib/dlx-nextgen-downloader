import * as React from "react"
import { createFileRoute } from "@tanstack/react-router"
import { Button } from "@workspace/ui/components/button"
import { Card, CardContent, CardHeader, CardTitle } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Input } from "@workspace/ui/components/input"
import { Logo } from "@workspace/ui/components/logo"
import { HiDownload, HiShieldCheck, HiOutlineLightningBolt, HiOutlineChevronRight } from "react-icons/hi"
import { FaYoutube, FaFacebook, FaTiktok } from "react-icons/fa"
import { BiGlobe } from "react-icons/bi"

export const Route = createFileRoute("/")({ component: LandingPage })

function LandingPage() {
  return (
    <div className="flex min-h-screen flex-col bg-background text-foreground font-sans selection:bg-primary/20">
      {/* Minimal Header */}
      <nav className="sticky top-0 z-50 w-full bg-background/50 backdrop-blur-xl transition-all duration-300">
        <div className="container mx-auto flex h-16 items-center justify-between px-6">
          <div className="flex items-center gap-2.5">
            <Logo size={28} className="text-primary" />
            <span className="text-lg font-bold tracking-tight">DLX <span className="text-muted-foreground font-medium">Downloader</span></span>
          </div>
          <div className="flex items-center gap-4">
             <Badge variant="outline" className="hidden sm:flex text-[10px] uppercase font-bold text-muted-foreground border-muted-foreground/20">
                Hotkey <kbd className="ml-1 px-1 font-mono text-primary">D</kbd>
            </Badge>
            <Button variant="ghost" size="sm" className="rounded-full">Docs</Button>
            <Button size="sm" className="rounded-full px-4 font-semibold shadow-lg shadow-primary/20">Sign Up</Button>
          </div>
        </div>
      </nav>

      {/* Hero Section - The Core Utility */}
      <section className="flex flex-1 flex-col items-center justify-center py-20 px-6 text-center lg:py-32">
        <div className="container mx-auto max-w-4xl space-y-8">
          <Badge className="bg-primary/10 text-primary border-primary/20 px-4 py-1.5 rounded-full font-semibold animate-in fade-in slide-in-from-bottom-3 duration-1000">
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

          {/* Core App Interaction */}
          <div className="mx-auto mt-12 max-w-xl w-full">
            <div className="relative group transition-all duration-500">
              <div className="absolute -inset-1 bg-gradient-to-r from-primary to-blue-600 rounded-2xl blur opacity-25 group-focus-within:opacity-50 transition duration-1000" />
              <div className="relative flex p-1.5 bg-card border rounded-2xl shadow-2xl">
                <Input 
                  placeholder="Paste your video URL here..." 
                  className="flex-1 border-none shadow-none bg-transparent h-14 text-base focus-visible:ring-0 px-6"
                />
                <Button size="lg" className="h-14 px-8 rounded-xl font-bold gap-2">
                  <HiDownload className="h-5 w-5" /> Download
                </Button>
              </div>
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs font-medium text-muted-foreground uppercase tracking-widest">
              <span className="flex items-center gap-1.5"><CheckCircleIcon /> MP4 Export</span>
              <span className="flex items-center gap-1.5"><CheckCircleIcon /> AES-128 Ready</span>
              <span className="flex items-center gap-1.5"><CheckCircleIcon /> No Watermark</span>
            </div>
          </div>
        </div>
      </section>

      {/* Platform Support Section */}
      <section className="py-12 border-y bg-muted/20">
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
      <section className="py-24">
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

      {/* Minimal Footer */}
      <footer className="mt-auto border-t py-12">
        <div className="container mx-auto flex flex-col items-center justify-between gap-6 px-6 md:flex-row">
            <div className="flex items-center gap-2.5">
                <Logo size={24} className="text-muted-foreground" />
                <span className="text-sm font-bold tracking-tight opacity-50">DLX UNIVERSAL</span>
            </div>
            <div className="flex gap-8 text-sm font-medium text-muted-foreground/60">
                <a href="#" className="hover:text-primary transition-colors">Privacy</a>
                <a href="#" className="hover:text-primary transition-colors">Terms</a>
                <a href="#" className="hover:text-primary transition-colors">Discord</a>
            </div>
            <p className="text-xs text-muted-foreground/40 font-mono">
                BUILD 0.0.1_STABLE
            </p>
        </div>
      </footer>
    </div>
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
