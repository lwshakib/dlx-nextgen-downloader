
const axios = require('axios');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { spawn } = require('child_process');
const inquirer = require('inquirer');
const chalk = require('chalk');

const USER_AGENT_IOS = 'com.google.ios.youtube/21.02.3 (iPhone16,2; U; CPU iOS 18_3_2 like Mac OS X;)';

function getCookiesMap(filePath) {
    if (!fs.existsSync(filePath)) return {};
    try {
        const content = fs.readFileSync(filePath, 'utf8');
        const cookies = {};
        content.split('\n').forEach(line => {
            if (!line || line.startsWith('#')) return;
            const parts = line.split('\t');
            if (parts.length < 7) return;
            cookies[parts[5]] = parts[6].trim();
        });
        return cookies;
    } catch (e) { return {}; }
}

function generateSapiHash(sapisid, origin = 'https://www.youtube.com') {
    const timestamp = Math.floor(Date.now() / 1000);
    const msg = `${timestamp} ${sapisid} ${origin}`;
    const hash = crypto.createHash('sha1').update(msg).digest('hex');
    return `SAPISIDHASH ${timestamp}_${hash}`;
}

function extractVideoId(url) {
    const regex = /(?:v=|\/embed\/|\/watch\?v=|\/shorts\/|\.be\/)([^&?#/]+)/;
    const match = url.match(regex);
    return match ? match[1] : url;
}

async function parseHlsManifest(url, headers) {
    const res = await axios.get(url, { headers });
    const lines = res.data.split('\n');
    const formats = [];
    const seen = new Set();

    for (let i = 0; i < lines.length; i++) {
        const line = lines[i].trim();
        if (line.startsWith('#EXT-X-STREAM-INF')) {
            const info = line;
            let streamUrl = lines[i + 1]?.trim();
            if (!streamUrl || streamUrl.startsWith('#')) continue;
            if (!streamUrl.startsWith('http')) streamUrl = new URL(streamUrl, url).href;

            const resMatch = info.match(/RESOLUTION=(\d+x\d+)/);
            const codecs = info.match(/CODECS="([^"]+)"/)?.[1] || '';
            const bw = info.match(/BANDWIDTH=(\d+)/)?.[1] || '0';
            
            let name = '', height = 0, type = 'video';
            let hasAudio = codecs.includes('mp4a') || codecs.includes('opus');

            if (resMatch) {
                height = parseInt(resMatch[1].split('x')[1]);
                name = `[Video] ${height}p (${resMatch[1]})`;
                type = 'video';
            } else if (hasAudio) {
                name = `[Audio Track] ${Math.round(parseInt(bw)/1000)}kbps`;
                height = -1; type = 'audio';
            } else { continue; }
            
            if (seen.has(name)) continue;
            seen.add(name);
            formats.push({ name, height, url: streamUrl, type, hasAudio });
        } else if (line.toUpperCase().includes('TYPE=AUDIO') && line.includes('URI=')) {
            const uriMatch = line.match(/URI="([^"]+)"/i);
            if (!uriMatch) continue;
            let streamUrl = uriMatch[1];
            if (!streamUrl.startsWith('http')) streamUrl = new URL(streamUrl, url).href;

            const nameMatch = line.match(/NAME="([^"]+)"/i);
            const bw = line.match(/BANDWIDTH=(\d+)/i)?.[1] || '128000';
            const name = `[Dedicated Audio] ${nameMatch ? nameMatch[1] : 'Track'} (${Math.round(parseInt(bw)/1000)}kbps)`;
            if (seen.has(name)) continue;
            seen.add(name);
            formats.push({ name, height: -1, url: streamUrl, type: 'audio', hasAudio: true });
        }
    }
    return formats;
}

