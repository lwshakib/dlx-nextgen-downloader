const fetch = require("node-fetch");
const fs = require('fs');
const { execSync } = require('child_process');

const videoId = "wRu0rGYXDvc";
const video1080p = `video_1080p_final_${videoId}.mp4`;
const video360p = `video_360p_for_audio_${videoId}.mp4`;
const audioExtracted = `temp_audio_${videoId}.m4a`;
const finalOutput = `wRu0rGYXDvc_1080p_WITH_AUDIO.mp4`;

const USER_AGENT = "com.google.android.youtube/21.02.35 (Linux; U; Android 11) gzip";

async function get360pUrl(videoId) {
    const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const html = await fetch(videoUrl, {
        headers: { 'User-Agent': "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36" }
    }).then(res => res.text());
    const apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) || [])[1];

    const data = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "User-Agent": USER_AGENT },
        body: JSON.stringify({
            context: { client: { clientName: "ANDROID", clientVersion: "21.02.35" } },
            videoId
        })
    }).then(res => res.json());

    const format18 = data.streamingData.formats.find(f => f.itag === 18);
    if (!format18) throw new Error("Itag 18 not found.");
    return format18.url;
}

async function main() {
    try {
        console.log(`Step 1: Downloading 360p video (itag 18) for audio track...`);
        const url360 = await get360pUrl(videoId);
        
        const res = await fetch(url360, { headers: { 'User-Agent': USER_AGENT } });
        if (res.status !== 200) throw new Error(`Fetch 360p failed: ${res.status}`);
        
        const buffer = await res.buffer();
        fs.writeFileSync(video360p, buffer);
        console.log(`Step 2: 360p Downloaded (${(buffer.length/1024/1024).toFixed(2)} MB).`);

        console.log(`Step 3: Extracting Audio Track using FFmpeg...`);
        execSync(`ffmpeg -y -i "${video360p}" -vn -c:a copy "${audioExtracted}"`);

        console.log(`Step 4: Muxing 1080p Video + High Quality Audio...`);
        if (!fs.existsSync(video1080p)) throw new Error("1080p video file missing.");
        
        execSync(`ffmpeg -y -i "${video1080p}" -i "${audioExtracted}" -c copy -map 0:v:0 -map 1:a:0 "${finalOutput}"`);
        
        console.log(`\n✅ [FINAL SUCCESS] COMPLETE! Result: ${finalOutput}`);
        console.log(`Final File Size: ${(fs.statSync(finalOutput).size / 1024 / 1024).toFixed(2)} MB`);

        // Cleanup
        if (fs.existsSync(video360p)) fs.unlinkSync(video360p);
        if (fs.existsSync(audioExtracted)) fs.unlinkSync(audioExtracted);

    } catch (e) {
        console.error(`\nFatal Error: ${e.message}`);
    }
}

main();
