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
  resolutions: Resolution[];
}

/**
 * Extract video format from URL or mimeType
 */
function extractVideoFormat(url: string, mimeType?: string | null): string {
  if (mimeType) {
    const mimeLower = mimeType.toLowerCase();
    if (mimeLower.includes("mp4") || mimeLower.includes("video/mp4")) {
      return "mp4";
    }
    if (mimeLower.includes("webm") || mimeLower.includes("video/webm")) {
      return "webm";
    }
    if (mimeLower.includes("mkv") || mimeLower.includes("video/x-matroska")) {
      return "mkv";
    }
    if (
      mimeLower.includes("m3u8") ||
      mimeLower.includes("application/vnd.apple.mpegurl")
    ) {
      return "m3u8";
    }
  }

  // Extract from URL extension
  const urlLower = url.toLowerCase();
  if (urlLower.includes(".mp4") || urlLower.includes("format=mp4")) {
    return "mp4";
  }
  if (urlLower.includes(".webm") || urlLower.includes("format=webm")) {
    return "webm";
  }
  if (urlLower.includes(".mkv") || urlLower.includes("format=mkv")) {
    return "mkv";
  }
  if (urlLower.includes(".m3u8") || urlLower.includes("format=m3u8")) {
    return "m3u8";
  }
  if (urlLower.includes(".flv") || urlLower.includes("format=flv")) {
    return "flv";
  }

  // Default to mp4 if no format detected
  return "mp4";
}

/**
 * Extract video links from text content using regex patterns (supports multiple formats)
 */
export function extractMp4FromText(text: string): string[] {
  if (!text) return [];

  const links = new Set<string>();

  // Pattern 1: Direct video URLs (http/https) - supports mp4, webm, mkv, m3u8, flv
  const videoExtensions = ["mp4", "webm", "mkv", "m3u8", "flv"];
  const pattern1 = new RegExp(
    `https?:\\/\\/[^\\s"'<>{}]+\\.(${videoExtensions.join(
      "|"
    )})(?:\\?[^\\s"'<>{}]*)?`,
    "gi"
  );
  let matches = text.match(pattern1);
  if (matches) {
    matches.forEach((match) => {
      const cleaned = match.replace(/[.,;:!?)]+$/, "");
      links.add(cleaned);
    });
  }

  // Pattern 2: Video URLs in JSON (may be escaped)
  const hasVideo = videoExtensions.some((ext) =>
    text.toLowerCase().includes(ext)
  );
  if (hasVideo) {
    const jsonPattern = new RegExp(
      `https?:\\\\?\\/\\\\?\\/[^"'<>{}]+\\.(${videoExtensions.join(
        "|"
      )})[^"'<>{}]*`,
      "gi"
    );
    matches = text.match(jsonPattern);
    if (matches) {
      matches.forEach((match) => {
        const cleaned = match.replace(/\\\//g, "/").replace(/\\"/g, '"');
        const trimmed = cleaned.replace(/[.,;:!?)]+$/, "");
        if (trimmed.startsWith("http")) {
          links.add(trimmed);
        }
      });
    }
  }

  return Array.from(links);
}

/**
 * Parse a single Representation block and extract stream info
 */
