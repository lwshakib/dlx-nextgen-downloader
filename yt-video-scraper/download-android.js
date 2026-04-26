const fetch = require("node-fetch");
const fs = require('fs');

const videoId = "wRu0rGYXDvc";
const outputFilename = `video_downloaded_${videoId}.mp4`;

async function downloadVideo(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  console.log(`Step 1: Fetching API Key for video ${videoId}...`);

  const html = await fetch(videoUrl).then(res => res.text());
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  if (!apiKeyMatch) throw new Error("INNERTUBE_API_KEY not found.");
  const apiKey = apiKeyMatch[1];

  console.log(`Step 2: Fetching player response impersonating ANDROID client...`);
  const playerData = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38"
        }
      },
      videoId
    })
  }).then(res => res.json());

  if (playerData.playabilityStatus && playerData.playabilityStatus.status === 'ERROR') {
      throw new Error(`Video unplayable: ${playerData.playabilityStatus.reason}`);
  }

  const streamingData = playerData.streamingData;
  if (!streamingData) {
      console.error(JSON.stringify(playerData, null, 2));
      throw new Error("No streamingData found in the Android response. YouTube might be blocking this specific client version.");
  }

  console.log(`Step 3: Extracting best stream URL...`);
  let bestStream = null;

  // Prefer formats which combine audio and video
  if (streamingData.formats && streamingData.formats.length > 0) {
    bestStream = streamingData.formats[0]; 
  } else if (streamingData.adaptiveFormats && streamingData.adaptiveFormats.length > 0) {
    bestStream = streamingData.adaptiveFormats.find(f => f.mimeType && f.mimeType.includes('video/mp4'));
    if (!bestStream) bestStream = streamingData.adaptiveFormats[0];
  }

  if (!bestStream) {
    throw new Error('No suitable stream format found.');
  }

  if (bestStream.signatureCipher) {
    throw new Error('This video is protected by a signature cipher. Native extraction cannot download it without decryption logic (n parameter).');
  }

  const downloadUrl = bestStream.url;
  if (!downloadUrl) {
    throw new Error('Could not find a valid stream URL.');
  }

  console.log(`Found direct stream! Quality: ${bestStream.qualityLabel}. Starting download...`);

  // Step 4: Download the file with proper headers bypassing 403
  const downloadHeaders = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.youtube.com/',
    'Origin': 'https://www.youtube.com'
  };

  const response = await fetch(downloadUrl, { headers: downloadHeaders });

  if (!response.ok) {
     throw new Error(`Failed to download stream URL. Status: ${response.status} ${response.statusText}`);
  }

  const totalBytes = parseInt(response.headers.get('content-length') || '0', 10);
  let downloadedBytes = 0;

  const fileStream = fs.createWriteStream(outputFilename);
  
  return new Promise((resolve, reject) => {
      response.body.on('data', (chunk) => {
          downloadedBytes += chunk.length;
          if (totalBytes) {
              const percentage = ((downloadedBytes / totalBytes) * 100).toFixed(2);
              process.stdout.write(`\rDownloading: ${percentage}% (${(downloadedBytes / 1024 / 1024).toFixed(2)} MB / ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
          } else {
              process.stdout.write(`\rDownloading: ${(downloadedBytes / 1024 / 1024).toFixed(2)} MB`);
          }
      });

      response.body.pipe(fileStream);

      response.body.on('error', (err) => {
          reject(err);
      });

      fileStream.on('finish', () => {
          console.log(`\n✅ Download completed successfully! Saved to ${outputFilename}`);
          resolve();
      });
  });
}

downloadVideo(videoId).catch(err => {
    console.error(`\n❌ Error:`, err.message);
});
