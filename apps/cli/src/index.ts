#!/usr/bin/env node

import inquirer from 'inquirer';
import chalk from 'chalk';
import cliProgress from 'cli-progress';
import axios from 'axios';
import fs from 'fs-extra';
import path from 'path';
import { createWriteStream } from 'fs';
import { pipeline } from 'stream/promises';
import { Buffer } from 'buffer';
import { execSync, spawn } from 'child_process';
import { fileURLToPath } from 'url';
import os from 'os';
import crypto from 'crypto';
import _ffmpegPath from 'ffmpeg-static';
const ffmpegPath = _ffmpegPath as unknown as string | null;

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const USER_AGENT = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36';
const USER_AGENT_IOS = 'com.google.ios.youtube/21.02.3 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)';
const IOS_CLIENT_CONTEXT = {
  clientName: 'IOS',
  clientVersion: '21.02.3',
  deviceMake: 'Apple',
  deviceModel: 'iPhone16,2',
  osName: 'iPhone',
  osVersion: '18.3.2.22D82',
  hl: 'en-US',
  gl: 'US'
};

function getFFmpegPath(): string {
  try {
    execSync('ffmpeg -version', { stdio: 'ignore' });
    return 'ffmpeg';
  } catch (e) {
    return (ffmpegPath as string) || 'ffmpeg';
  }
}

let activeTempDir: string | null = null;

// Handle Ctrl+C gracefully globally
process.on('SIGINT', () => {
  console.log(chalk.red('\n\n[!] Download cancelled by user. Cleaning up...'));
  if (activeTempDir && fs.existsSync(activeTempDir)) {
    fs.removeSync(activeTempDir);
  }
  process.exit(0);
});

function generateSapiHash(sapisid: string, origin = 'https://www.youtube.com') {
  const timestamp = Math.floor(Date.now() / 1000);
  const msg = `${timestamp} ${sapisid} ${origin}`;
  const hash = crypto.createHash('sha1').update(msg).digest('hex');
  return `SAPISIDHASH ${timestamp}_${hash}`;
}

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
}

interface TikTokResolution {
  qualityType: string | null;
  qualityLabel: string | null;
  bitrate: number | null;
  codec: string | null;
  width: number | null;
  height: number | null;
  url: string | null;
  sizeFormatted?: string;
}

interface TikTokData {
  id: string | null;
  description: string | null;
  thumbnail: string | null;
  resolutions: TikTokResolution[];
  tokens?: {
    msToken: string | null;
    ttChainToken: string | null;
    cookieString?: string;
  };
}

const SCRIPT_ID = "__UNIVERSAL_DATA_FOR_REHYDRATION__";

function getQualityLabel(height?: number | null, qualityType?: string | null) {
  if (height && Number.isFinite(height)) {
    return `${height}p`;
  }
  if (qualityType) {
    const match = qualityType.match(/\d{3,4}/);
    if (match) return `${match[0]}p`;
    return qualityType;
  }
  return null;
}

async function crawlTikTok(url: string): Promise<TikTokData> {
  // First fetch to get cookies and tokens
  const res1 = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT
    }
  });

  if (!res1.ok) {
    throw new Error(`Failed to fetch page first time (${res1.status} ${res1.statusText})`);
  }

  let setCookies: string[] = [];
  const anyHeaders = res1.headers as any;
  if (typeof anyHeaders.getSetCookie === 'function') {
    setCookies = anyHeaders.getSetCookie();
  } else {
    const single = res1.headers.get('set-cookie');
    if (single) {
      // Robust split for environments where getSetCookie is missing
      setCookies = single.split(/,(?=[^;]+?=)/g);
    }
  }

  const cookies: Record<string, string> = {};
  for (const line of setCookies) {
    const [cookiePart] = line.split(';');
    if (!cookiePart) continue;
    const [name, ...rest] = cookiePart.split('=');
    if (name) cookies[name.trim()] = rest.join('=').trim();
  }

  const msToken = cookies.msToken || cookies.mstoken;
  const ttChainToken = cookies.tt_chain_token || cookies.tt_chain_token_v2;
  const cookieString = setCookies.map(c => c.split(';')[0]).join('; ');

  // Second fetch with cookies to get the real HTML
  const res2 = await fetch(url, {
    headers: {
      'User-Agent': USER_AGENT,
      'Cookie': cookieString
    },
  });

  if (!res2.ok) {
    throw new Error(`Failed to fetch page second time (${res2.status} ${res2.statusText})`);
  }

  const html = await res2.text();
  const escapedId = SCRIPT_ID.replace(/[-/\\^$*+?.()|[\]{}]/g, '\\$&');
  const regex = new RegExp(`<script[^>]+id="${escapedId}"[^>]*>([\\s\\S]*?)<\\/script>`, 'i');
  const match = html.match(regex);

  if (!match) {
    const foundIds = Array.from(html.matchAll(/<script[^>]+id="([^"]+)"/g)).map(m => m[1]);
    throw new Error(`Unable to find TikTok rehydration data. Found script IDs: ${foundIds.join(', ')}`);
  }

  const parsed = JSON.parse(match[1]!.trim());
  const defaultScope = parsed.__DEFAULT_SCOPE__;
  const itemStruct = defaultScope?.['webapp.video-detail']?.itemInfo?.itemStruct;

  if (!itemStruct) throw new Error("Video detail data was not found in the TikTok page.");

  const video = itemStruct.video;
  // Handle various property name variations (bitrateInfo vs bitrate_info)
  const bitrateInfo = Array.isArray(video?.bitrateInfo) 
    ? video.bitrateInfo 
    : (Array.isArray(video?.bitrate_info) ? video.bitrate_info : []);

  const resolutions: TikTokResolution[] = bitrateInfo
    .map((entry: any) => {
      // Handle case variations for properties inside entry
      const playAddr = entry.PlayAddr || entry.play_addr || entry.playAddr;
      const height = playAddr?.Height || playAddr?.height || null;
      const width = playAddr?.Width || playAddr?.width || null;
      const bitrate = entry.Bitrate || entry.bitrate || null;
      const codec = entry.CodecType || entry.codec_type || entry.codec || null;
      const dataSize = playAddr?.DataSize || playAddr?.data_size || playAddr?.size || null;
      const url = playAddr?.UrlList?.[0] || playAddr?.url_list?.[0] || playAddr?.url || null;

      let qualityLabel = null;
      if (entry.GearName || entry.gear_name) {
         const m = (entry.GearName || entry.gear_name).match(/(\d{3,4})/);
         if (m) qualityLabel = `${m[1]}p`;
      }
      if (!qualityLabel) qualityLabel = getQualityLabel(height, entry.QualityType || entry.quality_type || null);
      
      const sizeFormatted = dataSize ? formatBytes(parseInt(dataSize, 10)) : 'Unknown size';

      return {
        qualityType: entry.QualityType || entry.quality_type || null,
        qualityLabel,
        bitrate,
        codec,
        width,
        height,
        url,
        sizeFormatted
      };
    })
    .filter((entry: TikTokResolution) => entry.url)
    .sort((a: TikTokResolution, b: TikTokResolution) => (b.bitrate || 0) - (a.bitrate || 0));

  // Fallback to primary addresses if no bitrate info is found
  if (resolutions.length === 0 && video) {
    const primaryUrl = video.downloadAddr || video.playAddr || video.play_addr;
    if (primaryUrl) {
      resolutions.push({
        qualityType: video.videoQuality || 'original',
        qualityLabel: video.definition || 'Original',
        bitrate: video.bitrate || null,
        codec: video.codecType || null,
        width: video.width || null,
        height: video.height || null,
        url: primaryUrl,
        sizeFormatted: video.size ? formatBytes(parseInt(video.size, 10)) : 'Unknown size'
      });
    }
  }

  return {
    id: itemStruct.id ?? null,
    description: itemStruct.desc ?? null,
    thumbnail: video?.cover ?? null,
    tokens: { 
      msToken: msToken ?? null, 
      ttChainToken: ttChainToken ?? null,
      cookieString: cookieString 
    },
    resolutions
  };
}

interface HLSFormat {
  name: string;
  height: number;
  url: string;
  type: 'video' | 'audio';
  hasAudio: boolean;
}

interface YouTubeResolution {
  itags: number[];
  qualityLabel: string;
  bitrate: number;
  codec: string;
  mimeType: string;
  url: string;
  sizeFormatted: string;
  isAdaptive: boolean;
  isHLS?: boolean;
  hasAudio?: boolean;
}

