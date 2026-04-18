export interface YouTubeResolution {
  url: string;
  qualityLabel: string;
  width: number;
  height: number;
  mimeType: string;
  bitrate: number;
}

export interface YouTubeAudio {
  url: string;
  mimeType: string;
  bitrate: number;
  audioQuality?: string;
  audioSampleRate?: string;
}

export interface YouTubeData {
  videoId: string;
  title: string | null;
  thumbnail: string | null;
  resolutions: YouTubeResolution[];
  audio: YouTubeAudio | null;
}

function extractYouTubeId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    if (urlObj.hostname === "youtu.be") return urlObj.pathname.slice(1);
    if (urlObj.hostname.includes("youtube.com")) {
      if (urlObj.pathname === "/watch") return urlObj.searchParams.get("v");
      const shortsMatch = urlObj.pathname.match(/\/shorts\/([\w-]{11})/);
      if (shortsMatch) return shortsMatch[1];
    }
  } catch { /* ignore */ }
  const match = url.match(/([\w-]{11})/);
  return match ? match[1] : null;
}

export async function crawlYouTube(url: string): Promise<YouTubeData> {
  const videoId = extractYouTubeId(url);
  if (!videoId) throw new Error("Invalid YouTube URL.");

  const response = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) throw new Error(`Failed to fetch YouTube page: ${response.status}`);
  const html = await response.text();

  // Extract ytInitialData
  const playerMatch = html.match(/var ytInitialPlayerResponse = ({.*?});<\/script>/);

  if (!playerMatch) throw new Error("Unable to extract YouTube player response.");

  const playerResponse = JSON.parse(playerMatch[1]);
  const streamingData = playerResponse.streamingData;
  const videoDetails = playerResponse.videoDetails;

  if (!streamingData) throw new Error("No streaming data found for this video.");

  const formats = [...(streamingData.formats || []), ...(streamingData.adaptiveFormats || [])];
  
  const videoFormats: YouTubeResolution[] = [];
  const audioFormats: YouTubeAudio[] = [];

  formats.forEach((f: any) => {
    if (!f.url) return;
    const mime = f.mimeType.toLowerCase();
    if (mime.includes("video/")) {
      videoFormats.push({
        url: f.url,
        qualityLabel: f.qualityLabel || `${f.height}p`,
        width: f.width,
        height: f.height,
        mimeType: f.mimeType,
        bitrate: f.bitrate
      });
    } else if (mime.includes("audio/")) {
      audioFormats.push({
        url: f.url,
        mimeType: f.mimeType,
        bitrate: f.bitrate,
        audioQuality: f.audioQuality,
        audioSampleRate: f.audioSampleRate
      });
    }
  });

  // Sort video formats by height
  videoFormats.sort((a, b) => b.height - a.height);
  
  // Best audio
  const bestAudio = audioFormats.sort((a, b) => b.bitrate - a.bitrate)[0] || null;

  // Best thumbnail
  const thumbs = videoDetails?.thumbnail?.thumbnails || [];
  const bestThumb = thumbs.sort((a: any, b: any) => (b.width * b.height) - (a.width * a.height))[0]?.url || null;

  return {
    videoId,
    title: videoDetails?.title || "YouTube Video",
    thumbnail: bestThumb,
    resolutions: videoFormats,
    audio: bestAudio
  };
}
