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
}

interface TikTokData {
  title: string | null;
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
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      Referer: "https://www.tiktok.com/",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) throw new Error(`Failed to fetch TikTok page: ${response.status}`);
  
  // Extract cookies
  let setCookies: string[] = [];
  const anyHeaders = response.headers as any;
  if (typeof anyHeaders.getSetCookie === "function") {
    setCookies = anyHeaders.getSetCookie();
  } else {
    const single = response.headers.get("set-cookie");
    if (single) {
      setCookies = single.split(/,(?=[^;]+?=)/g);
    }
  }

  const cookies: Record<string, string> = {};
  for (const line of setCookies) {
    const [cookiePart] = line.split(";");
    if (!cookiePart) continue;
    const [name, ...rest] = cookiePart.split("=");
    const value = rest.join("=");
    if (!name) continue;
    cookies[name.trim()] = value.trim();
  }

  const msToken = cookies.msToken || cookies.mstoken;
  const ttChainToken = cookies.tt_chain_token || cookies.tt_chain_token_v2;

  const html = await response.text();

  const regex = new RegExp(`<script[^>]+id="${SCRIPT_ID}"[^>]*>([\\s\\S]*?)<\\/script>`, "i");
  const match = html.match(regex);
  if (!match) throw new Error("Unable to find TikTok rehydration data.");

  const parsed = JSON.parse(match[1]!.trim());
  const defaultScope = parsed?.__DEFAULT_SCOPE__;
  const itemStruct = defaultScope?.["webapp.video-detail"]?.itemInfo?.itemStruct;

  if (!itemStruct) throw new Error("Video detail data was not found in the TikTok page.");

  const video = itemStruct.video;
  const bitrateInfo = Array.isArray(video?.bitrateInfo) ? video.bitrateInfo : [];

  return {
    title: itemStruct.desc ?? null,
    thumbnail: video?.cover ?? null,
    tokens: {
      msToken: msToken ?? null,
      ttChainToken: ttChainToken ?? null,
    },
    resolutions: bitrateInfo
      .map((entry: any) => {
        const height = entry.PlayAddr?.Height ?? null;
        return {
          qualityType: entry.QualityType ?? null,
          qualityLabel: getQualityLabel(height, entry.QualityType ?? null),
          bitrate: entry.Bitrate ?? null,
          codec: entry.CodecType ?? null,
          width: entry.PlayAddr?.Width ?? null,
          height,
          url: entry.PlayAddr?.UrlList?.[0] ?? null,
        };
      })
      .filter((entry: any) => entry.url),
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

        console.log(chalk.green(`\nFound: ${chalk.white(tiktokData.title || 'Untitled Video')}`));

        const choice = await inquirer.prompt([
          {
            type: 'list',
            name: 'resolution',
            message: 'Select quality:',
            choices: tiktokData.resolutions.map((res) => ({
              name: `${res.qualityLabel || 'Unknown'} (${res.codec || 'N/A'}, ${res.bitrate ? (res.bitrate / 1000).toFixed(0) + 'kbps' : 'N/A'})`,
              value: res
            })),
          },
        ]);

        url = choice.resolution.url;
        filename = `${(tiktokData.title || 'tiktok_video').substring(0, 30).replace(/[^a-z0-9]/gi, '_')}_${choice.resolution.qualityLabel}.mp4`;
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
