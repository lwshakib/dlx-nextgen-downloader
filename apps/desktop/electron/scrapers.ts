import axios from "axios";
import { Buffer } from "buffer";

function formatBytes(bytes: number, decimals = 2) {
  if (bytes === 0) return "0 Bytes";
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ["Bytes", "KB", "MB", "GB", "TB"];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + " " + sizes[i];
}

const SCRIPT_ID = "__UNIVERSAL_DATA_FOR_REHYDRATION__";

function getQualityLabel(height?: number | null, qualityType?: string | null) {
  if (height && Number.isFinite(height)) {
    return `${height}p`;
  }
  if (qualityType) {
    const match = qualityType.match(/\d{3,4}/);
    if (match) return `${match[0]}p`;
    return qualityType;
  }
  return null;
}

export async function crawlTikTok(url: string) {
  // First fetch to get cookies and tokens
  const res1 = await fetch(url);

  if (!res1.ok) {
    throw new Error(
      `Failed to fetch page first time (${res1.status} ${res1.statusText})`
    );
  }

  let setCookies: string[] = [];
  const anyHeaders = res1.headers as any;
  if (typeof anyHeaders.getSetCookie === "function") {
    setCookies = anyHeaders.getSetCookie();
  } else {
    const single = res1.headers.get("set-cookie");
    if (single) {
      setCookies = single.split(/,(?=[^;]+?=)/g);
    }
  }

  const cookies: Record<string, string> = {};
  for (const line of setCookies) {
    const [cookiePart] = line.split(";");
    if (!cookiePart) continue;
    const [name, ...rest] = cookiePart.split("=");
    if (name) cookies[name.trim()] = rest.join("=").trim();
  }

  const msToken = cookies.msToken || cookies.mstoken;
  const ttChainToken = cookies.tt_chain_token || cookies.tt_chain_token_v2;
  const cookieString = setCookies.map((c) => c.split(";")[0]).join("; ");

  // Second fetch with cookies to get the real HTML
  const res2 = await fetch(url, {
    headers: {
      Cookie: cookieString,
    },
  });

  if (!res2.ok) {
    throw new Error(
      `Failed to fetch page second time (${res2.status} ${res2.statusText})`
    );
  }

  const html = await res2.text();
  const escapedId = SCRIPT_ID.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regex = new RegExp(
    `<script[^>]+id="${escapedId}"[^>]*>([\\s\\S]*?)<\\/script>`,
    "i"
  );
  const match = html.match(regex);

  if (!match) {
    throw new Error(`Unable to find TikTok rehydration data.`);
  }

  const parsed = JSON.parse(match[1]!.trim());
  const defaultScope = parsed.__DEFAULT_SCOPE__;
  const itemStruct =
    defaultScope?.["webapp.video-detail"]?.itemInfo?.itemStruct;

  if (!itemStruct)
    throw new Error("Video detail data was not found in the TikTok page.");

  const video = itemStruct.video;
  const bitrateInfo = Array.isArray(video?.bitrateInfo)
    ? video.bitrateInfo
    : Array.isArray(video?.bitrate_info)
    ? video.bitrate_info
    : [];

  const resolutions = bitrateInfo
    .map((entry: any) => {
      const playAddr = entry.PlayAddr || entry.play_addr || entry.playAddr;
      const height = playAddr?.Height || playAddr?.height || null;
      const width = playAddr?.Width || playAddr?.width || null;
      const bitrate = entry.Bitrate || entry.bitrate || null;
      const codec = entry.CodecType || entry.codec_type || entry.codec || null;
      const dataSize =
        playAddr?.DataSize || playAddr?.data_size || playAddr?.size || null;
      const url =
        playAddr?.UrlList?.[0] ||
        playAddr?.url_list?.[0] ||
        playAddr?.url ||
        null;

      let qualityLabel = null;
      if (entry.GearName || entry.gear_name) {
        const m = (entry.GearName || entry.gear_name).match(/(\d{3,4})/);
        if (m) qualityLabel = `${m[1]}p`;
      }
      if (!qualityLabel)
        qualityLabel = getQualityLabel(
          height,
          entry.QualityType || entry.quality_type || null
        );

      return {
        qualityType: entry.QualityType || entry.quality_type || null,
        qualityLabel,
        bitrate,
        codec,
        width,
        height,
        url,
        sizeFormatted: dataSize
          ? formatBytes(parseInt(dataSize, 10))
          : "Unknown size",
      };
    })
    .filter((entry: any) => entry.url)
    .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

  if (resolutions.length === 0 && video) {
    const primaryUrl = video.downloadAddr || video.playAddr || video.play_addr;
    if (primaryUrl) {
      resolutions.push({
        qualityType: video.videoQuality || "original",
        qualityLabel: video.definition || "Original",
        bitrate: video.bitrate || null,
        codec: video.codecType || null,
        width: video.width || null,
        height: video.height || null,
        url: primaryUrl,
        sizeFormatted: video.size
          ? formatBytes(parseInt(video.size, 10))
          : "Unknown size",
      });
    }
  }

  return {
    id: itemStruct.id ?? null,
    title: itemStruct.desc ?? null,
    thumbnail: video?.cover ?? null,
    tokens: { msToken: msToken ?? null, ttChainToken: ttChainToken ?? null },
    resolutions,
  };
}

