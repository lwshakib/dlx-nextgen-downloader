import {
  app,
  BrowserWindow,
  dialog,
  ipcMain,
  Menu,
  Notification,
  shell,
  Tray,
} from "electron";
// import { createRequire } from 'node:module'
import { execSync, spawn } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";

// const require = createRequire(import.meta.url)
const __dirname = path.dirname(fileURLToPath(import.meta.url));

// The built directory structure
//
// ├─┬─┬ dist
// │ │ └── index.html
// │ │
// │ ├─┬ dist-electron
// │ │ ├── main.js
// │ │ └── preload.mjs
// │
process.env.APP_ROOT = path.join(__dirname, "..");

// 🚧 Use ['ENV_NAME'] avoid vite:define plugin - Vite@2.x
export const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
export const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
export const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");

// Platform-specific icon paths
const getIconPath = (): string => {
  const platform = process.platform;
  const basePath = process.env.APP_ROOT;

  switch (platform) {
    case "win32":
      return path.join(basePath, "public", "icons", "win", "icon.ico");
    case "darwin":
      return path.join(basePath, "public", "icons", "mac", "icon.icns");
    case "linux":
    default:
      return path.join(basePath, "public", "icons", "png", "256x256.png");
  }
};

const iconPath = getIconPath();

// Get tray icon path (smaller icon for system tray)
const getTrayIconPath = (): string => {
  const platform = process.platform;
  const basePath = process.env.APP_ROOT;

  switch (platform) {
    case "win32":
      // Windows can use ICO or PNG
      return path.join(basePath, "public", "icons", "png", "32x32.png");
    case "darwin":
      // macOS uses template images for better appearance
      return path.join(basePath, "public", "icons", "png", "32x32.png");
    case "linux":
    default:
      return path.join(basePath, "public", "icons", "png", "32x32.png");
  }
};

const trayIconPath = getTrayIconPath();

const getSettingsPaths = () => {
  const homeDir = process.env.USERPROFILE || os.homedir();
  const settingsDir = path.join(homeDir, ".flux");
  const settingsFile = path.join(settingsDir, "settings.json");
  return { settingsDir, settingsFile };
};

const ensureSettingsFile = async () => {
  const { settingsDir, settingsFile } = getSettingsPaths();
  const defaultSettings = { downloadLocation: "Downloads" };

  try {
    await fs.mkdir(settingsDir, { recursive: true });
    await fs.access(settingsFile);
  } catch {
    await fs.writeFile(
      settingsFile,
      JSON.stringify(defaultSettings, null, 2),
      "utf-8"
    );
  }
};

// Check if a command is available in PATH
const isCommandAvailable = (command: string): boolean => {
  try {
    if (process.platform === "win32") {
      // On Windows, use 'where' command
      execSync(`where ${command}`, { stdio: "ignore" });
    } else {
      // On Unix-like systems, use 'which' command
      execSync(`which ${command}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
};

// Check if Chocolatey is installed
const checkChocolatey = (): boolean => {
  try {
    // Try to get choco version
    execSync("choco --version", { stdio: "ignore" });
    return true;
  } catch {
    // Also check if choco command exists in PATH
    return isCommandAvailable("choco");
  }
};

// Check if FFmpeg is installed
const checkFFmpeg = (): boolean => {
  try {
    // Try to get ffmpeg version
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    // Also check if ffmpeg command exists in PATH
    return isCommandAvailable("ffmpeg");
  }
};

// Verify required dependencies before starting the app
const verifyDependencies = async (): Promise<boolean> => {
  const missingDeps: string[] = [];

  if (!checkChocolatey()) {
    missingDeps.push("Chocolatey (choco)");
  }

  if (!checkFFmpeg()) {
    missingDeps.push("FFmpeg");
  }

  if (missingDeps.length > 0) {
    const message = `The following required dependencies are not installed:\n\n${missingDeps
      .map((dep) => `• ${dep}`)
      .join(
        "\n"
      )}\n\nPlease install them before starting the application.\n\nInstallation instructions:\n\n1. Install Chocolatey:\n   Run PowerShell as Administrator and execute:\n   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))\n\n2. Install FFmpeg:\n   Run in PowerShell (as Administrator):\n   choco install ffmpeg -y\n\nOr visit https://chocolatey.org/install and https://ffmpeg.org/download.html for manual installation.`;

    // Show error dialog (we need to wait for app to be ready to show dialogs)
    // For now, we'll log and exit
    console.error(message);

    // Try to show dialog if app is ready, otherwise just exit
    if (app.isReady()) {
      await dialog.showMessageBox({
        type: "error",
        title: "Missing Dependencies",
        message: "Required Dependencies Not Found",
        detail: message,
        buttons: ["OK"],
      });
    }

    return false;
  }

  return true;
};

process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL
  ? path.join(process.env.APP_ROOT, "public")
  : RENDERER_DIST;

const downloaderUrl = VITE_DEV_SERVER_URL
  ? `${VITE_DEV_SERVER_URL}/downloader.html`
  : path.join(RENDERER_DIST, "downloader.html");

let win: BrowserWindow | null;
let tray: Tray | null = null;

// Store active download items by window ID
const activeDownloads = new Map<number, Electron.DownloadItem>();

// Store active fetch-based downloads (for cancellation)
const activeFetchDownloads = new Map<
  number,
  {
    abortController: AbortController;
    tempFilePath: string;
    cleanup: () => Promise<void>;
  }
>();

// Track downloader windows - store the most recent one
let downloaderWindow: BrowserWindow | null = null;

// Helper function to show download completion notification and focus window
function notifyDownloadComplete(
  filePath: string,
  targetWindow?: BrowserWindow | null
) {
  // Show system notification
  if (Notification.isSupported()) {
    const fileName = path.basename(filePath);
    const notification = new Notification({
      title: "Download Complete",
      body: fileName,
      icon: iconPath,
      urgency: "normal",
    });
    notification.show();
  }

  // Focus the downloader window - use provided window or fallback to stored reference
  const windowToFocus = targetWindow || downloaderWindow;
  if (windowToFocus && !windowToFocus.isDestroyed()) {
    // Restore window if minimized
    if (windowToFocus.isMinimized()) {
      windowToFocus.restore();
    }
    // Show and focus the window
    windowToFocus.show();
    windowToFocus.focus();
  }
}

// Store pending download data for when window is ready
let pendingDownloadData: {
  url: string;
  title?: string | null;
  filename?: string | null; // Full filename with extension from Chrome
  audioUrl?: string | null;
  cookies?: {
    msToken?: string | null;
    ttChainToken?: string | null;
  } | null;
} | null = null;

// HTTP server port for Chrome extension communication
const EXTENSION_SERVER_PORT = 8765;

function createWindow() {
  win = new BrowserWindow({
    width: 1200,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    center: true,
    title: "Flux",
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      sandbox: true,
      contextIsolation: true,
    },
  });

  // Open DevTools only in development mode
  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools();
  }

  win.on("ready-to-show", () => {
    win?.show();
  });

  // Test active push message to Renderer-process.
  win.webContents.on("did-finish-load", () => {
    win?.webContents.send("main-process-message", new Date().toLocaleString());
  });

  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    // win.loadFile('dist/index.html')
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}

ipcMain.handle("select-download-location", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title: "Select download folder",
  });

  if (canceled || filePaths.length === 0) {
    return null;
  }

  return filePaths[0];
});

