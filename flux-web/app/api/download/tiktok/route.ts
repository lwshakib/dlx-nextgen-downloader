import { NextResponse } from "next/server";
const MAX_REDIRECTS = 5;

const BASE_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
  Accept: "*/*",
  "Accept-Language": "en-US,en;q=0.9",
  Connection: "keep-alive",
  Referer: "https://www.tiktok.com/",
};

/**
 * Build a Cookie header value from individual TikTok tokens.
 */
function buildCookieHeader(msToken?: string, ttChainToken?: string) {
  const parts: string[] = [];
  if (msToken) {
    parts.push(`msToken=${msToken}`);
  }
  if (ttChainToken) {
    parts.push(`tt_chain_token=${ttChainToken}`);
  }
  return parts.join("; ");
}

/**
 * Extract cookies (msToken, tt_chain_token, etc.) from the Set-Cookie headers
 * of the TikTok HTML page, similar to the Node script in `index.js`.
 */
async function fetchHtmlAndCookies(sourceUrl: string) {
  const response = await fetch(sourceUrl, {
    headers: {
      ...BASE_HEADERS,
    },
  });

  if (!response.ok) {
    throw new Error(
      `Failed to fetch TikTok page (${response.status} ${response.statusText})`
    );
  }

  let setCookies: string[] = [];

  // Next.js / undici may expose getSetCookie()
  const anyHeaders = response.headers as unknown as {
    getSetCookie?: () => string[];
  };
  if (typeof anyHeaders.getSetCookie === "function") {
    setCookies = anyHeaders.getSetCookie();
  } else {
    const single = response.headers.get("set-cookie");
    if (single) {
      // In many cases TikTok returns multiple Set-Cookie headers separated by comma.
      // This simple split should work for our cookie names.
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

  console.log("TikTok raw Set-Cookie headers:", setCookies);
  console.log("TikTok parsed cookies:", cookies);
  console.log("TikTok tokens extracted:", { msToken, ttChainToken });

  return {
    msToken,
    ttChainToken,
  };
}

async function fetchWithCookies(
  url: string,
  cookieHeader: string,
  attempt = 1
): Promise<Response> {
  if (attempt > MAX_REDIRECTS) {
    throw new Error("Too many redirects while downloading the video.");
  }

  const parsed = new URL(url);
  const headers = new Headers({
    ...BASE_HEADERS,
    Host: parsed.hostname,
  });

  if (!cookieHeader) {
    throw new Error(
      "TikTok cookie header could not be constructed from TikTok response."
    );
  }

  console.log("Using TikTok Cookie header:", cookieHeader);

  headers.set("Cookie", cookieHeader);

  const response = await fetch(url, {
    headers,
    redirect: "manual",
  });

  if (
    response.status >= 300 &&
    response.status < 400 &&
    response.headers.get("location")
  ) {
    const nextUrl = new URL(response.headers.get("location") as string, url);
    response.body?.cancel();
    return fetchWithCookies(nextUrl.toString(), cookieHeader, attempt + 1);
  }

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "");
    throw new Error(
      `Download failed with status ${response.status}. ${errorBody}`
    );
  }

  return response;
}

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const videoUrl = searchParams.get("resolutionUrl");
    const url = searchParams.get("url");
    const msTokenFromQuery = searchParams.get("msToken");
    const ttChainTokenFromQuery = searchParams.get("ttChainToken");

    if (!videoUrl || !url) {
      return NextResponse.json(
        { error: "resolutionUrl and url parameters are required" },
        { status: 400 }
      );
    }

    // Prefer tokens passed from the crawl API; fall back to fetching from HTML if missing.
    let msToken = msTokenFromQuery || undefined;
    let ttChainToken = ttChainTokenFromQuery || undefined;

    if (!msToken || !ttChainToken) {
      const htmlTokens = await fetchHtmlAndCookies(url);
      msToken = msToken || htmlTokens.msToken;
      ttChainToken = ttChainToken || htmlTokens.ttChainToken;
    }

    const cookieHeader = buildCookieHeader(msToken, ttChainToken);

    // 2. Use those cookies to download the actual video stream URL
    const response = await fetchWithCookies(videoUrl, cookieHeader);

    const contentType = response.headers.get("content-type") || "video/mp4";
    const contentDisposition =
      response.headers.get("content-disposition") ||
      'attachment; filename="tiktok-video.mp4"';

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    return new NextResponse(buffer, {
      status: 200,
      headers: {
        "Content-Type": contentType,
        "Content-Disposition": contentDisposition,
        "Content-Length": buffer.length.toString(),
        "Cache-Control": "no-cache",
      },
    });
  } catch (error) {
    console.error("Error downloading TikTok video:", error);
    const message =
      error instanceof Error ? error.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
