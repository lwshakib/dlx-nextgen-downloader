const fetch = require("node-fetch");

const videoId = "wRu0rGYXDvc";

async function checkHls(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const html = await fetch(videoUrl).then(res => res.text());
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  const apiKey = apiKeyMatch[1];

  const CLIENTS = ["ANDROID", "IOS", "TVHTML5", "WEB_EMBEDDED"];
  
  for (const clientName of CLIENTS) {
    console.log(`Checking HLS for client: ${clientName}...`);
    const data = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        context: { client: { clientName, clientVersion: "21.02.35" } },
        videoId
      })
    }).then(res => res.json());

    if (data.streamingData && data.streamingData.hlsManifestUrl) {
      console.log(`✅ FOUND HLS for ${clientName}: ${data.streamingData.hlsManifestUrl}`);
    } else {
      console.log(`❌ No HLS for ${clientName}. Status: ${data.playabilityStatus?.status}`);
    }
  }
}

checkHls(videoId);