ipcMain.handle("load-settings", async () => {
  try {
    const { settingsDir, settingsFile } = getSettingsPaths();
    await fs.mkdir(settingsDir, { recursive: true });
    const contents = await fs.readFile(settingsFile, "utf-8");
    return JSON.parse(contents);
  } catch (error) {
    const err = error as NodeJS.ErrnoException;
    if (err?.code === "ENOENT") {
      return null;
    }
    console.error("Failed to load settings", error);
    return null;
  }
});

ipcMain.handle("save-settings", async (_event, payload) => {
  try {
    const { settingsDir, settingsFile } = getSettingsPaths();
    await fs.mkdir(settingsDir, { recursive: true });
    const data = JSON.stringify(payload ?? {}, null, 2);
    await fs.writeFile(settingsFile, data, "utf-8");
    return true;
  } catch (error) {
    console.error("Failed to save settings", error);
    return false;
  }
});

// Handle theme changes and broadcast to all windows
ipcMain.on("theme-change", (_event, theme: string) => {
  // Broadcast theme change to all windows
  BrowserWindow.getAllWindows().forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send("theme-changed", theme);
    }
  });
});

// Handle window controls
ipcMain.handle("window-minimize", (_event) => {
  const window = BrowserWindow.fromWebContents(_event.sender);
  if (window && !window.isDestroyed()) {
    window.minimize();
  }
  return true;
});

ipcMain.handle("window-maximize", (_event) => {
  const window = BrowserWindow.fromWebContents(_event.sender);
  if (window && !window.isDestroyed()) {
    if (window.isMaximized()) {
      window.unmaximize();
    } else {
      window.maximize();
    }
  }
  return true;
});

ipcMain.handle("window-close", (_event) => {
  const window = BrowserWindow.fromWebContents(_event.sender);
  if (window && !window.isDestroyed()) {
    window.close();
  }
  return true;
});

// Handle request for pending download data
ipcMain.handle("get-pending-download", () => {
  const data = pendingDownloadData;
  // Clear after sending
  if (data) {
    pendingDownloadData = null;
  }
  return data;
});

// Function to create or reuse a downloader window with download data
function createDownloaderWindow(payload: {
  url: string;
  title?: string | null;
  filename?: string | null; // Full filename with extension from Chrome
  audioUrl?: string | null;
  cookies?: {
    msToken?: string | null;
    ttChainToken?: string | null;
  } | null;
}) {
  // Check if a downloader window already exists and is not destroyed
  if (downloaderWindow && !downloaderWindow.isDestroyed()) {
    // Window exists, send new download data to it
    console.log("Reusing existing downloader window");
    downloaderWindow.webContents.send("download-request", {
      url: payload.url,
      title: payload.title || null,
      filename: payload.filename || null,
      audioUrl: payload.audioUrl || null,
      cookies: payload.cookies || null,
    });
    downloaderWindow.show();
    downloaderWindow.focus();
    return;
  }

  // No valid window exists, create a new one
  console.log("Creating new downloader window");
  const newDownloaderWindow = new BrowserWindow({
    width: 600,
    height: 300,
    minWidth: 400,
    minHeight: 250,
    resizable: true,
    show: false,
    autoHideMenuBar: true,
    center: true,
    title: "Flux Downloader",
    frame: false,
    icon: iconPath,
    webPreferences: {
      preload: path.join(__dirname, "preload.mjs"),
      sandbox: true,
      contextIsolation: true,
    },
  });

  // Store reference to the downloader window
  downloaderWindow = newDownloaderWindow;

  // Clean up reference when window is closed
  newDownloaderWindow.on("closed", () => {
    if (downloaderWindow === newDownloaderWindow) {
      downloaderWindow = null;
    }
  });

  // Show window as soon as it's ready
  newDownloaderWindow.on("ready-to-show", () => {
    newDownloaderWindow?.show();
    newDownloaderWindow?.focus();
  });

  // Open DevTools only in development mode
  if (VITE_DEV_SERVER_URL) {
    newDownloaderWindow.webContents.openDevTools();
  }

  // Store payload to send after page loads
  const downloadPayload = {
    url: payload.url,
    title: payload.title || null,
    filename: payload.filename || null,
    audioUrl: payload.audioUrl || null,
    cookies: payload.cookies || null,
  };

  // Store as pending data
  pendingDownloadData = downloadPayload;

  // Wait for the window to be ready, then send download data
  const sendDownloadData = () => {
    if (newDownloaderWindow && !newDownloaderWindow.isDestroyed()) {
      // Wait a bit longer to ensure React component is fully mounted and listeners are set up
      setTimeout(() => {
        if (newDownloaderWindow && !newDownloaderWindow.isDestroyed()) {
          console.log("========================================");
          console.log("📤 Sending download-request event to renderer");
          console.log("🔗 URL:", downloadPayload.url);
          console.log("📝 Title:", downloadPayload.title);
          console.log("========================================");

          newDownloaderWindow.webContents.send(
            "download-request",
            downloadPayload
          );
          newDownloaderWindow.show();
          newDownloaderWindow.focus();
          console.log("✅ Downloader window opened and data sent");
        } else {
          console.error("❌ Cannot send data - window is destroyed");
        }
      }, 1000); // Wait 1 second after page load to ensure React is ready
    } else {
      console.error("❌ Cannot send data - window is destroyed");
    }
  };

  // Load the downloader page
  if (VITE_DEV_SERVER_URL) {
    newDownloaderWindow.loadURL(downloaderUrl);
  } else {
    newDownloaderWindow.loadFile(path.join(RENDERER_DIST, "downloader.html"));
  }

  // Send data once the page is loaded
  newDownloaderWindow.webContents.once("did-finish-load", sendDownloadData);

  // Fallback: If page doesn't load within 3 seconds, still show the window
  setTimeout(() => {
    if (
      newDownloaderWindow &&
      !newDownloaderWindow.isDestroyed() &&
      !newDownloaderWindow.isVisible()
    ) {
      console.log("Fallback: Showing downloader window after timeout");
      newDownloaderWindow.show();
      newDownloaderWindow.focus();
      // Try to send data again
      try {
        newDownloaderWindow.webContents.send(
          "download-request",
          downloadPayload
        );
      } catch (error) {
        console.error("Failed to send download data in fallback:", error);
      }
    }
  }, 3000);
}

// Handle download requests - creates a new window for each download
ipcMain.handle(
  "start-download",
  async (
    _event,
    payload: {
      url: string;
      title?: string | null;
      audioUrl?: string | null;
      cookies?: {
        msToken?: string | null;
        ttChainToken?: string | null;
      } | null;
    }
  ) => {
    createDownloaderWindow(payload);
    return true;
  }
);

// TikTok download helper - uses fetch with manual redirect handling (like route.ts)
const MAX_REDIRECTS = 5;

const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  Referer: "https://www.tiktok.com/",
};

function buildCookieHeader(
  msToken?: string | null,
  ttChainToken?: string | null
) {
  const parts: string[] = [];
  if (msToken) {
    parts.push(`msToken=${msToken}`);
  }
  if (ttChainToken) {
    parts.push(`tt_chain_token=${ttChainToken}`);
  }
  return parts.join("; ");
}

