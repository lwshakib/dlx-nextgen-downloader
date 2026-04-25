export interface TikTokResolution {
  qualityType: string | null;
  qualityLabel: string | null;
  bitrate: number | null;
  codec: string | null;
  width: number | null;
  height: number | null;
  url: string | null;
}

export interface TikTokData {
  title: string | null;
  thumbnail: string | null;
  resolutions: TikTokResolution[];
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

export async function crawlTikTok(url: string): Promise<TikTokData> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      Referer: "https://www.tiktok.com/",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) throw new Error(`Failed to fetch TikTok page: ${response.status}`);
  const html = await response.text();

  const regex = new RegExp(`<script[^>]+id="${SCRIPT_ID}"[^>]*>([\\s\\S]*?)<\\/script>`, "i");
  const match = html.match(regex);
  if (!match) throw new Error("Unable to find TikTok rehydration data.");

  const parsed = JSON.parse(match[1].trim());
  const defaultScope = parsed?.__DEFAULT_SCOPE__;
  const itemStruct = defaultScope?.["webapp.video-detail"]?.itemInfo?.itemStruct;

  if (!itemStruct) throw new Error("Video detail data was not found in the TikTok page.");

  const video = itemStruct.video;
  const bitrateInfo = Array.isArray(video?.bitrateInfo) ? video.bitrateInfo : [];

  return {
    title: itemStruct.desc ?? null,
    thumbnail: video?.cover ?? null,
    resolutions: bitrateInfo
      .map((entry: any) => {
        const height = entry.PlayAddr?.Height ?? null;
        return {
          qualityType: entry.QualityType ?? null,
          qualityLabel: getQualityLabel(height, entry.QualityType ?? null),
          bitrate: entry.Bitrate ?? null,
          codec: entry.CodecType ?? null,
          width: entry.PlayAddr?.Width ?? null,
          height,
          url: entry.PlayAddr?.UrlList?.[0] ?? null,
        };
      })
      .filter((entry: any) => entry.url),
  };
}
