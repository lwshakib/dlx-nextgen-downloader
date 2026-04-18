import axios from "axios";
import { NextResponse } from "next/server";

type CrawlRequestBody = {
  url?: string;
};

const RAPID_API_URL = "https://yt-api.p.rapidapi.com/dl";
const RAPID_API_HOST = "yt-api.p.rapidapi.com";
const DEFAULT_COUNTRY_CODE = "BD";
const RAPID_API_KEY = process.env.RAPID_API_KEY;

// CORS headers helper
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

function extractYouTubeId(input?: string | null) {
  if (!input) return null;
  const trimmed = input.trim();

  // Allow passing raw IDs directly
  if (/^[\w-]{11}$/.test(trimmed)) {
    return trimmed;
  }

  try {
    const url = new URL(trimmed);
    if (url.hostname === "youtu.be") {
      return url.pathname.replace("/", "") || null;
    }

    if (
      url.hostname.includes("youtube.com") ||
      url.hostname.includes("youtube-nocookie.com")
    ) {
      if (url.pathname === "/watch") {
        return url.searchParams.get("v");
      }

      const match = url.pathname.match(/\/shorts\/([\w-]{11})/);
      if (match) {
        return match[1];
      }
    }
  } catch {
    // If parsing fails, fall back to regex check below
  }

  const match = trimmed.match(/([\w-]{11})/);
  return match ? match[1] : null;
}

// Handle OPTIONS request for CORS preflight
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 200,
    headers: getCorsHeaders(),
  });
}

