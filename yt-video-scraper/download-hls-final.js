const fetch = require("node-fetch");
const fs = require('fs');

const videoId = "wRu0rGYXDvc";
const outputFilename = `video_1080p_final_${videoId}.mp4`;
const USER_AGENT = "com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip";

class CookieJar {
    constructor() {
        this.cookies = {};
    }
    update(headers) {
        const setCookie = headers.get('set-cookie');
        if (setCookie) {
            const parts = setCookie.split(',');
            parts.forEach(part => {
                const kv = part.split(';')[0].trim();
                const [key, value] = kv.split('=');
                if (key && value) this.cookies[key] = value;
            });
        }
    }
    getHeader() {
        return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; ');
    }
}

async function main() {
    const jar = new CookieJar();
    if (fs.existsSync(outputFilename)) fs.unlinkSync(outputFilename);

    try {
        console.log(`Step 1: Initializing Session (Capturing Cookies)...`);
        const initialResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        jar.update(initialResponse.headers);
        const html = await initialResponse.text();

        const visitorData = (html.match(/"visitorData":"([^"]+)"/) || [])[1];
        const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
        if (!apiKey) throw new Error("API Key not found.");

        console.log(`Step 2: Requesting HLS Master Manifest (IOS Client with Cookie Persistence)...`);
        const playerResponse = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
                "Cookie": jar.getHeader()
            },
            body: JSON.stringify({
                context: { client: { clientName: "IOS", clientVersion: "21.02.35", visitorData } },
                videoId
            })
        });
        jar.update(playerResponse.headers);
        const playerData = await playerResponse.json();

        const masterUrl = (playerData.streamingData && playerData.streamingData.hlsManifestUrl);
        if (!masterUrl) throw new Error("Master manifest not found. Bot detection triggered?");
        
        console.log(`Step 3: Parsing 1080p Playlist...`);
        const masterManifest = await fetch(masterUrl, { headers: { "Cookie": jar.getHeader() } }).then(res => res.text());
        const masterLines = masterManifest.split('\n');
        let variantUrl = null;
        for (let i = 0; i < masterLines.length; i++) {
            if (masterLines[i].includes("RESOLUTION=1920x1080")) {
                variantUrl = masterLines[i+1];
                break;
            }
        }
        if (!variantUrl) {
            // Fallback to highest
            for (let i = masterLines.length - 1; i >= 0; i--) {
                if (masterLines[i].includes("RESOLUTION")) {
                    variantUrl = masterLines[i+1];
                    break;
                }
            }
        }

        console.log(`Step 4: Starting FULL Download (Synchronized segments)...`);
        const variantManifest = await fetch(variantUrl, { headers: { "Cookie": jar.getHeader() } }).then(res => res.text());
        const segments = variantManifest.split('\n').filter(line => line.startsWith('https://'));

        for (let i = 0; i < segments.length; i++) {
            const res = await fetch(segments[i], { 
                headers: { 
                    'User-Agent': USER_AGENT,
                    'Cookie': jar.getHeader(),
                    'Referer': 'https://www.youtube.com/'
                } 
            });
            if (res.status !== 200) {
                console.error(`\nFailed segment ${i}. Status: ${res.status}`);
                continue;
            }
            const buffer = await res.buffer();
            fs.appendFileSync(outputFilename, buffer);
            
            const progress = (((i + 1) / segments.length) * 100).toFixed(2);
            process.stdout.write(`\rProgress: ${progress}% (${i + 1}/${segments.length} segments)`);
        }

        console.log(`\n\n✅ [FINAL SUCCESS] Full 1080p Downloaded!`);
        console.log(`Final Size: ${(fs.statSync(outputFilename).size / 1024 / 1024).toFixed(2)} MB`);

    } catch (e) {
        console.error(`\nFatal Error: ${e.message}`);
    }
}

main();