interface YouTubeData {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  resolutions: YouTubeResolution[];
  apiKey: string;
  visitorData: string;
  cookies?: string;
  sts?: number;
  sapiHash?: string;
}

class YouTubeCookieJar {
  private cookies: Record<string, string> = {};

  update(setCookie: string[] | null) {
    if (!setCookie) return;
    setCookie.forEach((line: string) => {
      const part = line.split(';')[0];
      if (part) {
        const [key, ...rest] = part.split('=');
        if (key) this.cookies[key.trim()] = rest.join('=').trim();
      }
    });
  }

  getHeader(): string {
    return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
  }

  loadFromNetscape(content: string) {
    content.split('\n').forEach(line => {
      if (!line || line.startsWith('#')) return;
      const parts = line.split('\t');
      if (parts.length >= 7) {
        const key = parts[5];
        const value = parts[6];
        if (key && value) {
          this.cookies[key.trim()] = value.trim();
        }
      }
    });
  }
}



async function getYouTubeSession(videoId: string, jar: YouTubeCookieJar): Promise<{ apiKey: string, sts: number, visitorData: string, html: string }> {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const localPagePath = path.join(process.cwd(), 'page.html');
    const localCookiesPath = path.join(process.cwd(), 'cookies.txt');
    const rootCookiesPath = path.join(process.cwd(), '..', '..', 'cookies.txt');
    
    // 0. Load cookies from cookies.txt if exists
    if (fs.existsSync(localCookiesPath)) {
        console.log(chalk.gray(`[*] Loading cookies from cookies.txt...`));
        jar.loadFromNetscape(fs.readFileSync(localCookiesPath, 'utf8'));
    } else if (fs.existsSync(rootCookiesPath)) {
        console.log(chalk.gray(`[*] Loading cookies from project root cookies.txt...`));
        jar.loadFromNetscape(fs.readFileSync(rootCookiesPath, 'utf8'));
    }
    
    let html = "";
    // 1. Try dynamic fetch first to see if we can get it without a file
    try {
        const response = await axios.get(watchUrl, { 
            headers: { 
                "User-Agent": USER_AGENT_IOS,
                "Referer": "https://www.youtube.com/",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
                "Accept-Language": "en-US,en;q=0.5",
                "Connection": "keep-alive",
                "Upgrade-Insecure-Requests": "1"
            },
            timeout: 15000
        });
        
        if (response.headers['set-cookie']) {
            jar.update(response.headers['set-cookie']);
        }
        
        html = response.data;
        
        const hasApiKey = html.includes('INNERTUBE_API_KEY') || html.includes('innertube_api_key');
        if (!hasApiKey) throw new Error("No API key in dynamic fetch");
        console.log(chalk.gray(`[*] Dynamic session fetch successful.`));
    } catch (e: any) {
        if (e.response?.status === 429) {
            console.log(chalk.yellow(`[!] YouTube is rate-limiting automated requests (429).`));
        } else {
            console.log(chalk.yellow(`[!] Dynamic session fetch failed: ${e.message}`));
        }
        
        // 2. Ask user for path (Always ask if dynamic fails, as requested)
        const { pagePath } = await inquirer.prompt([{
            type: 'input',
            name: 'pagePath',
            message: 'Provide path to "page.html" (optional, press Enter to check current directory):',
        }]);
        
        if (pagePath && fs.existsSync(pagePath)) {
            console.log(chalk.gray(`[*] Reading from provided path: ${pagePath}`));
            html = fs.readFileSync(pagePath, 'utf8');
        } else if (!pagePath && fs.existsSync(localPagePath)) {
            console.log(chalk.gray(`[*] Reading from page.html found in current directory...`));
            html = fs.readFileSync(localPagePath, 'utf8');
        } else {
            console.log(chalk.gray(`[*] Continuing without session file...`));
        }
    }
    
    const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1] || html.match(/innertube_api_key":"([^"]+)"/i)?.[1] || "";
    const sts = html.match(/"sts":(\d+)/)?.[1] || html.match(/signatureTimestamp":(\d+)/)?.[1];
    const visitorData = html.match(/"visitorData":"([^"]+)"/)?.[1] || html.match(/visitor_data":"([^"]+)"/i)?.[1] || "";
    
    return { apiKey, sts: sts ? parseInt(sts) : 19800, visitorData, html };
}

async function parseHlsManifest(url: string, headers: Record<string, string>): Promise<HLSFormat[]> {
  try {
    const res = await axios.get(url, { headers });
    const lines = res.data.split('\n');
    const formats: HLSFormat[] = [];
    const seen = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXT-X-STREAM-INF')) {
            const info = line;
            let streamUrl = lines[i + 1]?.trim();
            if (!streamUrl || streamUrl.startsWith('#')) continue;
            if (!streamUrl.startsWith('http')) streamUrl = new URL(streamUrl, url).href;

            const resMatch = info.match(/RESOLUTION=(\d+x\d+)/);
            const codecs = info.match(/CODECS="([^"]+)"/)?.[1] || '';
            const bw = info.match(/BANDWIDTH=(\d+)/)?.[1] || '0';
            
            let name = '', height = 0, type: 'video' | 'audio' = 'video';
            let hasAudio = codecs.includes('mp4a') || codecs.includes('opus');

            if (resMatch) {
                height = parseInt(resMatch[1].split('x')[1]);
                name = `[Video] ${height}p (${resMatch[1]})`;
                type = 'video';
            } else if (hasAudio) {
                name = `[Audio Track] ${Math.round(parseInt(bw)/1000)}kbps`;
                height = -1; type = 'audio';
            } else { continue; }
            
            if (seen.has(name)) continue;
            seen.add(name);
            formats.push({ name, height, url: streamUrl, type, hasAudio });
        } else if (line.toUpperCase().includes('TYPE=AUDIO') && line.includes('URI=')) {
            const uriMatch = line.match(/URI="([^"]+)"/i);
            if (!uriMatch) continue;
            let streamUrl = uriMatch[1];
            if (!streamUrl.startsWith('http')) streamUrl = new URL(streamUrl, url).href;

            const nameMatch = line.match(/NAME="([^"]+)"/i);
            const bw = line.match(/BANDWIDTH=(\d+)/i)?.[1] || '128000';
            const name = `[Dedicated Audio] ${nameMatch ? nameMatch[1] : 'Track'} (${Math.round(parseInt(bw)/1000)}kbps)`;
            if (seen.has(name)) continue;
            seen.add(name);
            formats.push({ name, height: -1, url: streamUrl, type: 'audio', hasAudio: true });
        }
    }
    return formats;
  } catch (e) {
    return [];
  }
}