async function getInnertubeConfig(url, cookiesStr) {
    const headers = {
        'User-Agent': USER_AGENT_IOS,
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.5',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'Referer': url,
        'Origin': 'https://www.youtube.com'
    };
    if (cookiesStr) headers['Cookie'] = cookiesStr;

    try {
        const response = await axios.get(url, { headers, timeout: 15000 });
        const html = response.data;
        const apiKey = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
        const sts = html.match(/"sts":(\d+)/)?.[1];
        
        if (apiKey) {
            console.log(chalk.gray(`[*] Session Sync Successful (API Key: ${apiKey.substring(0, 8)}...)`));
            return { apiKey, sts: sts ? parseInt(sts) : 19800 };
        }
    } catch (err) {
        if (err.response?.status === 429) {
            console.log(chalk.yellow(`[!] YouTube is rate-limiting automated requests (429).`));
        } else {
            console.log(chalk.yellow(`[!] Session Sync failed: ${err.message}`));
        }
    }

    if (fs.existsSync('page.html')) {
        console.log(chalk.gray(`[*] Reading from page.html fallback...`));
        const pageContent = fs.readFileSync('page.html', 'utf8');
        const apiKey = pageContent.match(/"INNERTUBE_API_KEY":"([^"]+)"/)?.[1];
        const sts = pageContent.match(/"sts":(\d+)/)?.[1];
        if (apiKey) return { apiKey, sts: sts ? parseInt(sts) : 19800 };
    }

    throw new Error('API Key could not be obtained. Please save the YouTube page source as "page.html" and try again.');
}

