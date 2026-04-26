# DLX NextGen Downloader

DLX NextGen Downloader is a comprehensive suite of applications designed for high-performance video downloading from popular platforms such as YouTube, TikTok, and Facebook. 

It provides an integrated ecosystem consisting of a Desktop App, a CLI tool, a Chrome Extension, and a Web application, all working seamlessly to deliver a fast and reliable downloading experience.

## Ecosystem Overview

The project is structured as a monorepo using `pnpm` and `turbo`, containing the following packages and applications:

### Apps
* **`apps/desktop`**: A standalone, high-performance Electron desktop application built with React, Vite, and Shadcn/UI. It features a modern interface, built-in scrapers, multi-threaded downloading, and FFmpeg integration for adaptive formats.
* **`apps/cli`**: A fast, interactive Node.js command-line interface for downloading videos directly from your terminal. It features interactive prompts and detailed download progress bars.
* **`apps/extension`**: A Chrome extension that integrates directly with your browser to intercept video downloads and send them to the DLX Desktop App for processing.
* **`apps/web`**: A modern web interface built with TanStack Start, utilizing the shared UI component library.

### Packages
* **`packages/ui`**: A shared component library based on Shadcn/UI, ensuring a consistent design language across the Desktop and Web applications.

## Key Features

* **Multi-Platform Support**: Download videos from YouTube, TikTok (without watermarks), and Facebook (public and private).
* **High Quality**: Supports downloading adaptive streams (e.g., 4K/8K YouTube videos) by downloading video and audio separately and muxing them locally using FFmpeg.
* **Bypass Restrictions**: Advanced scraping techniques, including client rotation and rehydration data extraction, to reliably fetch video metadata.
* **Seamless Integration**: The Chrome Extension can seamlessly detect videos and send download commands directly to the Desktop App via a local HTTP server.

## Getting Started

### Prerequisites

* Node.js (v20+)
* `pnpm` (v9+)
* FFmpeg (Required for the Desktop App to merge adaptive streams)

### Installation

1. Clone the repository:
   ```bash
   git clone <repository-url>
   cd dlx-nextgen-downloader
   ```

2. Install dependencies:
   ```bash
   pnpm install
   ```

3. Build the project:
   ```bash
   pnpm build
   ```

### Running Locally

To run the entire suite in development mode:

```bash
pnpm dev
```

You can also run specific apps by navigating to their directories or using turbo filters:
```bash
pnpm --filter desktop dev
```

## Contributing

We welcome contributions! Please see our [Contributing Guide](CONTRIBUTING.md) for more details on how to get started.

## Code of Conduct

Please review our [Code of Conduct](CODE_OF_CONDUCT.md) before participating in this project.

## License

Copyright © 2026 Flux / DLX NextGen. All rights reserved.
