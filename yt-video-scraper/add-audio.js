const fetch = require("node-fetch");
const fs = require('fs');
const { execSync } = require('child_process');

const videoId = "wRu0rGYXDvc";
const videoInput = `video_1080p_final_${videoId}.mp4`;
const audioInput = `audio_${videoId}.m4a`;
const finalOutput = `final_${videoId}_1080p_full.mp4`;

const CHUNK_SIZE = 5 * 1024 * 1024;
const USER_AGENT = "com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip";

class CookieJar {
    constructor() { this.cookies = {}; }
    update(headers) {
        const setCookie = headers.get('set-cookie');
        if (setCookie) {
            setCookie.split(',').forEach(part => {
                const kv = part.split(';')[0].trim();
                const [key, value] = kv.split('=');
                if (key && value) this.cookies[key] = value;
            });
        }
    }
    getHeader() { return Object.entries(this.cookies).map(([k, v]) => `${k}=${v}`).join('; '); }
}

async function main() {
    const jar = new CookieJar();
    if (fs.existsSync(audioInput)) fs.unlinkSync(audioInput);

    try {
        console.log(`Step 1: Initializing Session...`);
        const initialResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        jar.update(initialResponse.headers);
        const html = await initialResponse.text();
        const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
        const visitorData = (html.match(/"visitorData":"([^"]+)"/) || [])[1];

        console.log(`Step 2: Syncing Session for Audio URL (Itag 140)...`);
        const playerResponse = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
            method: "POST",
            headers: { 
                "Content-Type": "application/json",
                "User-Agent": USER_AGENT,
                "Cookie": jar.getHeader()
            },
            body: JSON.stringify({
                context: { client: { clientName: "ANDROID", clientVersion: "21.02.35", visitorData } },
                videoId
            })
        });
        jar.update(playerResponse.headers);
        const playerData = await playerResponse.json();

        const audioFormat = playerData.streamingData.adaptiveFormats.find(f => f.itag === 140);
        if (!audioFormat) throw new Error("Audio itag 140 not found.");
        const { url, contentLength: sizeStr } = audioFormat;
        const size = parseInt(sizeStr);

        console.log(`Step 3: Downloading Synchronized Audio (${(size / 1024 / 1024).toFixed(2)} MB)...`);
        for (let start = 0; start < size; start += CHUNK_SIZE + 1) {
            const end = Math.min(start + CHUNK_SIZE, size - 1);
            const res = await fetch(url + `&range=${start}-${end}`, { 
                headers: { 
                    'User-Agent': USER_AGENT,
                    'Cookie': jar.getHeader(),
                    'Referer': 'https://www.youtube.com/'
                } 
            });
            if (res.status !== 200 && res.status !== 206) throw new Error(`Status: ${res.status}`);
            fs.appendFileSync(audioInput, await res.buffer());
            process.stdout.write(`\rProgress: ${((end / size) * 100).toFixed(2)}%`);
        }

        console.log(`\nStep 4: Muxing with FFmpeg...`);
        execSync(`ffmpeg -y -i "${videoInput}" -i "${audioInput}" -c copy -map 0:v:0 -map 1:a:0 "${finalOutput}"`);

        console.log(`\n✅ [SUCCESS] Video + Audio Muxed: ${finalOutput}`);
    } catch (e) { console.error(`\nError: ${e.message}`); }
}

main();
