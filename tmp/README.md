# Flux Video Downloader

Flux is a free, cross-platform video downloader for YouTube, Facebook (public and private), TikTok, and more. Available as a web app, desktop application, and Chrome extension.

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)

## Overview

Flux provides multiple ways to download videos:

- **Web App**: Browser-based video downloader with quality selection and server-side crawling
- **Desktop App**: Electron-based desktop application with advanced download management
- **Chrome Extension**: Seamlessly intercepts browser downloads and sends them to the desktop app

All three components work independently or together to provide a comprehensive video downloading solution.

## ✨ Features

### Core Features

- **Multi-platform Support**: Download from YouTube, Facebook, TikTok, and more
- **Quality Selection**: Choose from available resolutions and formats
- **Download Management**: Pause, resume, and cancel downloads (desktop app)
- **Chrome Integration**: Seamless browser-to-desktop workflow
- **Modern UI**: Beautiful, responsive interface with dark mode support
- **Cross-platform**: Web, desktop (Windows/macOS/Linux), and browser extension
- **Private Video Support**: Specialized handling for Facebook private videos
- **Server-side Processing**: Robust crawling with multiple fallback strategies

### Platform-Specific Features

- **YouTube**: Full support with multiple quality options and audio extraction
- **Facebook**: Public and private video support with quality selection
- **TikTok**: Quality selection with authentication token handling
- **Other Platforms**: Direct download support for any video URL

## 🏗️ Project Structure

This repository contains three main components, each with its own directory and can be developed independently:

```
flux-video-downloader/
├── flux-web-app/              # Next.js web application
├── flux-desktop-app/          # Electron desktop application
├── flux-chrome-extension/     # Chrome extension
├── assets/                    # Shared assets (logos, icons)
├── CONTRIBUTING.md            # Contribution guidelines
├── LICENSE                    # MIT License
└── README.md                  # This file
```

### 🌐 flux-web-app

Next.js web application that provides a browser-based interface for downloading videos from various platforms.

**Features:**

- Platform-specific download pages (YouTube, Facebook, Facebook Private Video, TikTok)
- Quality selection and preview
- Server-side video crawling and processing
- Direct download proxy for Facebook videos (bypasses CORS)
- Modern UI with theme switching and mobile-friendly navigation
- Robust crawling layer with RapidAPI, Puppeteer, and custom HTML parsers

**Tech Stack:**

- **Framework**: Next.js 16.0 (App Router)
- **Language**: TypeScript
- **UI Library**: React 19
- **Styling**: Tailwind CSS v4 (via `@tailwindcss/postcss`)
- **UI Components**: shadcn/ui (Radix UI primitives)
- **HTTP Client**: Axios
- **Web Scraping**: Puppeteer
- **Icons**: Lucide React
- **Theming**: next-themes
- **Notifications**: Sonner toasts
- **Form Handling**: React Hook Form with Zod validation

**Key Files:**

- `app/api/crawl/` - Platform-specific crawlers (YouTube, Facebook, TikTok)
- `app/api/download/` - Server-side download proxy
- `app/{platform}/` - Platform-specific download pages
- `utilities/facebook-utils.ts` - Facebook video parsing utilities

### 💻 flux-desktop-app

Electron desktop application for managing video downloads with advanced features.

**Features:**

- Download management (pause, resume, cancel)
- Real-time progress tracking with percentage and file size
- Custom download locations per file
- Chrome extension integration via HTTP server (port 8765)
- Platform-specific workflows (YouTube, Facebook, Facebook Private Video, TikTok)
- Settings management with persistent storage
- Cross-platform support (Windows, macOS, Linux)

**Tech Stack:**

- **Framework**: Electron + React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS v4
- **State Management**: React Hooks
- **Icons**: Lucide React
- **Form Handling**: React Hook Form with Zod validation
- **Notifications**: Sonner toast notifications

**Key Files:**