// Merge video and audio using FFmpeg
async function mergeVideoAudio(
  videoPath: string,
  audioPath: string,
  outputPath: string,
  signal?: AbortSignal
): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log("🎬 Starting FFmpeg merge...");
    console.log("Video:", videoPath);
    console.log("Audio:", audioPath);
    console.log("Output:", outputPath);

    // FFmpeg command to merge video and audio
    // -i: input files
    // -c:v copy: copy video codec (no re-encoding, faster)
    // -c:a copy: copy audio codec (no re-encoding, faster)
    // -map 0:v:0: use video from first input
    // -map 1:a:0: use audio from second input
    // -y: overwrite output file if it exists
    const ffmpegArgs = [
      "-i",
      videoPath,
      "-i",
      audioPath,
      "-c:v",
      "copy",
      "-c:a",
      "copy",
      "-map",
      "0:v:0",
      "-map",
      "1:a:0",
      "-y", // Overwrite output file
      outputPath,
    ];

    const ffmpegProcess = spawn("ffmpeg", ffmpegArgs, {
      stdio: ["ignore", "pipe", "pipe"], // Ignore stdin, pipe stdout and stderr
    });

    let errorOutput = "";

    // Capture stderr (FFmpeg outputs progress to stderr)
    ffmpegProcess.stderr.on("data", (data) => {
      const output = data.toString();
      errorOutput += output;
      // Log progress (FFmpeg outputs time information)
      if (output.includes("time=")) {
        const timeMatch = output.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (timeMatch) {
          console.log(`FFmpeg progress: ${timeMatch[1]}`);
        }
      }
    });

    // Handle process completion
    ffmpegProcess.on("close", (code) => {
      if (code === 0) {
        console.log("✅ FFmpeg merge completed successfully");
        resolve();
      } else {
        const error = `FFmpeg merge failed with code ${code}: ${errorOutput}`;
        console.error("❌ FFmpeg error:", error);
        reject(new Error(error));
      }
    });

    // Handle process errors
    ffmpegProcess.on("error", (error) => {
      console.error("❌ FFmpeg process error:", error);
      reject(error);
    });

    // Handle cancellation
    if (signal) {
      signal.addEventListener("abort", () => {
        console.log("FFmpeg merge cancelled");
        ffmpegProcess.kill("SIGTERM");
        reject(new Error("FFmpeg merge cancelled"));
      });
    }
  });
}

// Fetch with manual redirect handling (for YouTube and other videos)
async function fetchWithRedirects(
  url: string,
  attempt = 1,
  signal?: AbortSignal
): Promise<Response> {
  if (attempt > MAX_REDIRECTS) {
    throw new Error("Too many redirects while downloading the file.");
  }

  const parsed = new URL(url);
  const headers = new Headers({
    ...BASE_HEADERS,
    Host: parsed.hostname,
  });

  const response = await fetch(url, {
    headers,
    redirect: "manual",
    signal,
  });

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get("location")
  ) {
    const nextUrl = new URL(response.headers.get("location") as string, url);
    console.log(`Redirect ${attempt}: ${url} -> ${nextUrl.toString()}`);
    response.body?.cancel();
    return fetchWithRedirects(nextUrl.toString(), attempt + 1, signal);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Download failed with status ${response.status}. ${errorBody}`
    );
  }

  return response;
}

// Check if server supports Range requests
async function checkRangeSupport(url: string): Promise<boolean> {
  try {
    const parsed = new URL(url);
    const headers = new Headers({
      ...BASE_HEADERS,
      Host: parsed.hostname,
      Range: "bytes=0-0", // Request first byte only
    });

    const response = await fetch(url, {
      headers,
      redirect: "manual",
    });

    // Follow redirects if needed
    let finalResponse = response;
    let redirectCount = 0;
    while (
      finalResponse.status >= 300 &&
      finalResponse.status < 400 &&
      finalResponse.headers.get("location") &&
      redirectCount < MAX_REDIRECTS
    ) {
      const nextUrl = new URL(
        finalResponse.headers.get("location") as string,
        url
      );
      finalResponse.body?.cancel();
      const nextHeaders = new Headers({
        ...BASE_HEADERS,
        Host: nextUrl.hostname,
        Range: "bytes=0-0",
      });
      finalResponse = await fetch(nextUrl.toString(), {
        headers: nextHeaders,
        redirect: "manual",
      });
      redirectCount++;
    }

    // Check if server supports Range requests (206 Partial Content)
    const supportsRange =
      finalResponse.status === 206 ||
      finalResponse.headers.get("accept-ranges") === "bytes";
    return supportsRange;
  } catch {
    return false;
  }
}

// Download a specific byte range
async function downloadRange(
  url: string,
  start: number,
  end: number,
  chunkIndex: number,
  signal?: AbortSignal,
  onProgress?: (chunkIndex: number, received: number, total: number) => void
): Promise<{ chunkIndex: number; data: Buffer }> {
  const parsed = new URL(url);
  const headers = new Headers({
    ...BASE_HEADERS,
    Host: parsed.hostname,
    Range: `bytes=${start}-${end}`,
  });

  let response = await fetch(url, {
    headers,
    redirect: "manual",
    signal,
  });

  // Handle redirects
  let redirectCount = 0;
  while (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get("location") &&
    redirectCount < MAX_REDIRECTS
  ) {
    const nextUrl = new URL(response.headers.get("location") as string, url);
    response.body?.cancel();
    const nextHeaders = new Headers({
      ...BASE_HEADERS,
      Host: nextUrl.hostname,
      Range: `bytes=${start}-${end}`,
    });
    response = await fetch(nextUrl.toString(), {
      headers: nextHeaders,
      redirect: "manual",
      signal,
    });
    redirectCount++;
  }

  if (response.status !== 206 && response.status !== 200) {
    throw new Error(
      `Range request failed with status ${response.status} for chunk ${chunkIndex}`
    );
  }

  const body = response.body;
  if (!body) {
    throw new Error(`Response body is null for chunk ${chunkIndex}`);
  }

  const chunks: Uint8Array[] = [];
  const reader = body.getReader();
  let chunkReceived = 0;

  try {
    let reading = true;
    while (reading) {
      // Check if cancelled
      if (signal?.aborted) {
        reading = false;
        reader.releaseLock();
        throw new Error("Download cancelled");
      }

      const { done, value } = await reader.read();
      if (done) {
        reading = false;
        break;
      }
      if (value) {
        chunks.push(value);
        chunkReceived += value.length;

        // Report progress for this chunk
        if (onProgress) {
          const chunkTotal = end - start + 1;
          onProgress(chunkIndex, chunkReceived, chunkTotal);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }

  // Combine all chunks into a single buffer
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }

  return { chunkIndex, data: Buffer.from(result) };
}

// Download file in parallel chunks (for faster downloads)
async function downloadWithChunks(
  url: string,
  totalSize: number,
  numChunks: number = 4,
  signal?: AbortSignal,
  onProgress?: (percent: number, received: number, total: number) => void
): Promise<Buffer[]> {
  const chunkSize = Math.ceil(totalSize / numChunks);
  const chunks: Promise<{ chunkIndex: number; data: Buffer }>[] = [];

  // Track progress for each chunk
  const chunkProgress = new Map<number, number>();
  const chunkSizes = new Map<number, number>();

  // Initialize chunk sizes
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = i === numChunks - 1 ? totalSize - 1 : (i + 1) * chunkSize - 1;
    chunkSizes.set(i, end - start + 1);
    chunkProgress.set(i, 0);
  }

  // Progress callback for individual chunks
  const chunkProgressCallback = (
    chunkIndex: number,
    received: number,
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    _total: number
  ) => {
    chunkProgress.set(chunkIndex, received);

    // Calculate total progress across all chunks
    let totalReceived = 0;
    for (let i = 0; i < numChunks; i++) {
      totalReceived += chunkProgress.get(i) || 0;
    }

    // Report overall progress
    if (onProgress) {
      const percent = Math.round((totalReceived / totalSize) * 100);
      onProgress(percent, totalReceived, totalSize);
    }
  };

  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = i === numChunks - 1 ? totalSize - 1 : (i + 1) * chunkSize - 1;

    chunks.push(
      downloadRange(url, start, end, i, signal, chunkProgressCallback)
    );
  }

  // Download all chunks concurrently
  // If signal is aborted, Promise.all will reject
  const results = await Promise.all(chunks).catch((error) => {
    if (signal?.aborted) {
      throw new Error("Download cancelled");
    }
    throw error;
  });

  // Sort by chunk index to maintain order
  results.sort((a, b) => a.chunkIndex - b.chunkIndex);

  return results.map((r) => r.data);
}

async function fetchWithCookies(
  url: string,
  cookieHeader: string,
  attempt = 1,
  signal?: AbortSignal
): Promise<Response> {
  if (attempt > MAX_REDIRECTS) {
    throw new Error("Too many redirects while downloading the file.");
  }

  const parsed = new URL(url);
  const headers = new Headers({
    ...BASE_HEADERS,
    Host: parsed.hostname,
  });

  if (!cookieHeader) {
    throw new Error(
      "TikTok cookie header could not be constructed from TikTok response."
    );
  }

  headers.set("Cookie", cookieHeader);

  const response = await fetch(url, {
    headers,
    redirect: "manual",
    signal,
  });

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get("location")
  ) {
    const nextUrl = new URL(response.headers.get("location") as string, url);
    console.log(`TikTok redirect ${attempt}: ${url} -> ${nextUrl.toString()}`);
    response.body?.cancel();
    return fetchWithCookies(
      nextUrl.toString(),
      cookieHeader,
      attempt + 1,
      signal
    );
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Download failed with status ${response.status}. ${errorBody}`
    );
  }

  return response;
}

