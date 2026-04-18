"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";

import { MobileMenu } from "@/components/mobile-menu";
import { ModeToggle } from "@/components/mode-togle";
import { cn } from "@/lib/utils";

const navLinks = [
  { label: "Youtube", href: "/youtube" },
  { label: "Facebook", href: "/facebook" },
  { label: "Private", href: "/facebook-private-video" },
  { label: "TikTok", href: "/tiktok" },
];

export function Header() {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-50 w-full border-b border-zinc-200 bg-white/80 backdrop-blur-md dark:border-zinc-800 dark:bg-black/70">
      <div className="absolute inset-x-0 top-0 h-px w-full bg-linear-to-r from-red-500 via-purple-500 to-blue-500 opacity-75" />
      <div className="container mx-auto flex h-20 items-center justify-between px-4 sm:px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-3">
          <Image
            src="/flux-colorful-logo.svg"
            alt="Flux logo"
            width={36}
            height={36}
            priority
          />
          <p className="text-base font-semibold leading-tight text-zinc-900 dark:text-white">
            Flux
          </p>
        </Link>

        <nav className="hidden md:flex items-center gap-1 rounded-full border border-zinc-200 bg-white/70 px-1 py-1 text-sm shadow-sm dark:border-zinc-800 dark:bg-zinc-900/70">
          {navLinks.map((link) => {
            const isActive =
              pathname === link.href ||
              (link.href !== "/" &&
                pathname?.startsWith(link.href) &&
                link.href !== "/");

            return (
              <Link
                key={link.href}
                href={link.href}
                className={cn(
                  "rounded-full px-4 py-2 font-medium transition-colors",
                  isActive
                    ? "bg-zinc-900 text-zinc-50 shadow-sm dark:bg-zinc-50 dark:text-zinc-900"
                    : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-white"
                )}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>

        <div className="flex items-center gap-2">
          <ModeToggle />
          <MobileMenu />
        </div>
      </div>
    </header>
  );
}