- `electron/main.ts` - Main process with download handlers and HTTP server
- `src/downloader_app.tsx` - Downloader window component
- `src/pages/` - Platform-specific pages and settings
- `src/components/` - UI components (shadcn/ui)

### 🔌 flux-chrome-extension

Chrome extension that intercepts video downloads and sends them to the desktop app.

**Features:**

- Automatic download interception
- Blob URL handling (converts to original source URLs)
- Platform detection (YouTube, Facebook, TikTok)
- Quality selection dropdown for supported platforms
- Video element detection with overlay download buttons
- Direct communication with desktop app via HTTP

**Tech Stack:**

- **UI Library**: React 19
- **Language**: TypeScript
- **Build Tool**: Vite
- **Extension Framework**: Chrome Extension Manifest V3
- **Extension Plugin**: CRXJS Vite Plugin
- **Styling**: Tailwind CSS v4

**Key Files:**

- `src/background/index.ts` - Background service worker for download interception
- `src/content/views/App.tsx` - Content script with video detection and quality selection
- `manifest.config.ts` - Chrome extension manifest configuration

## 🚀 Getting Started

### Prerequisites

- **Node.js**: v18 or higher
- **npm** or **yarn**
- **Chrome/Chromium** (for testing the extension)
- **RapidAPI Key** (optional, for YouTube crawling in web app)

### Installation

Each component can be installed and run independently:

#### 1. Web App

```bash
cd flux-web-app
npm install

# Create .env.local file
echo "RAPIDAPI_KEY=your_key_here" > .env.local

# Start development server
npm run dev
```

The web app will be available at `http://localhost:3000`

#### 2. Desktop App

```bash
cd flux-desktop-app
npm install

# Start development server
npm run dev
```

#### 3. Chrome Extension

```bash
cd flux-chrome-extension
npm install

# Create .env file (optional)
echo "VITE_WEB_API_URL=http://localhost:3000" > .env

# Build the extension
npm run build

# Load dist/ folder in Chrome as unpacked extension
# Chrome → Extensions → Developer mode → Load unpacked → Select dist/ folder
```

### Environment Variables

**Web App** (`.env.local`):

```env
# YouTube crawling (optional, can use fallbacks)
RAPIDAPI_KEY=your_rapidapi_key
# or
YOUTUBE_RAPIDAPI_KEY=your_rapidapi_key

# Optional: Custom API URL
NEXT_PUBLIC_API_URL=http://localhost:3000
```

**Chrome Extension** (`.env`):

```env
# Web API URL for fetching video metadata
VITE_WEB_API_URL=http://localhost:3000
```

## 📖 Usage

### Web App

1. Navigate to the platform-specific page (e.g., `/youtube`, `/facebook`, `/tiktok`)
2. Paste the video URL
3. Wait for the crawler to fetch available qualities
4. Select your preferred quality
5. Click download

### Desktop App

1. Launch the desktop app
2. Paste a video URL in the appropriate platform page
3. Select quality and download location
4. Manage downloads (pause, resume, cancel) from the downloader window

### Chrome Extension

1. Install the extension in Chrome
2. Ensure the desktop app is running (listening on port 8765)
3. Browse to a video on YouTube, Facebook, or TikTok
4. The extension will automatically detect the video
5. Click the download button and select quality
6. The download request is sent to the desktop app

## 🏛️ Architecture

### System Overview