// Handle actual file download with progress
ipcMain.handle(
  "download-file",
  async (
    event,
    payload: {
      url: string;
      filePath: string;
      audioUrl?: string | null;
      cookies?: {
        msToken?: string | null;
        ttChainToken?: string | null;
      } | null;
    }
  ) => {
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) {
      console.error("Download error: Window not found");
      return { success: false, error: "Window not found" };
    }

    try {
      console.log("Download started:", {
        url: payload.url.substring(0, 100) + "...",
        hasCookies: !!(
          payload.cookies?.msToken || payload.cookies?.ttChainToken
        ),
      });

      // Get the window's session
      const windowSession = window.webContents.session;

      // Resolve file path to absolute path
      // Normalize path separators (handle both / and \)
      const normalizedPath = payload.filePath.replace(/\//g, path.sep);
      let absoluteFilePath = normalizedPath;

      if (!path.isAbsolute(absoluteFilePath)) {
        // If relative, resolve to user's home directory
        const homeDir = process.env.USERPROFILE || os.homedir();
        absoluteFilePath = path.join(homeDir, normalizedPath);
      }

      // Normalize the final path (resolve .. and . segments)
      absoluteFilePath = path.normalize(absoluteFilePath);

      // Ensure the final directory exists
      const finalDir = path.dirname(absoluteFilePath);
      await fs.mkdir(finalDir, { recursive: true });

      // Create temp directory for downloads
      const tempDir = path.join(os.tmpdir(), "flux-downloads");
      await fs.mkdir(tempDir, { recursive: true });

      // Generate temp file path with unique name
      const fileName = path.basename(absoluteFilePath);
      const fileExt = path.extname(fileName);
      const fileBase = path.basename(fileName, fileExt);
      const tempFilePath = path.join(
        tempDir,
        `${fileBase}-${Date.now()}${fileExt}`
      );

      // Check if this is a YouTube or TikTok video that needs fetch-based download
      // YouTube URLs often redirect, and TikTok needs cookies
      const urlObj = new URL(payload.url);
      const isYouTube =
        urlObj.hostname.includes("youtube.com") ||
        urlObj.hostname.includes("youtu.be") ||
        urlObj.hostname.includes("googlevideo.com");
      const isTikTokDownload =
        payload.cookies &&
        (payload.cookies.msToken || payload.cookies.ttChainToken);

      // Use fetch-based download for YouTube (redirects) or TikTok (cookies)
      if (
        (isYouTube || isTikTokDownload) &&
        (!isTikTokDownload || payload.cookies)
      ) {
        const downloadType = isYouTube ? "YouTube" : "TikTok";
        console.log(`Using fetch-based download for ${downloadType} video`);

        // For YouTube, we don't need cookies, but we need to handle redirects
        // For TikTok, we need cookies
        let cookieHeader = "";
        if (isTikTokDownload && payload.cookies) {
          cookieHeader = buildCookieHeader(
            payload.cookies.msToken,
            payload.cookies.ttChainToken
          );
          console.log("Cookie header built:", cookieHeader ? "Yes" : "No");
        }

        // Create AbortController for cancellation
        const abortController = new AbortController();
        const signal = abortController.signal;

        // Store the download info for cancellation
        const cleanup = async () => {
          try {
            await fs.unlink(tempFilePath);
          } catch {
            // Ignore cleanup errors
          }
        };

        activeFetchDownloads.set(window.id, {
          abortController,
          tempFilePath,
          cleanup,
        });

        try {
          // For YouTube, try concurrent chunk downloads for faster speed
          // For TikTok, use regular download (cookies required)
          if (isYouTube && !isTikTokDownload) {
            console.log("Attempting concurrent chunk download for YouTube...");

            // First, get the file size by making a HEAD request
            let totalBytes = 0;
            let supportsRange = false;

            try {
              const parsed = new URL(payload.url);
              const headHeaders = new Headers({
                ...BASE_HEADERS,
                Host: parsed.hostname,
              });
              let headResponse = await fetch(payload.url, {
                method: "HEAD",
                headers: headHeaders,
                redirect: "manual",
                signal,
              });

              // Handle redirects for HEAD request
              let redirectCount = 0;
              while (
                headResponse.status >= 300 &&
                headResponse.status < 400 &&
                headResponse.headers.get("location") &&
                redirectCount < MAX_REDIRECTS
              ) {
                const nextUrl = new URL(
                  headResponse.headers.get("location") as string,
                  payload.url
                );
                headResponse.body?.cancel();
                const nextHeaders = new Headers({
                  ...BASE_HEADERS,
                  Host: nextUrl.hostname,
                });
                headResponse = await fetch(nextUrl.toString(), {
                  method: "HEAD",
                  headers: nextHeaders,
                  redirect: "manual",
                  signal,
                });
                redirectCount++;
              }

              const contentLength = headResponse.headers.get("content-length");
              totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

              // Check Range support
              supportsRange =
                headResponse.status === 206 ||
                headResponse.headers.get("accept-ranges") === "bytes";
            } catch (error) {
              // If HEAD fails, try a regular GET request to get size
              console.log(
                "HEAD request failed, trying GET to get file size..."
              );
              try {
                const response = await fetchWithRedirects(
                  payload.url,
                  1,
                  signal
                );
                const contentLength = response.headers.get("content-length");
                totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
                // Cancel the body since we only need headers
                response.body?.cancel();
                // Check Range support (we'll check with signal)
                supportsRange = await checkRangeSupport(payload.url);
              } catch {
                // If all else fails, we'll use sequential download
                console.log(
                  "Could not determine file size, using sequential download"
                );
                totalBytes = 0;
                supportsRange = false;
              }
            }

            // Check if Range requests are supported and file is large enough to benefit
            const shouldUseChunks =
              supportsRange && totalBytes > 5 * 1024 * 1024; // 5MB minimum

            if (shouldUseChunks) {
              console.log(
                `Using concurrent chunk download (${totalBytes} bytes)`
              );

              // Determine optimal number of chunks (4-8 chunks for best performance)
              const numChunks = Math.min(
                8,
                Math.max(4, Math.ceil(totalBytes / (10 * 1024 * 1024)))
              ); // ~10MB per chunk
              console.log(`Downloading in ${numChunks} concurrent chunks...`);

              // Progress callback for chunk downloads
              const progressCallback = (
                percent: number,
                received: number,
                total: number
              ) => {
                window.webContents.send("download-progress", {
                  percent: isNaN(percent) ? 0 : percent,
                  received: received,
                  total: total,
                });
              };

              // Download chunks concurrently
              const chunkBuffers = await downloadWithChunks(
                payload.url,
                totalBytes,
                numChunks,
                signal,
                progressCallback
              );

              // Write all chunks to file
              const fileHandle = await fs.open(tempFilePath, "w");
              try {
                let position = 0;

                for (const chunkBuffer of chunkBuffers) {
                  // Check if cancelled before writing
                  if (signal.aborted) {
                    throw new Error("Download cancelled");
                  }

                  await fileHandle.write(
                    chunkBuffer,
                    0,
                    chunkBuffer.length,
                    position
                  );
                  position += chunkBuffer.length;

                  // Progress is already reported during download, but send final update
                  // to ensure 100% is shown after writing completes
                  if (position >= totalBytes) {
                    window.webContents.send("download-progress", {
                      percent: 100,
                      received: totalBytes,
                      total: totalBytes,
                    });
                  }
                }
              } finally {
                await fileHandle.close();
              }

              console.log("Concurrent chunk download completed");
            } else {
              // Fall back to regular sequential download
              console.log(
                "Using sequential download (Range not supported or file too small)"
              );
              const response = await fetchWithRedirects(payload.url, 1, signal);
              const contentLength = response.headers.get("content-length");
              const totalBytes = contentLength
                ? parseInt(contentLength, 10)
                : 0;

              const fileHandle = await fs.open(tempFilePath, "w");
              const body = response.body;
              if (!body) {
                await fileHandle.close();
                throw new Error("Response body is null");
              }

              let receivedBytes = 0;
              let position = 0;
              const reader = body.getReader();

              try {
                let reading = true;
                while (reading) {
                  // Check if cancelled
                  if (signal.aborted) {
                    reading = false;
                    throw new Error("Download cancelled");
                  }

                  const { done, value } = await reader.read();
                  if (done) {
                    reading = false;
                    break;
                  }

                  if (value) {
                    const buffer = Buffer.from(value);
                    await fileHandle.write(buffer, 0, buffer.length, position);
                    position += buffer.length;
                    receivedBytes += buffer.length;

                    // Send progress update
                    if (totalBytes > 0) {
                      const percent = Math.round(
                        (receivedBytes / totalBytes) * 100
                      );
                      window.webContents.send("download-progress", {
                        percent: isNaN(percent) ? 0 : percent,
                        received: receivedBytes,
                        total: totalBytes,
                      });
                    }
                  }
                }
              } finally {
                await fileHandle.close();
              }
            }
          } else {
            // For TikTok or non-YouTube, use regular download
            let response: Response;
            if (isTikTokDownload && cookieHeader) {
              response = await fetchWithCookies(
                payload.url,
                cookieHeader,
                1,
                signal
              );
            } else {
              response = await fetchWithRedirects(payload.url, 1, signal);
            }
            console.log("Fetch response received:", {
              status: response.status,
              contentType: response.headers.get("content-type"),
            });

            // Get content length for progress tracking
            const contentLength = response.headers.get("content-length");
            const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;

            // Write to temp file with progress tracking
            const fileHandle = await fs.open(tempFilePath, "w");
            const body = response.body;
            if (!body) {
              await fileHandle.close();
              throw new Error("Response body is null");
            }

            let receivedBytes = 0;
            let position = 0;
            const reader = body.getReader();

            try {
              let reading = true;
              while (reading) {
                // Check if cancelled
                if (signal.aborted) {
                  reading = false;
                  throw new Error("Download cancelled");
                }

                const { done, value } = await reader.read();
                if (done) {
                  reading = false;
                  break;
                }

                if (value) {
                  const buffer = Buffer.from(value);
                  await fileHandle.write(buffer, 0, buffer.length, position);
                  position += buffer.length;
                  receivedBytes += buffer.length;

                  // Send progress update
                  if (totalBytes > 0) {
                    const percent = Math.round(
                      (receivedBytes / totalBytes) * 100
                    );
                    window.webContents.send("download-progress", {
                      percent: isNaN(percent) ? 0 : percent,
                      received: receivedBytes,
                      total: totalBytes,
                    });
                  }
                }
              }
            } finally {
              await fileHandle.close();
            }
          }

          console.log("Download completed, copying to final location");

          // Handle file name conflicts by adding a number suffix
          let finalPath = absoluteFilePath;
          let counter = 1;
          let fileExists = true;

          while (fileExists) {
            try {
              await fs.access(finalPath);
              // File exists, try with a number suffix
              const dir = path.dirname(absoluteFilePath);
              const ext = path.extname(absoluteFilePath);
              const base = path.basename(absoluteFilePath, ext);
              finalPath = path.join(dir, `${base} (${counter})${ext}`);
              counter++;
            } catch {
              // File doesn't exist, we can use this path
              fileExists = false;
            }
          }

          // Copy from temp to final location
          await fs.copyFile(tempFilePath, finalPath);
          console.log("File copied to:", finalPath);

          // Clean up temp file
          try {
            await fs.unlink(tempFilePath);
          } catch (cleanupError) {
            console.warn("Failed to cleanup temp file:", cleanupError);
          }

          // Download audio file if provided (for YouTube videos)
          if (isYouTube && payload.audioUrl && payload.audioUrl.trim() !== "") {
            try {
              console.log("🎵 Starting audio download for YouTube video...");

              // Generate audio file path (same location, different extension)
              const audioExt = ".m4a"; // YouTube audio is typically m4a
              const audioFileName = `${path.basename(
                finalPath,
                path.extname(finalPath)
              )}_audio${audioExt}`;
              const audioFilePath = path.join(
                path.dirname(finalPath),
                audioFileName
              );

              // Create temp path for audio
              const audioTempPath = path.join(
                tempDir,
                `${path.basename(
                  audioFileName,
                  audioExt
                )}-${Date.now()}${audioExt}`
              );

              // Get audio file size and check Range support (same as video)
              let audioTotalBytes = 0;
              let audioSupportsRange = false;

              try {
                const parsed = new URL(payload.audioUrl);
                const headHeaders = new Headers({
                  ...BASE_HEADERS,
                  Host: parsed.hostname,
                });
                let headResponse = await fetch(payload.audioUrl, {
                  method: "HEAD",
                  headers: headHeaders,
                  redirect: "manual",
                  signal,
                });

                // Handle redirects for HEAD request
                let redirectCount = 0;
                while (
                  headResponse.status >= 300 &&
                  headResponse.status < 400 &&
                  headResponse.headers.get("location") &&
                  redirectCount < MAX_REDIRECTS
                ) {
                  const nextUrl = new URL(
                    headResponse.headers.get("location") as string,
                    payload.audioUrl
                  );
                  headResponse.body?.cancel();
                  const nextHeaders = new Headers({
                    ...BASE_HEADERS,
                    Host: nextUrl.hostname,
                  });
                  headResponse = await fetch(nextUrl.toString(), {
                    method: "HEAD",
                    headers: nextHeaders,
                    redirect: "manual",
                    signal,
                  });
                  redirectCount++;
                }

                const contentLength =
                  headResponse.headers.get("content-length");
                audioTotalBytes = contentLength
                  ? parseInt(contentLength, 10)
                  : 0;

                // Check Range support
                audioSupportsRange =
                  headResponse.status === 206 ||
                  headResponse.headers.get("accept-ranges") === "bytes";
              } catch (error) {
                // If HEAD fails, try a regular GET request to get size
                console.log(
                  "Audio HEAD request failed, trying GET to get file size..."
                );
                try {
                  const response = await fetchWithRedirects(
                    payload.audioUrl,
                    1,
                    signal
                  );
                  const contentLength = response.headers.get("content-length");
                  audioTotalBytes = contentLength
                    ? parseInt(contentLength, 10)
                    : 0;
                  // Cancel the body since we only need headers
                  response.body?.cancel();
                  // Check Range support
                  audioSupportsRange = await checkRangeSupport(
                    payload.audioUrl
                  );
                } catch {
                  // If all else fails, we'll use sequential download
                  console.log(
                    "Could not determine audio file size, using sequential download"
                  );
                  audioTotalBytes = 0;
                  audioSupportsRange = false;
                }
              }

              // Check if Range requests are supported and file is large enough to benefit
              const shouldUseChunks =
                audioSupportsRange && audioTotalBytes > 2 * 1024 * 1024; // 2MB minimum for audio

              if (shouldUseChunks) {
                console.log(
                  `Using concurrent chunk download for audio (${audioTotalBytes} bytes)`
                );

                // Determine optimal number of chunks (4-8 chunks for best performance)
                const numChunks = Math.min(
                  8,
                  Math.max(4, Math.ceil(audioTotalBytes / (5 * 1024 * 1024)))
                ); // ~5MB per chunk for audio
                console.log(
                  `Downloading audio in ${numChunks} concurrent chunks...`
                );

                // Progress callback for audio chunk downloads
                const audioProgressCallback = (
                  percent: number,
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  _received: number,
                  // eslint-disable-next-line @typescript-eslint/no-unused-vars
                  _total: number
                ) => {
                  // Log audio progress (video is already at 100%)
                  console.log(`Audio download: ${percent}%`);
                };

                // Download audio chunks concurrently
                const audioChunkBuffers = await downloadWithChunks(
                  payload.audioUrl,
                  audioTotalBytes,
                  numChunks,
                  signal,
                  audioProgressCallback
                );

                // Write all audio chunks to file
                const audioFileHandle = await fs.open(audioTempPath, "w");
                try {
                  let position = 0;

                  for (const chunkBuffer of audioChunkBuffers) {
                    // Check if cancelled before writing
                    if (signal.aborted) {
                      throw new Error("Download cancelled");
                    }

                    await audioFileHandle.write(
                      chunkBuffer,
                      0,
                      chunkBuffer.length,
                      position
                    );
                    position += chunkBuffer.length;
                  }
                } finally {
                  await audioFileHandle.close();
                }

                console.log("Concurrent audio chunk download completed");
              } else {
                // Fall back to regular sequential download
                console.log(
                  "Using sequential download for audio (Range not supported or file too small)"
                );
                const audioResponse = await fetchWithRedirects(
                  payload.audioUrl,
                  1,
                  signal
                );
                const audioContentLength =
                  audioResponse.headers.get("content-length");
                audioTotalBytes = audioContentLength
                  ? parseInt(audioContentLength, 10)
                  : 0;

                const audioFileHandle = await fs.open(audioTempPath, "w");
                const audioBody = audioResponse.body;
                if (!audioBody) {
                  await audioFileHandle.close();
                  throw new Error("Audio response body is null");
                }

                let audioReceivedBytes = 0;
                let audioPosition = 0;
                const audioReader = audioBody.getReader();

                try {
                  let reading = true;
                  while (reading) {
                    // Check if cancelled
                    if (signal.aborted) {
                      reading = false;
                      throw new Error("Download cancelled");
                    }

                    const { done, value } = await audioReader.read();
                    if (done) {
                      reading = false;
                      break;
                    }

                    if (value) {
                      const buffer = Buffer.from(value);
                      await audioFileHandle.write(
                        buffer,
                        0,
                        buffer.length,
                        audioPosition
                      );
                      audioPosition += buffer.length;
                      audioReceivedBytes += buffer.length;

                      // Log audio progress
                      if (audioTotalBytes > 0) {
                        const audioPercent = Math.round(
                          (audioReceivedBytes / audioTotalBytes) * 100
                        );
                        console.log(`Audio download: ${audioPercent}%`);
                      }
                    }
                  }
                } finally {
                  await audioFileHandle.close();
                }
              }

              // Handle file name conflicts for audio
              let finalAudioPath = audioFilePath;
              let audioCounter = 1;
              let audioFileExists = true;

              while (audioFileExists) {
                try {
                  await fs.access(finalAudioPath);
                  const dir = path.dirname(audioFilePath);
                  const ext = path.extname(audioFilePath);
                  const base = path.basename(audioFilePath, ext);
                  finalAudioPath = path.join(
                    dir,
                    `${base} (${audioCounter})${ext}`
                  );
                  audioCounter++;
                } catch {
                  audioFileExists = false;
                }
              }

              // Copy audio from temp to final location
              await fs.copyFile(audioTempPath, finalAudioPath);
              console.log("✅ Audio file downloaded:", finalAudioPath);

              // Clean up temp audio file
              try {
                await fs.unlink(audioTempPath);
              } catch (cleanupError) {
                console.warn(
                  "Failed to cleanup temp audio file:",
                  cleanupError
                );
              }

              // Merge video and audio into a single file
              try {
                console.log("🎬 Merging video and audio...");

                // Create a temporary merged file path
                const mergedTempPath = path.join(
                  tempDir,
                  `merged-${Date.now()}${path.extname(finalPath)}`
                );

                // Merge video and audio using FFmpeg
                await mergeVideoAudio(
                  finalPath,
                  finalAudioPath,
                  mergedTempPath,
                  signal
                );

                // Replace the original video file with the merged version
                await fs.copyFile(mergedTempPath, finalPath);
                console.log("✅ Video and audio merged successfully");

                // Clean up temp merged file
                try {
                  await fs.unlink(mergedTempPath);
                } catch (cleanupError) {
                  console.warn(
                    "Failed to cleanup temp merged file:",
                    cleanupError
                  );
                }

                // Delete the separate audio file since it's now merged
                try {
                  await fs.unlink(finalAudioPath);
                  console.log(
                    "✅ Separate audio file removed (merged into video)"
                  );
                } catch (cleanupError) {
                  console.warn(
                    "Failed to remove separate audio file:",
                    cleanupError
                  );
                }
              } catch (mergeError) {
                // Log error but don't fail - user still has video and audio files
                console.error(
                  "❌ Failed to merge video and audio:",
                  mergeError
                );
                console.log("Video and audio files saved separately");
                // Don't throw - user still has both files
              }
            } catch (audioError) {
              // Log error but don't fail the entire download
              console.error("❌ Audio download failed:", audioError);
              console.log("Continuing with video-only download...");
            }
          }

          // Remove from active downloads
          activeFetchDownloads.delete(window.id);

          // Send completion message
          window.webContents.send("download-complete", {
            filePath: finalPath,
          });

          // Show notification and focus window
          notifyDownloadComplete(finalPath, window);

          return { success: true, filePath: finalPath };
        } catch (fetchError) {
          // Remove from active downloads on error
          activeFetchDownloads.delete(window.id);

          const isCancelled =
            fetchError instanceof Error &&
            (fetchError.message === "Download cancelled" || signal.aborted);

          const errorMessage = isCancelled
            ? "Download cancelled"
            : fetchError instanceof Error
            ? fetchError.message
            : `Failed to download ${isYouTube ? "YouTube" : "TikTok"} video`;

          if (isCancelled) {
            console.log("Download cancelled by user");
            window.webContents.send("download-cancelled");
          } else {
            console.error(
              `${isYouTube ? "YouTube" : "TikTok"} download error:`,
              errorMessage,
              fetchError
            );
            window.webContents.send("download-error", { error: errorMessage });
          }

          // Clean up temp file on error
          try {
            await fs.unlink(tempFilePath);
          } catch {
            // Ignore cleanup errors
          }

          return { success: false, error: errorMessage };
        }
      }

      // For non-TikTok downloads, use Electron's downloadURL
      return new Promise((resolve) => {
        let downloadResolved = false;
        let downloadStarted = false; // Track if download has started
        let timeoutId: NodeJS.Timeout | null = null;

        // Set up will-download listener BEFORE calling downloadURL
        // This prevents the default save dialog from appearing
        const willDownloadHandler = (
          _event: Electron.Event,
          item: Electron.DownloadItem
        ) => {
          // Match by URL (handle query parameters)
          const itemUrl = item.getURL();
          const baseUrl = payload.url.split("?")[0];
          const itemBaseUrl = itemUrl.split("?")[0];

          if (itemUrl === payload.url || itemBaseUrl === baseUrl) {
            // Mark download as started
            downloadStarted = true;

            // Clear the timeout since download has started
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }

            // Store the download item for pause/resume functionality
            activeDownloads.set(window.id, item);

            // CRITICAL: Set the save path to temp location IMMEDIATELY and SYNCHRONOUSLY
            // This prevents the save dialog from appearing
            item.setSavePath(tempFilePath);

            // Track progress
            item.on("updated", () => {
              const total = item.getTotalBytes();
              const received = item.getReceivedBytes();
              if (total > 0) {
                const progress = received / total;
                const percent = Math.round(progress * 100);
                window.webContents.send("download-progress", {
                  percent: isNaN(percent) ? 0 : percent,
                  received: received,
                  total: total,
                });
              }
            });

            // Handle completion
            item.once("done", (_event, state) => {
              // Remove the download item from active downloads
              activeDownloads.delete(window.id);

              // Remove the listener after this download completes
              windowSession.removeListener(
                "will-download",
                willDownloadHandler
              );

              if (state === "completed") {
                if (!downloadResolved) {
                  downloadResolved = true;
                  console.log("Download completed, copying to final location");

                  // Copy file from temp to final location
                  (async () => {
                    try {
                      // Handle file name conflicts by adding a number suffix
                      let finalPath = absoluteFilePath;
                      let counter = 1;
                      let fileExists = true;

                      while (fileExists) {
                        try {
                          await fs.access(finalPath);
                          // File exists, try with a number suffix
                          const dir = path.dirname(absoluteFilePath);
                          const ext = path.extname(absoluteFilePath);
                          const base = path.basename(absoluteFilePath, ext);
                          finalPath = path.join(
                            dir,
                            `${base} (${counter})${ext}`
                          );
                          counter++;
                        } catch {
                          // File doesn't exist, we can use this path
                          fileExists = false;
                        }
                      }

                      // Copy from temp to final location
                      await fs.copyFile(tempFilePath, finalPath);
                      console.log("File copied to:", finalPath);

                      // Clean up temp file
                      try {
                        await fs.unlink(tempFilePath);
                      } catch (cleanupError) {
                        console.warn(
                          "Failed to cleanup temp file:",
                          cleanupError
                        );
                      }

                      // Send completion message after file is copied
                      window.webContents.send("download-complete", {
                        filePath: finalPath,
                      });

                      // Show notification and focus window
                      notifyDownloadComplete(finalPath, window);
                    } catch (copyError) {
                      const errorMessage =
                        copyError instanceof Error
                          ? copyError.message
                          : "Failed to copy file to final location";
                      console.error("Copy error:", errorMessage, copyError);
                      window.webContents.send("download-error", {
                        error: errorMessage,
                      });
                    }
                  })();

                  // Resolve immediately (copy happens async)
                  resolve({ success: true, filePath: absoluteFilePath });
                }
              } else {
                if (!downloadResolved) {
                  downloadResolved = true;
                  const error = `Download failed: ${state}`;
                  console.error("Download failed:", error);

                  // Clean up temp file on failure
                  (async () => {
                    try {
                      await fs.unlink(tempFilePath);
                    } catch (cleanupError) {
                      console.warn(
                        "Failed to cleanup temp file on error:",
                        cleanupError
                      );
                    }
                  })();

                  window.webContents.send("download-error", { error });
                  resolve({ success: false, error });
                }
              }
            });
          }
        };

        // Register the handler BEFORE starting the download
        windowSession.on("will-download", willDownloadHandler);

        // Start the download
        window.webContents.downloadURL(payload.url);

        // Timeout fallback - only fires if download hasn't started
        // Increased to 60 seconds to allow slow servers to respond
        timeoutId = setTimeout(() => {
          if (!downloadStarted && !downloadResolved) {
            downloadResolved = true;
            // Clean up listener on timeout
            windowSession.removeListener("will-download", willDownloadHandler);

            // Clean up temp file on timeout
            (async () => {
              try {
                await fs.unlink(tempFilePath);
              } catch {
                // Ignore cleanup errors
              }
            })();

            const error = "Download timeout - no download started";
            console.error("Download timeout:", error);
            window.webContents.send("download-error", { error });
            resolve({ success: false, error });
          }
        }, 60000); // 60 second timeout for download to start
      });
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.error("Download error:", errorMessage, error);
      window.webContents.send("download-error", { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
);

// Handle pause download
ipcMain.handle("pause-download", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    return { success: false, error: "Window not found" };
  }

  const downloadItem = activeDownloads.get(window.id);
  if (!downloadItem) {
    return {
      success: false,
      error:
        "No active download found. Pause is not supported for fetch-based downloads (YouTube/TikTok).",
    };
  }

  // Check if download is already paused
  if (downloadItem.isPaused()) {
    return { success: false, error: "Download is already paused" };
  }

  // Check if download is in progress (not completed, cancelled, or interrupted)
  const state = downloadItem.getState();
  if (
    state === "completed" ||
    state === "cancelled" ||
    state === "interrupted"
  ) {
    return {
      success: false,
      error: "Download cannot be paused in current state",
    };
  }

  try {
    downloadItem.pause();
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to pause download";
    return { success: false, error: errorMessage };
  }
});

// Handle resume download
ipcMain.handle("resume-download", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    return { success: false, error: "Window not found" };
  }

  const downloadItem = activeDownloads.get(window.id);
  if (!downloadItem) {
    return {
      success: false,
      error:
        "No active download found. Resume is not supported for fetch-based downloads (YouTube/TikTok).",
    };
  }

  // Check if download can be resumed (i.e., is paused)
  if (!downloadItem.canResume()) {
    return {
      success: false,
      error: "Download cannot be resumed. It may not be paused.",
    };
  }

  try {
    downloadItem.resume();
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to resume download";
    return { success: false, error: errorMessage };
  }
});

