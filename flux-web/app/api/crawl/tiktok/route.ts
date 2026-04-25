import { NextResponse } from "next/server";

type CrawlRequestBody = {
  url?: string;
};

const SCRIPT_ID = "__UNIVERSAL_DATA_FOR_REHYDRATION__";

// CORS headers helper
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}
function withCustomToken(url?: string | null) {
  // Respect original TikTok token; only ensure string output consistency.
  return url ?? undefined;
}

function getQualityLabel(height?: number | null, qualityType?: string | null) {
  if (height && Number.isFinite(height)) {
    return `${height}p`;
  }

  if (qualityType) {
    // Ensure format like "720p" when TikTok already provides it, or fallback raw
    const match = qualityType.match(/\d{3,4}/);
    if (match) {
      return `${match[0]}p`;
    }
    return qualityType;
  }

  return null;
}

async function fetchPageSource(url: string): Promise<{
  html: string;
  cookies: Record<string, string>;
  msToken?: string;
  ttChainToken?: string;
}> {
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/118.0.0.0 Safari/537.36",
      Referer: "https://www.tiktok.com/",
      "Accept-Language": "en-US,en;q=0.9",
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch page (${response.status} ${response.statusText})`
    );
  }

  let setCookies: string[] = [];

  const anyHeaders = response.headers as unknown as {
    getSetCookie?: () => string[];
  };
  if (typeof anyHeaders.getSetCookie === "function") {
    setCookies = anyHeaders.getSetCookie();
  } else {
    const single = response.headers.get("set-cookie");
    if (single) {
      setCookies = single.split(/,(?=[^;]+?=)/g);
    }
  }

  const cookies: Record<string, string> = {};
  for (const line of setCookies) {
    const [cookiePart] = line.split(";");
    const [name, ...rest] = cookiePart.split("=");
    const value = rest.join("=");
    if (!name) continue;
    cookies[name.trim()] = value.trim();
  }

  const msToken = cookies.msToken || cookies.mstoken;
  const ttChainToken = cookies.tt_chain_token || cookies.tt_chain_token_v2;

  console.log("Crawl TikTok raw Set-Cookie headers:", setCookies);
  console.log("Crawl TikTok parsed cookies:", cookies);
  console.log("Crawl TikTok tokens extracted:", { msToken, ttChainToken });

  const html = await response.text();

  return { html, cookies, msToken, ttChainToken };
}

function extractJsonFromScript(html: string, scriptId: string): string {
  const escapedId = scriptId.replace(/[-/\\^$*+?.()|[\]{}]/g, "\\$&");
  const regex = new RegExp(
    `<script[^>]+id="${escapedId}"[^>]*>([\\s\\S]*?)<\\/script>`,
    "i"
  );
  const match = html.match(regex);

  if (!match) {
    throw new Error(`Unable to find script tag with id "${scriptId}"`);
  }

  return match[1].trim();
}

function buildResponsePayload(itemStruct: Record<string, unknown>) {
  const video = itemStruct?.video as {
    cover?: string;
    bitrateInfo?: Array<{
      QualityType?: string;
      Bitrate?: number;
      CodecType?: string;
      PlayAddr?: {
        Width?: number;
        Height?: number;
        UrlList?: string[];
      };
    }>;
  };

  const bitrateInfo = Array.isArray(video?.bitrateInfo)
    ? video?.bitrateInfo
    : [];

  return {
    title: (itemStruct as { desc?: string })?.desc ?? null,
    thumbnail: withCustomToken(video?.cover) ?? null,
    resolutions: bitrateInfo
      .map((entry) => {
        const width = entry.PlayAddr?.Width ?? null;
        const height = entry.PlayAddr?.Height ?? null;
        const url = withCustomToken(entry.PlayAddr?.UrlList?.[0]) ?? null;

        return {
          qualityType: entry.QualityType ?? null,
          qualityLabel: getQualityLabel(height, entry.QualityType ?? null),
          bitrate: entry.Bitrate ?? null,
          codec: entry.CodecType ?? null,
          width,
          height,
          url,
        };
      })
      .filter((entry) => entry.url),
  };
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

    console.log("Fetching TikTok page source for:", url);

    const { html, msToken, ttChainToken } = await fetchPageSource(url);
    const rawJson = extractJsonFromScript(html, SCRIPT_ID);
    const parsed = JSON.parse(rawJson) as Record<string, unknown>;

    const defaultScope = (
      parsed as {
        __DEFAULT_SCOPE__?: Record<string, unknown>;
      }
    ).__DEFAULT_SCOPE__;

    const videoDetailScope = (defaultScope?.["webapp.video-detail"] ??
      null) as {
      itemInfo?: { itemStruct?: Record<string, unknown> };
    } | null;

    const itemStruct = videoDetailScope?.itemInfo?.itemStruct;

    if (!itemStruct) {
      return NextResponse.json(
        { error: "Video detail data was not found in the provided HTML." },
        {
          status: 422,
          headers: getCorsHeaders(),
        }
      );
    }

    const summary = buildResponsePayload(itemStruct);

    return NextResponse.json(
      {
        status: "ok",
        url,
        tokens: {
          msToken: msToken ?? null,
          ttChainToken: ttChainToken ?? null,
        },
        ...summary,
      },
      {
        headers: getCorsHeaders(),
      }
    );
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Internal server error.";

    return NextResponse.json(
      { error: message },
      {
        status: 500,
        headers: getCorsHeaders(),
      }
    );
  }
}
