# Flux Video Downloader - Web App

Flux Web App is a Next.js web application that provides a browser-based interface for downloading videos from YouTube, Facebook (public and private), TikTok, and more. It features platform-specific workflows, quality selection, server-side crawling, and a modern UI with theme switching.

## Features

- **Platform-specific Workflows**: Individual pages for YouTube, Facebook, Facebook Private Video, and TikTok
- **Quality Selection**: Choose from available resolutions and formats with preview
- **Server-side Crawling**: Robust crawling layer with multiple strategies:
  - RapidAPI integration for YouTube
  - Puppeteer and axios fallbacks for Facebook
  - HTML parsing for TikTok
- **Direct Downloads**: Server-side proxy for Facebook CDN assets to bypass CORS limits
- **Modern UI**: Next.js 16 App Router with React 19, Tailwind CSS v4, and shadcn/ui components
- **Theme Switching**: Light/dark mode support with next-themes
- **Mobile-friendly**: Responsive design with mobile navigation
- **Utility Toolbox**: Comprehensive parsing and normalization utilities for video streams

## Tech Stack

- **Framework**: Next.js 16.0 (App Router)
- **Language**: TypeScript
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/postcss`)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Icons**: Lucide React
- **Theming**: next-themes
- **HTTP Client**: Axios
- **Web Scraping**: Puppeteer
- **Notifications**: Sonner toasts
- **Form Handling**: React Hook Form with Zod validation

## Project Structure

```
flux-web-app/
├── app/                        # Next.js App Router
│   ├── api/                    # API routes
│   │   ├── crawl/             # Platform crawlers
│   │   │   ├── youtube/       # YouTube crawler (RapidAPI)
│   │   │   ├── facebook/     # Facebook public video crawler
│   │   │   ├── facebook-private-video/ # Facebook private video crawler
│   │   │   └── tiktok/        # TikTok crawler
│   │   ├── desktop/           # Desktop app API endpoints
│   │   │   └── crawl/         # Desktop-specific crawlers
│   │   ├── download/          # Download proxy endpoints
│   │   │   ├── route.ts      # Facebook download proxy
│   │   │   └── tiktok/       # TikTok download proxy
│   │   └── health/            # Health check endpoint
│   ├── youtube/               # YouTube download page
│   ├── facebook/              # Facebook download page
│   ├── facebook-private-video/ # Facebook private video page
│   ├── tiktok/                # TikTok download page
│   ├── layout.tsx             # Root layout with theme provider
│   ├── page.tsx               # Home/marketing page
│   ├── globals.css             # Global styles and Tailwind
│   └── not-found.tsx          # 404 page
├── components/                 # React components
│   ├── ui/                    # shadcn/ui components
│   ├── header.tsx             # Site header
│   ├── footer.tsx             # Site footer
│   └── theme-toggle.tsx       # Theme switcher
├── hooks/                      # Custom React hooks
│   └── use-mobile.ts          # Mobile detection hook
├── utilities/                  # Utility functions
│   └── facebook-utils.ts      # Facebook video parsing utilities
│       ├── MP4 extraction
│       ├── DASH manifest decoding
│       └── Metadata formatting
├── lib/                        # Library utilities
│   └── utils.ts               # Common utilities (cn, etc.)
├── public/                     # Static assets
│   └── logos/                 # Brand logos and SVGs
└── .next/                      # Build artifacts (gitignored)
```

## API Overview

### Crawl Endpoints

| Route | Method | Purpose | Notes |
|-------|--------|---------|-------|
| `/api/crawl/youtube` | POST | Fetches YouTube metadata and adaptive formats | Requires `RAPIDAPI_KEY` or `YOUTUBE_RAPIDAPI_KEY` |
| `/api/crawl/facebook` | POST | Crawls Facebook public videos using Puppeteer/axios | Extracts MP4/M3U8 streams via regex and manifest parsing |
| `/api/crawl/facebook-private-video` | POST | Specialized crawler for private Facebook videos | Designed for authenticated session data |
| `/api/crawl/tiktok` | POST | Scrapes TikTok embedded JSON data | Preserves msToken/ttChainToken for follow-up requests |

### Download Endpoints

| Route | Method | Purpose | Notes |
|-------|--------|---------|-------|
| `/api/download` | GET | Proxies Facebook CDN video responses server-side | Adds `Content-Disposition` for consistent filenames, bypasses CORS |
| `/api/download/tiktok` | GET | Proxies TikTok video downloads | Handles authentication tokens |

### Utility Endpoints

| Route | Method | Purpose |
|-------|--------|---------|
| `/api/health` | GET | Returns `{ status: "ok" }` for uptime checks |

### Request/Response Format

**Crawl Request**:
```json
{
  "url": "https://www.youtube.com/watch?v=..."
}
```

**Crawl Response** (YouTube example):
```json
{
  "status": "ok",
  "videoId": "...",
  "title": "Video Title",
  "thumbnail": "https://...",
  "resolutions": [
    {
      "url": "https://...",
      "qualityLabel": "1080p",
      "width": 1920,
      "height": 1080,
      "mimeType": "video/mp4"
    }
  ],
  "audio": {
    "url": "https://...",
    "mimeType": "audio/mp4",
    "audioQuality": "AUDIO_QUALITY_HIGH"
  }
}
```

## Environment Variables

Create `.env.local` in the project root:

```env
# YouTube crawling (required for YouTube support)
RAPIDAPI_KEY=your_rapidapi_key
# or
YOUTUBE_RAPIDAPI_KEY=your_rapidapi_key

