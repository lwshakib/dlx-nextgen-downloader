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

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  // First fetch to get cookies and tokens (NO HEADERS to avoid bot detection)
  const res1 = await fetch(url);

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
    tokens: { msToken: msToken ?? null, ttChainToken: ttChainToken ?? null },
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
}

interface YouTubeData {
  id: string;
  title: string;
  description: string;
  thumbnail: string;
  resolutions: YouTubeResolution[];
  apiKey: string;
  visitorData: string;
  cookies: string;
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
}

async function parseHlsManifest(url: string, headers: Record<string, string>): Promise<HLSFormat[]> {
  const res = await axios.get(url, { headers });
  const lines: string[] = res.data.split('\n');
  const formats: HLSFormat[] = [];
  const seen = new Set();

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!.trim();
    if (line.startsWith('#EXT-X-STREAM-INF')) {
      const info = line;
      let streamUrl = lines[i + 1]?.trim();
      if (!streamUrl || streamUrl.startsWith('#')) continue;
      if (!streamUrl.startsWith('http')) streamUrl = new URL(streamUrl!, url).href;

      const resMatch = info.match(/RESOLUTION=(\d+x\d+)/);
      const codecs = info.match(/CODECS="([^"]+)"/)?.[1] || '';
      const bw = info.match(/BANDWIDTH=(\d+)/)?.[1] || '0';
      
      let name = '', height = 0, type: 'video' | 'audio' = 'video';
      let hasAudio = codecs.includes('mp4a') || codecs.includes('opus');

      if (resMatch) {
        height = parseInt(resMatch[1]!.split('x')[1]!);
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
      let streamUrl = uriMatch[1]!;
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
}

async function crawlYouTube(videoId: string): Promise<YouTubeData> {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  const tvUserAgent = "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)";
  const browserUserAgent = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const jar = new YouTubeCookieJar();
  
  let html = "";
  let streamingData: any = null;
  let videoDetails: any = null;
  let lastError = "";

  try {
    const res = await fetch(watchUrl, { 
      headers: { 
        "User-Agent": tvUserAgent,
        "Referer": "https://www.youtube.com/"
      } 
    });
    const getSetCookie = (res.headers as any).getSetCookie;
    jar.update(typeof getSetCookie === 'function' ? getSetCookie.call(res.headers) : []);
    html = await res.text();

    const playerResMatch = html.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);
    if (playerResMatch && playerResMatch[1]) {
      const data = JSON.parse(playerResMatch[1]);
      if (data.streamingData) {
        streamingData = data.streamingData;
        videoDetails = data.videoDetails;
      }
    }
  } catch (e) {}

  let apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || html.match(/innertube_api_key":"([^"]+)"/i);
  let apiKey = apiKeyMatch ? apiKeyMatch[1] : undefined;

  if (!streamingData && !apiKey) {
    const resEmbed = await fetch(embedUrl, { headers: { "User-Agent": browserUserAgent, "Referer": "https://www.youtube.com/" } });
    const getSetCookie = (resEmbed.headers as any).getSetCookie;
    jar.update(typeof getSetCookie === 'function' ? getSetCookie.call(resEmbed.headers) : []);
    html = await resEmbed.text();
    apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || html.match(/innertube_api_key":"([^"]+)"/i);
    apiKey = apiKeyMatch ? apiKeyMatch[1] : undefined;
  }
                  
  const visitorData = (html.match(/"visitorData":"([^"]+)"/) || html.match(/visitor_data":"([^"]+)"/i) || [])[1] || "";
  
  if (!streamingData && !apiKey) {
    const isBlocked = html.includes('recaptcha') || html.includes('bot detection') || html.includes('consent.youtube.com');
    throw new Error(`Could not find YouTube stream data or API key.${isBlocked ? ' (YouTube blocked the request)' : ''}`);
  }

  if (!streamingData) {
    const clients = [
      { name: "WEB_EMBEDDED_PLAYER", version: "1.20240101.01.01", userAgent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" },
      { name: "TVHTML5", version: "7.20230405.08.01", userAgent: "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)" },
      { name: "ANDROID", version: "19.30.36", userAgent: "com.google.android.youtube/19.30.36 (Linux; U; Android 14; en_US) gzip" }
    ];

    for (const client of clients) {
      try {
        const payload = {
          context: { client: { clientName: client.name, clientVersion: client.version, userAgent: client.userAgent, hl: 'en', gl: 'US', visitorData } },
          videoId
        };

        const playerRes = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey || ''}`, {
          method: "POST",
          headers: { 
            "Content-Type": "application/json",
            "User-Agent": client.userAgent,
            "Cookie": jar.getHeader(),
            "X-Youtube-Client-Name": client.name === "WEB_EMBEDDED_PLAYER" ? "1" : (client.name === "TVHTML5" ? "7" : "3"),
            "X-Youtube-Client-Version": client.version
          },
          body: JSON.stringify(payload)
        });

        const apiData = await playerRes.json() as any;
        if (apiData.streamingData) {
          streamingData = apiData.streamingData;
          videoDetails = apiData.videoDetails;
          break;
        }
        if (apiData.playabilityStatus) lastError = apiData.playabilityStatus.reason || apiData.playabilityStatus.status;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  if (streamingData) {
    const title = videoDetails?.title || "YouTube Video";
    const description = videoDetails?.shortDescription || "";
    const thumbnail = videoDetails?.thumbnail?.thumbnails?.pop()?.url || "";
    const resolutions: YouTubeResolution[] = [];

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
            isAdaptive: !f.mimeType.includes('audio/')
          });
        }
      }
    });

    if (resolutions.length > 0) {
      return { id: videoId, title, description, thumbnail, resolutions: resolutions.sort((a, b) => b.bitrate - a.bitrate), apiKey: apiKey || "", visitorData, cookies: jar.getHeader() };
    }
  }

  throw new Error(`YouTube failed all attempts. Last error: ${lastError || 'No streaming data found'}`);
}

async function getBestYouTubeAudio(videoId: string, apiKey: string, visitorData: string): Promise<string> {
  const payload = {
    context: { client: { clientName: "IOS", clientVersion: "19.29.1", userAgent: "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; en_US)", visitorData } },
    videoId
  };

  const res = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey || ''}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  });

  const data = await res.json() as any;
  const audioFormat = data.streamingData?.adaptiveFormats
    ?.filter((f: any) => f.mimeType.includes('audio/'))
    ?.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];

  if (!audioFormat?.url) throw new Error("Could not find audio stream for YouTube video.");
  return audioFormat.url;
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
  
  if (!finalHeadersPath) {
    throw new Error('Headers file not found. Please provide a path or ensure "headers.json" exists in the root directory.');
  }

  try {
    console.log(chalk.gray(`[*] Loading headers from ${finalHeadersPath}...`));
    const headersContent = await fs.readFile(finalHeadersPath, 'utf8');
    const parsed = JSON.parse(headersContent);
    customHeaders = { ...customHeaders, ...parsed };
  } catch (e) {
    throw new Error(`Failed to parse headers file: ${e instanceof Error ? e.message : String(e)}`);
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
  const tempDir = path.join(process.cwd(), `temp_${Date.now()}`);
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
        const ffmpeg = spawn('ffmpeg', [
            '-y',
            '-allowed_extensions', 'ALL',
            '-i', 'local.m3u8',
            '-c', 'copy',
            '-bsf:a', 'aac_adtstoasc',
            dest
        ], { cwd: tempDir });

        ffmpeg.on('close', (code) => {
            if (code === 0) resolve();
            else reject(new Error(`FFmpeg exited with code ${code}`));
        });
    });

    console.log(chalk.green.bold(`\n🎉 SUCCESS! Full video saved to: ${path.basename(dest)}`));
    console.log(chalk.dim("🧹 Cleaning up temporary files..."));
    await fs.remove(tempDir);
    console.log(chalk.dim("Done."));

  } catch (err) {
    await fs.remove(tempDir);
    throw err;
  }
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
    return str.replace(/\\u([a-fA-F0-9]{4})/g, (match, grp) => String.fromCharCode(parseInt(grp, 16)));
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

    const title = metadata.title || metadata.description || `Facebook Video ${targetVideoId}`;
    const result: FacebookData = {
        id: targetVideoId,
        title: title,
        thumbnail: metadata.thumbnail_url || '',
        resolutions: parsedResolutions
    };
    if (bestAudio) result.audio = bestAudio;
    return result;
}



async function main() {
  // Handle Ctrl+C gracefully
  process.on('SIGINT', () => {
    console.log(chalk.red('\n\n[!] Download cancelled by user. Exiting...'));
    process.exit(0);
  });

  // Clear the console for a clean start
  console.clear();

  // Display a minimal welcome message
  const welcomeText = 'DLXX - Nextgen Downloader';
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
    let tiktokTokens: { msToken: string | null; ttChainToken: string | null } | null = null;
    let isYouTube = false;
    let audioUrlToMux = '';

    const urlObj = new URL(url);
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
        
        // Robust filename: Description (max 50 chars) -> fallback to ID
        const cleanDescription = (tiktokData.description || '').replace(/[^a-z0-9]/gi, '_').substring(0, 50).replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
        const baseName = cleanDescription || tiktokData.id || `tiktok_${Date.now()}`;
        filename = `${baseName}_${choice.resolution.qualityLabel}.mp4`;
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
        const selectedRes = choice.resolution as YouTubeResolution;

        if (selectedRes.isAdaptive) {
          console.log(chalk.blue('Adaptive quality selected. Fetching audio stream...'));
          audioUrlToMux = await getBestYouTubeAudio(ytData.id, ytData.apiKey, ytData.visitorData);
        }

        const cleanTitle = ytData.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50).replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
        filename = `${cleanTitle}_${selectedRes.qualityLabel.split(' ')[0]}.mp4`;
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
        if (fbData.audio) {
           console.log(chalk.blue('Separate audio stream detected. Will mux with video.'));
           audioUrlToMux = fbData.audio.url;
        }
        const cleanTitle = fbData.title.replace(/[^a-z0-9]/gi, '_').substring(0, 50).replace(/_{2,}/g, '_').replace(/^_|_$/g, '');
        filename = `${cleanTitle}_${choice.resolution.quality}.${choice.resolution.format}`;
      } catch (err) {
        console.error(chalk.red(`\nError crawling Facebook: ${err instanceof Error ? err.message : String(err)}`));
        return;
      }
    } else if (url.toLowerCase().includes('.m3u8') || url.toLowerCase().includes('playlist')) {
      await handleM3U8Download(url);
      return;
    } else {
      // Extract filename from URL for non-tiktok downloads
      filename = path.basename(new URL(url).pathname);
      if (!filename || filename === '/') {
        filename = 'downloaded_file_' + Date.now();
      }
    }

    const outputPath = path.join(process.cwd(), filename);

    console.log(chalk.yellow(`\nStarting download: ${chalk.white(url)}`));
    console.log(chalk.yellow(`Saving to: ${chalk.white(outputPath)}`));

    // Start download
    const axiosConfig: any = {
      url,
      method: 'GET',
      responseType: 'stream',
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
      }
    };

    if (tiktokTokens) {
      const cookieParts = [];
      if (tiktokTokens.msToken) cookieParts.push(`msToken=${tiktokTokens.msToken}`);
      if (tiktokTokens.ttChainToken) cookieParts.push(`tt_chain_token=${tiktokTokens.ttChainToken}`);
      
      if (cookieParts.length > 0) {
        axiosConfig.headers['Cookie'] = cookieParts.join('; ');
        axiosConfig.headers['Referer'] = 'https://www.tiktok.com/';
      }
    }

    const response = await axios(axiosConfig);

    const totalLength = response.headers['content-length'];

    console.log(chalk.blue('Downloading...'));

    const writer = createWriteStream(outputPath);

    // Initialize progress bar
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
        speed: '0 Bytes/s',
        value_formatted: formatBytes(0),
        total_formatted: formatBytes(totalBytes)
      });
    } else {
      console.log(chalk.blue('Downloading (unknown size)...'));
    }

    let lastUpdate = Date.now();
    let lastBytes = 0;
    let speed = 0;

    response.data.on('data', (chunk: Buffer) => {
      downloadedBytes += chunk.length;
      
      const now = Date.now();
      const elapsed = (now - lastUpdate) / 1000;
      
      // Update speed calculation every 500ms for smoother updates
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

    if (totalBytes > 0) {
      progressBar.stop();
    }

    if (audioUrlToMux) {
      const audioPath = path.join(process.cwd(), `temp_audio_${Date.now()}.m4a`);
      const finalMuxedPath = path.join(process.cwd(), `muxed_${filename}`);
      
      console.log(chalk.yellow('\nDownloading audio stream for high-res muxing...'));
      const audioRes = await axios({ url: audioUrlToMux, method: 'GET', responseType: 'stream' });
      const audioWriter = createWriteStream(audioPath);
      await pipeline(audioRes.data, audioWriter);

      console.log(chalk.blue('Muxing video and audio with FFmpeg...'));
      try {
        execSync(`ffmpeg -y -i "${outputPath}" -i "${audioPath}" -c copy -map 0:v:0 -map 1:a:0 "${finalMuxedPath}"`, { stdio: 'ignore' });
        await fs.remove(outputPath);
        await fs.remove(audioPath);
        await fs.move(finalMuxedPath, outputPath);
        console.log(chalk.green('✓ Muxing complete!'));
      } catch (e) {
        console.error(chalk.red('\nFFmpeg muxing failed. You may need to install FFmpeg.'));
        console.log(chalk.yellow(`Video and audio saved separately as: ${filename} and ${path.basename(audioPath)}`));
      }
    }

    console.log(chalk.green('\n✓ Download Complete!'));
    console.log(chalk.green(`File saved as: ${chalk.bold(filename)}`));
    
  } catch (error: any) {
    console.error(chalk.red('\n✖ Error occurred during download:'));
    console.error(chalk.red(error.message));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