// Handle cancel download
ipcMain.handle("cancel-download", async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    return { success: false, error: "Window not found" };
  }

  // Check for fetch-based download first
  const fetchDownload = activeFetchDownloads.get(window.id);
  if (fetchDownload) {
    try {
      console.log("Cancelling fetch-based download...");
      // Abort all fetch requests
      fetchDownload.abortController.abort();

      // Clean up temp file
      await fetchDownload.cleanup();

      // Remove from active downloads
      activeFetchDownloads.delete(window.id);

      // Notify the renderer that download was cancelled
      window.webContents.send("download-cancelled");
      return { success: true };
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Failed to cancel download";
      console.error("Error cancelling fetch download:", errorMessage);
      // Still remove from active downloads even if cleanup fails
      activeFetchDownloads.delete(window.id);
      return { success: false, error: errorMessage };
    }
  }

  // Check for Electron DownloadItem
  const downloadItem = activeDownloads.get(window.id);
  if (!downloadItem) {
    return { success: false, error: "No active download found" };
  }

  try {
    // Cancel the download
    downloadItem.cancel();
    // Remove from active downloads
    activeDownloads.delete(window.id);
    // Notify the renderer that download was cancelled
    window.webContents.send("download-cancelled");
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to cancel download";
    return { success: false, error: errorMessage };
  }
});

