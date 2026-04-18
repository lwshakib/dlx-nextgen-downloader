import {
  extractMp4LinksFromContent,
  extractThumbnail,
  extractVideoTitle,
  formatVideoData,
} from "@/utilities/facebook-utils";
import axios from "axios";
import { NextResponse } from "next/server";

// CORS headers helper
function getCorsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Max-Age": "86400",
  };
}

// Try to load Puppeteer for browser-rendered pages
// eslint-disable-next-line @typescript-eslint/no-explicit-any
let puppeteer: any = null;
try {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  puppeteer = require("puppeteer");
} catch {
  // Puppeteer not available, will fall back to axios
}

/**
 * Fetch page source (view source) from URL using Puppeteer or axios
 */
async function fetchPageSource(url: string): Promise<string> {
  // Try Puppeteer first for JavaScript-rendered pages (like Facebook)
  if (puppeteer) {
    console.log("Using Puppeteer to fetch fully rendered page source...");
    let browser = null;
    try {
      browser = await puppeteer.launch({
        headless: true,
        args: [
          "--no-sandbox",
          "--disable-setuid-sandbox",
          "--disable-dev-shm-usage",
          "--disable-accelerated-2d-canvas",
          "--no-first-run",
          "--no-zygote",
          "--disable-gpu",
        ],
      });

      const page = await browser.newPage();

      // Set a realistic user agent
      await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
      );

      // Navigate to the page and wait for network to be idle
      console.log("Loading page and waiting for content to render...");
      await page.goto(url, {
        waitUntil: "networkidle2",
        timeout: 60000,
      });

      // Wait a bit more for any lazy-loaded content
      await page.waitForTimeout(3000);

      // Get the page source (view source)
      const content = await page.content();

      await browser.close();
      return content;
    } catch (error) {
      if (browser) {
        await browser.close();
      }
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";
      console.log(`Puppeteer failed: ${errorMessage}`);
      console.log("Falling back to axios...");
      // Fall through to axios
    }
  }

  // Fallback to axios for non-JS pages or if Puppeteer fails
  console.log("Using axios to fetch page source...");
  const response = await axios.get(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept:
        "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8",
      "Accept-Language": "en-US,en;q=0.5",
      "Accept-Encoding": "gzip, deflate, br",
      Connection: "keep-alive",
      "Upgrade-Insecure-Requests": "1",
    },
    timeout: 30000,
    maxRedirects: 5,
  });

  return response.data;
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
    const body = await request.json();
    const { url } = body;

    if (!url || typeof url !== "string") {
      return NextResponse.json(
        { error: "URL is required and must be a string" },
        {
          status: 400,
          headers: getCorsHeaders(),
        }
      );
    }

    console.log("Fetching page source from Facebook URL:", url);

    // Fetch page source (view source)
    const pageSource = await fetchPageSource(url);

    // Extract video streams
    const streamsData = extractMp4LinksFromContent(pageSource);

    if (streamsData.length === 0) {
      return NextResponse.json(
        {
          error: "No video streams found in the page",
        },
        {
          status: 404,
          headers: getCorsHeaders(),
        }
      );
    }

    // Extract title and thumbnail
    const title = extractVideoTitle(pageSource);
    const thumbnail = extractThumbnail(pageSource);

    // Format video data
    const videoData = formatVideoData(streamsData, title, thumbnail);

    return NextResponse.json(videoData, {
      headers: getCorsHeaders(),
    });
  } catch (error) {
    console.error("Error fetching page source:", error);
    const errorMessage =
      error instanceof Error ? error.message : "Internal server error";
    const httpStatus =
      axios.isAxiosError(error) && error.response
        ? `HTTP ${error.response.status}`
        : undefined;

    return NextResponse.json(
      {
        error: errorMessage,
        details: httpStatus,
      },
      {
        status: 500,
        headers: getCorsHeaders(),
      }
    );
  }
}