function parseRepresentationBlock(repBlock: string): StreamData[] {
  const streams: StreamData[] = [];

  // Get the full Representation tag
  let fullMatch = repBlock.match(
    /<Representation[^>]*>[\s\S]*?<\/Representation>/i
  );
  if (!fullMatch) {
    fullMatch = repBlock.match(
      /Representation[^>]*>[\s\S]*?<\/Representation/i
    );
  }

  if (fullMatch) {
    repBlock = fullMatch[0];
  }

  // Extract attributes from Representation tag
  const repTagMatch = repBlock.match(/Representation\s+([^>]*)>/i);
  if (!repTagMatch) {
    return streams;
  }

  const attrsStr = repTagMatch[1];

  // Extract quality info
  let width = 0;
  let height = 0;
  let bitrate = 0;
  let encodingTag: string | null = null;
  let mimeType: string | null = null;

  // Extract width
  const widthMatch = attrsStr.match(/width\s*=\s*["']?(\d+)["']?/i);
  if (widthMatch) {
    width = parseInt(widthMatch[1], 10);
  }

  // Extract height
  const heightMatch = attrsStr.match(/height\s*=\s*["']?(\d+)["']?/i);
  if (heightMatch) {
    height = parseInt(heightMatch[1], 10);
  }

  // Extract bandwidth
  const bandwidthMatch = attrsStr.match(/bandwidth\s*=\s*["']?(\d+)["']?/i);
  if (bandwidthMatch) {
    bitrate = parseInt(bandwidthMatch[1], 10);
  }

  // Extract FBEncodingTag
  const encodingMatch = attrsStr.match(/FBEncodingTag\s*=\s*["']([^"']+)["']/i);
  if (encodingMatch) {
    encodingTag = encodingMatch[1];
  }

  // Extract mimeType
  const mimeMatch = attrsStr.match(/mimeType\s*=\s*["']([^"']+)["']/i);
  if (mimeMatch) {
    mimeType = mimeMatch[1];
  }

  // Determine stream type
  let streamType = "combined";
  if (encodingTag) {
    const encodingLower = encodingTag.toLowerCase();
    if (encodingLower.includes("video") && !encodingLower.includes("audio")) {
      streamType = "video";
    } else if (
      encodingLower.includes("audio") &&
      !encodingLower.includes("video")
    ) {
      streamType = "audio";
    }
  } else if (mimeType) {
    const mimeLower = mimeType.toLowerCase();
    if (mimeLower.includes("video") && !mimeLower.includes("audio")) {
      streamType = "video";
    } else if (mimeLower.includes("audio")) {
      streamType = "audio";
    }
  }

  // Extract BaseURL
  const baseurlPatterns = [
    /<BaseURL>([\s\S]*?)<\/BaseURL>/i,
    /BaseURL>([\s\S]*?)<\/BaseURL/i,
    /BaseURL\s*>([\s\S]*?)\s*<\/BaseURL/i,
  ];

  let url: string | null = null;
  for (const pattern of baseurlPatterns) {
    const baseurlMatch = repBlock.match(pattern);
    if (baseurlMatch) {
      url = baseurlMatch[1].trim();
      break;
    }
  }

  if (!url) {
    return streams;
  }

  // Clean URL
  let cleanedUrl = url
    .replace(/&amp;/g, "&")
    .replace(/\\u00253D/g, "=")
    .replace(/\\\//g, "/");

  try {
    cleanedUrl = decodeURIComponent(cleanedUrl);
  } catch {
    // URL decode failed, use as is
  }

  cleanedUrl = cleanedUrl.replace(/[.,;:!?)]+$/, "");

  // Remove trailing tags
  if (cleanedUrl.includes("</")) {
    cleanedUrl = cleanedUrl.split("</")[0];
  }
  if (cleanedUrl.includes("\\u003C")) {
    cleanedUrl = cleanedUrl.split("\\u003C")[0];
  }
  if (cleanedUrl.includes("<") && !cleanedUrl.startsWith("<")) {
    cleanedUrl = cleanedUrl.split("<")[0];
  }

  // Only add if it's a valid URL with video/audio content
  if (!cleanedUrl) {
    return streams;
  }

  const videoFormats = [".mp4", ".webm", ".mkv", ".m3u8", ".flv"];
  const hasVideoExtension = videoFormats.some((format) =>
    cleanedUrl.toLowerCase().includes(format)
  );
  const hasVideoMimeType =
    mimeType &&
    (mimeType.toLowerCase().includes("video") ||
      mimeType.toLowerCase().includes("audio"));

  if (
    cleanedUrl.startsWith("http") &&
    (hasVideoExtension || hasVideoMimeType)
  ) {
    streams.push({ url: cleanedUrl, bitrate, height, streamType, width });
  }

  return streams;
}

/**
 * Parse DASH XML manifest and extract streams
 */
function parseDashXml(manifestXml: string): StreamData[] {
  const streams: StreamData[] = [];
  const representationPattern =
    /<Representation[^>]*>([\s\S]*?)<\/Representation>/gi;
  let match;

  while ((match = representationPattern.exec(manifestXml)) !== null) {
    streams.push(...parseRepresentationBlock(match[1]));
  }

  return streams;
}

/**
 * Extract video streams from DASH manifest data in HTML
 */
export function extractDashManifestStreams(content: string): StreamData[] {
  const streams: StreamData[] = [];

  // Method 1: Extract from JSON (manifest_xml field)
  try {
    const jsonPattern =
      /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
    let match;

    while ((match = jsonPattern.exec(content)) !== null) {
      try {
        const jsonStr = match[1];
        const data = JSON.parse(jsonStr);

        // Recursively search for manifest_xml and representations
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        function findStreamsInJson(obj: any): void {
          if (typeof obj === "object" && obj !== null) {
            if (Array.isArray(obj)) {
              obj.forEach((item) => findStreamsInJson(item));
            } else {
              // Check for manifest_xml
              if (obj.manifest_xml && typeof obj.manifest_xml === "string") {
                const manifestXml = obj.manifest_xml
                  .replace(/\\u003C/g, "<")
                  .replace(/\\u003E/g, ">")
                  .replace(/\\u00253D/g, "=")
                  .replace(/\\\//g, "/")
                  .replace(/\\n/g, "\n")
                  .replace(/\\"/g, '"')
                  .replace(/&amp;/g, "&");

                streams.push(...parseDashXml(manifestXml));
              }

              // Check for representations array
              if (obj.representations && Array.isArray(obj.representations)) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                obj.representations.forEach((rep: any) => {
                  if (rep && typeof rep === "object") {
                    const url = rep.base_url || "";
                    const width = rep.width || 0;
                    const height = rep.height || 0;
                    const bandwidth = rep.bandwidth || 0;
                    const mimeType = rep.mime_type || "";

                    let streamType = "combined";
                    if (mimeType) {
                      const mimeLower = mimeType.toLowerCase();
                      if (
                        mimeLower.includes("video") &&
                        !mimeLower.includes("audio")
                      ) {
                        streamType = "video";
                      } else if (mimeLower.includes("audio")) {
                        streamType = "audio";
                      }
                    }

                    const videoFormats = [
                      ".mp4",
                      ".webm",
                      ".mkv",
                      ".m3u8",
                      ".flv",
                    ];
                    const hasVideoExtension = videoFormats.some((format) =>
                      url.toLowerCase().includes(format)
                    );
                    const hasVideoMimeType =
                      mimeType &&
                      (mimeType.toLowerCase().includes("video") ||
                        mimeType.toLowerCase().includes("audio"));

                    if (
                      url &&
                      url.startsWith("http") &&
                      (hasVideoExtension || hasVideoMimeType)
                    ) {
                      streams.push({
                        url,
                        bitrate: bandwidth,
                        height,
                        streamType,
                        width,
                      });
                    }
                  }
                });
              }

              // Recursively search
              Object.values(obj).forEach((value) => findStreamsInJson(value));
            }
          }
        }

        findStreamsInJson(data);
      } catch {
        // JSON parse error, skip
      }
    }
  } catch {
    // Error extracting JSON, continue
  }

  // Method 2: Direct search in content (for escaped XML)
  const unescapedContent = content
    .replace(/\\u003C/g, "<")
    .replace(/\\u003E/g, ">")
    .replace(/\\u00253D/g, "=")
    .replace(/\\\//g, "/")
    .replace(/&amp;/g, "&");

  const representationPattern =
    /<Representation[^>]*>([\s\S]*?)<\/Representation>/gi;
  let match;
  while ((match = representationPattern.exec(unescapedContent)) !== null) {
    streams.push(...parseRepresentationBlock(match[1]));
  }

  return streams;
}

/**
 * Extract all MP4 video links from HTML content
 */
export function extractMp4LinksFromContent(content: string): StreamData[] {
  const mp4Links = new Set<string>();
  const streamsWithMetadata: StreamData[] = [];

  // Method 1: Extract DASH manifest streams (with quality metadata)
  const dashStreams = extractDashManifestStreams(content);
  dashStreams.forEach(({ url, bitrate, height, streamType, width }) => {
    streamsWithMetadata.push({ url, bitrate, height, streamType, width });
    mp4Links.add(url);
  });

  // Method 2: Direct regex search for video URLs (multiple formats)
  const videoExtensions = ["mp4", "webm", "mkv", "m3u8", "flv"];
  const patterns = [
    new RegExp(
      `https?:\\/\\/[^\\s"'<>{}]+\\.(${videoExtensions.join(
        "|"
      )})(?:\\?[^\\s"'<>{}]*)?`,
      "gi"
    ),
    new RegExp(
      `https?:\\\\?\\/\\\\?\\/[^"'<>{}]+\\.(${videoExtensions.join(
        "|"
      )})[^"'<>{}]*`,
      "gi"
    ),
  ];

  patterns.forEach((pattern) => {
    const matches = content.match(pattern);
    if (matches) {
      matches.forEach((match) => {
        let cleaned = match.replace(/\\\//g, "/").replace(/\\"/g, '"');
        cleaned = cleaned
          .replace(/&amp;/g, "&")
          .replace(/&lt;/g, "<")
          .replace(/&gt;/g, ">")
          .replace(/\\u00253D/g, "=")
          .replace(/\\u003C/g, "<");

        try {
          cleaned = decodeURIComponent(cleaned);
        } catch {
          // URL decode failed
        }

        cleaned = cleaned.replace(/[.,;:!?)]+$/, "");
        if (cleaned.includes("</")) {
          cleaned = cleaned.split("</")[0];
        }

        // Check if it's a video URL (any supported format)
        const videoExtensions = [".mp4", ".webm", ".mkv", ".m3u8", ".flv"];
        const isVideoUrl = videoExtensions.some(
          (ext) =>
            cleaned.toLowerCase().endsWith(ext) ||
            cleaned.toLowerCase().includes(`${ext}?`)
        );

        if (isVideoUrl && !mp4Links.has(cleaned)) {
          mp4Links.add(cleaned);
          streamsWithMetadata.push({
            url: cleaned,
            bitrate: 0,
            height: 0,
            streamType: "combined",
            width: 0,
          });
        }
      });
    }
  });

  // Method 3: Extract from text content
  const textLinks = extractMp4FromText(content);
  textLinks.forEach((link) => {
    if (!mp4Links.has(link)) {
      mp4Links.add(link);
      streamsWithMetadata.push({
        url: link,
        bitrate: 0,
        height: 0,
        streamType: "combined",
        width: 0,
      });
    }
  });

  // Method 4: Parse JSON data in script tags
  const jsonPattern =
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonPattern.exec(content)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      const jsonStr = JSON.stringify(data);
      const videoExtensions = ["mp4", "webm", "mkv", "m3u8", "flv"];
      const videoPattern = new RegExp(
        `https?:\\/\\/[^\\s"'<>{}]+\\.(${videoExtensions.join(
          "|"
        )})(?:\\?[^\\s"'<>{}]*)?`,
        "gi"
      );
      const videosInJson = jsonStr.match(videoPattern);
      if (videosInJson) {
        videosInJson.forEach((url) => {
          let cleaned = url.replace(/&amp;/g, "&").replace(/\\u00253D/g, "=");
          cleaned = cleaned.replace(/[.,;:!?)]+$/, "");
          if (cleaned.includes("</")) {
            cleaned = cleaned.split("</")[0];
          }
          if (!mp4Links.has(cleaned)) {
            mp4Links.add(cleaned);
            streamsWithMetadata.push({
              url: cleaned,
              bitrate: 0,
              height: 0,
              streamType: "combined",
              width: 0,
            });
          }
        });
      }
    } catch {
      // JSON parse error, try regex on raw text
      const videoExtensions = ["mp4", "webm", "mkv", "m3u8", "flv"];
      const videoPattern = new RegExp(
        `https?:\\/\\/[^\\s"'<>{}]+\\.(${videoExtensions.join(
          "|"
        )})(?:\\?[^\\s"'<>{}]*)?`,
        "gi"
      );
      const videosInText = match[1].match(videoPattern);
      if (videosInText) {
        videosInText.forEach((url) => {
          let cleaned = url.replace(/&amp;/g, "&").replace(/\\u00253D/g, "=");
          cleaned = cleaned.replace(/[.,;:!?)]+$/, "");
          if (cleaned.includes("</")) {
            cleaned = cleaned.split("</")[0];
          }
          if (!mp4Links.has(cleaned)) {
            mp4Links.add(cleaned);
            streamsWithMetadata.push({
              url: cleaned,
              bitrate: 0,
              height: 0,
              streamType: "combined",
              width: 0,
            });
          }
        });
      }
    }
  }

  return streamsWithMetadata;
}

/**
 * Decode HTML entities (both decimal and hexadecimal)
 */
function decodeHtmlEntities(text: string): string {
  // First decode named entities
  let decoded = text
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&nbsp;/g, " ")
    .replace(/&copy;/g, "©")
    .replace(/&reg;/g, "®");

  // Decode hexadecimal entities (&#xHHHH;)
  decoded = decoded.replace(/&#x([0-9a-fA-F]+);/g, (match, hex) => {
    try {
      return String.fromCharCode(parseInt(hex, 16));
    } catch {
      return match;
    }
  });

  // Decode decimal entities (&#DDDD;)
  decoded = decoded.replace(/&#(\d+);/g, (match, dec) => {
    try {
      return String.fromCharCode(parseInt(dec, 10));
    } catch {
      return match;
    }
  });

  return decoded;
}

/**
 * Clean title by removing Facebook metadata (views, reactions, shares, etc.)
 */
function cleanTitle(title: string): string {
  // Remove patterns like "11K views · 250 reactions |" or "| 11K views · 250 reactions"
  // This pattern can appear before or after the actual title
  let cleaned = title;

  // Pattern 1: Remove metadata at the start followed by pipe/separator (e.g., "11K views · 250 reactions | Title")
  // This handles: "11K views · 250 reactions |" or "11K views · 250 reactions | "
  cleaned = cleaned.replace(
    /^[\s]*[\d.]+[KMB]?\s*(views?|reactions?|shares?|comments?|likes?)[\s·]*[\d.]+[KMB]?\s*(views?|reactions?|shares?|comments?|likes?)[\s·|]*/i,
    ""
  );

  // Pattern 2: Remove metadata at the end preceded by pipe/separator (e.g., "Title | 11K views · 250 reactions")
  cleaned = cleaned.replace(
    /[\s|·]*[\d.]+[KMB]?\s*(views?|reactions?|shares?|comments?|likes?)[\s·]*[\d.]+[KMB]?\s*(views?|reactions?|shares?|comments?|likes?)[\s·|]*$/i,
    ""
  );

  // Pattern 3: Remove single metadata items anywhere (e.g., "· 11K views" or "| 250 reactions")
  cleaned = cleaned.replace(
    /[\s·|]*[\d.]+[KMB]?\s*(views?|reactions?|shares?|comments?|likes?)[\s·|]*/gi,
    ""
  );

  // Pattern 4: Split by pipe and take the longest part (usually the actual title)
  // This handles cases like "11K views · 250 reactions | University তে পড়ে..."
  const parts = cleaned
    .split(/\s*[\|·]\s+/)
    .filter((part) => part.trim().length > 0);
  if (parts.length > 1) {
    // Find the part that doesn't match metadata patterns
    const titlePart = parts.find(
      (part) =>
        !part.match(
          /^[\d.]+[KMB]?\s*(views?|reactions?|shares?|comments?|likes?)/i
        )
    );
    if (titlePart) {
      cleaned = titlePart;
    } else {
      // If all parts look like metadata, take the longest one
      cleaned = parts.reduce((a, b) => (a.length > b.length ? a : b), "");
    }
  }

  // Remove common separators and clean up
  cleaned = cleaned
    .replace(/^[\s|·\-–—]+/, "") // Remove leading separators
    .replace(/[\s|·\-–—]+$/, "") // Remove trailing separators
    .replace(/\s*[\|·]\s*$/, "") // Remove trailing pipe or middle dot
    .replace(/^\s*[\|·]\s*/, "") // Remove leading pipe or middle dot
    .trim();

  return cleaned;
}

/**
 * Extract video title from HTML content
 */
export function extractVideoTitle(content: string): string {
  // Method 1: Try og:title first
  const ogTitleMatch = content.match(
    /<meta\s+property=["']og:title["']\s+content=["']([^"']+)["']/i
  );
  if (ogTitleMatch) {
    let title = ogTitleMatch[1].trim();
    // Decode HTML entities
    title = decodeHtmlEntities(title);
    // Clean metadata
    title = cleanTitle(title);
    if (title && title !== "Facebook") {
      return title;
    }
  }

  // Method 2: Try title tag
  const titleMatch = content.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (titleMatch) {
    let title = titleMatch[1].trim();
    // Decode HTML entities
    title = decodeHtmlEntities(title);
    // Remove common Facebook suffixes
    title = title.replace(/\s*-\s*Facebook\s*$/i, "");
    // Clean metadata
    title = cleanTitle(title);
    if (title && title !== "Facebook") {
      return title;
    }
  }

  // Method 3: Try JSON-LD
  const jsonLdPattern =
    /<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let match;
  while ((match = jsonLdPattern.exec(content)) !== null) {
    try {
      const data = JSON.parse(match[1]);
      if (data.name || data.headline || data.title) {
        let title = (data.name || data.headline || data.title).trim();
        title = decodeHtmlEntities(title);
        title = cleanTitle(title);
        if (title && title !== "Facebook") {
          return title;
        }
      }
    } catch {
      // Continue
    }
  }

  // Method 4: Search in JSON data within script tags
  const jsonPattern =
    /<script[^>]*type=["']application\/json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let jsonMatch;
  while ((jsonMatch = jsonPattern.exec(content)) !== null) {
    try {
      const data = JSON.parse(jsonMatch[1]);

      // Recursively search for title fields
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      function findTitle(obj: any, depth = 0): string | null {
        if (depth > 10) return null; // Prevent infinite recursion

        if (typeof obj === "object" && obj !== null) {
          // Check common title fields
          const titleFields = [
            "title",
            "name",
            "headline",
            "video_title",
            "videoTitle",
            "videoName",
            "caption",
            "description",
          ];

          for (const field of titleFields) {
            if (obj[field] && typeof obj[field] === "string") {
              let title = obj[field].trim();
              title = decodeHtmlEntities(title);
              title = cleanTitle(title);
              if (title && title !== "Facebook" && title.length > 0) {
                return title;
              }
            }
          }

          // Recursively search in nested objects and arrays
          if (Array.isArray(obj)) {
            for (const item of obj) {
              const found = findTitle(item, depth + 1);
              if (found) return found;
            }
          } else {
            for (const value of Object.values(obj)) {
              const found = findTitle(value, depth + 1);
              if (found) return found;
            }
          }
        }
        return null;
      }

      const foundTitle = findTitle(data);
      if (foundTitle) {
        return foundTitle;
      }
    } catch {
      // Continue to next script tag
    }
  }

  // Method 5: Try to find title in h1 or h2 tags
  const headingMatch = content.match(/<h[12][^>]*>([\s\S]*?)<\/h[12]>/i);
  if (headingMatch) {
    let title = headingMatch[1]
      .replace(/<[^>]+>/g, "") // Remove HTML tags
      .trim();
    title = decodeHtmlEntities(title);
    title = cleanTitle(title);
    if (title && title.length > 0 && title !== "Facebook") {
      return title;
    }
  }

  // Method 6: Try meta name="title"
  const metaTitleMatch = content.match(
    /<meta\s+name=["']title["']\s+content=["']([^"']+)["']/i
  );
  if (metaTitleMatch) {
    let title = metaTitleMatch[1].trim();
    title = decodeHtmlEntities(title);
    title = cleanTitle(title);
    if (title && title !== "Facebook") {
      return title;
    }
  }

  return "";
}

/**
 * Extract thumbnail URL from HTML content
 */
export function extractThumbnail(content: string): string {
  // Try og:image first
  const ogImageMatch = content.match(
    /<meta\s+property=["']og:image["']\s+content=["']([^"']+)["']/i
  );
  if (ogImageMatch) {
    return ogImageMatch[1].trim();
  }

  // Try twitter:image
  const twitterImageMatch = content.match(
    /<meta\s+name=["']twitter:image["']\s+content=["']([^"']+)["']/i
  );
  if (twitterImageMatch) {
    return twitterImageMatch[1].trim();
  }

  return "";
}

/**
 * Categorize videos by quality and format response
 */
export function formatVideoData(
  streamsData: StreamData[],
  title: string,
  thumbnail: string
): VideoData {
  const resolutions: Resolution[] = [];

  // Filter only combined streams (video + audio together)
  const combinedStreams = streamsData.filter(
    (s) => s.streamType === "combined"
  );

  // Group by quality based on height
  combinedStreams.forEach(({ url, bitrate, height, width }) => {
    let quality = "144p";
    let finalHeight = height;
    let finalWidth = width;

    // Use height from metadata if available
    if (height > 0) {
      if (height >= 2160) {
        quality = "2160p";
        finalHeight = 2160;
      } else if (height >= 1440) {
        quality = "1440p";
        finalHeight = 1440;
      } else if (height >= 1080) {
        quality = "1080p";
        finalHeight = 1080;
      } else if (height >= 720) {
        quality = "720p";
        finalHeight = 720;
      } else if (height >= 480) {
        quality = "480p";
        finalHeight = 480;
      } else if (height >= 360) {
        quality = "360p";
        finalHeight = 360;
      } else if (height >= 240) {
        quality = "240p";
        finalHeight = 240;
      } else {
        quality = "144p";
        finalHeight = 144;
      }
    } else {
      // Fallback: analyze URL
      const urlLower = url.toLowerCase();
      let finalBitrate = bitrate;
      if (finalBitrate === 0) {
        const bitrateMatch = url.match(/bitrate=(\d+)/);
        if (bitrateMatch) {
          finalBitrate = parseInt(bitrateMatch[1], 10);
        }
      }

      // Determine from URL tags
      if (
        urlLower.includes("hd2") ||
        urlLower.includes("hd_2") ||
        urlLower.includes("1080")
      ) {
        quality = "1080p";
        finalHeight = 1080;
        finalWidth = 1920;
      } else if (
        urlLower.includes("hd1") ||
        urlLower.includes("hd_1") ||
        urlLower.includes("720")
      ) {
        quality = "720p";
        finalHeight = 720;
        finalWidth = 1280;
      } else if (urlLower.includes("md") && !urlLower.includes("hd")) {
        quality = "480p";
        finalHeight = 480;
        finalWidth = 854;
      } else if (urlLower.includes("sd")) {
        quality = "360p";
        finalHeight = 360;
        finalWidth = 640;
      } else if (urlLower.includes("qd")) {
        quality = "240p";
        finalHeight = 240;
        finalWidth = 426;
      } else {
        // Map based on bitrate
        if (finalBitrate > 3000000) {
          quality = "1080p";
          finalHeight = 1080;
          finalWidth = 1920;
        } else if (finalBitrate > 1500000) {
          quality = "720p";
          finalHeight = 720;
          finalWidth = 1280;
        } else if (finalBitrate > 500000) {
          quality = "480p";
          finalHeight = 480;
          finalWidth = 854;
        } else if (finalBitrate > 200000) {
          quality = "360p";
          finalHeight = 360;
          finalWidth = 640;
        } else if (finalBitrate > 100000) {
          quality = "240p";
          finalHeight = 240;
          finalWidth = 426;
        } else {
          quality = "144p";
          finalHeight = 144;
          finalWidth = 256;
        }
      }
    }

    // Calculate width if not available
    if (finalWidth === 0 && finalHeight > 0) {
      // Assume 16:9 aspect ratio
      finalWidth = Math.round((finalHeight * 16) / 9);
    }

    // Extract format from URL or default to mp4
    const format = extractVideoFormat(url);

    resolutions.push({
      url,
      width: finalWidth,
      height: finalHeight,
      quality,
      format,
    });
  });

  // Group by quality and keep only the best stream per quality
  const qualityMap = new Map<string, Resolution>();
  resolutions.forEach((res) => {
    const existing = qualityMap.get(res.quality);
    if (!existing || res.height > existing.height) {
      qualityMap.set(res.quality, res);
    }
  });

  // Convert to array and sort by height descending
  const uniqueResolutions = Array.from(qualityMap.values()).sort(
    (a, b) => b.height - a.height
  );

  return {
    title: title || "Facebook Video",
    thumbnail: thumbnail,
    resolutions: uniqueResolutions,
  };
}