// Handle open folder
ipcMain.handle("open-folder", async (_event, filePath: string) => {
  try {
    // Get the directory containing the file
    const dir = path.dirname(filePath);
    // Open the folder in the system file manager
    await shell.openPath(dir);
    return { success: true };
  } catch (error) {
    const errorMessage =
      error instanceof Error ? error.message : "Failed to open folder";
    return { success: false, error: errorMessage };
  }
});

// Quit when all windows are closed, except on macOS or if tray exists
// With tray, app should stay running in background
app.on("window-all-closed", () => {
  // Don't quit if tray exists (app runs in background)
  if (tray) {
    // Hide all windows but keep app running
    BrowserWindow.getAllWindows().forEach((window) => {
      window.hide();
    });
    return;
  }

  // On macOS, keep app running even without windows
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});

app.on("activate", () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Create HTTP server for Chrome extension communication
let extensionServer: http.Server | null = null;

function createExtensionServer() {
  // If server already exists and is listening, don't create another one
  if (extensionServer && extensionServer.listening) {
    console.log("Extension server already running");
    return extensionServer;
  }

  const server = http.createServer((req, res) => {
    // Enable CORS
    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.setHeader("Access-Control-Allow-Headers", "Content-Type");

    if (req.method === "OPTIONS") {
      res.writeHead(200);
      res.end();
      return;
    }

    if (req.method === "POST" && req.url === "/download") {
      let body = "";

      req.on("data", (chunk) => {
        body += chunk.toString();
      });

      req.on("end", () => {
        try {
          const data = JSON.parse(body) as {
            url: string;
            title?: string | null;
            filename?: string | null; // Full filename with extension from Chrome
            audioUrl?: string | null;
            cookies?: {
              msToken?: string | null;
              ttChainToken?: string | null;
            } | null;
          };

          console.log("Received download request from extension:", data.url);
          if (data.audioUrl) {
            console.log(
              "Audio URL provided:",
              data.audioUrl.substring(0, 100) + "..."
            );
          }

          // Ensure downloader window is created/opened
          createDownloaderWindow(data);

          res.writeHead(200, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: true }));
        } catch (error) {
          console.error("Error processing extension request:", error);
          res.writeHead(400, { "Content-Type": "application/json" });
          res.end(JSON.stringify({ success: false, error: "Invalid request" }));
        }
      });
    } else {
      res.writeHead(404);
      res.end("Not found");
    }
  });

  server.listen(EXTENSION_SERVER_PORT, "127.0.0.1", () => {
    console.log(
      `Extension server listening on http://127.0.0.1:${EXTENSION_SERVER_PORT}`
    );
  });

  server.on("error", (error: NodeJS.ErrnoException) => {
    if (error.code === "EADDRINUSE") {
      console.log(
        `Port ${EXTENSION_SERVER_PORT} is already in use. Trying to reuse existing server.`
      );
      // Try to find and reuse the existing server
      setTimeout(() => {
        createExtensionServer();
      }, 1000);
    } else {
      console.error("Extension server error:", error);
      // Retry after a delay
      setTimeout(() => {
        createExtensionServer();
      }, 2000);
    }
  });

  extensionServer = server;
  return server;
}

