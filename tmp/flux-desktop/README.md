# Flux Video Downloader - Desktop App

Flux Desktop App is a free, cross-platform desktop video downloader for YouTube, Facebook (public and private), TikTok, and more. Built with Electron, it provides advanced download management, quality selection, and seamless Chrome extension integration.

## Features

- **Multi-platform Support**: Download videos from YouTube, Facebook (public and private), TikTok, and other platforms
- **Chrome Extension Integration**: Seamlessly intercept downloads from your browser and send them to the desktop app via HTTP server
- **Quality Selection**: Choose from available video resolutions and formats for each platform
- **Download Management**:
  - Pause and resume downloads (for supported platforms)
  - Cancel downloads at any time
  - Real-time progress tracking with percentage and file size
  - Custom download location per file (without changing default settings)
- **Platform-specific Workflows**: Dedicated pages for YouTube, Facebook, Facebook Private Video, and TikTok
- **Settings Management**: Persistent settings storage with customizable download locations
- **Modern UI**: Built with React, TypeScript, and shadcn/ui components
- **Cross-platform**: Available for Windows, macOS, and Linux

## Tech Stack

- **Framework**: Electron + React 18
- **Language**: TypeScript
- **Build Tool**: Vite
- **UI Components**: shadcn/ui (Radix UI primitives)
- **Styling**: Tailwind CSS v4
- **State Management**: React Hooks
- **Icons**: Lucide React
- **Form Handling**: React Hook Form with Zod validation
- **Notifications**: Sonner toast notifications

## Project Structure

```
flux-desktop-app/
├── electron/                    # Electron main process
│   └── main.ts                 # Main process entry point
│       ├── Window management
│       ├── Download handlers
│       ├── IPC communication
│       ├── HTTP server (port 8765) for Chrome extension
│       └── Settings management
├── src/                         # React renderer process
│   ├── App.tsx                 # Main application component
│   ├── downloader_app.tsx      # Downloader window component
│   ├── main.tsx                # Renderer entry point
│   ├── components/             # UI components
│   │   ├── ui/                 # shadcn/ui components
│   │   ├── app-sidebar.tsx     # Main sidebar navigation
│   │   ├── theme-provider.tsx  # Theme management
│   │   └── ...
│   ├── pages/                  # Page components
│   │   ├── home.tsx            # Home page
│   │   ├── crawler.tsx         # Generic crawler page
│   │   ├── youtube-results.tsx # YouTube results page
│   │   ├── facebook-results.tsx # Facebook results page
│   │   ├── facebook-private-video.tsx # Private video page
│   │   ├── tiktok-results.tsx  # TikTok results page
│   │   └── settings.tsx        # Settings page
│   ├── constants/              # App constants
│   │   └── content.ts          # Content mapping
│   ├── hooks/                  # Custom React hooks
│   │   └── use-mobile.ts       # Mobile detection hook
│   └── lib/                    # Utility functions
│       └── utils.ts            # Common utilities
├── public/                     # Static assets
│   └── icons/                  # Application icons (win, mac, png)
├── dist/                       # Built renderer files
├── dist-electron/              # Built Electron main process
├── electron-builder.json5      # Electron Builder configuration
└── package.json                # Dependencies and scripts
```

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm or yarn

### Available Scripts

- `npm run dev` - Start development server with hot reload
- `npm run build` - Build the application for production (includes Electron Builder)
- `npm run lint` - Run ESLint to check code quality
- `npm run preview` - Preview the production build

### Development Mode

When running in development mode (`npm run dev`), DevTools will automatically open for debugging. In production builds, DevTools are disabled.

The app runs two windows in development:
- **Main Window**: Application interface with sidebar navigation
- **Downloader Window**: Opens automatically when receiving download requests from Chrome extension

## Key Features

### Download Management

- **Pause/Resume**: Pause and resume downloads for platforms that support it (not available for YouTube/TikTok fetch-based downloads)
- **Cancel**: Cancel any download at any time (except after completion)
- **Progress Tracking**: Real-time download progress with percentage and file size
- **Custom Location**: Select a custom download location for individual files without changing default settings
- **Download History**: View active and completed downloads in the downloader window

### Chrome Extension Integration

The desktop app runs an HTTP server on port 8765 to receive download requests from the Chrome extension. When you download a video in your browser, the extension intercepts it and sends the URL to the desktop app for handling.

**API Endpoint**: `POST http://127.0.0.1:8765/download`

**Request Body**:
```json
{
  "url": "video-url",
  "title": "Video Title",
  "cookies": {
    "msToken": "...",
    "ttChainToken": "..."
  }
}
```

The desktop app automatically opens the downloader window when receiving a download request.

### Platform Support

- **YouTube**: Full support with quality selection via web API
- **Facebook**: Public and private video support with quality selection
- **TikTok**: Quality selection with authentication tokens (msToken, ttChainToken)
- **Other Platforms**: Direct download support for any video URL

### Settings

User settings are stored in `~/.flux/settings.json` (or `%USERPROFILE%\.flux\settings.json` on Windows) and include:

- Default download location
- Theme preferences (light/dark/system)
- Other user preferences

Settings are automatically loaded on app startup and saved when changed.

## Build Configuration

The app is configured to build for:

- **Windows**: NSIS installer (x64)
  - Allows custom installation directory
  - Creates desktop and start menu shortcuts
  - Artifact: `Flux Video Downloader-Windows-{version}-Setup.exe`
- **macOS**: DMG package
  - Category: Utilities
  - Artifact: `Flux Video Downloader-Mac-{version}-Installer.dmg`
- **Linux**: AppImage
  - Category: Utility
  - Artifact: `Flux Video Downloader-Linux-{version}.AppImage`

Build outputs are placed in `release/${version}/` directory.

### Building for Production

```bash
npm run build
```

This command:
1. Compiles TypeScript
2. Builds the Vite renderer bundle
3. Builds the Electron main process
4. Packages the app using Electron Builder

## IPC Communication

The app uses Electron's IPC (Inter-Process Communication) for communication between the main process and renderer:

- `download:start` - Start a download
- `download:pause` - Pause a download
- `download:resume` - Resume a download
- `download:cancel` - Cancel a download
- `download:get-progress` - Get download progress
- `settings:get` - Get user settings
- `settings:set` - Update user settings
- `dialog:select-folder` - Open folder selection dialog

## Troubleshooting

### Desktop App Not Receiving Downloads from Extension

1. Ensure the desktop app is running
2. Check that the HTTP server is listening on port 8765
3. Verify firewall settings aren't blocking localhost connections
4. Check the browser console for extension errors

### Downloads Not Starting

1. Verify the video URL is valid
2. Check that the platform is supported
3. For TikTok/Facebook, ensure authentication tokens are provided if needed
4. Check the downloader window for error messages

### Settings Not Persisting

1. Verify write permissions in the home directory
2. Check that `~/.flux/` directory exists and is writable
3. Check console for file system errors

## License

MIT License

Copyright (c) 2025 Shakib Khan

## Related Projects

- [Flux Web App](../flux-web-app/README.md) - Web application for video downloading
- [Flux Chrome Extension](../flux-chrome-extension/README.md) - Browser extension integration