```mermaid
graph TB
    subgraph "User Browsers"
        Browser[Chrome/Browser]
        YouTube[YouTube.com]
        Facebook[Facebook.com]
        TikTok[TikTok.com]
    end

    subgraph "Flux Components"
        Extension[Chrome Extension<br/>Background + Content Scripts]
        WebApp[Web App<br/>Next.js Server]
        Desktop[Desktop App<br/>Electron]
    end

    subgraph "External Services"
        RapidAPI[RapidAPI<br/>YouTube Data]
        PlatformCDN[Platform CDNs<br/>Video Sources]
    end

    Browser -->|Browse videos| YouTube
    Browser -->|Browse videos| Facebook
    Browser -->|Browse videos| TikTok

    YouTube -->|Intercept downloads| Extension
    Facebook -->|Intercept downloads| Extension
    TikTok -->|Intercept downloads| Extension

    Extension -->|Fetch metadata| WebApp
    Extension -->|Send download request| Desktop

    WebApp -->|Query video data| RapidAPI
    WebApp -->|Scrape/Parse| PlatformCDN

    Desktop -->|Download videos| PlatformCDN
    Desktop -->|Save files| FileSystem[(File System)]

    style Extension fill:#48C774,stroke:#333,stroke-width:2px,color:#fff
    style WebApp fill:#4A86E8,stroke:#333,stroke-width:2px,color:#fff
    style Desktop fill:#E67E22,stroke:#333,stroke-width:2px,color:#fff
```

### Component Communication Flow

```mermaid
sequenceDiagram
    participant User
    participant Browser as Chrome Browser
    participant Extension as Chrome Extension
    participant WebAPI as Web App API
    participant Desktop as Desktop App
    participant CDN as Video CDN
    participant FS as File System

    User->>Browser: Navigate to video platform
    Browser->>Extension: Video page loaded
    Extension->>Extension: Detect video element

    User->>Extension: Click download button
    Extension->>WebAPI: GET /api/crawl/{platform}
    WebAPI->>CDN: Fetch video metadata
    CDN-->>WebAPI: Video info + qualities
    WebAPI-->>Extension: Available qualities

    User->>Extension: Select quality
    Extension->>Desktop: POST /download (URL + quality)
    Desktop->>Desktop: Open downloader window

    Desktop->>CDN: Download video stream
    CDN-->>Desktop: Video data stream
    Desktop->>Desktop: Track progress
    Desktop->>FS: Save video file
    Desktop-->>User: Download complete
```

### Web App Workflow

```mermaid
flowchart TD
    Start([User visits web app]) --> Platform{Select Platform}

    Platform -->|YouTube| YouTubePage[YouTube Page]
    Platform -->|Facebook| FacebookPage[Facebook Page]
    Platform -->|Private FB| PrivateFBPage[Private FB Page]
    Platform -->|TikTok| TikTokPage[TikTok Page]

    YouTubePage --> PasteURL1[Paste Video URL]
    FacebookPage --> PasteURL2[Paste Video URL]
    PrivateFBPage --> PasteURL3[Paste Video URL]
    TikTokPage --> PasteURL4[Paste Video URL]

    PasteURL1 --> Crawl1{API Crawler}
    PasteURL2 --> Crawl2{API Crawler}
    PasteURL3 --> Crawl3{API Crawler}
    PasteURL4 --> Crawl4{API Crawler}

    Crawl1 -->|YouTube| RapidAPI[RapidAPI Service]
    Crawl2 -->|Facebook| Puppeteer[Puppeteer/Scraper]
    Crawl3 -->|Private FB| SessionCrawl[Session-based Crawler]
    Crawl4 -->|TikTok| TikTokScraper[HTML Parser]

    RapidAPI --> Parse[Parse Response]
    Puppeteer --> Parse
    SessionCrawl --> Parse
    TikTokScraper --> Parse

    Parse --> Qualities[Display Available Qualities]
    Qualities --> UserSelect[User Selects Quality]
    UserSelect --> Download[Download Video]
    Download --> End([Complete])

    style RapidAPI fill:#E74C3C,stroke:#333,stroke-width:2px,color:#fff
    style Puppeteer fill:#1ABC9C,stroke:#333,stroke-width:2px,color:#fff
    style Parse fill:#58D68D,stroke:#333,stroke-width:2px,color:#000
    style Download fill:#F39C12,stroke:#333,stroke-width:2px,color:#fff
```

### Desktop App Workflow