// Create system tray
function createTray() {
  // Check if tray icon file exists
  try {
    // Use sync check for tray icon
    if (!fsSync.existsSync(trayIconPath)) {
      console.warn("Tray icon not found, using default icon");
      // Fallback to main icon if tray icon doesn't exist
      tray = new Tray(iconPath);
    } else {
      tray = new Tray(trayIconPath);
    }
  } catch (error) {
    console.warn("Error loading tray icon, using default:", error);
    tray = new Tray(iconPath);
  }

  // Create context menu for tray
  const contextMenu = Menu.buildFromTemplate([
    {
      label: "Show Window",
      click: () => {
        if (win && !win.isDestroyed()) {
          if (win.isMinimized()) {
            win.restore();
          }
          win.show();
          win.focus();
        } else {
          createWindow();
        }
      },
    },
    {
      label: "New Download",
      click: () => {
        // Create a new downloader window
        createDownloaderWindow({
          url: "",
          title: null,
          filename: null,
          audioUrl: null,
          cookies: null,
        });
      },
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        // Destroy tray before quitting
        if (tray) {
          tray.destroy();
          tray = null;
        }
        app.quit();
      },
    },
  ]);

  tray.setContextMenu(contextMenu);
  tray.setToolTip("Flux Downloader");

  // Handle tray click events
  tray.on("click", () => {
    // On Windows/Linux, show window on click
    if (process.platform !== "darwin") {
      if (win && !win.isDestroyed()) {
        if (win.isMinimized()) {
          win.restore();
        }
        win.show();
        win.focus();
      } else {
        createWindow();
      }
    }
  });

  // On macOS, right-click shows context menu, left-click does nothing by default
  // But we can handle double-click
  tray.on("double-click", () => {
    if (win && !win.isDestroyed()) {
      if (win.isMinimized()) {
        win.restore();
      }
      win.show();
      win.focus();
    } else {
      createWindow();
    }
  });

  console.log("System tray created");
}

app.whenReady().then(async () => {
  // Verify required dependencies before starting
  const depsOk = await verifyDependencies();
  if (!depsOk) {
    console.error("Missing required dependencies. Exiting application.");
    app.quit();
    return;
  }

  console.log("✓ Chocolatey and FFmpeg are installed");

  await ensureSettingsFile();
  createWindow();
  // Create system tray
  createTray();
  // Start extension server immediately
  createExtensionServer();
  console.log("Flux desktop app ready. Extension server should be running.");
});