async function crawlYouTube(videoId: string): Promise<YouTubeData> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  const tvUserAgent = "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)";
  const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const jar = new YouTubeCookieJar();
  

  let streamingData: any = null;
  let videoDetails: any = null;
  let lastError = "";

  const { apiKey, sts, visitorData, html } = await getYouTubeSession(videoId, jar);
  
  const currentCookies = jar.getHeader();
  let sapiHash = "";
  const sapisidMatch = currentCookies.match(/SAPISID=([^;]+)/);
  if (sapisidMatch && sapisidMatch[1]) {
    sapiHash = generateSapiHash(sapisidMatch[1]);
  }

  // Try parsing from HTML first (especially if provided via page.html)
  try {
    const playerResMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/) || html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\})\s*,/);
    if (playerResMatch && playerResMatch[1]) {
      const data = JSON.parse(playerResMatch[1]);
      if (data.streamingData) {
        streamingData = data.streamingData;
        videoDetails = data.videoDetails;
      }
    }
  } catch (e) {}

  // Always perform the authenticated POST request to get HLS manifests
  // even if page.html provided some initial (usually DASH) data
  try {
    const headers: Record<string, string> = { 
      "Content-Type": "application/json",
      "User-Agent": USER_AGENT_IOS,
      "Cookie": currentCookies,
      "X-Goog-AuthUser": "0"
    };
    if (sapiHash) headers["Authorization"] = sapiHash;

    const response = await axios.post(`https://www.youtube.com/youtubei/v1/player?key=${apiKey || ''}`, {
      videoId, 
      context: { client: IOS_CLIENT_CONTEXT },
      playbackContext: { contentPlaybackContext: { signatureTimestamp: sts } }
    }, { headers });

    const apiData = response.data;
    if (apiData.streamingData) {
      streamingData = apiData.streamingData;
      videoDetails = apiData.videoDetails;
    }
    if (apiData.playabilityStatus) lastError = apiData.playabilityStatus.reason || apiData.playabilityStatus.status;
  } catch (e: any) {
    lastError = e.message;
  }

  if (streamingData) {
    const title = videoDetails?.title || "YouTube Video";
    const description = videoDetails?.shortDescription || "";
    const thumbnail = videoDetails?.thumbnail?.thumbnails?.pop()?.url || "";
    const resolutions: YouTubeResolution[] = [];

    // For YouTube, if we have HLS, we use it EXCLUSIVELY for stability (matches working script)
    if (streamingData.hlsManifestUrl) {
        const hlsFormats = await parseHlsManifest(streamingData.hlsManifestUrl, {
            "User-Agent": USER_AGENT_IOS,
            "Cookie": currentCookies,
            "Authorization": sapiHash,
            "X-Goog-AuthUser": "0"
        });
        
        if (hlsFormats.length > 0) {
            hlsFormats.forEach(h => {
                if (h.type === 'video') {
                    resolutions.push({
                        itags: [0],
                        qualityLabel: h.name,
                        bitrate: 0,
                        codec: 'HLS',
                        mimeType: 'video/hls',
                        url: h.url,
                        sizeFormatted: 'HLS Stream',
                        isAdaptive: true,
                        isHLS: true,
                        hasAudio: h.hasAudio
                    });
                }
            });
            // If we found HLS formats, we return them and SKIP dash formats
            if (resolutions.length > 0) {
               return { id: videoId, title, description, thumbnail, resolutions, apiKey, visitorData, cookies: currentCookies, sts, sapiHash };
            }
        }
    }

    const allFormats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])];
    allFormats.forEach((f: any) => {
      if (f.url) {
        const isVideo = f.mimeType.includes('video/');
        if (isVideo) {
          resolutions.push({
            itags: [f.itags || f.itag],
            qualityLabel: f.qualityLabel || (f.height ? `${f.height}p` : 'Unknown'),
            bitrate: f.bitrate,
            codec: f.mimeType.split(';')[0],
            mimeType: f.mimeType,
            url: f.url,
            sizeFormatted: f.contentLength ? formatBytes(parseInt(f.contentLength, 10)) : 'Unknown',
            isAdaptive: !f.mimeType.includes('audio/'),
            isHLS: f.isHLS || false,
            hasAudio: f.hasAudio || f.mimeType.includes('audio') || !f.mimeType.includes('video')
          });
        }
      }
    });

    if (resolutions.length > 0) {
      return { 
        id: videoId, 
        title, 
        description, 
        thumbnail, 
        resolutions: resolutions.sort((a, b) => b.bitrate - a.bitrate), 
        apiKey: apiKey || "", 
        visitorData, 
        cookies: currentCookies, 
        sts,
        sapiHash
      };
    }
  }

  throw new Error(`YouTube failed all attempts. Last error: ${lastError || 'No streaming data found'}`);
}

async function getBestYouTubeAudio(videoId: string, apiKey: string, visitorData: string, cookies?: string, sts?: number, sapiHash?: string): Promise<string> {
  // If we have a player response, try to find HLS audio first (more stable)
  // But this function is usually called when we already have the URL.
  // Let's update it to use axios and the same logic as the working script.
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    "User-Agent": USER_AGENT_IOS,
    "Cookie": cookies || "",
    "X-Goog-AuthUser": "0"
  };
  if (sapiHash) headers["Authorization"] = sapiHash;

  try {
    const response = await axios.post(`https://www.youtube.com/youtubei/v1/player?key=${apiKey || ''}`, {
      videoId, 
      context: { client: IOS_CLIENT_CONTEXT },
      playbackContext: { contentPlaybackContext: { signatureTimestamp: sts } }
    }, { headers });

    const data = response.data;
    
    // Prioritize HLS audio track if manifest exists
    if (data.streamingData?.hlsManifestUrl) {
      const hlsFormats = await parseHlsManifest(data.streamingData.hlsManifestUrl, headers);
      const audioTrack = hlsFormats.find(f => f.type === 'audio') || hlsFormats.find(f => f.hasAudio);
      if (audioTrack) return audioTrack.url;
    }

    const audioFormat = data.streamingData?.adaptiveFormats
      ?.filter((f: any) => f.mimeType.includes('audio/'))
      ?.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];

    if (audioFormat?.url) return audioFormat.url;
  } catch (e) {}
  
  throw new Error("Could not find audio stream for YouTube video.");
}

