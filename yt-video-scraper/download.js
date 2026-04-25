const https = require('https');
const fs = require('fs');

const videoUrl = 'https://www.youtube.com/watch?v=wRu0rGYXDvc';
const outputFilename = 'video_downloaded.mp4';

const headers = {
  'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
  'Accept-Language': 'en-US,en;q=0.9',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8'
};

console.log(`Fetching page data for: ${videoUrl}...`);

https.get(videoUrl, { headers }, (res) => {
  let html = '';
  res.on('data', chunk => {
    html += chunk;
  });

  res.on('end', () => {
    console.log('Page loaded. Extracting video data...');
    extractAndDownload(html);
  });
}).on('error', (e) => {
  console.error("Error fetching page:", e);
});

function extractAndDownload(content) {
  const playerResMatch = content.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);
  let streamingData = null;

  if (playerResMatch) {
    try {
      const data = JSON.parse(playerResMatch[1]);
      if (data.streamingData) streamingData = data.streamingData;
    } catch(e) { }
  }

  if (!streamingData) {
    console.error('Failed to find streaming data in the requested page.');
    return;
  }

  let bestStream = null;
  if (streamingData.formats && streamingData.formats.length > 0) {
    bestStream = streamingData.formats[0];
  }

  if (!bestStream) {
    console.error('No suitable stream format found.');
    return;
  }

  let downloadUrl = bestStream.url;
  
  if (bestStream.signatureCipher) {
    console.error('This video is protected by a signature cipher. Native extraction cannot download it without decryption logic.');
    return;
  }

  if (!downloadUrl) {
    console.error('Could not find a valid URL.');
    return;
  }

  console.log(`Found direct stream URL (Quality: ${bestStream.qualityLabel}). Starting download...`);

  // Important: YouTube typically requires Referer boundary and often Range
  const downloadHeaders = {
    'User-Agent': headers['User-Agent'],
    'Referer': 'https://www.youtube.com/',
    'Origin': 'https://www.youtube.com'
  };

  const file = fs.createWriteStream(outputFilename);
  const req = https.get(downloadUrl, { headers: downloadHeaders }, (response) => {
    if (response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
      return https.get(response.headers.location, { headers: downloadHeaders }, (redirectResponse) => {
        downloadStream(redirectResponse, file);
      });
    }
    
    downloadStream(response, file);
  });

  req.on('error', (e) => {
    console.error("Error downloading stream:", e);
    fs.unlink(outputFilename, () => {});
  });
}

function downloadStream(response, file) {
  if (response.statusCode !== 200 && response.statusCode !== 206) {
    console.error(`Received status code ${response.statusCode}. Cannot download.`);
    return;
  }
  
  const totalBytes = parseInt(response.headers['content-length'], 10);
  let downloadedBytes = 0;

  response.pipe(file);

  response.on('data', (chunk) => {
    downloadedBytes += chunk.length;
    if (totalBytes) {
      const percentage = ((downloadedBytes / totalBytes) * 100).toFixed(2);
      process.stdout.write(`\rDownloading: ${percentage}% (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB / ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
    } else {
      process.stdout.write(`\rDownloading: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
    }
  });

  file.on('finish', () => {
    file.close();
    console.log(`\nDownload completed! Saved to ${outputFilename}`);
  });
}
