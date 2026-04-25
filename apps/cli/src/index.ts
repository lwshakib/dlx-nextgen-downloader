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

    const url = answers.url;
    
    // Extract filename from URL
    let filename = path.basename(new URL(url).pathname);
    if (!filename || filename === '/') {
      filename = 'downloaded_file_' + Date.now();
    }

    const outputPath = path.join(process.cwd(), filename);

    console.log(chalk.yellow(`\nStarting download: ${chalk.white(url)}`));
    console.log(chalk.yellow(`Saving to: ${chalk.white(outputPath)}`));

    // Start download
    const response = await axios({
      url,
      method: 'GET',
      responseType: 'stream',
    });

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
