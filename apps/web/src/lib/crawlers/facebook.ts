export interface StreamData {
  url: string;
  bitrate: number;
  height: number;
  streamType: string;
  width: number;
}

export interface Resolution {
  url: string;
  width: number;
  height: number;
  quality: string;
  format: string;
}

export interface VideoData {
  title: string;
  thumbnail: string;
  resolutions: Array<Resolution>;
}

function extractVideoFormat(url: string, mimeType?: string | null): string {
  if (mimeType) {
    const mimeLower = mimeType.toLowerCase();
    if (mimeLower.includes("mp4") || mimeLower.includes("video/mp4")) return "mp4";
    if (mimeLower.includes("webm") || mimeLower.includes("video/webm")) return "webm";
    if (mimeLower.includes("mkv") || mimeLower.includes("video/x-matroska")) return "mkv";
    if (mimeLower.includes("m3u8") || mimeLower.includes("application/vnd.apple.mpegurl")) return "m3u8";
  }

  const urlLower = url.toLowerCase();
  if (urlLower.includes(".mp4") || urlLower.includes("format=mp4")) return "mp4";
  if (urlLower.includes(".webm") || urlLower.includes("format=webm")) return "webm";
  if (urlLower.includes(".mkv") || urlLower.includes("format=mkv")) return "mkv";
  if (urlLower.includes(".m3u8") || urlLower.includes("format=m3u8")) return "m3u8";
  
  return "mp4";
}

function parseRepresentationBlock(repBlock: string): Array<StreamData> {
  const streams: Array<StreamData> = [];
  let fullMatch = repBlock.match(/<Representation[^>]*>[\s\S]*?<\/Representation>/i);
  if (!fullMatch) fullMatch = repBlock.match(/Representation[^>]*>[\s\S]*?<\/Representation/i);
  if (!fullMatch) return streams;

  const repBlockData = fullMatch[0];
  const repTagMatch = repBlockData.match(/Representation\s+([^>]*)>/i);
  if (!repTagMatch) return streams;

  const attrsStr = repTagMatch[1];
  const width = parseInt(attrsStr.match(/width\s*=\s*["']?(\d+)["']?/i)?.[1] || "0", 10);
  const height = parseInt(attrsStr.match(/height\s*=\s*["']?(\d+)["']?/i)?.[1] || "0", 10);
  const bitrate = parseInt(attrsStr.match(/bandwidth\s*=\s*["']?(\d+)["']?/i)?.[1] || "0", 10);
  const encodingTag = attrsStr.match(/FBEncodingTag\s*=\s*["']([^"']+)["']/i)?.[1];
  const mimeType = attrsStr.match(/mimeType\s*=\s*["']([^"']+)["']/i)?.[1];

  let streamType = "combined";
  if (encodingTag) {
    const encLower = encodingTag.toLowerCase();
    if (encLower.includes("video") && !encLower.includes("audio")) streamType = "video";
    else if (encLower.includes("audio") && !encLower.includes("video")) streamType = "audio";
  } else if (mimeType) {
      const mimeLower = mimeType.toLowerCase();
      if (mimeLower.includes("video") && !mimeLower.includes("audio")) streamType = "video";
      else if (mimeLower.includes("audio")) streamType = "audio";
  }

  let url: string | null = null;
  const baseurlPatterns = [/<BaseURL>([\s\S]*?)<\/BaseURL>/i, /BaseURL>([\s\S]*?)<\/BaseURL/i];
  for (const pattern of baseurlPatterns) {
    const match = repBlockData.match(pattern);
    if (match) {
      url = match[1].trim();
      break;
    }
  }

  if (!url) return streams;

  let cleanedUrl = url.replace(/&amp;/g, "&").replace(/\\u00253D/g, "=").replace(/\\\//g, "/");
  try { cleanedUrl = decodeURIComponent(cleanedUrl); } catch { /* ignore */ }
  cleanedUrl = cleanedUrl.replace(/[.,;:!?)]+$/, "").split("</")[0].split("\\u003C")[0].split("<")[0];

  if (cleanedUrl.startsWith("http")) {
    streams.push({ url: cleanedUrl, bitrate, height, streamType, width });
  }

  return streams;
}

function extractDashManifestStreams(content: string): Array<StreamData> {
  const streams: Array<StreamData> = [];
  const unescapedContent = content
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\u00253D/g, "=")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");

  const representationPattern = /<Representation[^>]*>([\s\S]*?)<\/Representation>/gi;
  let match;
  while ((match = representationPattern.exec(unescapedContent)) !== null) {
    streams.push(...parseRepresentationBlock(match[1]));
  }
  return streams;
}

function decodeHtmlEntities(text: string): string {
  return text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">");
}

function cleanTitle(title: string): string {
    return title
        .replace(/[\s·|]*[\d.]+[KMB]?\s*(views?|reactions?|shares?|comments?|likes?)[\s·|]*/gi, "")
        .replace(/\s*[|·]\s*$/, "")
        .replace(/^\s*[|·]\s*/, "")
        .trim();
}

export async function crawlFacebook(url: string): Promise<VideoData> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      "Accept-Language": "en-US,en;q=0.9",
    }
  });

  if (!response.ok) throw new Error(`Failed to fetch Facebook page: ${response.status}`);
  const html = await response.text();

  const title = extractVideoTitle(html);
  const thumbnail = extractThumbnail(html);
  const streams = extractDashManifestStreams(html);

  return formatVideoData(streams, title, thumbnail);
}

function extractVideoTitle(content: string): string {
  const ogTitleMatch = content.match(/<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i);
  if (ogTitleMatch) return cleanTitle(decodeHtmlEntities(ogTitleMatch[1]));
  
  const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) return cleanTitle(decodeHtmlEntities(titleMatch[1].replace(/\s*-\s*Facebook\s*$/i, "")));
  
  return "Facebook Video";
}

function extractThumbnail(content: string): string {
  const ogImageMatch = content.match(/<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i);
  return ogImageMatch ? ogImageMatch[1].trim() : "";
}

function formatVideoData(streamsData: Array<StreamData>, title: string, thumbnail: string): VideoData {
    const qualityMap = new Map<string, Resolution>();
    
    // Filter to combined streams or high quality video
    const candidates = streamsData.filter(s => s.streamType === "combined" || s.streamType === "video");

    candidates.forEach(s => {
        let quality = `${s.height}p`;
        if (s.height >= 2160) quality = "4K";
        else if (s.height >= 1440) quality = "2K";
        else if (s.height >= 1080) quality = "1080p";
        else if (s.height >= 720) quality = "720p";
        else if (s.height >= 480) quality = "480p";
        else if (s.height >= 360) quality = "360p";

        const existing = qualityMap.get(quality);
        if (!existing || s.bitrate > (existing as any).bitrate) {
            qualityMap.set(quality, {
                url: s.url,
                width: s.width || Math.round((s.height * 16) / 9),
                height: s.height,
                quality,
                format: extractVideoFormat(s.url)
            });
            (qualityMap.get(quality) as any).bitrate = s.bitrate;
        }
    });

    return {
        title,
        thumbnail,
        resolutions: Array.from(qualityMap.values()).sort((a, b) => b.height - a.height)
    };
}
