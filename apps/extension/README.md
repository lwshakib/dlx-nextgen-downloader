# DLX NextGen Chrome Extension

The DLX NextGen Chrome Extension is a powerful browser extension that seamlessly integrates with the DLX NextGen Desktop application to download videos from YouTube, Facebook, TikTok, and other platforms directly from your browser.

## Features

- **Automatic Download Interception**: Automatically intercepts video downloads initiated in the browser.
- **Platform Detection**: Automatically detects and handles YouTube, Facebook, and TikTok videos.
- **Quality Selection**: Provides quality selection dropdowns directly on the webpage for supported platforms.
- **Desktop Integration**: Sends download requests directly to the DLX NextGen Desktop app via a local HTTP server (`http://127.0.0.1:8765`).
- **Video Detection**: Automatically detects video elements on web pages and injects floating download buttons.

## Prerequisites

- **DLX NextGen Desktop App**: The extension requires the Desktop application to be running.
- **Chrome Browser**: Chrome or any Chromium-based browser (Manifest V3 compatible).

## Installation

### Development Build

1. Clone the repository and navigate to the extension directory:
   ```bash
   cd apps/extension
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the extension:
   ```bash
   pnpm build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `dist` directory from the `apps/extension` folder.

### Development Mode

For development with hot-reload:
```bash
pnpm dev
```
Then load the `dist` directory. The extension will automatically rebuild when you make changes.

## How It Works

### Download Interception

1. **Background Service Worker** (`src/background/index.ts`):
   - Listens for download events.
   - Extracts video URL, title, and metadata.
   - Sends the download request to the desktop app via HTTP POST.

2. **Content Script** (`src/content/main.tsx`):
   - Detects video elements.
   - Provides download buttons overlaid on videos.
   - Handles platform-specific video URL extraction.

### Desktop App Communication

The extension communicates with the desktop app via HTTP:
- **Endpoint**: `http://127.0.0.1:8765/download`
- **Method**: POST
- **Payload Example**:
  ```json
  {
    "url": "https://example.com/video.mp4",
    "title": "Awesome Video",
    "cookies": {
      "msToken": "...",
      "ttChainToken": "..."
    }
  }
  ```

## Troubleshooting

- **Extension Not Intercepting Downloads**: Ensure the desktop app is running and listening on port 8765. Verify firewall settings aren't blocking localhost connections.
- **Quality Selection Not Appearing**: Ensure you are on a supported platform (YouTube, Facebook, TikTok).
- **Desktop App Connection Failed**: Make sure the DLX NextGen Desktop app is open.

## Tech Stack

- **React 19**: UI framework for injected components.
- **Vite & CRXJS**: Build tool and Chrome extension development plugin.
- **Tailwind CSS v4**: Styling.
