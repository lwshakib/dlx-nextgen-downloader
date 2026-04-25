const fetch = require("node-fetch");
const videoId = "wRu0rGYXDvc";
const USER_AGENT = "com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip";

async function main() {
    try {
        const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
        const html = await fetch(videoUrl).then(res => res.text());
        const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];

        const data = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                context: { client: { clientName: "IOS", clientVersion: "21.02.35" } },
                videoId
            })
        }).then(res => res.json());

        const masterUrl = data.streamingData.hlsManifestUrl;
        console.log(`Master Manifest: ${masterUrl}`);
        
        const manifestContent = await fetch(masterUrl).then(res => res.text());
        console.log("MANIFEST CONTENT (Partial):");
        console.log(manifestContent.substring(0, 1000));
    } catch (e) {
        console.error(e.message);
    }
}

main();