```mermaid
flowchart LR
    subgraph "Main Process"
        MainWindow[Main Window]
        DownloaderWindow[Downloader Window]
        HTTPServer[HTTP Server :8765]
        IPC[IPC Handler]
        DownloadMgr[Download Manager]
    end

    subgraph "Renderer Process"
        UI[React UI]
        Pages[Platform Pages]
        Settings[Settings]
    end

    subgraph "External"
        Extension[Chrome Extension]
        CDN[Video CDN]
        FS[(File System)]
    end

    Extension -->|POST /download| HTTPServer
    HTTPServer -->|IPC Message| IPC
    IPC -->|Open Window| DownloaderWindow
    IPC -->|Download Command| DownloadMgr

    MainWindow -->|Navigate| Pages
    Pages -->|User Input| IPC
    IPC -->|Start Download| DownloadMgr

    DownloadMgr -->|Fetch| CDN
    CDN -->|Stream| DownloadMgr
    DownloadMgr -->|Progress| IPC
    IPC -->|Update UI| UI
    DownloadMgr -->|Save| FS

    Settings -->|Save Preferences| IPC
    IPC -->|Persist| FS

    style DownloadMgr fill:#E67E22,stroke:#333,stroke-width:2px,color:#fff
    style HTTPServer fill:#48C774,stroke:#333,stroke-width:2px,color:#fff
    style CDN fill:#4A86E8,stroke:#333,stroke-width:2px,color:#fff
```

### Chrome Extension Workflow

```mermaid
stateDiagram-v2
    [*] --> PageLoad: User visits video site

    PageLoad --> VideoDetection: Content script injected

    VideoDetection --> ShowButton: Video element found
    VideoDetection --> Waiting: No video detected

    ShowButton --> UserClick: User clicks download

    UserClick --> Intercept: Background intercepts download

    Intercept --> CheckPlatform: Detect platform

    CheckPlatform --> FetchMetadata: YouTube/Facebook/TikTok
    CheckPlatform --> DirectDownload: Other platforms

    FetchMetadata --> WebAPI: Request to Web App API
    WebAPI --> ShowQuality: Return available qualities
    ShowQuality --> UserSelect: User selects quality
    UserSelect --> SendToDesktop: Send to Desktop App

    DirectDownload --> SendToDesktop: Send URL directly

    SendToDesktop --> DesktopReceive: Desktop App receives request
    DesktopReceive --> DownloadStart: Download initiated

    DownloadStart --> Progress: Track progress
    Progress --> Complete: Download complete
    Complete --> [*]

    Waiting --> [*]: User leaves page

    note right of FetchMetadata
        Fetches video metadata
        and available qualities
        from Web App API
    end note

    note right of SendToDesktop
        POST request to
        http://127.0.0.1:8765/download
    end note
```

### Complete Download Flow

```mermaid
sequenceDiagram
    autonumber
    actor User
    participant Browser as Chrome Browser
    participant Extension as Chrome Extension
    participant WebAPI as Web App API
    participant Desktop as Desktop App
    participant CDN as Video CDN
    participant FS as File System

    User->>Browser: Opens YouTube/Facebook/TikTok
    Browser->>Extension: Page loads, injects content script

    Extension->>Extension: Detects video element
    Extension->>Browser: Shows download button overlay

    User->>Extension: Clicks download button
    Extension->>Extension: Cancels browser download

    alt Platform supports quality selection
        Extension->>WebAPI: GET /api/crawl/{platform}?url={videoUrl}
        WebAPI->>CDN: Fetch metadata (RapidAPI/Scraper)
        CDN-->>WebAPI: Video metadata + qualities
        WebAPI-->>Extension: JSON with available qualities
        Extension->>User: Shows quality selection dropdown
        User->>Extension: Selects quality
    else Direct download
        Extension->>Extension: Uses direct URL
    end

    Extension->>Desktop: POST http://127.0.0.1:8765/download
    Note over Extension,Desktop: {url, title, quality, cookies}

    Desktop->>Desktop: Opens/downloader window
    Desktop->>CDN: Initiates download (selected URL)

    loop Download progress
        CDN-->>Desktop: Streams video chunks
        Desktop->>Desktop: Updates progress (bytes, %)
        Desktop->>FS: Writes chunks to file
        Desktop->>User: Updates UI progress bar
    end

    CDN-->>Desktop: Download complete
    Desktop->>FS: Finalize file write
    Desktop->>User: Shows success notification
    Desktop->>User: Opens file location
```

