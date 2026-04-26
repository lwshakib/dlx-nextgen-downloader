const fetch = require("node-fetch");
const fs = require('fs');

const videoId = "wRu0rGYXDvc";
const outputFilename = `video_1080p_${videoId}.mp4`;
const CHUNK_SIZE = 2 * 1024 * 1024; // 2MB segments to mimic real player buffering
const CHUNK_DELAY = 100; // 100ms delay between chunks

const CLIENT_NAME = "TVHTML5";
const CLIENT_VERSION = "7.20230405.08.01";
const USER_AGENT = "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)";

async function getPlayerData(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const html = await fetch(videoUrl).then(res => res.text());
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  const apiKey = apiKeyMatch ? apiKeyMatch[1] : null;

  const payload = {
    context: {
      client: {
        clientName: CLIENT_NAME,
        clientVersion: CLIENT_VERSION,
        userAgent: USER_AGENT,
        hl: 'en',
        gl: 'US'
      }
    },
    videoId
  };

  const data = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
    body: JSON.stringify(payload)
  }).then(res => res.json());

  return data;
}

async function downloadChunk(url, start, end, filename, totalBytes) {
  const rangeHeader = `bytes=${start}-${end}`;
  const downloadHeaders = {
    'User-Agent': USER_AGENT,
    'Range': rangeHeader,
    'Referer': 'https://www.youtube.com/',
    'Origin': 'https://www.youtube.com',
    'Sec-Fetch-Mode': 'cors',
    'Sec-Fetch-Site': 'cross-site',
    'Accept': '*/*',
    'Accept-Language': 'en-US,en;q=0.9',
  };

  const res = await fetch(url, { headers: downloadHeaders });
  if (res.status !== 200 && res.status !== 206) {
    throw new Error(`\r\nFailed to download chunk ${rangeHeader}. Status: ${res.status}`);
  }

  const chunkBuffer = await res.buffer();
  fs.appendFileSync(filename, chunkBuffer);
  
  const percentage = ((end / totalBytes) * 100).toFixed(2);
  process.stdout.write(`\rDownloading: ${percentage}% (${(end / 1024 / 1024).toFixed(2)} MB / ${(totalBytes / 1024 / 1024).toFixed(2)} MB)`);
}

async function main() {
  if (fs.existsSync(outputFilename)) fs.unlinkSync(outputFilename);
  
  try {
      console.log(`Step 1: Extracting unthrottled 1080p URL with ${CLIENT_NAME}...`);
      const data = await getPlayerData(videoId);
      
      const stream1080p = data.streamingData.adaptiveFormats.find(f => 
        f.qualityLabel && f.qualityLabel.includes('1080p') && f.mimeType && f.mimeType.includes('video/mp4')
      );

      if (stream1080p && stream1080p.url) {
        console.log(`Step 2: Starting stealth download with 2MB chunks and referer headers...`);
        const totalSize = parseInt(stream1080p.contentLength, 10);
        
        for (let start = 0; start < totalSize; start += CHUNK_SIZE + 1) {
            const end = Math.min(start + CHUNK_SIZE, totalSize - 1);
            await downloadChunk(stream1080p.url, start, end, outputFilename, totalSize);
            // Artificial delay to prevent aggressive bot detection
            await new Promise(r => setTimeout(r, CHUNK_DELAY));
        }
        
        console.log(`\n\n✅ Final Success! Full 1080p downloaded to ${outputFilename}`);
      } else {
        console.log(`\r\n❌ No 1080p URL found. Client returned limited itags.`);
      }
  } catch (e) {
      console.error(`\r\nFatal Error: ${e.message}`);
  }
}

main();
