# DLX NextGen CLI

The `dlx` CLI is a fast, interactive Node.js command-line tool for downloading videos directly from your terminal.

## Installation

Install the package globally using npm:

```bash
npm install -g @lwshakib/dlx
```

Or using pnpm:

```bash
pnpm add -g @lwshakib/dlx
```

## Usage

Simply run the command from anywhere in your terminal:

```bash
dlx
```

The CLI will prompt you for the video URL and guide you through selecting the quality and format.

## Features

- **Embedded Engine**: Includes its own FFmpeg engine—no need to install external software on your system.
- **Interactive Prompts**: Easy-to-use interface with no complex arguments required.
- **Platform Support**: 
  - **YouTube**: High-quality adaptive formats (4K/1080p) with automatic muxing.
  - **TikTok**: Downloads without watermarks.
  - **Facebook**: Support for public and private videos.
- **Visual Progress**: Real-time progress bars showing speed, size, and percentage.

## Local Development (Build from Source)

If you want to build and run the CLI locally from this repository:

1. **Build the project**:
   ```bash
   cd apps/cli
   pnpm install
   pnpm build
   ```

2. **Run locally**:
   ```bash
   node dist/index.js
   ```

3. **Development with hot-reload**:
   ```bash
   pnpm dev
   ```

4. **Link for global use**:
   ```bash
   pnpm link --global
   ```