### API Communication Diagram

```mermaid
graph TB
    subgraph "Web App API Routes"
        direction TB
        CrawlYouTube[POST /api/crawl/youtube]
        CrawlFacebook[POST /api/crawl/facebook]
        CrawlPrivateFB[POST /api/crawl/facebook-private-video]
        CrawlTikTok[POST /api/crawl/tiktok]
        DownloadFB[GET /api/download]
        DownloadTikTok[GET /api/download/tiktok]
        Health[GET /api/health]
    end

    subgraph "External Services"
        RapidAPI[RapidAPI<br/>YouTube Data API]
        Puppeteer[Puppeteer<br/>Headless Browser]
        Axios[Axios<br/>HTTP Client]
        HTMLParser[HTML Parser<br/>Custom Utility]
    end

    subgraph "Desktop App API"
        DesktopDownload[POST http://127.0.0.1:8765/download]
    end

    CrawlYouTube -->|Requires API Key| RapidAPI
    CrawlFacebook -->|Fallback chain| Puppeteer
    CrawlFacebook -->|Primary method| Axios
    CrawlPrivateFB -->|Session-based| Puppeteer
    CrawlTikTok -->|Extract JSON| HTMLParser
    DownloadFB -->|Proxy request| Axios
    DownloadTikTok -->|Proxy with tokens| Axios

    DesktopDownload -.->|Receives from| Extension[Chrome Extension]
    Extension -.->|Fetches metadata| CrawlYouTube
    Extension -.->|Fetches metadata| CrawlFacebook
    Extension -.->|Fetches metadata| CrawlTikTok

    style CrawlYouTube fill:#E74C3C,stroke:#333,stroke-width:2px,color:#fff
    style CrawlFacebook fill:#1ABC9C,stroke:#333,stroke-width:2px,color:#fff
    style CrawlTikTok fill:#F39C12,stroke:#333,stroke-width:2px,color:#fff
    style DesktopDownload fill:#E67E22,stroke:#333,stroke-width:2px,color:#fff
```

### How It Works - Step by Step

#### 1. Web App Download Process

```mermaid
flowchart TD
    A[User visits flux-web-app] --> B[Navigate to platform page]
    B --> C{Paste video URL}
    C --> D[Submit URL]
    D --> E[API crawler processes]

    E --> F{Platform Type}
    F -->|YouTube| G[Use RapidAPI]
    F -->|Facebook| H[Use Puppeteer/Axios]
    F -->|TikTok| I[Parse HTML/JSON]

    G --> J[Extract video formats]
    H --> J
    I --> J

    J --> K[Display quality options]
    K --> L[User selects quality]
    L --> M[Download video]
    M --> N[Save to browser downloads]

    style G fill:#E74C3C,stroke:#333,stroke-width:2px,color:#fff
    style H fill:#1ABC9C,stroke:#333,stroke-width:2px,color:#fff
    style I fill:#F39C12,stroke:#333,stroke-width:2px,color:#fff
    style M fill:#58D68D,stroke:#333,stroke-width:2px,color:#000
```

#### 2. Desktop App Download Process

