const fetch = require("node-fetch");

const videoId = "wRu0rGYXDvc";

async function getUrls(videoId) {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const html = await fetch(videoUrl).then(res => res.text());
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  const apiKey = apiKeyMatch[1];

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

  const streamingData = playerData.streamingData;
  if (!streamingData) return console.log("No streaming data");

  console.log("\n--- DIRECT VIDEO URLs (Video+Audio) ---");
  if (streamingData.formats) {
    streamingData.formats.forEach((f, i) => {
      console.log(`\n[Format ${i+1}] Quality: ${f.qualityLabel || f.quality} | Mime: ${f.mimeType}`);
      console.log(`URL: ${f.url}`);
    });
  }

  console.log("\n--- ADAPTIVE STREAM URLs (Audio only or Video only) ---");
  if (streamingData.adaptiveFormats) {
    streamingData.adaptiveFormats.forEach((f, i) => {
      console.log(`\n[Adaptive ${i+1}] Quality: ${f.qualityLabel || f.quality || 'Audio'} | Mime: ${f.mimeType}`);
      console.log(`URL: ${f.url}`);
    });
  }
}

getUrls(videoId);
