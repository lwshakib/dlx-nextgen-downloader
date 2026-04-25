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

  console.log("--- STREAMING DATA ---");
  console.log(JSON.stringify(playerData.streamingData, null, 2));
}

getUrls(videoId);
