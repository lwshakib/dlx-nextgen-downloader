# DLX NextGen CLI

The `dlxx` CLI is a fast, interactive Node.js command-line tool for downloading videos directly from your terminal. It is part of the DLX NextGen Downloader ecosystem.

## Features

- **Interactive Prompts**: Built with `inquirer` for an easy-to-use experience without complex arguments.
- **Platform Support**: Downloads videos from:
  - **YouTube**: Supports high-quality adaptive formats (automatically muxes video and audio).
  - **TikTok**: Downloads without watermarks.
  - **Facebook**: Supports both public and private videos.
- **Visual Progress**: Real-time progress bars via `cli-progress` showing percentage, downloaded bytes, and speed.
- **Standalone Engine**: Implements its own scraping logic (client rotation, rehydration extraction) independently from the desktop app.

## Installation

Since this is part of the Turborepo workspace, you can build and link it locally:

```bash
cd apps/cli
pnpm install
pnpm build
```

The binary will be built in the `dist/` directory. You can run it directly:
```bash
node dist/index.js
```

Or you can link it globally using pnpm or npm:
```bash
pnpm link --global
```
Then you can run it from anywhere using:
```bash
dlxx
```

## Usage

Simply run the command:
```bash
dlxx
```

The CLI will prompt you to enter the URL of the video you want to download. 
After analyzing the URL, it will present a list of available qualities and formats. 
Select your preferred option, and the download will begin immediately, saving the file to your current working directory.

## Development

To develop the CLI with hot-reloading:

```bash
pnpm dev
```

This will run `tsc-watch` and automatically execute the CLI on successful compilation.
