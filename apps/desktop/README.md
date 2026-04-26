# DLX NextGen Desktop

The DLX NextGen Desktop application is a high-performance, standalone tool for downloading videos from various platforms. Built with Electron, React, Vite, and Shadcn/UI, it offers a seamless and modern user experience.

## Features

- **Modern User Interface**: A beautifully designed, responsive UI built with React, Tailwind CSS, and Shadcn/UI components.
- **Multi-Platform Scraping**: Built-in support for scraping and downloading from:
  - **YouTube**: Bypasses restrictions using client rotation and supports high-resolution adaptive formats.
  - **TikTok**: Downloads watermark-free videos by extracting rehydration data.
  - **Facebook**: Extracts and downloads video and audio streams seamlessly.
- **Advanced Download Engine**: 
  - Multi-threaded downloads using range requests for maximum speed.
  - FFmpeg integration for muxing adaptive video and audio streams (e.g., 4K/8K YouTube).
  - Automatic manual redirect handling to bypass bot protections.
- **Extension Integration**: Runs a local HTTP server (on port 8765) to receive download requests directly from the DLX Chrome Extension.
- **Customizable Settings**: Configurable download locations, themes (dark/light mode), and system tray integration.

## Prerequisites

- Node.js (v20+)
- `pnpm` (v9+)
- **FFmpeg**: Required for merging adaptive video and audio streams. 
- **Chocolatey** (Windows only): Used to install FFmpeg if not present.

## Getting Started

1. Navigate to the desktop app directory:
   ```bash
   cd apps/desktop
   ```

2. Install dependencies (if you haven't run `pnpm install` at the workspace root):
   ```bash
   pnpm install
   ```

3. Start the development server:
   ```bash
   pnpm dev
   ```
   This will start Vite for the renderer process and compile the Electron main process.

## Building for Production

To build the executable for your platform:

```bash
pnpm build
```

This will compile TypeScript, build the Vite app, and package it using `electron-builder`. The output will be in the `dist` or `release` directory depending on your `electron-builder.json5` configuration.

## Architecture

- `src/`: Contains the React frontend code (Renderer process).
- `electron/`: Contains the Electron backend code (Main process).
  - `main.ts`: Handles window lifecycle, IPC communications, download management, and the local HTTP server.
  - `scrapers.ts`: Contains the core logic for crawling YouTube, TikTok, and Facebook.
  - `preload.ts`: Securely exposes selected Node.js and Electron APIs to the renderer process via context isolation.
