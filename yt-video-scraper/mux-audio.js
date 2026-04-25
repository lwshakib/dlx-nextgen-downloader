const fetch = require("node-fetch");
const fs = require('fs');
const { execSync } = require('child_process');

const videoId = "wRu0rGYXDvc";
const videoInput = `video_1080p_final_${videoId}.mp4`;
const audioOutput = `audio_hls_final_${videoId}.m4a`;
const finalOutput = `final_${videoId}_1080p_muxed_ready.mp4`;
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
    if (fs.existsSync(audioOutput)) fs.unlinkSync(audioOutput);

    try {
        console.log(`Step 1: Initializing Session for Audio...`);
        const initialResponse = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
            headers: { 'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
        });
        jar.update(initialResponse.headers);
        const html = await initialResponse.text();
        const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];
        const visitorData = (html.match(/"visitorData":"([^"]+)"/) || [])[1];

        console.log(`Step 2: Fetching Master HLS manifest (IOS client)...`);
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

        const masterUrl = playerData.streamingData.hlsManifestUrl;
        const masterManifest = await fetch(masterUrl, { headers: { "Cookie": jar.getHeader() } }).then(res => res.text());
        
        const audioLines = masterManifest.split('\n').filter(line => line.includes('TYPE=AUDIO') && line.includes('URI='));
        if (audioLines.length === 0) throw new Error("Audio URI not found.");
        
        const audioPlaylistUrl = audioLines[0].match(/URI="([^"]+)"/)[1];
        console.log(`Step 3: Starting Session-Synchronized Audio Download...`);

        const audioPlaylist = await fetch(audioPlaylistUrl, { headers: { "Cookie": jar.getHeader() } }).then(res => res.text());
        const segments = audioPlaylist.split('\n').filter(line => line.startsWith('https://'));

        for (let i = 0; i < segments.length; i++) {
            const res = await fetch(segments[i], { 
                headers: { 
                    'User-Agent': USER_AGENT,
                    'Cookie': jar.getHeader(),
                    'Referer': 'https://www.youtube.com/'
                } 
            });
            if (res.status !== 200) throw new Error(`Status ${res.status} at segment ${i}`);
            fs.appendFileSync(audioOutput, await res.buffer());
            process.stdout.write(`\rAudio Progress: ${(((i+1)/segments.length)*100).toFixed(2)}% (${i+1}/${segments.length})`);
        }

        console.log(`\nStep 4: Muxing with FFmpeg...`);
        if (!fs.existsSync(videoInput)) throw new Error("Video file missing.");
        
        execSync(`ffmpeg -y -i "${videoInput}" -i "${audioOutput}" -c copy -map 0:v:0 -map 1:a:0 "${finalOutput}"`);
        
        console.log(`\n✅ [COMPLETE] Final Muxed Video: ${finalOutput}`);
        console.log(`Final Size: ${(fs.statSync(finalOutput).size / 1024 / 1024).toFixed(2)} MB`);

    } catch (e) {
        console.error(`\nError: ${e.message}`);
    }
}

main();
