import { ipcMain, dialog, BrowserWindow, shell, app, Notification, Tray, Menu } from "electron";
import { spawn, execSync } from "node:child_process";
import fsSync from "node:fs";
import fs from "node:fs/promises";
import http from "node:http";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
const __dirname$1 = path.dirname(fileURLToPath(import.meta.url));
process.env.APP_ROOT = path.join(__dirname$1, "..");
const VITE_DEV_SERVER_URL = process.env["VITE_DEV_SERVER_URL"];
const MAIN_DIST = path.join(process.env.APP_ROOT, "dist-electron");
const RENDERER_DIST = path.join(process.env.APP_ROOT, "dist");
const getIconPath = () => {
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
const getTrayIconPath = () => {
  const platform = process.platform;
  const basePath = process.env.APP_ROOT;
  switch (platform) {
    case "win32":
      return path.join(basePath, "public", "icons", "png", "32x32.png");
    case "darwin":
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
const isCommandAvailable = (command) => {
  try {
    if (process.platform === "win32") {
      execSync(`where ${command}`, { stdio: "ignore" });
    } else {
      execSync(`which ${command}`, { stdio: "ignore" });
    }
    return true;
  } catch {
    return false;
  }
};
const checkChocolatey = () => {
  try {
    execSync("choco --version", { stdio: "ignore" });
    return true;
  } catch {
    return isCommandAvailable("choco");
  }
};
const checkFFmpeg = () => {
  try {
    execSync("ffmpeg -version", { stdio: "ignore" });
    return true;
  } catch {
    return isCommandAvailable("ffmpeg");
  }
};
const verifyDependencies = async () => {
  const missingDeps = [];
  if (!checkChocolatey()) {
    missingDeps.push("Chocolatey (choco)");
  }
  if (!checkFFmpeg()) {
    missingDeps.push("FFmpeg");
  }
  if (missingDeps.length > 0) {
    const message = `The following required dependencies are not installed:

${missingDeps.map((dep) => `• ${dep}`).join(
      "\n"
    )}

Please install them before starting the application.

Installation instructions:

1. Install Chocolatey:
   Run PowerShell as Administrator and execute:
   Set-ExecutionPolicy Bypass -Scope Process -Force; [System.Net.ServicePointManager]::SecurityProtocol = [System.Net.ServicePointManager]::SecurityProtocol -bor 3072; iex ((New-Object System.Net.WebClient).DownloadString('https://community.chocolatey.org/install.ps1'))

2. Install FFmpeg:
   Run in PowerShell (as Administrator):
   choco install ffmpeg -y

Or visit https://chocolatey.org/install and https://ffmpeg.org/download.html for manual installation.`;
    console.error(message);
    if (app.isReady()) {
      await dialog.showMessageBox({
        type: "error",
        title: "Missing Dependencies",
        message: "Required Dependencies Not Found",
        detail: message,
        buttons: ["OK"]
      });
    }
    return false;
  }
  return true;
};
process.env.VITE_PUBLIC = VITE_DEV_SERVER_URL ? path.join(process.env.APP_ROOT, "public") : RENDERER_DIST;
const downloaderUrl = VITE_DEV_SERVER_URL ? `${VITE_DEV_SERVER_URL}/downloader.html` : path.join(RENDERER_DIST, "downloader.html");
let win;
let tray = null;
const activeDownloads = /* @__PURE__ */ new Map();
const activeFetchDownloads = /* @__PURE__ */ new Map();
let downloaderWindow = null;
function notifyDownloadComplete(filePath, targetWindow) {
  if (Notification.isSupported()) {
    const fileName = path.basename(filePath);
    const notification = new Notification({
      title: "Download Complete",
      body: fileName,
      icon: iconPath,
      urgency: "normal"
    });
    notification.show();
  }
  const windowToFocus = targetWindow || downloaderWindow;
  if (windowToFocus && !windowToFocus.isDestroyed()) {
    if (windowToFocus.isMinimized()) {
      windowToFocus.restore();
    }
    windowToFocus.show();
    windowToFocus.focus();
  }
}
let pendingDownloadData = null;
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
      preload: path.join(__dirname$1, "preload.mjs"),
      sandbox: true,
      contextIsolation: true
    }
  });
  if (VITE_DEV_SERVER_URL) {
    win.webContents.openDevTools();
  }
  win.on("ready-to-show", () => {
    win == null ? void 0 : win.show();
  });
  win.webContents.on("did-finish-load", () => {
    win == null ? void 0 : win.webContents.send("main-process-message", (/* @__PURE__ */ new Date()).toLocaleString());
  });
  if (VITE_DEV_SERVER_URL) {
    win.loadURL(VITE_DEV_SERVER_URL);
  } else {
    win.loadFile(path.join(RENDERER_DIST, "index.html"));
  }
}
ipcMain.handle("select-download-location", async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    properties: ["openDirectory", "createDirectory"],
    title: "Select download folder"
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
    const err = error;
    if ((err == null ? void 0 : err.code) === "ENOENT") {
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
ipcMain.on("theme-change", (_event, theme) => {
  BrowserWindow.getAllWindows().forEach((window) => {
    if (window && !window.isDestroyed()) {
      window.webContents.send("theme-changed", theme);
    }
  });
});
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
ipcMain.handle("get-pending-download", () => {
  const data = pendingDownloadData;
  if (data) {
    pendingDownloadData = null;
  }
  return data;
});
function createDownloaderWindow(payload) {
  if (downloaderWindow && !downloaderWindow.isDestroyed()) {
    console.log("Reusing existing downloader window");
    downloaderWindow.webContents.send("download-request", {
      url: payload.url,
      title: payload.title || null,
      filename: payload.filename || null,
      audioUrl: payload.audioUrl || null,
      cookies: payload.cookies || null
    });
    downloaderWindow.show();
    downloaderWindow.focus();
    return;
  }
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
      preload: path.join(__dirname$1, "preload.mjs"),
      sandbox: true,
      contextIsolation: true
    }
  });
  downloaderWindow = newDownloaderWindow;
  newDownloaderWindow.on("closed", () => {
    if (downloaderWindow === newDownloaderWindow) {
      downloaderWindow = null;
    }
  });
  newDownloaderWindow.on("ready-to-show", () => {
    newDownloaderWindow == null ? void 0 : newDownloaderWindow.show();
    newDownloaderWindow == null ? void 0 : newDownloaderWindow.focus();
  });
  if (VITE_DEV_SERVER_URL) {
    newDownloaderWindow.webContents.openDevTools();
  }
  const downloadPayload = {
    url: payload.url,
    title: payload.title || null,
    filename: payload.filename || null,
    audioUrl: payload.audioUrl || null,
    cookies: payload.cookies || null
  };
  pendingDownloadData = downloadPayload;
  const sendDownloadData = () => {
    if (newDownloaderWindow && !newDownloaderWindow.isDestroyed()) {
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
      }, 1e3);
    } else {
      console.error("❌ Cannot send data - window is destroyed");
    }
  };
  if (VITE_DEV_SERVER_URL) {
    newDownloaderWindow.loadURL(downloaderUrl);
  } else {
    newDownloaderWindow.loadFile(path.join(RENDERER_DIST, "downloader.html"));
  }
  newDownloaderWindow.webContents.once("did-finish-load", sendDownloadData);
  setTimeout(() => {
    if (newDownloaderWindow && !newDownloaderWindow.isDestroyed() && !newDownloaderWindow.isVisible()) {
      console.log("Fallback: Showing downloader window after timeout");
      newDownloaderWindow.show();
      newDownloaderWindow.focus();
      try {
        newDownloaderWindow.webContents.send(
          "download-request",
          downloadPayload
        );
      } catch (error) {
        console.error("Failed to send download data in fallback:", error);
      }
    }
  }, 3e3);
}
ipcMain.handle(
  "start-download",
  async (_event, payload) => {
    createDownloaderWindow(payload);
    return true;
  }
);
const MAX_REDIRECTS = 5;
const BASE_HEADERS = {
  "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  Referer: "https://www.tiktok.com/"
};
function buildCookieHeader(msToken, ttChainToken) {
  const parts = [];
  if (msToken) {
    parts.push(`msToken=${msToken}`);
  }
  if (ttChainToken) {
    parts.push(`tt_chain_token=${ttChainToken}`);
  }
  return parts.join("; ");
}
async function mergeVideoAudio(videoPath, audioPath, outputPath, signal) {
  return new Promise((resolve, reject) => {
    console.log("🎬 Starting FFmpeg merge...");
    console.log("Video:", videoPath);
    console.log("Audio:", audioPath);
    console.log("Output:", outputPath);
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
      "-y",
      // Overwrite output file
      outputPath
    ];
    const ffmpegProcess = spawn("ffmpeg", ffmpegArgs, {
      stdio: ["ignore", "pipe", "pipe"]
      // Ignore stdin, pipe stdout and stderr
    });
    let errorOutput = "";
    ffmpegProcess.stderr.on("data", (data) => {
      const output = data.toString();
      errorOutput += output;
      if (output.includes("time=")) {
        const timeMatch = output.match(/time=(\d+:\d+:\d+\.\d+)/);
        if (timeMatch) {
          console.log(`FFmpeg progress: ${timeMatch[1]}`);
        }
      }
    });
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
    ffmpegProcess.on("error", (error) => {
      console.error("❌ FFmpeg process error:", error);
      reject(error);
    });
    if (signal) {
      signal.addEventListener("abort", () => {
        console.log("FFmpeg merge cancelled");
        ffmpegProcess.kill("SIGTERM");
        reject(new Error("FFmpeg merge cancelled"));
      });
    }
  });
}
async function fetchWithRedirects(url, attempt = 1, signal) {
  var _a;
  if (attempt > MAX_REDIRECTS) {
    throw new Error("Too many redirects while downloading the file.");
  }
  const parsed = new URL(url);
  const headers = new Headers({
    ...BASE_HEADERS,
    Host: parsed.hostname
  });
  const response = await fetch(url, {
    headers,
    redirect: "manual",
    signal
  });
  if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
    const nextUrl = new URL(response.headers.get("location"), url);
    console.log(`Redirect ${attempt}: ${url} -> ${nextUrl.toString()}`);
    (_a = response.body) == null ? void 0 : _a.cancel();
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
async function checkRangeSupport(url) {
  var _a;
  try {
    const parsed = new URL(url);
    const headers = new Headers({
      ...BASE_HEADERS,
      Host: parsed.hostname,
      Range: "bytes=0-0"
      // Request first byte only
    });
    const response = await fetch(url, {
      headers,
      redirect: "manual"
    });
    let finalResponse = response;
    let redirectCount = 0;
    while (finalResponse.status >= 300 && finalResponse.status < 400 && finalResponse.headers.get("location") && redirectCount < MAX_REDIRECTS) {
      const nextUrl = new URL(
        finalResponse.headers.get("location"),
        url
      );
      (_a = finalResponse.body) == null ? void 0 : _a.cancel();
      const nextHeaders = new Headers({
        ...BASE_HEADERS,
        Host: nextUrl.hostname,
        Range: "bytes=0-0"
      });
      finalResponse = await fetch(nextUrl.toString(), {
        headers: nextHeaders,
        redirect: "manual"
      });
      redirectCount++;
    }
    const supportsRange = finalResponse.status === 206 || finalResponse.headers.get("accept-ranges") === "bytes";
    return supportsRange;
  } catch {
    return false;
  }
}
async function downloadRange(url, start, end, chunkIndex, signal, onProgress) {
  var _a;
  const parsed = new URL(url);
  const headers = new Headers({
    ...BASE_HEADERS,
    Host: parsed.hostname,
    Range: `bytes=${start}-${end}`
  });
  let response = await fetch(url, {
    headers,
    redirect: "manual",
    signal
  });
  let redirectCount = 0;
  while (response.status >= 300 && response.status < 400 && response.headers.get("location") && redirectCount < MAX_REDIRECTS) {
    const nextUrl = new URL(response.headers.get("location"), url);
    (_a = response.body) == null ? void 0 : _a.cancel();
    const nextHeaders = new Headers({
      ...BASE_HEADERS,
      Host: nextUrl.hostname,
      Range: `bytes=${start}-${end}`
    });
    response = await fetch(nextUrl.toString(), {
      headers: nextHeaders,
      redirect: "manual",
      signal
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
  const chunks = [];
  const reader = body.getReader();
  let chunkReceived = 0;
  try {
    let reading = true;
    while (reading) {
      if (signal == null ? void 0 : signal.aborted) {
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
        if (onProgress) {
          const chunkTotal = end - start + 1;
          onProgress(chunkIndex, chunkReceived, chunkTotal);
        }
      }
    }
  } finally {
    reader.releaseLock();
  }
  const totalLength = chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const result = new Uint8Array(totalLength);
  let offset = 0;
  for (const chunk of chunks) {
    result.set(chunk, offset);
    offset += chunk.length;
  }
  return { chunkIndex, data: Buffer.from(result) };
}
async function downloadWithChunks(url, totalSize, numChunks = 4, signal, onProgress) {
  const chunkSize = Math.ceil(totalSize / numChunks);
  const chunks = [];
  const chunkProgress = /* @__PURE__ */ new Map();
  const chunkSizes = /* @__PURE__ */ new Map();
  for (let i = 0; i < numChunks; i++) {
    const start = i * chunkSize;
    const end = i === numChunks - 1 ? totalSize - 1 : (i + 1) * chunkSize - 1;
    chunkSizes.set(i, end - start + 1);
    chunkProgress.set(i, 0);
  }
  const chunkProgressCallback = (chunkIndex, received, _total) => {
    chunkProgress.set(chunkIndex, received);
    let totalReceived = 0;
    for (let i = 0; i < numChunks; i++) {
      totalReceived += chunkProgress.get(i) || 0;
    }
    if (onProgress) {
      const percent = Math.round(totalReceived / totalSize * 100);
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
  const results = await Promise.all(chunks).catch((error) => {
    if (signal == null ? void 0 : signal.aborted) {
      throw new Error("Download cancelled");
    }
    throw error;
  });
  results.sort((a, b) => a.chunkIndex - b.chunkIndex);
  return results.map((r) => r.data);
}
async function fetchWithCookies(url, cookieHeader, attempt = 1, signal) {
  var _a;
  if (attempt > MAX_REDIRECTS) {
    throw new Error("Too many redirects while downloading the file.");
  }
  const parsed = new URL(url);
  const headers = new Headers({
    ...BASE_HEADERS,
    Host: parsed.hostname
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
    signal
  });
  if (response.status >= 300 && response.status < 400 && response.headers.get("location")) {
    const nextUrl = new URL(response.headers.get("location"), url);
    console.log(`TikTok redirect ${attempt}: ${url} -> ${nextUrl.toString()}`);
    (_a = response.body) == null ? void 0 : _a.cancel();
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
ipcMain.handle(
  "download-file",
  async (event, payload) => {
    var _a, _b, _c, _d, _e, _f;
    const window = BrowserWindow.fromWebContents(event.sender);
    if (!window || window.isDestroyed()) {
      console.error("Download error: Window not found");
      return { success: false, error: "Window not found" };
    }
    try {
      console.log("Download started:", {
        url: payload.url.substring(0, 100) + "...",
        hasCookies: !!(((_a = payload.cookies) == null ? void 0 : _a.msToken) || ((_b = payload.cookies) == null ? void 0 : _b.ttChainToken))
      });
      const windowSession = window.webContents.session;
      const normalizedPath = payload.filePath.replace(/\//g, path.sep);
      let absoluteFilePath = normalizedPath;
      if (!path.isAbsolute(absoluteFilePath)) {
        const homeDir = process.env.USERPROFILE || os.homedir();
        absoluteFilePath = path.join(homeDir, normalizedPath);
      }
      absoluteFilePath = path.normalize(absoluteFilePath);
      const finalDir = path.dirname(absoluteFilePath);
      await fs.mkdir(finalDir, { recursive: true });
      const tempDir = path.join(os.tmpdir(), "flux-downloads");
      await fs.mkdir(tempDir, { recursive: true });
      const fileName = path.basename(absoluteFilePath);
      const fileExt = path.extname(fileName);
      const fileBase = path.basename(fileName, fileExt);
      const tempFilePath = path.join(
        tempDir,
        `${fileBase}-${Date.now()}${fileExt}`
      );
      const urlObj = new URL(payload.url);
      const isYouTube = urlObj.hostname.includes("youtube.com") || urlObj.hostname.includes("youtu.be") || urlObj.hostname.includes("googlevideo.com");
      const isTikTokDownload = payload.cookies && (payload.cookies.msToken || payload.cookies.ttChainToken);
      if ((isYouTube || isTikTokDownload) && (!isTikTokDownload || payload.cookies)) {
        const downloadType = isYouTube ? "YouTube" : "TikTok";
        console.log(`Using fetch-based download for ${downloadType} video`);
        let cookieHeader = "";
        if (isTikTokDownload && payload.cookies) {
          cookieHeader = buildCookieHeader(
            payload.cookies.msToken,
            payload.cookies.ttChainToken
          );
          console.log("Cookie header built:", cookieHeader ? "Yes" : "No");
        }
        const abortController = new AbortController();
        const signal = abortController.signal;
        const cleanup = async () => {
          try {
            await fs.unlink(tempFilePath);
          } catch {
          }
        };
        activeFetchDownloads.set(window.id, {
          abortController,
          tempFilePath,
          cleanup
        });
        try {
          if (isYouTube && !isTikTokDownload) {
            console.log("Attempting concurrent chunk download for YouTube...");
            let totalBytes = 0;
            let supportsRange = false;
            try {
              const parsed = new URL(payload.url);
              const headHeaders = new Headers({
                ...BASE_HEADERS,
                Host: parsed.hostname
              });
              let headResponse = await fetch(payload.url, {
                method: "HEAD",
                headers: headHeaders,
                redirect: "manual",
                signal
              });
              let redirectCount = 0;
              while (headResponse.status >= 300 && headResponse.status < 400 && headResponse.headers.get("location") && redirectCount < MAX_REDIRECTS) {
                const nextUrl = new URL(
                  headResponse.headers.get("location"),
                  payload.url
                );
                (_c = headResponse.body) == null ? void 0 : _c.cancel();
                const nextHeaders = new Headers({
                  ...BASE_HEADERS,
                  Host: nextUrl.hostname
                });
                headResponse = await fetch(nextUrl.toString(), {
                  method: "HEAD",
                  headers: nextHeaders,
                  redirect: "manual",
                  signal
                });
                redirectCount++;
              }
              const contentLength = headResponse.headers.get("content-length");
              totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
              supportsRange = headResponse.status === 206 || headResponse.headers.get("accept-ranges") === "bytes";
            } catch (error) {
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
                (_d = response.body) == null ? void 0 : _d.cancel();
                supportsRange = await checkRangeSupport(payload.url);
              } catch {
                console.log(
                  "Could not determine file size, using sequential download"
                );
                totalBytes = 0;
                supportsRange = false;
              }
            }
            const shouldUseChunks = supportsRange && totalBytes > 5 * 1024 * 1024;
            if (shouldUseChunks) {
              console.log(
                `Using concurrent chunk download (${totalBytes} bytes)`
              );
              const numChunks = Math.min(
                8,
                Math.max(4, Math.ceil(totalBytes / (10 * 1024 * 1024)))
              );
              console.log(`Downloading in ${numChunks} concurrent chunks...`);
              const progressCallback = (percent, received, total) => {
                window.webContents.send("download-progress", {
                  percent: isNaN(percent) ? 0 : percent,
                  received,
                  total
                });
              };
              const chunkBuffers = await downloadWithChunks(
                payload.url,
                totalBytes,
                numChunks,
                signal,
                progressCallback
              );
              const fileHandle = await fs.open(tempFilePath, "w");
              try {
                let position = 0;
                for (const chunkBuffer of chunkBuffers) {
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
                  if (position >= totalBytes) {
                    window.webContents.send("download-progress", {
                      percent: 100,
                      received: totalBytes,
                      total: totalBytes
                    });
                  }
                }
              } finally {
                await fileHandle.close();
              }
              console.log("Concurrent chunk download completed");
            } else {
              console.log(
                "Using sequential download (Range not supported or file too small)"
              );
              const response = await fetchWithRedirects(payload.url, 1, signal);
              const contentLength = response.headers.get("content-length");
              const totalBytes2 = contentLength ? parseInt(contentLength, 10) : 0;
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
                    if (totalBytes2 > 0) {
                      const percent = Math.round(
                        receivedBytes / totalBytes2 * 100
                      );
                      window.webContents.send("download-progress", {
                        percent: isNaN(percent) ? 0 : percent,
                        received: receivedBytes,
                        total: totalBytes2
                      });
                    }
                  }
                }
              } finally {
                await fileHandle.close();
              }
            }
          } else {
            let response;
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
              contentType: response.headers.get("content-type")
            });
            const contentLength = response.headers.get("content-length");
            const totalBytes = contentLength ? parseInt(contentLength, 10) : 0;
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
                  if (totalBytes > 0) {
                    const percent = Math.round(
                      receivedBytes / totalBytes * 100
                    );
                    window.webContents.send("download-progress", {
                      percent: isNaN(percent) ? 0 : percent,
                      received: receivedBytes,
                      total: totalBytes
                    });
                  }
                }
              }
            } finally {
              await fileHandle.close();
            }
          }
          console.log("Download completed, copying to final location");
          let finalPath = absoluteFilePath;
          let counter = 1;
          let fileExists = true;
          while (fileExists) {
            try {
              await fs.access(finalPath);
              const dir = path.dirname(absoluteFilePath);
              const ext = path.extname(absoluteFilePath);
              const base = path.basename(absoluteFilePath, ext);
              finalPath = path.join(dir, `${base} (${counter})${ext}`);
              counter++;
            } catch {
              fileExists = false;
            }
          }
          await fs.copyFile(tempFilePath, finalPath);
          console.log("File copied to:", finalPath);
          try {
            await fs.unlink(tempFilePath);
          } catch (cleanupError) {
            console.warn("Failed to cleanup temp file:", cleanupError);
          }
          if (isYouTube && payload.audioUrl && payload.audioUrl.trim() !== "") {
            try {
              console.log("🎵 Starting audio download for YouTube video...");
              const audioExt = ".m4a";
              const audioFileName = `${path.basename(
                finalPath,
                path.extname(finalPath)
              )}_audio${audioExt}`;
              const audioFilePath = path.join(
                path.dirname(finalPath),
                audioFileName
              );
              const audioTempPath = path.join(
                tempDir,
                `${path.basename(
                  audioFileName,
                  audioExt
                )}-${Date.now()}${audioExt}`
              );
              let audioTotalBytes = 0;
              let audioSupportsRange = false;
              try {
                const parsed = new URL(payload.audioUrl);
                const headHeaders = new Headers({
                  ...BASE_HEADERS,
                  Host: parsed.hostname
                });
                let headResponse = await fetch(payload.audioUrl, {
                  method: "HEAD",
                  headers: headHeaders,
                  redirect: "manual",
                  signal
                });
                let redirectCount = 0;
                while (headResponse.status >= 300 && headResponse.status < 400 && headResponse.headers.get("location") && redirectCount < MAX_REDIRECTS) {
                  const nextUrl = new URL(
                    headResponse.headers.get("location"),
                    payload.audioUrl
                  );
                  (_e = headResponse.body) == null ? void 0 : _e.cancel();
                  const nextHeaders = new Headers({
                    ...BASE_HEADERS,
                    Host: nextUrl.hostname
                  });
                  headResponse = await fetch(nextUrl.toString(), {
                    method: "HEAD",
                    headers: nextHeaders,
                    redirect: "manual",
                    signal
                  });
                  redirectCount++;
                }
                const contentLength = headResponse.headers.get("content-length");
                audioTotalBytes = contentLength ? parseInt(contentLength, 10) : 0;
                audioSupportsRange = headResponse.status === 206 || headResponse.headers.get("accept-ranges") === "bytes";
              } catch (error) {
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
                  audioTotalBytes = contentLength ? parseInt(contentLength, 10) : 0;
                  (_f = response.body) == null ? void 0 : _f.cancel();
                  audioSupportsRange = await checkRangeSupport(
                    payload.audioUrl
                  );
                } catch {
                  console.log(
                    "Could not determine audio file size, using sequential download"
                  );
                  audioTotalBytes = 0;
                  audioSupportsRange = false;
                }
              }
              const shouldUseChunks = audioSupportsRange && audioTotalBytes > 2 * 1024 * 1024;
              if (shouldUseChunks) {
                console.log(
                  `Using concurrent chunk download for audio (${audioTotalBytes} bytes)`
                );
                const numChunks = Math.min(
                  8,
                  Math.max(4, Math.ceil(audioTotalBytes / (5 * 1024 * 1024)))
                );
                console.log(
                  `Downloading audio in ${numChunks} concurrent chunks...`
                );
                const audioProgressCallback = (percent, _received, _total) => {
                  console.log(`Audio download: ${percent}%`);
                };
                const audioChunkBuffers = await downloadWithChunks(
                  payload.audioUrl,
                  audioTotalBytes,
                  numChunks,
                  signal,
                  audioProgressCallback
                );
                const audioFileHandle = await fs.open(audioTempPath, "w");
                try {
                  let position = 0;
                  for (const chunkBuffer of audioChunkBuffers) {
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
                console.log(
                  "Using sequential download for audio (Range not supported or file too small)"
                );
                const audioResponse = await fetchWithRedirects(
                  payload.audioUrl,
                  1,
                  signal
                );
                const audioContentLength = audioResponse.headers.get("content-length");
                audioTotalBytes = audioContentLength ? parseInt(audioContentLength, 10) : 0;
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
                      if (audioTotalBytes > 0) {
                        const audioPercent = Math.round(
                          audioReceivedBytes / audioTotalBytes * 100
                        );
                        console.log(`Audio download: ${audioPercent}%`);
                      }
                    }
                  }
                } finally {
                  await audioFileHandle.close();
                }
              }
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
              await fs.copyFile(audioTempPath, finalAudioPath);
              console.log("✅ Audio file downloaded:", finalAudioPath);
              try {
                await fs.unlink(audioTempPath);
              } catch (cleanupError) {
                console.warn(
                  "Failed to cleanup temp audio file:",
                  cleanupError
                );
              }
              try {
                console.log("🎬 Merging video and audio...");
                const mergedTempPath = path.join(
                  tempDir,
                  `merged-${Date.now()}${path.extname(finalPath)}`
                );
                await mergeVideoAudio(
                  finalPath,
                  finalAudioPath,
                  mergedTempPath,
                  signal
                );
                await fs.copyFile(mergedTempPath, finalPath);
                console.log("✅ Video and audio merged successfully");
                try {
                  await fs.unlink(mergedTempPath);
                } catch (cleanupError) {
                  console.warn(
                    "Failed to cleanup temp merged file:",
                    cleanupError
                  );
                }
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
                console.error(
                  "❌ Failed to merge video and audio:",
                  mergeError
                );
                console.log("Video and audio files saved separately");
              }
            } catch (audioError) {
              console.error("❌ Audio download failed:", audioError);
              console.log("Continuing with video-only download...");
            }
          }
          activeFetchDownloads.delete(window.id);
          window.webContents.send("download-complete", {
            filePath: finalPath
          });
          notifyDownloadComplete(finalPath, window);
          return { success: true, filePath: finalPath };
        } catch (fetchError) {
          activeFetchDownloads.delete(window.id);
          const isCancelled = fetchError instanceof Error && (fetchError.message === "Download cancelled" || signal.aborted);
          const errorMessage = isCancelled ? "Download cancelled" : fetchError instanceof Error ? fetchError.message : `Failed to download ${isYouTube ? "YouTube" : "TikTok"} video`;
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
          try {
            await fs.unlink(tempFilePath);
          } catch {
          }
          return { success: false, error: errorMessage };
        }
      }
      return new Promise((resolve) => {
        let downloadResolved = false;
        let downloadStarted = false;
        let timeoutId = null;
        const willDownloadHandler = (_event, item) => {
          const itemUrl = item.getURL();
          const baseUrl = payload.url.split("?")[0];
          const itemBaseUrl = itemUrl.split("?")[0];
          if (itemUrl === payload.url || itemBaseUrl === baseUrl) {
            downloadStarted = true;
            if (timeoutId) {
              clearTimeout(timeoutId);
              timeoutId = null;
            }
            activeDownloads.set(window.id, item);
            item.setSavePath(tempFilePath);
            item.on("updated", () => {
              const total = item.getTotalBytes();
              const received = item.getReceivedBytes();
              if (total > 0) {
                const progress = received / total;
                const percent = Math.round(progress * 100);
                window.webContents.send("download-progress", {
                  percent: isNaN(percent) ? 0 : percent,
                  received,
                  total
                });
              }
            });
            item.once("done", (_event2, state) => {
              activeDownloads.delete(window.id);
              windowSession.removeListener(
                "will-download",
                willDownloadHandler
              );
              if (state === "completed") {
                if (!downloadResolved) {
                  downloadResolved = true;
                  console.log("Download completed, copying to final location");
                  (async () => {
                    try {
                      let finalPath = absoluteFilePath;
                      let counter = 1;
                      let fileExists = true;
                      while (fileExists) {
                        try {
                          await fs.access(finalPath);
                          const dir = path.dirname(absoluteFilePath);
                          const ext = path.extname(absoluteFilePath);
                          const base = path.basename(absoluteFilePath, ext);
                          finalPath = path.join(
                            dir,
                            `${base} (${counter})${ext}`
                          );
                          counter++;
                        } catch {
                          fileExists = false;
                        }
                      }
                      await fs.copyFile(tempFilePath, finalPath);
                      console.log("File copied to:", finalPath);
                      try {
                        await fs.unlink(tempFilePath);
                      } catch (cleanupError) {
                        console.warn(
                          "Failed to cleanup temp file:",
                          cleanupError
                        );
                      }
                      window.webContents.send("download-complete", {
                        filePath: finalPath
                      });
                      notifyDownloadComplete(finalPath, window);
                    } catch (copyError) {
                      const errorMessage = copyError instanceof Error ? copyError.message : "Failed to copy file to final location";
                      console.error("Copy error:", errorMessage, copyError);
                      window.webContents.send("download-error", {
                        error: errorMessage
                      });
                    }
                  })();
                  resolve({ success: true, filePath: absoluteFilePath });
                }
              } else {
                if (!downloadResolved) {
                  downloadResolved = true;
                  const error = `Download failed: ${state}`;
                  console.error("Download failed:", error);
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
        windowSession.on("will-download", willDownloadHandler);
        window.webContents.downloadURL(payload.url);
        timeoutId = setTimeout(() => {
          if (!downloadStarted && !downloadResolved) {
            downloadResolved = true;
            windowSession.removeListener("will-download", willDownloadHandler);
            (async () => {
              try {
                await fs.unlink(tempFilePath);
              } catch {
              }
            })();
            const error = "Download timeout - no download started";
            console.error("Download timeout:", error);
            window.webContents.send("download-error", { error });
            resolve({ success: false, error });
          }
        }, 6e4);
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      console.error("Download error:", errorMessage, error);
      window.webContents.send("download-error", { error: errorMessage });
      return { success: false, error: errorMessage };
    }
  }
);
ipcMain.handle("pause-download", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    return { success: false, error: "Window not found" };
  }
  const downloadItem = activeDownloads.get(window.id);
  if (!downloadItem) {
    return {
      success: false,
      error: "No active download found. Pause is not supported for fetch-based downloads (YouTube/TikTok)."
    };
  }
  if (downloadItem.isPaused()) {
    return { success: false, error: "Download is already paused" };
  }
  const state = downloadItem.getState();
  if (state === "completed" || state === "cancelled" || state === "interrupted") {
    return {
      success: false,
      error: "Download cannot be paused in current state"
    };
  }
  try {
    downloadItem.pause();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to pause download";
    return { success: false, error: errorMessage };
  }
});
ipcMain.handle("resume-download", (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    return { success: false, error: "Window not found" };
  }
  const downloadItem = activeDownloads.get(window.id);
  if (!downloadItem) {
    return {
      success: false,
      error: "No active download found. Resume is not supported for fetch-based downloads (YouTube/TikTok)."
    };
  }
  if (!downloadItem.canResume()) {
    return {
      success: false,
      error: "Download cannot be resumed. It may not be paused."
    };
  }
  try {
    downloadItem.resume();
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to resume download";
    return { success: false, error: errorMessage };
  }
});
ipcMain.handle("cancel-download", async (event) => {
  const window = BrowserWindow.fromWebContents(event.sender);
  if (!window || window.isDestroyed()) {
    return { success: false, error: "Window not found" };
  }
  const fetchDownload = activeFetchDownloads.get(window.id);
  if (fetchDownload) {
    try {
      console.log("Cancelling fetch-based download...");
      fetchDownload.abortController.abort();
      await fetchDownload.cleanup();
      activeFetchDownloads.delete(window.id);
      window.webContents.send("download-cancelled");
      return { success: true };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : "Failed to cancel download";
      console.error("Error cancelling fetch download:", errorMessage);
      activeFetchDownloads.delete(window.id);
      return { success: false, error: errorMessage };
    }
  }
  const downloadItem = activeDownloads.get(window.id);
  if (!downloadItem) {
    return { success: false, error: "No active download found" };
  }
  try {
    downloadItem.cancel();
    activeDownloads.delete(window.id);
    window.webContents.send("download-cancelled");
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to cancel download";
    return { success: false, error: errorMessage };
  }
});
ipcMain.handle("open-folder", async (_event, filePath) => {
  try {
    const dir = path.dirname(filePath);
    await shell.openPath(dir);
    return { success: true };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : "Failed to open folder";
    return { success: false, error: errorMessage };
  }
});
app.on("window-all-closed", () => {
  if (tray) {
    BrowserWindow.getAllWindows().forEach((window) => {
      window.hide();
    });
    return;
  }
  if (process.platform !== "darwin") {
    app.quit();
    win = null;
  }
});
app.on("activate", () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});
let extensionServer = null;
function createExtensionServer() {
  if (extensionServer && extensionServer.listening) {
    console.log("Extension server already running");
    return extensionServer;
  }
  const server = http.createServer((req, res) => {
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
          const data = JSON.parse(body);
          console.log("Received download request from extension:", data.url);
          if (data.audioUrl) {
            console.log(
              "Audio URL provided:",
              data.audioUrl.substring(0, 100) + "..."
            );
          }
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
  server.on("error", (error) => {
    if (error.code === "EADDRINUSE") {
      console.log(
        `Port ${EXTENSION_SERVER_PORT} is already in use. Trying to reuse existing server.`
      );
      setTimeout(() => {
        createExtensionServer();
      }, 1e3);
    } else {
      console.error("Extension server error:", error);
      setTimeout(() => {
        createExtensionServer();
      }, 2e3);
    }
  });
  extensionServer = server;
  return server;
}
function createTray() {
  try {
    if (!fsSync.existsSync(trayIconPath)) {
      console.warn("Tray icon not found, using default icon");
      tray = new Tray(iconPath);
    } else {
      tray = new Tray(trayIconPath);
    }
  } catch (error) {
    console.warn("Error loading tray icon, using default:", error);
    tray = new Tray(iconPath);
  }
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
      }
    },
    {
      label: "New Download",
      click: () => {
        createDownloaderWindow({
          url: "",
          title: null,
          filename: null,
          audioUrl: null,
          cookies: null
        });
      }
    },
    { type: "separator" },
    {
      label: "Quit",
      click: () => {
        if (tray) {
          tray.destroy();
          tray = null;
        }
        app.quit();
      }
    }
  ]);
  tray.setContextMenu(contextMenu);
  tray.setToolTip("Flux Downloader");
  tray.on("click", () => {
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
  const depsOk = await verifyDependencies();
  if (!depsOk) {
    console.error("Missing required dependencies. Exiting application.");
    app.quit();
    return;
  }
  console.log("✓ Chocolatey and FFmpeg are installed");
  await ensureSettingsFile();
  createWindow();
  createTray();
  createExtensionServer();
  console.log("Flux desktop app ready. Extension server should be running.");
});
export {
  MAIN_DIST,
  RENDERER_DIST,
  VITE_DEV_SERVER_URL
};
