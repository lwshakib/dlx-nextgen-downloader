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

async function main() {
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
      format: 'Progress |' + chalk.cyan('{bar}') + '| {percentage}% | {value_formatted}/{total_formatted} | Speed: {speed}',
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
