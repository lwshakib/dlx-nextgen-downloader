import Link from "next/link";
import Image from "next/image";
import {
  Youtube,
  Facebook,
  Lock,
  Music,
  Github,
  Twitter,
  Mail,
  Shield,
  FileText,
  Cookie,
  AlertCircle,
  HelpCircle,
  MessageCircle,
  Info,
  Heart,
  Copyright,
} from "lucide-react";

export function Footer() {
  const currentYear = new Date().getFullYear();

  const platforms = [
    { name: "YouTube", href: "/youtube", icon: Youtube },
    { name: "Facebook", href: "/facebook", icon: Facebook },
    { name: "Facebook Private Video", href: "/facebook-private-video", icon: Lock },
    { name: "TikTok", href: "/tiktok", icon: Music },
  ];

  const legalLinks = [
    { name: "Privacy Policy", href: "/privacy", icon: Shield },
    { name: "Terms of Service", href: "/terms", icon: FileText },
    { name: "Cookie Policy", href: "/cookies", icon: Cookie },
    { name: "Disclaimer", href: "/disclaimer", icon: AlertCircle },
  ];

  const socialLinks = [
    { name: "GitHub", href: "https://github.com", icon: Github },
    { name: "Twitter", href: "https://twitter.com", icon: Twitter },
    { name: "Email", href: "mailto:support@flux.com", icon: Mail },
  ];

  return (
    <footer className="border-t border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900">
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 mb-8">
          {/* Brand Section */}
          <div className="space-y-4">
            <Link href="/" className="flex items-center gap-3">
              <Image
                src="/flux-colorful-logo.svg"
                alt="Flux logo"
                width={32}
                height={32}
              />
              <span className="text-xl font-semibold text-black dark:text-zinc-50">
                Flux
              </span>
            </Link>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Your all-in-one video downloader. Extract and save videos from
              YouTube, Facebook, TikTok, and more.
            </p>
            <div className="flex gap-4">
              {socialLinks.map((social) => {
                const Icon = social.icon;
                return (
                  <a
                    key={social.name}
                    href={social.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                    aria-label={social.name}
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                );
              })}
            </div>
          </div>

          {/* Platforms Section */}
          <div>
            <h3 className="text-sm font-semibold text-black dark:text-zinc-50 mb-4">
              Platforms
            </h3>
            <ul className="space-y-3">
              {platforms.map((platform) => {
                const Icon = platform.icon;
                return (
                  <li key={platform.name}>
                    <Link
                      href={platform.href}
                      className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                      {platform.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Legal Section */}
          <div>
            <h3 className="text-sm font-semibold text-black dark:text-zinc-50 mb-4">
              Legal
            </h3>
            <ul className="space-y-3">
              {legalLinks.map((link) => {
                const Icon = link.icon;
                return (
                  <li key={link.name}>
                    <Link
                      href={link.href}
                      className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                    >
                      <Icon className="h-4 w-4" />
                      {link.name}
                    </Link>
                  </li>
                );
              })}
            </ul>
          </div>

          {/* Support Section */}
          <div>
            <h3 className="text-sm font-semibold text-black dark:text-zinc-50 mb-4">
              Support
            </h3>
            <ul className="space-y-3">
              <li>
                <Link
                  href="/help"
                  className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  <HelpCircle className="h-4 w-4" />
                  Help Center
                </Link>
              </li>
              <li>
                <Link
                  href="/faq"
                  className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  <MessageCircle className="h-4 w-4" />
                  FAQ
                </Link>
              </li>
              <li>
                <Link
                  href="/contact"
                  className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  <Mail className="h-4 w-4" />
                  Contact Us
                </Link>
              </li>
              <li>
                <Link
                  href="/about"
                  className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-50 transition-colors"
                >
                  <Info className="h-4 w-4" />
                  About Us
                </Link>
              </li>
            </ul>
          </div>
        </div>

        {/* Bottom Bar */}
        <div className="border-t border-zinc-200 dark:border-zinc-800 pt-8 mt-8">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <Copyright className="h-4 w-4" />
              <span>{currentYear} Flux. All rights reserved.</span>
            </div>
            <div className="flex items-center gap-2 text-sm text-zinc-600 dark:text-zinc-400">
              <span>Made with</span>
              <Heart className="h-4 w-4 text-red-500 fill-red-500" />
              <span>for video enthusiasts</span>
            </div>
          </div>
        </div>
      </div>
    </footer>
  );
}

