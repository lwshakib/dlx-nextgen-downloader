# Flux Video Downloader - Chrome Extension

Flux Chrome Extension is a browser extension that seamlessly integrates with the Flux desktop application to download videos from YouTube, Facebook, TikTok, and other platforms. The extension intercepts video downloads and sends them to the desktop app for processing.

## Features

- **Automatic Download Interception**: Automatically intercepts video downloads initiated in the browser
- **Platform Detection**: Automatically detects and handles YouTube, Facebook, and TikTok videos
- **Quality Selection**: Provides quality selection dropdown for YouTube, Facebook, and TikTok videos
- **Blob URL Handling**: Converts blob URLs to original source URLs when possible
- **Desktop App Integration**: Sends download requests directly to the Flux desktop app via HTTP
- **Video Detection**: Automatically detects video elements on web pages and provides download buttons
- **Smart URL Extraction**: Intelligently extracts video URLs from various page structures

## Prerequisites

- **Flux Desktop App**: The extension requires the Flux desktop application to be running (listening on `http://127.0.0.1:8765`)
- **Chrome Browser**: Chrome or Chromium-based browser (Manifest V3 compatible)
- **Node.js**: Required for development (v18 or higher recommended)

## Installation

### Development Build

1. Clone the repository and navigate to the extension directory:

   ```bash
   cd flux-chrome-extension
   ```

2. Install dependencies:

   ```bash
   npm install
   ```

3. Build the extension:

   ```bash
   npm run build
   ```

4. Load the extension in Chrome:
   - Open Chrome and navigate to `chrome://extensions/`
   - Enable "Developer mode" (toggle in top-right corner)
   - Click "Load unpacked"
   - Select the `dist` directory from the extension folder

### Development Mode

For development with hot-reload:

```bash
npm run dev
```

Then load the extension from the `dist` directory as described above. The extension will automatically rebuild when you make changes.

## Configuration

### Environment Variables

Create a `.env` file in the extension root directory:

```env
VITE_WEB_API_URL=http://localhost:3000
```

This URL should point to your Flux web API server for fetching video metadata (YouTube, Facebook, TikTok).

## How It Works

### Download Interception

The extension uses Chrome's download API to intercept video downloads:

1. **Background Service Worker** (`src/background/index.ts`):

   - Listens for download events (`onDeterminingFilename`, `onCreated`)
   - Cancels Chrome's default download behavior
   - Extracts video URL, title, and metadata
   - Sends download request to desktop app via HTTP POST

2. **Content Script** (`src/content/main.tsx`):
   - Detects video elements on web pages
   - Provides download buttons overlaid on videos
   - Handles platform-specific video URL extraction
   - Fetches available quality options from the web API

### Platform Support

#### YouTube

- Extracts video ID from URL
- Fetches available resolutions and audio tracks
- Provides quality selection dropdown

#### Facebook

- Extracts video ID from URL or DOM
- Supports both public and private videos
- Fetches available resolutions

#### TikTok

- Extracts video URL and authentication tokens
- Handles both regular and short links
- Fetches available quality options

#### Other Platforms

- Direct download support for any video URL
- Blob URL conversion when possible

### Desktop App Communication

The extension communicates with the desktop app via HTTP:

- **Endpoint**: `http://127.0.0.1:8765/download`
- **Method**: POST
- **Payload**:
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

The extension includes retry logic (3 attempts) and shows notifications if the desktop app is not available.

## Project Structure

```
flux-chrome-extension/
├── src/
│   ├── background/          # Background service worker
│   │   └── index.ts         # Download interception logic
│   ├── content/             # Content scripts
│   │   ├── main.tsx         # Content script entry point
│   │   └── views/
│   │       └── App.tsx      # Video detection and download UI
│   ├── popup/               # Extension popup (optional)
│   ├── sidepanel/           # Side panel (optional)
│   └── components/          # Shared React components
├── public/                  # Static assets
│   └── icons/              # Extension icons
├── manifest.config.ts       # Chrome extension manifest configuration
├── vite.config.ts          # Vite build configuration
└── package.json            # Dependencies and scripts
```

## Development

### Available Scripts

- `npm run dev` - Start development server with hot-reload
- `npm run build` - Build extension for production
- `npm run preview` - Preview the built extension

### Tech Stack

- **React 19**: UI framework
- **TypeScript**: Type safety
- **Vite**: Build tool and dev server
- **CRXJS Vite Plugin**: Chrome extension development
- **Tailwind CSS v4**: Styling

### Building for Production

```bash
npm run build
```

The built extension will be in the `dist` directory, ready to be loaded into Chrome or packaged for distribution.

## Troubleshooting

### Extension Not Intercepting Downloads

1. Ensure the desktop app is running and listening on port 8765
2. Check browser console for errors (right-click extension icon → Inspect popup)
3. Verify extension permissions in `chrome://extensions/`

### Desktop App Connection Failed

- Make sure the Flux desktop app is running
- Check that the app is listening on `http://127.0.0.1:8765`
- Verify firewall settings aren't blocking localhost connections

### Quality Selection Not Appearing

- Ensure `VITE_WEB_API_URL` is set correctly in `.env`
- Check that the web API server is running and accessible
- Verify the video platform is supported (YouTube, Facebook, TikTok)

### Blob URLs Not Downloading

- Some blob URLs cannot be converted to original sources
- Try downloading the video directly from the platform's interface
- Check browser console for error messages

## Permissions

The extension requires the following permissions:

- `sidePanel`: For side panel UI (optional)
- `contentSettings`: For content script injection
- `downloads`: To intercept and manage downloads
- `notifications`: To show download status notifications
- `tabs`: To access tab information and titles
- `<all_urls>`: To work on all websites

## License

Copyright © 2026 Flux

## Related Projects

- [Flux Desktop App](../flux-desktop-app/README.md) - Electron desktop application
- [Flux Web App](../flux-web-app/README.md) - Next.js web application