```mermaid
flowchart TD
    A[Desktop App Running] --> B[HTTP Server on :8765]
    B --> C{Request Source}

    C -->|Chrome Extension| D[Receive POST /download]
    C -->|Manual Input| E[User pastes URL]

    D --> F[Parse request body]
    E --> G[User selects platform]

    F --> H[Extract URL, quality, cookies]
    G --> I[Navigate to platform page]

    H --> J[Open downloader window]
    I --> K[Fetch video metadata]

    J --> L[Display download UI]
    K --> L

    L --> M[User confirms download]
    M --> N[Start download stream]

    N --> O[Track progress]
    O --> P{Download Status}

    P -->|In Progress| Q[Update progress bar]
    P -->|Paused| R[Wait for resume]
    P -->|Completed| S[Save to file system]
    P -->|Error| T[Show error message]

    Q --> O
    R -->|User resumes| O

    S --> U[Show success notification]
    T --> V[Allow retry]

    style J fill:#E67E22,stroke:#333,stroke-width:2px,color:#fff
    style N fill:#48C774,stroke:#333,stroke-width:2px,color:#fff
    style S fill:#4A86E8,stroke:#333,stroke-width:2px,color:#fff
```

#### 3. Chrome Extension Interception Process

```mermaid
flowchart TD
    A[User browsing video site] --> B[Content script injected]
    B --> C{Video element detected?}

    C -->|Yes| D[Show download button]
    C -->|No| E[Continue monitoring]

    D --> F[User clicks button]
    F --> G[Background script intercepts]

    G --> H{Cancel browser download}
    H --> I[Extract video URL]

    I --> J{Platform type?}
    J -->|YouTube/Facebook/TikTok| K[Fetch metadata from Web API]
    J -->|Other| L[Use direct URL]

    K --> M[Show quality selector]
    M --> N[User selects quality]
    N --> O[Prepare download request]

    L --> O
    O --> P[Send to Desktop App]

    P --> Q{Desktop App reachable?}
    Q -->|Yes| R[POST to :8765/download]
    Q -->|No| S[Show error notification]

    R --> T[Desktop App receives]
    T --> U[Download initiated]

    style G fill:#48C774,stroke:#333,stroke-width:2px,color:#fff
    style K fill:#4A86E8,stroke:#333,stroke-width:2px,color:#fff
    style R fill:#E67E22,stroke:#333,stroke-width:2px,color:#fff
```

### API Endpoints

**Web App** (`/api/*`):

- `POST /api/crawl/youtube` - Fetch YouTube metadata and formats
- `POST /api/crawl/facebook` - Crawl Facebook public videos
- `POST /api/crawl/facebook-private-video` - Crawl Facebook private videos
- `POST /api/crawl/tiktok` - Scrape TikTok video data
- `GET /api/download` - Proxy Facebook video downloads
- `GET /api/download/tiktok` - Proxy TikTok video downloads
- `GET /api/health` - Health check endpoint

**Desktop App** (`http://127.0.0.1:8765`):

- `POST /download` - Receive download requests from Chrome extension

## 🔄 How It Works

### Overview

Flux is a distributed video downloading system with three interconnected components that can work independently or together:

1. **Web App**: Handles browser-based video downloads with server-side crawling
2. **Desktop App**: Manages downloads with advanced features (pause, resume, progress tracking)
3. **Chrome Extension**: Seamlessly integrates browser and desktop workflows

### Workflow Modes

#### Mode 1: Standalone Web App

```mermaid
flowchart LR
    User[User] --> Web[Web App]
    Web --> Crawler[Crawler API]
    Crawler --> CDN[Video CDN]
    CDN --> Web
    Web --> BrowserDL[Browser Download]
    BrowserDL --> User
```

**Process:**

1. User visits web app and navigates to platform page (e.g., `/youtube`)
2. User pastes video URL
3. Frontend sends request to Next.js API route (`/api/crawl/{platform}`)
4. API crawler fetches video metadata using appropriate method:
   - **YouTube**: RapidAPI integration
   - **Facebook**: Puppeteer headless browser or Axios with HTML parsing
   - **TikTok**: HTML/JSON parsing from page source
