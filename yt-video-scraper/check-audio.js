const fetch = require("node-fetch");
const fs = require('fs');

const videoId = "wRu0rGYXDvc";
const USER_AGENT = "com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip";

async function main() {
    try {
        const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        const html = await response.text();
        const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];

        const playerResponse = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
            },
            body: JSON.stringify({
                context: { client: { clientName: "ANDROID", clientVersion: "21.02.35" } },
                videoId
            })
        }).then(res => res.json());

        const audioFormats = playerResponse.streamingData.adaptiveFormats.filter(f => f.mimeType.includes("audio"));
        console.log("BEST AUDIO FORMATS:");
        audioFormats.forEach(f => {
            console.log(`Itag: ${f.itag} | Bitrate: ${f.bitrate} | Mime: ${f.mimeType} | Size: ${f.contentLength}`);
        });

    } catch (e) {
        console.error(e.message);
    }
}

main();