export async function POST(request: Request) {
  try {
    const body = (await request.json()) as CrawlRequestBody;
    const url = body?.url?.trim();

    if (!url) {
      return NextResponse.json(
        { error: "URL is required and must be a non-empty string." },
        {
          status: 400,
          headers: getCorsHeaders(),
        }
      );
    }

    const videoId = extractYouTubeId(url);
    if (!videoId) {
      return NextResponse.json(
        { error: "Unable to determine a valid YouTube video ID from the URL." },
        {
          status: 422,
          headers: getCorsHeaders(),
        }
      );
    }

    const rapidApiKey = RAPID_API_KEY;

    if (!rapidApiKey) {
      return NextResponse.json(
        {
          error: "RapidAPI key is not configured. Please set RAPID_API_KEY.",
        },
        {
          status: 500,
          headers: getCorsHeaders(),
        }
      );
    }

    const response = await axios.request({
      method: "GET",
      url: RAPID_API_URL,
      params: {
        id: videoId,
        cgeo: DEFAULT_COUNTRY_CODE,
      },
      headers: {
        "x-rapidapi-key": rapidApiKey,
        "x-rapidapi-host": RAPID_API_HOST,
      },
    });

    const responseData = response.data ?? {};
    const rawThumbnails = Array.isArray(responseData.thumbnail)
      ? responseData.thumbnail
      : responseData.thumbnail
      ? [responseData.thumbnail]
      : [];
    type ThumbnailCandidate = {
      url: string;
      width?: number | null;
      height?: number | null;
    };
    const candidates: ThumbnailCandidate[] = rawThumbnails
      .map((thumb: unknown) => {
        if (typeof thumb === "string") {
          return { url: thumb, width: null, height: null };
        }
        if (thumb && typeof thumb === "object") {
          const entry = thumb as {
            url?: string;
            width?: number;
            height?: number;
          };
          if (typeof entry.url === "string" && entry.url.length > 0) {
            return {
              url: entry.url,
              width: entry.width ?? null,
              height: entry.height ?? null,
            };
          }
        }
        return null;
      })
      .filter((thumb: ThumbnailCandidate | null): thumb is ThumbnailCandidate =>
        Boolean(thumb?.url)
      );

    const primaryThumbnail = candidates.length
      ? candidates.reduce((best, current) => {
          const bestArea =
            (best.width ?? 0) > 0 && (best.height ?? 0) > 0
              ? (best.width as number) * (best.height as number)
              : 0;
          const currentArea =
            (current.width ?? 0) > 0 && (current.height ?? 0) > 0
              ? (current.width as number) * (current.height as number)
              : 0;
          if (currentArea === bestArea) {
            return best;
          }
          if (currentArea > bestArea) {
            return current;
          }
          return best;
        }).url
      : null;

    const rawAdaptiveFormats = Array.isArray(responseData.adaptiveFormats)
      ? responseData.adaptiveFormats
      : [];

    type Format = {
      url?: string;
      qualityLabel?: string;
      width?: number;
      height?: number;
      mimeType?: string;
      bitrate?: number;
      audioQuality?: string;
      audioSampleRate?: string;
    };

    // Separate video and audio formats
    const videoFormats: Format[] = [];
    const audioFormats: Format[] = [];

    rawAdaptiveFormats.forEach((format: Format | null) => {
      if (!format || !format.url || !format.mimeType) return;

      const mimeType = format.mimeType.toLowerCase();

      if (mimeType.startsWith("video/")) {
        if (format.qualityLabel && format.width && format.height) {
          videoFormats.push(format);
        }
      } else if (mimeType.startsWith("audio/")) {
        audioFormats.push(format);
      }
    });

    // Deduplicate video formats by qualityLabel, prioritizing MP4
    const videoMap = new Map<string, Format>();

    videoFormats.forEach((format) => {
      const qualityKey =
        format.qualityLabel || `${format.width}x${format.height}`;
      const existing = videoMap.get(qualityKey);

      if (!existing) {
        videoMap.set(qualityKey, format);
      } else {
        // Prefer MP4 over other formats for the same quality
        const existingIsMp4 = existing.mimeType?.toLowerCase().includes("mp4");
        const currentIsMp4 = format.mimeType?.toLowerCase().includes("mp4");

        if (currentIsMp4 && !existingIsMp4) {
          videoMap.set(qualityKey, format);
        }
      }
    });

    const resolutions = Array.from(videoMap.values())
      .map((format) => ({
        url: format.url!,
        qualityLabel: format.qualityLabel!,
        width: format.width!,
        height: format.height!,
        mimeType: format.mimeType!,
      }))
      .sort((a, b) => {
        // Sort by resolution (height) descending
        return (b.height || 0) - (a.height || 0);
      });

    // Find best quality audio (highest bitrate)
    let bestAudio: {
      url: string;
      mimeType: string;
      bitrate?: number;
      audioQuality?: string;
      audioSampleRate?: string;
    } | null = null;

    if (audioFormats.length > 0) {
      const bestAudioFormat = audioFormats
        .filter((f): f is Format & { url: string; mimeType: string } =>
          Boolean(f.url && f.mimeType)
        )
        .reduce((best, current) => {
          const bestBitrate = best.bitrate || 0;
          const currentBitrate = current.bitrate || 0;

          if (currentBitrate > bestBitrate) {
            return current;
          }
          // If bitrates are equal, prefer higher sample rate
          if (
            currentBitrate === bestBitrate &&
            current.audioSampleRate &&
            best.audioSampleRate
          ) {
            const currentSampleRate = parseInt(current.audioSampleRate) || 0;
            const bestSampleRate = parseInt(best.audioSampleRate) || 0;
            if (currentSampleRate > bestSampleRate) {
              return current;
            }
          }
          return best;
        });

      if (bestAudioFormat && bestAudioFormat.url && bestAudioFormat.mimeType) {
        bestAudio = {
          url: bestAudioFormat.url,
          mimeType: bestAudioFormat.mimeType,
          bitrate: bestAudioFormat.bitrate,
          audioQuality: bestAudioFormat.audioQuality,
          audioSampleRate: bestAudioFormat.audioSampleRate,
        };
      }
    }

    return NextResponse.json(
      {
        status: "ok",
        videoId,
        title: responseData.title ?? null,
        thumbnail: primaryThumbnail,
        resolutions,
        audio: bestAudio,
      },
      {
        headers: getCorsHeaders(),
      }
    );
  } catch (error) {
    console.error("YouTube crawl error:", error);
    const message =
      axios.isAxiosError(error) && error.response?.data
        ? JSON.stringify(error.response.data)
        : error instanceof Error
        ? error.message
        : "Internal server error.";

    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: getCorsHeaders(),
      }
    );
  }
}