5. API returns available video qualities and formats
6. User selects desired quality
7. Video downloads directly through browser or via proxy endpoint

#### Mode 2: Desktop App with Manual Input

```mermaid
flowchart TB
    User[User] --> Desktop[Desktop App]
    Desktop --> Pages[Platform Pages]
    Pages --> IPC[IPC Communication]
    IPC --> Main[Main Process]
    Main --> DownloadMgr[Download Manager]
    DownloadMgr --> CDN[Video CDN]
    CDN --> DownloadMgr
    DownloadMgr --> FS[(File System)]
    FS --> User
```

**Process:**

1. User opens desktop app
2. Navigates to platform page (YouTube, Facebook, TikTok, etc.)
3. Pastes video URL in input field
4. Desktop app processes URL and fetches metadata
5. User selects quality and download location
6. Download manager initiates download with progress tracking
7. User can pause, resume, or cancel downloads
8. Completed files saved to selected location

#### Mode 3: Chrome Extension + Desktop App Integration

```mermaid
flowchart TB
    Browser[User Browsing] --> Video[Video Platform]
    Video --> Extension[Chrome Extension]
    Extension --> Detect[Detects Video]
    Detect --> Button[Shows Download Button]
    Button --> UserClick[User Clicks]
    UserClick --> Metadata{Need Metadata?}
    Metadata -->|Yes| WebAPI[Web App API]
    Metadata -->|No| Direct[Direct URL]
    WebAPI --> Qualities[Quality Options]
    Qualities --> Select[User Selects]
    Select --> Desktop[Desktop App]
    Direct --> Desktop
    Desktop --> Download[Download Manager]
    Download --> FS[(File System)]
```

**Process:**

1. User browses YouTube/Facebook/TikTok in Chrome
2. Chrome extension content script injects into page
3. Extension detects video element and shows download button overlay
4. User clicks download button
5. Extension's background script intercepts browser download and cancels it
6. Extension identifies platform and extracts video URL
7. **If quality selection needed**: Extension fetches metadata from Web App API
8. Extension shows quality selector (if available)
9. User selects quality
10. Extension sends POST request to Desktop App at `http://127.0.0.1:8765/download`
11. Desktop App receives request and opens downloader window
12. Desktop App downloads video with progress tracking
13. Video saved to user's selected location

### Component Responsibilities

#### Web App Responsibilities

- **Crawling**: Fetch video metadata from platforms using various methods
- **Quality Extraction**: Parse available video formats and resolutions
- **Download Proxy**: Server-side proxy for platforms with CORS restrictions
- **API Service**: Provide RESTful API for other components (extension, desktop)

#### Desktop App Responsibilities

- **Download Management**: Handle video downloads with pause/resume/cancel
- **Progress Tracking**: Real-time progress updates (bytes, percentage)
- **File Management**: Save files to user-selected locations
- **HTTP Server**: Accept download requests from Chrome extension
- **Settings Storage**: Persist user preferences and configurations

#### Chrome Extension Responsibilities

- **Video Detection**: Identify video elements on web pages
- **Download Interception**: Cancel browser downloads and route to desktop app
- **Metadata Fetching**: Retrieve video quality options from Web App API
- **UI Integration**: Overlay download buttons and quality selectors
- **Communication**: Send download requests to Desktop App

### Data Flow