async function main() {
    const args = process.argv.slice(2);
    let argUrl = args[0];

    if (!argUrl) {
        console.clear();
        console.log(chalk.bold.red('======================================='));
        console.log(chalk.bold.white('    ULTIMATE YOUTUBE MEDIA TOOL    '));
        console.log(chalk.bold.red('======================================='));
        const res = await inquirer.prompt([{ type: 'input', name: 'url', message: 'Paste YouTube URL:', validate: i => i ? true : 'Required' }]);
        argUrl = res.url;
    }

    const videoId = extractVideoId(argUrl);
    const cookiesFile = fs.existsSync('cookies.txt') ? 'cookies.txt' : path.join(__dirname, 'cookies.txt');
    const cookiesMap = fs.existsSync(cookiesFile) ? getCookiesMap(cookiesFile) : {};
    const cookiesStr = Object.entries(cookiesMap).map(([k, v]) => `${k}=${v}`).join('; ');
    const sapiHash = cookiesMap['SAPISID'] ? generateSapiHash(cookiesMap['SAPISID']) : null;

    if (!cookiesStr) {
        console.log(chalk.yellow('[!] No cookies.txt detected. Running in anonymous mode (High-res may fail).'));
    } else {
        console.log(chalk.green('[*] session cookies loaded successfully.'));
    }

    try {
        const { apiKey, sts } = await getInnertubeConfig(argUrl, cookiesStr);
        console.log(chalk.cyan(`\n[*] Authenticating with InnerTube...`));

        const playerHeaders = {
            'Content-Type': 'application/json',
            'User-Agent': USER_AGENT_IOS,
            'X-Goog-AuthUser': '0'
        };
        if (cookiesStr) playerHeaders['Cookie'] = cookiesStr;
        if (sapiHash) playerHeaders['Authorization'] = sapiHash;

        const response = await axios.post(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
            videoId, 
            context: { client: { clientName: 'IOS', clientVersion: '21.02.3', deviceMake: 'Apple', deviceModel: 'iPhone16,2', osName: 'iPhone', osVersion: '18.3.2.22D82', hl: 'en-US', gl: 'US' } },
            playbackContext: { contentPlaybackContext: { signatureTimestamp: sts } }
        }, { headers: playerHeaders });

        const sd = response.data.streamingData;
        if (!sd || !sd.hlsManifestUrl) throw new Error('HLS manifest not found. This video might be restricted.');

        const allFormats = await parseHlsManifest(sd.hlsManifestUrl, playerHeaders);

        const { mode } = await inquirer.prompt([{
            type: 'list', name: 'mode', message: 'Download Mode:',
            choices: [{ name: 'Complete Video (Video + Audio)', value: 'both' }, { name: 'Video Only', value: 'video' }, { name: 'Audio Only', value: 'audio' }]
        }]);

        const extensions = mode === 'audio' ? ['mp3', 'm4a', 'wav', 'flac'] : ['mp4', 'mkv', 'avi'];
        const { ext } = await inquirer.prompt([{ type: 'list', name: 'ext', message: 'File Format:', choices: extensions }]);

        let filtered;
        if (mode === 'audio') {
            filtered = allFormats.filter(f => f.type === 'audio');
            if (filtered.length === 0) filtered = allFormats.filter(f => f.hasAudio);
        } else {
            filtered = allFormats.filter(f => f.type === 'video');
        }

        const { selectedFormat } = await inquirer.prompt([{
            type: 'list', name: 'selectedFormat', message: mode === 'audio' ? 'Select Audio Quality:' : 'Select Video Resolution:',
            choices: filtered.sort((a,b) => b.height - a.height).map(f => ({ name: f.name, value: f }))
        }]);

        // 1080p and higher in HLS are almost always video-only
        const needsMerge = (mode === 'both') && (!selectedFormat.hasAudio || selectedFormat.height >= 1080);
        
        console.log(chalk.gray(`[*] Selected URL: ${selectedFormat.url.substring(0, 100)}...`));

        const title = response.data.videoDetails?.title || 'video';
        const safeTitle = title.replace(/[^a-z0-9]/gi, '_').toLowerCase();
        const dest = path.join(__dirname, `${safeTitle}_${selectedFormat.height > 0 ? selectedFormat.height+'p' : 'audio'}.${ext}`);

        const headerLines = [
            `User-Agent: ${USER_AGENT_IOS}`,
            cookiesStr ? `Cookie: ${cookiesStr}` : null,
            sapiHash ? `Authorization: ${sapiHash}` : null,
            'X-Goog-AuthUser: 0',
            'Origin: https://www.youtube.com',
            `Referer: ${argUrl}`
        ].filter(Boolean);
        const headerStr = headerLines.join('\r\n') + '\r\n';

        let ffmpegArgs = [
            '-analyzeduration', '0',
            '-probesize', '32',
            '-http_persistent', '1',
            '-threads', '0',
            '-reconnect', '1',
            '-reconnect_at_eof', '1',
            '-reconnect_streamed', '1',
            '-reconnect_delay_max', '2'
        ];

        if (needsMerge) {
            const bestAudio = allFormats.find(f => f.type === 'audio') || allFormats.find(f => f.hasAudio);
            if (bestAudio) {
                console.log(chalk.cyan(`[*] Merging separate audio track: ${bestAudio.name}`));
                ffmpegArgs.push(
                    '-thread_queue_size', '4096', '-headers', headerStr, '-i', selectedFormat.url, 
                    '-thread_queue_size', '4096', '-headers', headerStr, '-i', bestAudio.url, 
                    '-c:v', 'copy', 
                    '-c:a', ext === 'mp3' ? 'libmp3lame' : 'aac', 
                    '-map', '0:v:0', 
                    '-map', '1:a:0'
                );
            } else { 
                ffmpegArgs.push('-thread_queue_size', '4096', '-headers', headerStr, '-i', selectedFormat.url, '-c', 'copy'); 
            }
        } else {
            ffmpegArgs.push('-thread_queue_size', '4096', '-headers', headerStr, '-i', selectedFormat.url);
            if (mode === 'video') ffmpegArgs.push('-an', '-c:v', 'copy');
            else if (mode === 'audio') {
                ffmpegArgs.push('-vn');
                if (ext === 'mp3') ffmpegArgs.push('-c:a', 'libmp3lame', '-q:a', '2');
                else if (ext === 'wav') ffmpegArgs.push('-c:a', 'pcm_s16le');
                else ffmpegArgs.push('-c:a', ext === 'm4a' ? 'copy' : 'aac');
            } else { ffmpegArgs.push('-c', 'copy', '-bsf:a', 'aac_adtstoasc'); }
        }

        ffmpegArgs.push('-y', dest);
        console.log(chalk.green(`\n[+] Downloading: "${title}"`));

        const ffmpeg = spawn('ffmpeg', ffmpegArgs);
        let errLog = '';
        ffmpeg.stderr.on('data', d => {
            const out = d.toString(); errLog += out;
            if (out.includes('time=')) process.stdout.write(chalk.gray(`\rProgress: ${out.split('time=')[1].split(' ')[0]}`));
        });
        ffmpeg.on('close', c => {
            if (c === 0) console.log(chalk.bold.green('\n\n[SUCCESS] Media saved successfully!'));
            else { 
                console.error(chalk.bold.red(`\n\n[FAILED] FFmpeg error ${c}`));
                if (errLog.includes('403 Forbidden')) console.log(chalk.red('[!] Auth Error: Session might have expired. Try refreshing page.html.'));
                else console.log(chalk.gray(errLog));
            }
        });
    } catch (e) { console.error(chalk.red(`\n[ERROR] ${e.message}`)); }
}
main();
