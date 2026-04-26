const fetch = require("node-fetch");
const fs = require('fs');

const videoId = "wRu0rGYXDvc";
const outputFilename = `video_1080p_hls_${videoId}.mp4`;
const USER_AGENT = "com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip";

async function getMasterManifest(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const html = await fetch(videoUrl).then(res => res.text());
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  const apiKey = apiKeyMatch[1];

  const payload = {
    context: {
      client: {
        clientName: "IOS",
        clientVersion: "21.02.35"
      }
    },
    videoId
  };

  const data = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(res => res.json());

  return data.streamingData.hlsManifestUrl;
}

async function main() {
  if (fs.existsSync(outputFilename)) fs.unlinkSync(outputFilename);

  try {
    const masterUrl = await getMasterManifest(videoId);
    if (!masterUrl) throw new Error("No HLS Master URL found.");
    console.log(`Step 1: Master Manifest FOUND: ${masterUrl.substring(0, 100)}...`);

    const masterContent = await fetch(masterUrl).then(res => res.text());
    
    // Find the 1080p variant
    const lines = masterContent.split('\n');
    let variantUrl = null;
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes("RESOLUTION=1920x1080")) {
            variantUrl = lines[i+1];
            break;
        }
    }

    if (!variantUrl) {
        console.log("1080p variant not found in master. Selecting highest available resolution...");
        let highestRes = 0;
        for (let i = 0; i < lines.length; i++) {
            const match = lines[i].match(/RESOLUTION=\d+x(\d+)/);
            if (match) {
                const resValue = parseInt(match[1]);
                if (resValue > highestRes) {
                    highestRes = resValue;
                    variantUrl = lines[i+1];
                }
            }
        }
    }

    if (!variantUrl) throw new Error("No variants found in HLS manifest.");
    console.log(`Step 2: Selected Variant URL: ${variantUrl.substring(0, 100)}...`);

    const variantContent = await fetch(variantUrl).then(res => res.text());
    // In YouTube HLS variants, segments start with #EXTINF and then the URL
    const segments = [];
    const variantLines = variantContent.split('\n');
    for (let i = 0; i < variantLines.length; i++) {
        if (variantLines[i].startsWith('https://')) {
            segments.push(variantLines[i]);
        }
    }

    if (segments.length === 0) throw new Error("No segments found in variant manifest.");
    console.log(`Step 3: Found ${segments.length} segments. Starting download...`);
    
    const totalSegments = segments.length;
    for (let i = 0; i < totalSegments; i++) {
        const segUrl = segments[i];
        const res = await fetch(segUrl, { headers: { 'User-Agent': USER_AGENT } });
        if (res.status !== 200) {
            console.error(`\nFailed to download segment ${i}. Status: ${res.status}`);
            continue;
        }
        
        const buffer = await res.buffer();
        fs.appendFileSync(outputFilename, buffer);
        
        const percentage = (((i + 1) / totalSegments) * 100).toFixed(2);
        process.stdout.write(`\rProgress: ${percentage}% (${i + 1}/${totalSegments} segments)`);
    }

    console.log(`\n\n✅ [FINAL] HLS Download completed! File: ${outputFilename}`);
    const stats = fs.statSync(outputFilename);
    console.log(`Final File Size: ${(stats.size / 1024 / 1024).toFixed(2)} MB`);

  } catch (e) {
    console.error(`Fatal Error: ${e.message}`);
  }
}

main();