```mermaid
graph TD
    subgraph "Input Sources"
        WebInput[Web App UI]
        DesktopInput[Desktop App UI]
        ExtensionInput[Chrome Extension]
    end

    subgraph "Processing Layer"
        WebCrawler[Web App Crawlers]
        DesktopCrawler[Desktop Crawlers]
        ExtensionProcessor[Extension Processor]
    end

    subgraph "Video Sources"
        YouTubeCDN[YouTube CDN]
        FacebookCDN[Facebook CDN]
        TikTokCDN[TikTok CDN]
        OtherCDN[Other Platforms]
    end

    subgraph "Output Destinations"
        BrowserDL[Browser Downloads]
        DesktopFS[Desktop File System]
    end

    WebInput --> WebCrawler
    DesktopInput --> DesktopCrawler
    ExtensionInput --> ExtensionProcessor

    WebCrawler --> YouTubeCDN
    WebCrawler --> FacebookCDN
    WebCrawler --> TikTokCDN
    DesktopCrawler --> YouTubeCDN
    DesktopCrawler --> FacebookCDN
    DesktopCrawler --> TikTokCDN
    ExtensionProcessor --> DesktopCrawler

    WebCrawler --> BrowserDL
    DesktopCrawler --> DesktopFS

    YouTubeCDN -.->|Stream| BrowserDL
    YouTubeCDN -.->|Stream| DesktopFS
    FacebookCDN -.->|Stream| BrowserDL
    FacebookCDN -.->|Stream| DesktopFS
    TikTokCDN -.->|Stream| BrowserDL
    TikTokCDN -.->|Stream| DesktopFS
    OtherCDN -.->|Stream| BrowserDL
    OtherCDN -.->|Stream| DesktopFS
```

### Key Technologies & Their Roles

- **Next.js (Web App)**: Server-side rendering, API routes for crawling
- **Electron (Desktop App)**: Cross-platform desktop application, IPC communication
- **Puppeteer (Web App)**: Headless browser for scraping dynamic content
- **RapidAPI (Web App)**: External service for YouTube metadata
- **HTTP Server (Desktop App)**: Local server for extension communication
- **Chrome Extensions API**: Download interception, content scripts
- **React (All Components)**: UI framework for all three components
- **TypeScript**: Type safety across all components

## 🛠️ Development

### Available Scripts

**Web App:**

- `npm run dev` - Start development server
- `npm run build` - Build for production
- `npm run start` - Run production server
- `npm run lint` - Run ESLint

**Desktop App:**

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build for production (includes Electron Builder)
- `npm run lint` - Run ESLint

**Chrome Extension:**

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build extension for production
- `npm run preview` - Preview the built extension

### Building for Production

**Desktop App:**

```bash
cd flux-desktop-app
npm run build
```

Builds are output to `release/{version}/` directory for Windows, macOS, and Linux.

**Web App:**

```bash
cd flux-web-app
npm run build
npm run start
```

**Chrome Extension:**

```bash
cd flux-chrome-extension
npm run build
```

The built extension is in the `dist/` directory.

## 🤝 Contributing

We welcome contributions! Please see [CONTRIBUTING.md](CONTRIBUTING.md) for detailed guidelines on:

- Code of conduct
- Development setup
- Coding standards
- Git workflow
- Pull request process
- Testing guidelines

### Quick Contribution Guide

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Make your changes following the coding standards
4. Test your changes
5. Commit your changes (`git commit -m 'feat: add amazing feature'`)
6. Push to the branch (`git push origin feature/amazing-feature`)
7. Open a Pull Request

## 📝 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

Copyright (c) 2025 Shakib Khan

## 📚 Documentation

For more detailed information about each component, see:

- [flux-web-app/README.md](flux-web-app/README.md) - Web application documentation
- [flux-desktop-app/README.md](flux-desktop-app/README.md) - Desktop application documentation
- [flux-chrome-extension/README.md](flux-chrome-extension/README.md) - Chrome extension documentation

## 🙏 Acknowledgments

- Built with [Next.js](https://nextjs.org/), [Electron](https://www.electronjs.org/), and [React](https://react.dev/)
- UI components from [shadcn/ui](https://ui.shadcn.com/)
- Icons from [Lucide](https://lucide.dev/)

## 📮 Support

For issues, questions, or contributions, please open an issue on GitHub or refer to the [CONTRIBUTING.md](CONTRIBUTING.md) guide.