class YouTubeCookieJar {
  private cookies: Record<string, string> = {};

  update(setCookie: string[] | null) {
    if (!setCookie) return;
    setCookie.forEach((line) => {
      const part = line.split(";")[0];
      if (part) {
        const [key, ...rest] = part.split("=");
        if (key) this.cookies[key.trim()] = rest.join("=").trim();
      }
    });
  }

  getHeader(): string {
    return Object.entries(this.cookies)
      .map(([k, v]) => `${k}=${v}`)
      .join("; ");
  }
}

export async function crawlYouTube(videoId: string) {
  const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
  const embedUrl = `https://www.youtube.com/embed/${videoId}`;
  const tvUserAgent =
    "Mozilla/5.0 (ChromiumStylePlatform) Cobalt/25.lts.30.1034943-gold (unlike Gecko), Unknown_TV_Unknown_0/Unknown (Unknown, Unknown)";
  const browserUserAgent =
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36";
  const jar = new YouTubeCookieJar();

  let html = "";
  let streamingData: any = null;
  let videoDetails: any = null;
  let lastError = "";

  try {
    const res = await fetch(watchUrl, {
      headers: {
        "User-Agent": tvUserAgent,
        Referer: "https://www.youtube.com/",
      },
    });
    const setCookies = (res.headers as any).getSetCookie
      ? (res.headers as any).getSetCookie()
      : [];
    jar.update(setCookies);
    html = await res.text();

    const playerResMatch = html.match(
      /ytInitialPlayerResponse\s*=\s*(\{.*?\});/
    );
    if (playerResMatch && playerResMatch[1]) {
      const data = JSON.parse(playerResMatch[1]);
      if (data.streamingData) {
        streamingData = data.streamingData;
        videoDetails = data.videoDetails;
      }
    }
  } catch (e) {}

  let apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ||
    html.match(/innertube_api_key":"([^"]+)"/i) ||
    [])[1];

  if (!streamingData && !apiKey) {
    const resEmbed = await fetch(embedUrl, {
      headers: { "User-Agent": browserUserAgent, Referer: "https://www.youtube.com/" },
    });
    const setCookies = (resEmbed.headers as any).getSetCookie
      ? (resEmbed.headers as any).getSetCookie()
      : [];
    jar.update(setCookies);
    html = await resEmbed.text();
    apiKey = (html.match(/"INNERTUBE_API_KEY":"([^"]+)"/) ||
      html.match(/innertube_api_key":"([^"]+)"/i) ||
      [])[1];
  }

  const visitorData =
    (html.match(/"visitorData":"([^"]+)"/) ||
      html.match(/visitor_data":"([^"]+)"/i) ||
      [])[1] || "";

  if (!streamingData && !apiKey) {
    throw new Error(`Could not find YouTube stream data or API key.`);
  }

  if (!streamingData) {
    const clients = [
      {
        name: "ANDROID",
        version: "20.10.38",
        userAgent: "com.google.android.youtube/20.10.38 (Linux; U; Android 11) gzip",
      },
      {
        name: "IOS",
        version: "21.02.35",
        userAgent: "com.google.ios.youtube/21.02.35 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; en_US)",
      },
      {
        name: "WEB_EMBEDDED_PLAYER",
        version: "1.20240101.01.01",
        userAgent: browserUserAgent,
      },
      {
        name: "TVHTML5",
        version: "7.20230405.08.01",
        userAgent: tvUserAgent,
      },
    ];

    for (const client of clients) {
      try {
        const payload = {
          context: {
            client: {
              clientName: client.name,
              clientVersion: client.version,
              userAgent: client.userAgent,
              hl: "en",
              gl: "US",
              visitorData,
            },
          },
          videoId,
        };

        const playerRes = await fetch(
          `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "User-Agent": client.userAgent,
              Cookie: jar.getHeader(),
            },
            body: JSON.stringify(payload),
          }
        );

        const apiData = (await playerRes.json()) as any;
        if (apiData.streamingData) {
          streamingData = apiData.streamingData;
          videoDetails = apiData.videoDetails;
          break;
        }
        if (apiData.playabilityStatus)
          lastError =
            apiData.playabilityStatus.reason || apiData.playabilityStatus.status;
      } catch (e) {
        lastError = e instanceof Error ? e.message : String(e);
      }
    }
  }

  if (streamingData) {
    const title = videoDetails?.title || "YouTube Video";
    const thumbnail = videoDetails?.thumbnail?.thumbnails?.pop()?.url || "";
    const resolutions: any[] = [];

    const allFormats = [
      ...(streamingData.formats || []),
      ...(streamingData.adaptiveFormats || []),
    ];
    allFormats.forEach((f: any) => {
      if (f.url) {
        const isVideo = f.mimeType.includes("video/");
        if (isVideo) {
          resolutions.push({
            url: f.url,
            qualityLabel:
              f.qualityLabel || (f.height ? `${f.height}p` : "Unknown"),
            bitrate: f.bitrate,
            mimeType: f.mimeType,
            sizeFormatted: f.contentLength
              ? formatBytes(parseInt(f.contentLength, 10))
              : "Unknown",
            isAdaptive: !f.mimeType.includes("audio/"),
          });
        }
      }
    });

    return {
      id: videoId,
      title,
      thumbnail,
      resolutions: resolutions.sort((a, b) => b.bitrate - a.bitrate),
      apiKey: apiKey || "",
      visitorData,
      cookies: jar.getHeader(),
    };
  }

  throw new Error(`YouTube failed. Last error: ${lastError}`);
}

export async function getBestYouTubeAudio(
  videoId: string,
  apiKey: string,
  visitorData: string
) {
  const payload = {
    context: {
      client: {
        clientName: "IOS",
        clientVersion: "19.29.1",
        userAgent:
          "com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; en_US)",
        visitorData,
      },
    },
    videoId,
  };

  const res = await fetch(
    `https://www.youtube.com/youtubei/v1/player?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    }
  );

  const data = (await res.json()) as any;
  const audioFormat = data.streamingData?.adaptiveFormats
    ?.filter((f: any) => f.mimeType.includes("audio/"))
    ?.sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0))[0];

  if (!audioFormat?.url) throw new Error("Could not find audio stream.");
  return audioFormat.url;
}

function cleanFbUrl(url: string | null | undefined) {
  if (!url) return "";
  return url
    .replace(/\\\//g, "/")
    .replace(/\\u00253D/g, "=")
    .replace(/\\u0025/g, "%")
    .replace(/&amp;/g, "&");
}

function decodeFbUnicode(str: string | null | undefined) {
  if (!str) return str;
  return str.replace(/\\u([a-fA-F0-9]{4})/g, (match, grp) =>
    String.fromCharCode(parseInt(grp, 16))
  );
}

export async function crawlFacebook(url: string) {
  let targetUrl = url;
  if (url.includes("fb.watch")) {
    try {
      const res = await axios.get(url, { maxRedirects: 5 });
      targetUrl = res.request?.res?.responseUrl || url;
    } catch (e) {}
  }

  const finalIdMatch =
    targetUrl.match(/\/reel\/(\d+)/) ||
    targetUrl.match(/\/videos\/(\d+)/) ||
    targetUrl.match(/fbid=(\d+)/) ||
    targetUrl.match(/v=(\d+)/);

  const response = await fetch(targetUrl, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
    },
  });

  if (!response.ok) {
    throw new Error(`Failed to fetch Facebook page (${response.status})`);
  }

  const content = await response.text();

  let targetVideoId = finalIdMatch ? finalIdMatch[1] : null;
  if (!targetVideoId) {
    const currVidMatch = content.match(/"currentVideoID":"(\d+)"/);
    if (currVidMatch) targetVideoId = currVidMatch[1];
    else {
      const videoIdMatch = content.match(/"video_id":"(\d+)"/);
      if (videoIdMatch) targetVideoId = videoIdMatch[1];
    }
  }

  if (!targetVideoId) {
    throw new Error("Could not extract video ID.");
  }

  const scriptRegex =
    /<script type="application\/json"[^>]*data-sjs>([\s\S]*?)<\/script>/g;
  let match;
  let metadata = {
    title: null as string | null | undefined,
    description: null as string | null | undefined,
    thumbnail_url: null as string | null | undefined,
  };

  let representations: any[] = [];

  while ((match = scriptRegex.exec(content)) !== null) {
    const jsonStr = match[1] || "";
    if (jsonStr.includes(targetVideoId)) {
      const msgMatch = /"message":\{"text":"((?:[^"\\]|\\.)*)"\}/.exec(jsonStr);
      if (msgMatch && !metadata.description)
        metadata.description = decodeFbUnicode(msgMatch[1]);

      const thumbMatch =
        /"preferred_thumbnail":\{"image":\{"uri":"((?:[^"\\]|\\.)*)"/.exec(
          jsonStr
        ) || /"thumbnail":\{"uri":"((?:[^"\\]|\\.)*)"/.exec(jsonStr);
      if (thumbMatch && !metadata.thumbnail_url)
        metadata.thumbnail_url = cleanFbUrl(thumbMatch[1]);

      const titleMatch = /"title":"((?:[^"\\]|\\.)*)"/.exec(jsonStr);
      if (titleMatch && !metadata.title)
        metadata.title = decodeFbUnicode(titleMatch[1]);

      if (jsonStr.includes('"representations":[')) {
        const vidIndex =
          jsonStr.indexOf(`"video_id":"${targetVideoId}"`) !== -1
            ? jsonStr.indexOf(`"video_id":"${targetVideoId}"`)
            : jsonStr.indexOf(`"video_id":${targetVideoId}`);

        if (vidIndex !== -1) {
          const repsLabel = '"representations":[';
          const repsStartIndex = jsonStr.lastIndexOf(repsLabel, vidIndex);
          if (repsStartIndex !== -1) {
            let bracketCount = 1;
            let repsEndIndex = repsStartIndex + repsLabel.length;
            while (bracketCount > 0 && repsEndIndex < jsonStr.length) {
              if (jsonStr[repsEndIndex] === "[") bracketCount++;
              if (jsonStr[repsEndIndex] === "]") bracketCount--;
              repsEndIndex++;
            }
            const repsJson = jsonStr.substring(
              repsStartIndex + '"representations":'.length,
              repsEndIndex
            );
            try {
              const parsedReps = JSON.parse(repsJson);
              representations = parsedReps.map((rep: any) => {
                if (rep.base_url) rep.base_url = cleanFbUrl(rep.base_url);
                if (rep.mime_type)
                  rep.mime_type = rep.mime_type.replace(/\\\//g, "/");
                return rep;
              });
            } catch (e) {}
          }
        }
      }
    }
  }

  const videoReps = representations.filter(
    (r) => r.mime_type && r.mime_type.startsWith("video/")
  );
  const audioReps = representations.filter(
    (r) => r.mime_type && r.mime_type.startsWith("audio/")
  );

  const resolutions: any[] = videoReps
    .map((r) => {
      const height = r.height || 0;
      return {
        url: r.base_url,
        width: r.width || 0,
        height,
        qualityLabel: height ? `${height}p` : "Unknown",
        bitrate: r.bandwidth || 0,
      };
    })
    .sort((a, b) => b.height - a.height);

  let audioUrl = null;
  if (audioReps.length > 0) {
    const bestAudioRep = [...audioReps].sort(
      (a, b) => (b.bandwidth || 0) - (a.bandwidth || 0)
    )[0];
    if (bestAudioRep) audioUrl = bestAudioRep.base_url;
  }

  return {
    id: targetVideoId,
    title:
      metadata.title ||
      metadata.description ||
      `Facebook Video ${targetVideoId}`,
    thumbnail: metadata.thumbnail_url || "",
    resolutions,
    audioUrl,
  };
}