# Optional: Custom API URL for Chrome extension
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Note**: Only YouTube crawling requires RapidAPI. Facebook and TikTok routes scrape directly but may require additional configuration (cookies, proxy settings) based on your deployment environment.

## Getting Started

### Prerequisites

- Node.js 18.17+ (matching Next.js 16 requirement)
- npm or yarn
- For Puppeteer: Chrome dependencies (or fall back to axios-only crawling)

### Installation

1. Install dependencies:
   ```bash
   npm install
   ```

2. Set up environment variables:
   ```bash
   cp .env.example .env.local
   # Edit .env.local with your RapidAPI key
   ```

3. Launch development server:
   ```bash
   npm run dev
   ```
   The app will be available at `http://localhost:3000`

### Available Scripts

- `npm run dev` - Start development server (defaults to `http://localhost:3000`)
- `npm run build` - Build for production
- `npm run start` - Run production server
- `npm run lint` - Lint all files with ESLint

## Development Notes

### Component Styling

- Tailwind utilities are defined in `app/globals.css`
- shadcn tokens/components use the "new-york" theme defined in `components.json`
- Use the `cn()` utility from `lib/utils.ts` for conditional class merging

### Client vs Server Components

- UI pages dealing with form state are client components (`"use client"`)
- API routes run on the Edge/Node runtime (default) and can use:
  - Node APIs
  - Puppeteer
  - File system access
  - External HTTP requests

### Extending Providers

To add a new video platform:

1. Create a new page under `app/{provider}/page.tsx`
2. Register a crawler under `app/api/crawl/{provider}/route.ts`
3. Reuse utilities from `lib/utils.ts` and `utilities/`
4. Share UI primitives via `components/ui`

### Testing Crawlers

1. Verify the server is running: `GET /api/health`
2. Test crawler endpoint:
   ```bash
   curl -X POST http://localhost:3000/api/crawl/youtube \
     -H "Content-Type: application/json" \
     -d '{"url": "https://www.youtube.com/watch?v=..."}'
   ```
3. Inspect JSON response for `resolutions`, `mimeType`, and tokens
4. Wire into UI components

## Deployment Tips

### Puppeteer Considerations

- Disable Puppeteer when not supported by hosting platform
- Or bundle `puppeteer-core` with a compatible Chrome binary
- Consider using axios-only fallback for serverless environments

### Performance Optimization

- Add rate limiting and API key validation before exposing crawl routes publicly
- Cache responses (e.g., via Redis or Next.js Route Handlers with `revalidate`) to avoid repeated RapidAPI calls for the same video ID
- Use Next.js Image optimization for thumbnails

### Security

- Never expose RapidAPI keys in client-side code
- Validate and sanitize all user-provided URLs
- Implement rate limiting for API endpoints
- Use environment variables for all sensitive configuration

## Facebook Utilities

The `utilities/facebook-utils.ts` module provides comprehensive parsing helpers:

- **MP4 Extraction**: Extracts direct MP4 URLs from Facebook HTML
- **DASH Manifest Decoding**: Parses DASH manifests for quality options
- **Metadata Formatting**: Normalizes video metadata and quality labels
- **Stream Normalization**: Handles dozens of stream variations

## Chrome Extension Integration

The web app can be used by the Chrome extension to fetch video metadata:

1. Extension detects video on page
2. Extension calls web app's crawl API
3. Web app returns available qualities
4. Extension shows quality selection dropdown
5. User selects quality, extension sends to desktop app

Set `VITE_WEB_API_URL` in the Chrome extension's `.env` to point to your web app URL.

## License

MIT License

Copyright (c) 2025 Shakib Khan

## Related Projects

- [Flux Desktop App](../flux-desktop-app/README.md) - Electron desktop application
- [Flux Chrome Extension](../flux-chrome-extension/README.md) - Browser extension integration