async function handleM3U8Download(url: string): Promise<void> {
  // 1. Ask for headers file
  const { headersPath } = await inquirer.prompt([{
    type: 'input',
    name: 'headersPath',
    message: 'Path to headers JSON file (press Enter to check root "headers.json"):',
    validate: (input: string) => {
        if (!input) return true;
        return fs.existsSync(input) ? true : 'File does not exist.';
    }
  }]);

  let customHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  const finalHeadersPath = headersPath || (fs.existsSync('headers.json') ? 'headers.json' : null);
  
  if (finalHeadersPath) {
    try {
      console.log(chalk.gray(`[*] Loading headers from ${finalHeadersPath}...`));
      const headersContent = await fs.readFile(finalHeadersPath, 'utf8');
      const parsed = JSON.parse(headersContent);
      customHeaders = { ...customHeaders, ...parsed };
    } catch (e) {
      console.log(chalk.yellow(`[!] Warning: Failed to parse headers file (${e instanceof Error ? e.message : String(e)}). Using defaults.`));
    }
  } else {
    console.log(chalk.gray('[*] No headers file provided. Using default browser headers.'));
  }

  console.log(chalk.yellow('\n[*] Analyzing M3U8 manifest...'));
  
  const formats = await parseHlsManifest(url, customHeaders);
  
  let downloadUrl = url;
  let finalTitle = '';

  if (formats.length > 0) {
    console.log(chalk.green(`\n[+] Master Playlist detected with ${formats.length} streams.`));
    const { selectedFormat } = await inquirer.prompt([{
      type: 'select',
      name: 'selectedFormat',
      message: 'Select stream quality:',
      choices: formats.sort((a, b) => b.height - a.height).map(f => ({ name: f.name, value: f }))
    }]);
    downloadUrl = selectedFormat.url;
  } else {
    console.log(chalk.cyan('\n[*] Media Playlist detected (single stream).'));
  }

  const { title } = await inquirer.prompt([{
    type: 'input',
    name: 'title',
    message: 'Enter video title (optional, leave empty for default):',
    default: `hls_download_${Date.now()}`
  }]);
  finalTitle = title;

  const dest = path.join(process.cwd(), `${finalTitle.replace(/[^a-z0-9]/gi, '_')}.mp4`);
  const tempDir = path.join(process.cwd(), `.dlx_temp_${Date.now()}`);
  activeTempDir = tempDir;
  await fs.ensureDir(tempDir);

  try {
    console.log(chalk.blue("\n📥 Fetching media playlist..."));
    const response = await axios.get(downloadUrl, { headers: customHeaders });
    const playlistContent = response.data;
    const lines = playlistContent.split('\n');

    // Handle AES-128 Key
    const keyMatch = playlistContent.match(/#EXT-X-KEY:METHOD=AES-128,URI="([^"]+)"/);
    if (keyMatch) {
        console.log(chalk.yellow("🔑 Detected AES-128 encryption. Fetching key..."));
        const keyUri = keyMatch[1];
        const keyUrl = keyUri.startsWith('http') ? keyUri : new URL(keyUri, downloadUrl).href;
        const keyData = await axios.get(keyUrl, { headers: customHeaders, responseType: 'arraybuffer' });
        await fs.writeFile(path.join(tempDir, 'video.key'), Buffer.from(keyData.data));
        console.log(chalk.green("✅ Decryption key saved."));
    }

    const segments = lines.filter((line: string) => line.trim() && !line.startsWith('#'));
    const totalSegments = segments.length;
    const baseUrl = downloadUrl.substring(0, downloadUrl.lastIndexOf('/') + 1);

    console.log(chalk.blue(`✅ Found ${totalSegments} segments. Starting parallel download...\n`));

    const progressBar = new cliProgress.SingleBar({
        format: chalk.cyan('💎 Progress |') + chalk.green('{bar}') + '| {percentage}% | {value}/{total} Segments | Speed: {speed} | Size: {size}',
        barCompleteChar: '\u2588',
        barIncompleteChar: '\u2591',
        hideCursor: true
    }, cliProgress.Presets.shades_classic);

    let completed = 0;
    let totalBytes = 0;
    let lastUpdate = Date.now();
    let lastBytes = 0;
    let speedFormatted = '0 B/s';

    progressBar.start(totalSegments, 0, { speed: '0 B/s', size: '0 B' });

    const CONCURRENCY = 15;
    const queue = [...segments.entries()];
    
    async function worker() {
        while (queue.length > 0) {
            const item = queue.shift();
            if (!item) break;
            const [index, segmentName] = item;
            const segmentUrl = segmentName.startsWith('http') ? segmentName : new URL(segmentName, baseUrl).href;
            const segmentPath = path.join(tempDir, `${index.toString().padStart(5, '0')}.ts`);
            
            let retries = 3;
            while (retries > 0) {
                try {
                    const res = await axios.get(segmentUrl, { 
                        headers: customHeaders, 
                        responseType: 'arraybuffer',
                        timeout: 30000 
                    });
                    const buffer = Buffer.from(res.data);
                    await fs.writeFile(segmentPath, buffer);
                    
                    completed++;
                    totalBytes += buffer.length;
                    
                    const now = Date.now();
                    const elapsed = (now - lastUpdate) / 1000;
                    if (elapsed >= 0.5) {
                        const speed = (totalBytes - lastBytes) / elapsed;
                        speedFormatted = `${formatBytes(speed)}/s`;
                        lastUpdate = now;
                        lastBytes = totalBytes;
                    }

                    progressBar.update(completed, {
                        speed: speedFormatted,
                        size: formatBytes(totalBytes)
                    });
                    break;
                } catch (err) {
                    retries--;
                    if (retries === 0) {
                        console.error(chalk.red(`\n❌ Failed segment ${index}: ${err instanceof Error ? err.message : String(err)}`));
                    }
                }
            }
        }
    }

    await Promise.all(Array(CONCURRENCY).fill(0).map(() => worker()));
    progressBar.stop();

    console.log(chalk.green("\n📦 Download complete. Preparing local playlist..."));

    // Generate Local m3u8
    const localM3u8Path = path.join(tempDir, 'local.m3u8');
    let localM3u8Content = "";
    let segmentIndex = 0;

    for (const line of lines) {
        if (line.startsWith('#EXT-X-KEY')) {
            localM3u8Content += `#EXT-X-KEY:METHOD=AES-128,URI="video.key"\n`;
        } else if (line.trim() && !line.startsWith('#')) {
            localM3u8Content += `${segmentIndex.toString().padStart(5, '0')}.ts\n`;
            segmentIndex++;
        } else {
            localM3u8Content += line + "\n";
        }
    }
    await fs.writeFile(localM3u8Path, localM3u8Content);

    console.log(chalk.blue("🎬 Finalizing video (Merging)..."));
    
    await new Promise<void>((resolve, reject) => {
        const ffmpeg = spawn(ffmpegPath || 'ffmpeg', [
            '-y',
            '-allowed_extensions', 'ALL',
            '-i', 'local.m3u8',
            '-c', 'copy',
            '-bsf:a', 'aac_adtstoasc',
            dest
        ], { cwd: tempDir }) as any;

        ffmpeg.on('close', (code: number | null) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg exited with code ${code}`));
        });
    });

    console.log(chalk.green.bold(`\n🎉 SUCCESS! Full video saved to: ${path.basename(dest)}`));
    console.log(chalk.dim("🧹 Cleaning up temporary files..."));
    await fs.remove(tempDir);
    console.log(chalk.dim("Done."));

    console.log(chalk.dim("Done."));

  } catch (err) {
    if (fs.existsSync(tempDir)) await fs.remove(tempDir);
    throw err;
  } finally {
    if (fs.existsSync(tempDir)) await fs.remove(tempDir);
    activeTempDir = null;
  }
}

async function handleGenericDownload(url: string): Promise<void> {
  const { filename, method, headersJson, bodyContent } = await inquirer.prompt([
    {
      type: 'input',
      name: 'filename',
      message: 'Enter output filename (optional):',
      default: () => {
        try {
          return path.basename(new URL(url).pathname) || `download_${Date.now()}`;
        } catch (e) {
          return `download_${Date.now()}`;
        }
      }
    },
    {
      type: 'list',
      name: 'method',
      message: 'Request Method:',
      choices: ['GET', 'POST', 'PUT', 'DELETE'],
      default: 'GET'
    },
    {
      type: 'input',
      name: 'headersJson',
      message: 'Custom Headers JSON (optional, e.g. {"Auth":"..."}):',
      validate: (input) => {
        if (!input) return true;
        try { JSON.parse(input); return true; } catch (e) { return 'Invalid JSON format. Please enter a valid JSON string.'; }
      }
    },
    {
      type: 'input',
      name: 'bodyContent',
      message: 'Request Body (optional):',
      when: (ans) => ans.method !== 'GET'
    }
  ]);

  let customHeaders: Record<string, string> = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  };

  if (headersJson) {
    try {
      customHeaders = { ...customHeaders, ...JSON.parse(headersJson) };
    } catch (e) {}
  }

  const outputPath = path.join(process.cwd(), filename);
  console.log(chalk.yellow(`\n[*] Starting generic download: ${chalk.white(url)}`));

  const axiosConfig: any = {
    url,
    method,
    headers: customHeaders,
    responseType: 'stream'
  };

  if (bodyContent) {
    try {
      axiosConfig.data = JSON.parse(bodyContent);
    } catch (e) {
      axiosConfig.data = bodyContent;
    }
  }

  const response = await axios(axiosConfig);
  const totalLength = response.headers['content-length'];
  const writer = createWriteStream(outputPath);

  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |' + chalk.green('{bar}') + '| {percentage}% | {value_formatted}/{total_formatted} | Speed: {speed}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  }, cliProgress.Presets.shades_classic);

  let downloadedBytes = 0;
  const totalBytes = totalLength ? parseInt(String(totalLength), 10) : 0;

  if (totalBytes > 0) {
    progressBar.start(totalBytes, 0, {
      speed: '0 B/s',
      value_formatted: formatBytes(0),
      total_formatted: formatBytes(totalBytes)
    });
  } else {
    console.log(chalk.blue('\n[*] Downloading (unknown size)...'));
  }

  let lastUpdate = Date.now();
  let lastBytes = 0;
  let speed = 0;

  response.data.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    const now = Date.now();
    const elapsed = (now - lastUpdate) / 1000;
    if (elapsed >= 0.5) {
      speed = (downloadedBytes - lastBytes) / elapsed;
      lastUpdate = now;
      lastBytes = downloadedBytes;
    }

    if (totalBytes > 0) {
      progressBar.update(downloadedBytes, {
        speed: `${formatBytes(speed)}/s`,
        value_formatted: formatBytes(downloadedBytes),
        total_formatted: formatBytes(totalBytes)
      });
    }
  });

  await pipeline(response.data, writer);
  if (totalBytes > 0) progressBar.stop();

  console.log(chalk.green.bold(`\n🎉 SUCCESS! File saved to: ${path.basename(outputPath)}`));
}

interface FacebookResolution {
  url: string;
  width: number;
  height: number;
  quality: string;
  format: string;
  bitrate?: number;
}

interface FacebookAudioResolution {
  url: string;
  bandwidth: number;
}

interface FacebookData {
  id: string;
  title: string;
  thumbnail: string;
  resolutions: FacebookResolution[];
  audio?: FacebookAudioResolution;
}

function cleanFbUrl(url: string | null | undefined) {
    if (!url) return "";
    return url.replace(/\\\//g, '/')
              .replace(/\\u00253D/g, '=')
              .replace(/\\u0025/g, '%')
              .replace(/&amp;/g, '&');
}

function decodeFbUnicode(str: string | null | undefined) {
    if (!str) return str;
    let decoded = str.replace(/\\u([a-fA-F0-9]{4})/g, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
    // Decode hexadecimal HTML entities
    decoded = decoded.replace(/&#x([a-fA-F0-9]+);/ig, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
    // Decode decimal HTML entities
    decoded = decoded.replace(/&#(\d+);/g, (match, grp) => String.fromCharCode(parseInt(grp, 10)));
    return decoded;
}

async function crawlFacebook(url: string): Promise<FacebookData> {
    let targetUrl = url;
    if (url.includes('fb.watch')) {
      try {
        const res = await axios.get(url, { maxRedirects: 5 });
        targetUrl = res.request?.res?.responseUrl || url;
      } catch (e) {
        // Ignore and proceed
      }
    }

    const finalIdMatch = targetUrl.match(/\/reel\/(\d+)/) || targetUrl.match(/\/videos\/(\d+)/) || targetUrl.match(/fbid=(\d+)/) || targetUrl.match(/v=(\d+)/);
    
    const response = await fetch(targetUrl, {
        headers: {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
            'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8',
            'Accept-Language': 'en-US,en;q=0.9',
            'Sec-Fetch-Dest': 'document',
            'Sec-Fetch-Mode': 'navigate',
            'Sec-Fetch-Site': 'none',
            'Sec-Fetch-User': '?1',
            'Upgrade-Insecure-Requests': '1'
        }
    });
    
    if (!response.ok) {
        throw new Error(`Failed to fetch Facebook page (${response.status})`);
    }

    const content: string = await response.text();

    let targetVideoId = finalIdMatch ? finalIdMatch[1] : null;
    if (!targetVideoId) {
       const currVidMatch = content.match(/"currentVideoID":"(\d+)"/);
       if (currVidMatch) targetVideoId = currVidMatch[1];
       else {
         const videoIdMatch = content.match(/"video_id":"(\d+)"/);
         if (videoIdMatch) targetVideoId = videoIdMatch[1];
       }
    }

    if (!targetVideoId) {
        throw new Error('Could not extract video ID from URL or page content.');
    }

    const scriptRegex = /<script type="application\/json"[^>]*data-sjs>([\s\S]*?)<\/script>/g;
    let match;
    let metadata = {
        title: null as string | null | undefined,
        description: null as string | null | undefined,
        owner: { name: null as string | null | undefined, id: null as string | null | undefined },
        duration: null as number | null | undefined,
        thumbnail_url: null as string | null | undefined
    };

    let representations: any[] = [];

    while ((match = scriptRegex.exec(content)) !== null) {
        const jsonStr = match[1] || "";
        if (jsonStr.includes(targetVideoId)) {
            const msgMatch = /"message":\{"text":"((?:[^"\\]|\\.)*)"\}/.exec(jsonStr);
            if (msgMatch && !metadata.description) metadata.description = decodeFbUnicode(msgMatch[1]);

            const ownerIdMatch = /"owner":\{[^}]*?"id":"(\d+)"/.exec(jsonStr);
            const ownerNameMatch = /"video_owner":\{[^}]*?"name":"((?:[^"\\]|\\.)*)"/.exec(jsonStr) 
                                 || /"owner":\{[^}]*?"name":"((?:[^"\\]|\\.)*)"/.exec(jsonStr);
            if (ownerIdMatch && !metadata.owner.id) metadata.owner.id = ownerIdMatch[1];
            if (ownerNameMatch && !metadata.owner.name) metadata.owner.name = decodeFbUnicode(ownerNameMatch[1]);

            const thumbMatch = /"preferred_thumbnail":\{"image":\{"uri":"((?:[^"\\]|\\.)*)"/.exec(jsonStr) 
                            || /"thumbnail":\{"uri":"((?:[^"\\]|\\.)*)"/.exec(jsonStr);
            if (thumbMatch && !metadata.thumbnail_url) metadata.thumbnail_url = cleanFbUrl(thumbMatch[1]);

            const durMatch = /"duration":([\d.]+)/.exec(jsonStr);
            if (durMatch && !metadata.duration) metadata.duration = parseFloat(durMatch[1] || "0");

            const titleMatch = /"title":"((?:[^"\\]|\\.)*)"/.exec(jsonStr);
            if (titleMatch && !metadata.title) metadata.title = decodeFbUnicode(titleMatch[1]);

            if (jsonStr.includes('"representations":[')) {
                const vidIndex = jsonStr.indexOf(`"video_id":"${targetVideoId}"`) !== -1 
                  ? jsonStr.indexOf(`"video_id":"${targetVideoId}"`)
                  : jsonStr.indexOf(`"video_id":${targetVideoId}`);
                  
                if (vidIndex !== -1) {
                    const repsLabel = '"representations":[';
                    const repsStartIndex = jsonStr.lastIndexOf(repsLabel, vidIndex);
                    if (repsStartIndex !== -1) {
                        let bracketCount = 1;
                        let repsEndIndex = repsStartIndex + repsLabel.length;
                        while (bracketCount > 0 && repsEndIndex < jsonStr.length) {
                            if (jsonStr[repsEndIndex] === '[') bracketCount++;
                            if (jsonStr[repsEndIndex] === ']') bracketCount--;
                            repsEndIndex++;
                        }
                        const repsJson = jsonStr.substring(repsStartIndex + '"representations":'.length, repsEndIndex);
                        try {
                            const parsedReps = JSON.parse(repsJson);
                            representations = parsedReps.map((rep: any) => {
                                if (rep.base_url) rep.base_url = cleanFbUrl(rep.base_url);
                                if (rep.mime_type) rep.mime_type = rep.mime_type.replace(/\\\//g, '/');
                                return rep;
                            });
                        } catch (e) {}
                    }
                }
            }
        }
    }

    if (representations.length === 0) {
        throw new Error(`Could not find detailed representation data for video ID ${targetVideoId}.`);
    }

    const videoReps = representations.filter(r => r.mime_type && r.mime_type.startsWith('video/'));
    const audioReps = representations.filter(r => r.mime_type && r.mime_type.startsWith('audio/'));

    const parsedResolutions: FacebookResolution[] = videoReps.map(r => {
        const height = r.height || 0;
        let quality = `${height}p`;
        if (height === 0) quality = "Unknown";
        return {
            url: r.base_url,
            width: r.width || 0,
            height,
            quality,
            format: 'mp4',
            bitrate: r.bandwidth || 0
        };
    }).sort((a, b) => b.height - a.height);

    let bestAudio: FacebookAudioResolution | undefined = undefined;
    if (audioReps.length > 0) {
        const bestAudioRep = [...audioReps].sort((a, b) => (b.bandwidth || 0) - (a.bandwidth || 0))[0];
        if (bestAudioRep) {
            bestAudio = {
                url: bestAudioRep.base_url,
                bandwidth: bestAudioRep.bandwidth || 0
            };
        }
    }

    const titleMatchHtml = content.match(/<title>([\s\S]*?)<\/title>/i);
    const htmlTitle = titleMatchHtml && titleMatchHtml[1] ? titleMatchHtml[1].trim().replace(/\s*[|\-]\s*Facebook\s*$/i, '') : null;

    const metaTitleMatch = content.match(/<meta\s+property="og:title"\s+content="([^"]+)"/i);
    const metaTitle = metaTitleMatch && metaTitleMatch[1] ? decodeFbUnicode(metaTitleMatch[1]) : null;

    const metaDescMatch = content.match(/<meta\s+property="og:description"\s+content="([^"]+)"/i);
    const metaDesc = metaDescMatch && metaDescMatch[1] ? decodeFbUnicode(metaDescMatch[1]) : null;

    let finalTitle = metadata.description || metaDesc || metadata.title || metaTitle || htmlTitle || `Facebook Video ${targetVideoId}`;
    
    // Clean up title if it contains HTML entities like &quot;
    finalTitle = finalTitle.replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>');

    const result: FacebookData = {
        id: targetVideoId,
        title: finalTitle,
        thumbnail: metadata.thumbnail_url || '',
        resolutions: parsedResolutions
    };
    if (bestAudio) result.audio = bestAudio;
    return result;
}



function getUniqueFilename(filename: string): string {
  const ext = path.extname(filename);
  const base = path.basename(filename, ext);
  const dir = path.dirname(filename);
  let finalPath = filename;
  let counter = 1;

  while (fs.existsSync(finalPath)) {
    finalPath = path.join(dir, `${base} (${counter})${ext}`);
    counter++;
  }
  return finalPath;
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[<>:"/\\|?*\n\r]/g, '')
    .replace(/\s+/g, '_')
    .substring(0, 100)
    .replace(/_{2,}/g, '_')
    .replace(/^_|_$/g, '');
}

async function downloadWithProgress(url: string, outputPath: string, headers: Record<string, string> = {}): Promise<void> {
  const response = await axios({
    url,
    method: 'GET',
    headers: {
      'User-Agent': USER_AGENT,
      ...headers
    },
    responseType: 'stream'
  }).catch(e => {
    if (e.response?.status === 403) {
      console.error(chalk.red(`\n[!] 403 Forbidden details: ${e.response.data ? (typeof e.response.data === 'string' ? e.response.data : JSON.stringify(e.response.data)) : 'No body'}`));
    }
    throw e;
  });

  const totalLength = response.headers['content-length'];
  const writer = fs.createWriteStream(outputPath);

  const progressBar = new cliProgress.SingleBar({
    format: 'Progress |' + chalk.green('{bar}') + '| {percentage}% | {value_formatted}/{total_formatted} | Speed: {speed}',
    barCompleteChar: '\u2588',
    barIncompleteChar: '\u2591',
    hideCursor: true
  }, cliProgress.Presets.shades_classic);

  let downloadedBytes = 0;
  const totalBytes = totalLength ? parseInt(String(totalLength), 10) : 0;

  if (totalBytes > 0) {
    progressBar.start(totalBytes, 0, {
      speed: '0 B/s',
      value_formatted: formatBytes(0),
      total_formatted: formatBytes(totalBytes)
    });
  }

  let lastUpdate = Date.now();
  let lastBytes = 0;
  let speed = 0;

  response.data.on('data', (chunk: Buffer) => {
    downloadedBytes += chunk.length;
    const now = Date.now();
    const elapsed = (now - lastUpdate) / 1000;
    if (elapsed >= 0.5) {
      speed = (downloadedBytes - lastBytes) / elapsed;
      lastUpdate = now;
      lastBytes = downloadedBytes;
    }

    if (totalBytes > 0) {
      progressBar.update(downloadedBytes, {
        speed: `${formatBytes(speed)}/s`,
        value_formatted: formatBytes(downloadedBytes),
        total_formatted: formatBytes(totalBytes)
      });
    }
  });

  await pipeline(response.data, writer);
  if (totalBytes > 0) progressBar.stop();
}

async function muxFiles(videoPath: string, audioPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(getFFmpegPath(), [
      '-y',
      '-i', videoPath,
      '-i', audioPath,
      '-c:v', 'copy',
      '-c:a', 'aac',
      '-strict', 'experimental',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });

    ffmpeg.on('error', reject);
  });
}

async function extractAudio(videoPath: string, outputPath: string, format: string): Promise<void> {
  const audioCodec = format === 'mp3' ? 'libmp3lame' : 'aac';
  const extraArgs = format === 'mp3' ? ['-q:a', '2'] : [];

  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(getFFmpegPath(), [
      '-y',
      '-i', videoPath,
      '-vn',
      '-c:a', audioCodec,
      ...extraArgs,
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });

    ffmpeg.on('error', reject);
  });
}

async function extractVideo(videoPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(getFFmpegPath(), [
      '-y',
      '-i', videoPath,
      '-an',
      '-c:v', 'copy',
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });

    ffmpeg.on('error', reject);
  });
}

async function convertFormat(inputPath: string, outputPath: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const ffmpeg = spawn(ffmpegPath || 'ffmpeg', [
      '-y',
      '-i', inputPath,
      '-c', 'copy', // Copy both audio and video streams into new container
      outputPath
    ]);

    ffmpeg.on('close', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`FFmpeg exited with code ${code}`));
    });

    ffmpeg.on('error', reject);
  });
}

async function main() {
  // Clear the console for a clean start
  console.clear();

  // Display a minimal welcome message
  const welcomeText = 'DLX - Nextgen Downloader';
  console.log(chalk.cyan.bold(welcomeText));
  console.log(chalk.cyan('='.repeat(welcomeText.length)));
  console.log(chalk.gray('Your ultra-fast file downloader CLI\n'));

  try {
    // Prompt the user for the URL
    const answers = await inquirer.prompt([
      {
        type: 'input',
        name: 'url',
        message: 'Please provide the URL to download:',
        validate: (input: string) => {
          if (!input) return 'URL cannot be empty.';
          try {
            new URL(input);
            return true;
          } catch (e) {
            return 'Please enter a valid URL (including http/https).';
          }
        },
      },
    ]);

    let url = answers.url;
    let filename = '';
    let tiktokTokens: { msToken: string | null; ttChainToken: string | null; cookieString?: string } | null = null;
    let isYouTube = false;
    let audioUrlToMux = '';
    let downloadType = 'complete';
    let outputFormat = 'mp4';
    let isHLS = false;
    let ytDataRef: YouTubeData | null = null;

    const urlObj = new URL(url);

    if (
      urlObj.hostname.includes('tiktok.com') ||
      urlObj.hostname.includes('youtube.com') ||
      urlObj.hostname.includes('youtu.be') ||
      urlObj.hostname.includes('facebook.com') ||
      urlObj.hostname.includes('fb.watch')
    ) {
      const typeChoice = await inquirer.prompt([
        {
          type: 'select',
          name: 'downloadType',
          message: 'Select download type:',
          choices: [
            { name: 'Complete Video (Video + Audio)', value: 'complete' },
            { name: 'Video Only (No Audio)', value: 'video' },
            { name: 'Audio Only', value: 'audio' },
          ],
        },
      ]);
      downloadType = typeChoice.downloadType;

      const formatChoice = await inquirer.prompt([
        {
          type: 'select',
          name: 'format',
          message: 'Select output format:',
          choices: downloadType === 'audio' 
            ? [
                { name: 'M4A (Default, best quality)', value: 'm4a' },
                { name: 'MP3 (Most compatible)', value: 'mp3' },
              ]
            : [
                { name: 'MP4 (Default, most compatible)', value: 'mp4' },
                { name: 'MKV (Better for large files)', value: 'mkv' },
              ],
        },
      ]);
      outputFormat = formatChoice.format;
    }

    if (urlObj.hostname.includes('tiktok.com')) {
      console.log(chalk.yellow('\nCrawling TikTok video...'));
      try {
        const tiktokData = await crawlTikTok(url);
        tiktokTokens = tiktokData.tokens || null;
        if (tiktokData.resolutions.length === 0) {
          throw new Error('No downloadable resolutions found for this TikTok video.');
        }

        console.log(chalk.green(`\nFound: ${chalk.white(tiktokData.description || 'Untitled Video')}`));
        console.log(chalk.gray(`Available Qualities: ${tiktokData.resolutions.length}\n`));

        if (downloadType === 'audio') {
          url = tiktokData.resolutions[0]?.url || '';
          const cleanDescription = sanitizeFilename(tiktokData.description || '');
          const baseName = cleanDescription || tiktokData.id || `tiktok_${Date.now()}`;
          filename = `${baseName}.${outputFormat}`;
        } else {
          const choice = await inquirer.prompt([
            {
              type: 'select',
              name: 'resolution',
              message: 'Select quality to download:',
              pageSize: 10,
              choices: tiktokData.resolutions.map((res) => ({
                name: `${chalk.bold(res.qualityLabel || 'Unknown')} - ${chalk.cyan(res.codec || 'N/A')} - ${chalk.yellow(res.bitrate ? (res.bitrate / 1000).toFixed(0) + ' kbps' : 'N/A')} - ${chalk.green(res.sizeFormatted)}`,
                value: res
              })),
            },
          ]);
          url = choice.resolution.url;
          const cleanDescription = sanitizeFilename(tiktokData.description || '');
          const baseName = cleanDescription || tiktokData.id || `tiktok_${Date.now()}`;
          filename = `${baseName}_${choice.resolution.qualityLabel}.${outputFormat}`;
        }
      } catch (err) {
        console.error(chalk.red(`\nError crawling TikTok: ${err instanceof Error ? err.message : String(err)}`));
        return;
      }
    } else if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
      console.log(chalk.yellow('\nCrawling YouTube video...'));
      try {
        let videoId = urlObj.searchParams.get('v');
        if (!videoId && urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.slice(1);
        }
        if (!videoId) throw new Error("Invalid YouTube URL: Could not find video ID.");

        const ytData = await crawlYouTube(videoId);
        isYouTube = true;

        console.log(chalk.green(`\nFound: ${chalk.white(ytData.title)}`));
        console.log(chalk.gray(`Available Qualities: ${ytData.resolutions.length}\n`));

        if (downloadType === 'audio') {
          console.log(chalk.blue('Fetching best audio stream...'));
          url = await getBestYouTubeAudio(ytData.id, ytData.apiKey, ytData.visitorData, ytData.cookies, ytData.sts, ytData.sapiHash);
          const cleanTitle = sanitizeFilename(ytData.title);
          filename = `${cleanTitle}.${outputFormat}`;
        } else {
          const choice = await inquirer.prompt([
            {
              type: 'select',
              name: 'resolution',
              message: 'Select YouTube quality:',
              pageSize: 10,
              choices: ytData.resolutions.map((res) => ({
                name: `${chalk.bold(res.qualityLabel)} - ${chalk.cyan(res.codec)} - ${chalk.yellow((res.bitrate / 1000).toFixed(0) + ' kbps')} - ${chalk.green(res.sizeFormatted)}`,
                value: res
              })),
            },
          ]);

          url = choice.resolution.url;
          isHLS = choice.resolution.isHLS || false;
          ytDataRef = ytData;
          const selectedRes = choice.resolution as YouTubeResolution;

          if (selectedRes.isHLS && downloadType === 'complete') {
            console.log(chalk.blue('HLS quality selected. Fetching manifest audio track...'));
            // getBestYouTubeAudio will now automatically prioritize HLS audio if manifest is available
            audioUrlToMux = await getBestYouTubeAudio(ytData.id, ytData.apiKey, ytData.visitorData, ytData.cookies, ytData.sts, ytData.sapiHash);
          } else if (selectedRes.isAdaptive && downloadType === 'complete') {
            console.log(chalk.blue('Adaptive quality selected. Fetching audio stream...'));
            audioUrlToMux = await getBestYouTubeAudio(ytData.id, ytData.apiKey, ytData.visitorData, ytData.cookies, ytData.sts, ytData.sapiHash);
          }

          const cleanTitle = sanitizeFilename(ytData.title);
          filename = `${cleanTitle}_${selectedRes.qualityLabel.split(' ')[0]}.${outputFormat}`;
        }
      } catch (err) {
        console.error(chalk.red(`\nError crawling YouTube: ${err instanceof Error ? err.message : String(err)}`));
        return;
      }
    } else if (urlObj.hostname.includes('facebook.com') || urlObj.hostname.includes('fb.watch')) {
      console.log(chalk.yellow('\nCrawling Facebook video...'));
      try {
        const fbData = await crawlFacebook(url);
        if (fbData.resolutions.length === 0) {
          throw new Error('No downloadable resolutions found for this Facebook video.');
        }

        console.log(chalk.green(`\nFound: ${chalk.white(fbData.title)}`));
        console.log(chalk.gray(`Available Qualities: ${fbData.resolutions.length}\n`));

        if (downloadType === 'audio') {
          if (fbData.audio) {
            url = fbData.audio.url;
          } else {
            url = fbData.resolutions[0]?.url || ''; // Progressive video fallback
          }
          const cleanTitle = sanitizeFilename(fbData.title);
          filename = `${cleanTitle}.${outputFormat}`;
        } else {
          const choice = await inquirer.prompt([
            {
              type: 'select',
              name: 'resolution',
              message: 'Select Facebook quality:',
              pageSize: 10,
              choices: fbData.resolutions.map((res) => ({
                name: `${chalk.bold(res.quality)} - ${chalk.cyan(res.format.toUpperCase())} - ${chalk.yellow(res.bitrate ? (res.bitrate / 1000).toFixed(0) + ' kbps' : 'N/A')}`,
                value: res
              })),
            },
          ]);

          url = choice.resolution.url;
          if (fbData.audio && downloadType === 'complete') {
             console.log(chalk.blue('Separate audio stream detected. Will mux with video.'));
             audioUrlToMux = fbData.audio.url;
          }
          const cleanTitle = sanitizeFilename(fbData.title);
          filename = `${cleanTitle}_${choice.resolution.quality}.${outputFormat}`;
        }
      } catch (err) {
        console.error(chalk.red(`\nError crawling Facebook: ${err instanceof Error ? err.message : String(err)}`));
        return;
      }
    } else if (url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('playlist')) {
      await handleM3U8Download(url);
      return;
    } else {
      console.log(chalk.yellow('[!] Platform not specifically recognized. Attempting generic download...'));
      await handleGenericDownload(url);
      return;
    }

    // Final download step for TikTok, YouTube, and Facebook
    if (url && filename) {
      const finalFilename = getUniqueFilename(filename);
      const headers: Record<string, string> = {};

      if (isYouTube && ytDataRef) {
        headers['User-Agent'] = USER_AGENT_IOS;
        if (ytDataRef.cookies) headers['Cookie'] = ytDataRef.cookies;
        if (ytDataRef.sapiHash) headers['Authorization'] = ytDataRef.sapiHash;
        headers['X-Goog-AuthUser'] = '0';
        headers['Origin'] = 'https://www.youtube.com';
        headers['Referer'] = `https://www.youtube.com/watch?v=${ytDataRef.id}`;
        headers['Accept'] = '*/*';
        headers['Accept-Language'] = 'en-US,en;q=0.9';
        headers['Connection'] = 'keep-alive';
        headers['Sec-Fetch-Dest'] = 'video';
        headers['Sec-Fetch-Mode'] = 'no-cors';
        headers['Sec-Fetch-Site'] = 'cross-site';
      }

      if (isYouTube && isHLS && ytDataRef) {
         // Specialized HLS download for YouTube
         const bestAudio = ytDataRef.resolutions.find(r => !r.isHLS && r.mimeType.includes('audio'))?.url;
         
         const headerLines = [
            `User-Agent: ${USER_AGENT_IOS}`,
            ytDataRef.cookies ? `Cookie: ${ytDataRef.cookies}` : null,
            ytDataRef.sapiHash ? `Authorization: ${ytDataRef.sapiHash}` : null,
            'X-Goog-AuthUser: 0',
            'Origin: https://www.youtube.com',
            `Referer: https://www.youtube.com/watch?v=${ytDataRef.id}`
         ].filter(Boolean) as string[];
         const headerStr = headerLines.join('\r\n') + '\r\n';

         let ffmpegArgs = [
            '-analyzeduration', '0',
            '-probesize', '32',
            '-http_persistent', '1',
            '-threads', '0',
            '-reconnect', '1',
            '-reconnect_at_eof', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '2',
            '-thread_queue_size', '4096',
            '-headers', headerStr,
            '-i', url
         ];

         if (bestAudio && downloadType === 'complete') {
            console.log(chalk.cyan(`[*] Merging separate audio track...`));
            ffmpegArgs.push('-thread_queue_size', '4096', '-headers', headerStr, '-i', bestAudio);
            ffmpegArgs.push('-c:v', 'copy', '-c:a', outputFormat === 'mp3' ? 'libmp3lame' : 'aac', '-map', '0:v:0', '-map', '1:a:0');
         } else if (downloadType === 'audio') {
            ffmpegArgs.push('-vn');
            if (outputFormat === 'mp3') ffmpegArgs.push('-c:a', 'libmp3lame', '-q:a', '2');
            else ffmpegArgs.push('-c:a', 'aac');
         } else {
            ffmpegArgs.push('-c', 'copy');
            if (downloadType === 'video') ffmpegArgs.push('-an');
         }

         ffmpegArgs.push('-y', finalFilename);
         console.log(chalk.green(`\n📥 Starting HLS download via FFmpeg...`));
         
         await new Promise<void>((resolve, reject) => {
            const ffmpeg = spawn(getFFmpegPath(), ffmpegArgs);
            ffmpeg.stderr.on('data', d => {
                const out = d.toString();
                if (out.includes('time=')) process.stdout.write(chalk.gray(`\rProgress: ${out.split('time=')[1].split(' ')[0]}`));
            });
            ffmpeg.on('close', c => {
                if (c === 0) {
                    console.log(chalk.green.bold(`\n\n🎉 SUCCESS! File saved to: ${path.basename(finalFilename)}`));
                    resolve();
                } else reject(new Error(`FFmpeg exited with code ${c}`));
            });
            ffmpeg.on('error', reject);
         });
         return;
      }
      
      if (tiktokTokens) {
        if (tiktokTokens.cookieString) {
          headers['Cookie'] = tiktokTokens.cookieString;
        } else {
          const parts: string[] = [];
          if (tiktokTokens.msToken) parts.push(`msToken=${tiktokTokens.msToken}`);
          if (tiktokTokens.ttChainToken) parts.push(`tt_chain_token=${tiktokTokens.ttChainToken}`);
          headers['Cookie'] = parts.join('; ');
        }
        headers['Referer'] = 'https://www.tiktok.com/';
      }

      if (audioUrlToMux) {
        const tempDir = path.join(process.cwd(), `.dlx_temp_${Date.now()}`);
        activeTempDir = tempDir;
        await fs.ensureDir(tempDir);
        
        const videoTempPath = path.join(tempDir, 'video.mp4');
        const audioTempPath = path.join(tempDir, 'audio.m4a');
        
        try {
          if (isYouTube) {
            // Use FFmpeg for YouTube to handle auth and merging more reliably
            const headerStr = [
              `User-Agent: ${USER_AGENT_IOS}`,
              headers['Cookie'] ? `Cookie: ${headers['Cookie']}` : null,
              headers['Authorization'] ? `Authorization: ${headers['Authorization']}` : null,
              'X-Goog-AuthUser: 0',
              'Origin: https://www.youtube.com',
              headers['Referer'] ? `Referer: ${headers['Referer']}` : null
            ].filter(Boolean).join('\r\n') + '\r\n';

            console.log(chalk.blue('\n📥 Downloading and merging streams via FFmpeg...'));
            
            let ffmpegArgs = [
              '-analyzeduration', '0',
              '-probesize', '32',
              '-http_persistent', '1',
              '-threads', '0',
              '-reconnect', '1',
              '-reconnect_at_eof', '1',
              '-reconnect_streamed', '1',
              '-reconnect_delay_max', '2',
              '-thread_queue_size', '4096',
              '-headers', headerStr,
              '-i', url,
              '-thread_queue_size', '4096',
              '-headers', headerStr,
              '-i', audioUrlToMux,
              '-c:v', 'copy',
              '-c:a', outputFormat === 'mp3' ? 'libmp3lame' : 'aac',
              '-map', '0:v:0',
              '-map', '1:a:0'
            ];

            ffmpegArgs.push('-y', finalFilename);

            await new Promise<void>((resolve, reject) => {
              const ffmpeg = spawn(getFFmpegPath(), ffmpegArgs);
              ffmpeg.stderr.on('data', d => {
                const out = d.toString();
                if (out.includes('time=')) process.stdout.write(chalk.gray(`\rProgress: ${out.split('time=')[1].split(' ')[0]}`));
              });
              ffmpeg.on('close', c => {
                if (c === 0) resolve();
                else reject(new Error(`FFmpeg exited with code ${c}`));
              });
              ffmpeg.on('error', reject);
            });
          } else {
            console.log(chalk.blue('\n📥 Downloading video stream...'));
            await downloadWithProgress(url, videoTempPath, headers);
            
            console.log(chalk.blue('\n📥 Downloading audio stream...'));
            await downloadWithProgress(audioUrlToMux, audioTempPath, headers);
            
            console.log(chalk.yellow('\n🎬 Muxing video and audio...'));
            await muxFiles(videoTempPath, audioTempPath, finalFilename);
          }
          
          console.log(chalk.green.bold(`\n🎉 SUCCESS! File saved to: ${path.basename(finalFilename)}`));
        } finally {
          if (fs.existsSync(tempDir)) await fs.remove(tempDir);
          activeTempDir = null;
        }
      } else {
        if (downloadType === 'video' || downloadType === 'audio') {
          // If we need to extract/strip from a progressive video (where audioUrlToMux is empty)
          const isAudioOnly = downloadType === 'audio';
          // Note: for YouTube and Facebook audio-only with separate streams, we just download the audio stream directly (so it acts like a normal download)
          // But if we downloaded a progressive video to get audio/video only, we use temp files and extract.
          // Wait, for YouTube, audio is already M4A if we just get the audio URL.
          // For Facebook audio, it's also M4A.
          // Only TikTok needs extraction if we want audio/video only because it's purely progressive.
          // So let's check if we actually need extraction.
          // For video only on progressive, we strip audio. For audio only on progressive, we extract audio.
          // We can determine if it's progressive and needs extraction if `audioUrlToMux` is empty but the downloadType is not complete.
          // BUT wait, YouTube adaptive video stream has NO audio. If downloadType='video', audioUrlToMux is empty, it's already video only!
          // So running extractVideo on it is redundant but safe.
          // Let's just always do extraction if downloadType !== 'complete' to be safe.
          
          const tempDir = path.join(process.cwd(), `.dlx_temp_${Date.now()}`);
          activeTempDir = tempDir;
          await fs.ensureDir(tempDir);
          const tempPath = path.join(tempDir, `temp_download${path.extname(finalFilename)}`);
          
          try {
            console.log(chalk.blue('\n📥 Downloading stream...'));
            if (isYouTube) {
               const headerStr = [
                 `User-Agent: ${USER_AGENT_IOS}`,
                 headers['Cookie'] ? `Cookie: ${headers['Cookie']}` : null,
                 headers['Authorization'] ? `Authorization: ${headers['Authorization']}` : null,
                 'X-Goog-AuthUser: 0',
                 'Origin: https://www.youtube.com',
                 headers['Referer'] ? `Referer: ${headers['Referer']}` : null
               ].filter(Boolean).join('\r\n') + '\r\n';
               
               let ffmpegArgs = [
                 '-analyzeduration', '0',
                 '-probesize', '32',
                 '-http_persistent', '1',
                 '-threads', '0',
                 '-reconnect', '1',
                 '-reconnect_at_eof', '1',
                 '-reconnect_streamed', '1',
                 '-reconnect_delay_max', '2',
                 '-y',
                 '-thread_queue_size', '4096',
                 '-headers', headerStr,
                 '-i', url,
                 '-c', 'copy',
                 tempPath
               ];
               
               await new Promise<void>((resolve, reject) => {
                 const ffmpeg = spawn(getFFmpegPath(), ffmpegArgs);
                 ffmpeg.stderr.on('data', d => {
                    const out = d.toString();
                    if (out.includes('time=')) process.stdout.write(chalk.gray(`\rProgress: ${out.split('time=')[1].split(' ')[0]}`));
                 });
                 ffmpeg.on('close', c => {
                    if (c === 0) resolve();
                    else reject(new Error(`FFmpeg exited with code ${c}`));
                 });
                 ffmpeg.on('error', reject);
               });
            } else {
              await downloadWithProgress(url, tempPath, headers);
            }
          } catch (e: any) {
            if (fs.existsSync(tempDir)) await fs.remove(tempDir);
            activeTempDir = null;
            throw e;
          }
          
          try {
            console.log(chalk.yellow(`\n🎬 Processing ${isAudioOnly ? 'audio' : 'video'} only...`));
            if (isAudioOnly) {
              await extractAudio(tempPath, finalFilename, outputFormat);
            } else {
              await extractVideo(tempPath, finalFilename);
            }
            console.log(chalk.green.bold(`\n🎉 SUCCESS! File saved to: ${path.basename(finalFilename)}`));
          } catch (e: any) {
             console.log(chalk.yellow(`\n⚠️ FFmpeg processing skipped or failed: ${e.message}. Saving as is...`));
             await fs.copy(tempPath, finalFilename);
             console.log(chalk.green.bold(`\n🎉 SUCCESS! File saved to: ${path.basename(finalFilename)}`));
          } finally {
            if (fs.existsSync(tempDir)) await fs.remove(tempDir);
            activeTempDir = null;
          }
        } else {
          // If we requested a non-MP4 format but it's a direct progressive download, convert container
          if (outputFormat !== 'mp4') {
            const tempDir = path.join(process.cwd(), `.dlx_temp_${Date.now()}`);
            activeTempDir = tempDir;
            await fs.ensureDir(tempDir);
            const tempPath = path.join(tempDir, `temp_download.mp4`);
            try {
              console.log(chalk.blue('\n📥 Downloading stream...'));
              await downloadWithProgress(url, tempPath, headers);
            } catch (e: any) {
              if (fs.existsSync(tempDir)) await fs.remove(tempDir);
              activeTempDir = null;
              throw e;
            }
            
            try {
              console.log(chalk.yellow(`\n🎬 Converting to ${outputFormat.toUpperCase()} container...`));
              await convertFormat(tempPath, finalFilename);
              console.log(chalk.green.bold(`\n🎉 SUCCESS! File saved to: ${path.basename(finalFilename)}`));
            } catch (e: any) {
              console.log(chalk.yellow(`\n⚠️ FFmpeg container conversion failed: ${e.message}. Saving as is...`));
              await fs.copy(tempPath, finalFilename);
              console.log(chalk.green.bold(`\n🎉 SUCCESS! File saved to: ${path.basename(finalFilename)}`));
            } finally {
              if (fs.existsSync(tempDir)) await fs.remove(tempDir);
              activeTempDir = null;
            }
          } else {
            console.log(chalk.blue('\n📥 Starting download...'));
            await downloadWithProgress(url, finalFilename, headers);
            console.log(chalk.green.bold(`\n🎉 SUCCESS! File saved to: ${path.basename(finalFilename)}`));
          }
        }
      }
    }
  } catch (error: any) {
    console.error(chalk.red('\n✖ Error occurred during download:'));
    console.error(chalk.red(error.message));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
