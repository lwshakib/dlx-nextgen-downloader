const fetch = require("node-fetch");
const { parseStringPromise } = require("xml2js");

/**
 * Get captions for a given YouTube video and language (default: English).
 * @param {string} videoId - YouTube video ID
 * @param {string} language - Language code, e.g., "en", "hi"
 * @returns {Promise<Array<{ caption: string, startTime: number, endTime: number }>>}
 */
async function getYoutubeTranscript(videoId, language = "en") {
  const videoUrl = `https://www.youtube.com/watch?v=${videoId}`;

  // Step 1
  const html = await fetch(videoUrl).then(res => res.text());
  const apiKeyMatch = html.match(/"INNERTUBE_API_KEY":"([^"]+)"/);
  if (!apiKeyMatch) throw new Error("INNERTUBE_API_KEY not found.");
  const apiKey = apiKeyMatch[1];

  // Step 2
  const playerData = await fetch(`https://www.youtube.com/youtubei/v1/player?key=${apiKey}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      context: {
        client: {
          clientName: "ANDROID",
          clientVersion: "20.10.38"
        }
      },
      videoId
    })
  }).then(res => res.json());

  // Step 3
  const tracks = playerData?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
  if (!tracks) throw new Error("No captions found.");
  const track = tracks.find(t => t.languageCode === language);
  if (!track) throw new Error(`No captions for language: ${language}`);

  const baseUrl = track.baseUrl.replace(/&fmt=\w+$/, "");

  // Step 4
  const xml = await fetch(baseUrl).then(res => res.text());
  const parsed = await parseStringPromise(xml);

  if (!parsed.transcript || !parsed.transcript.text) {
      return [];
  }

  return parsed.transcript.text.map(entry => {
    const start = parseFloat(entry.$.start || 0);
    const dur = parseFloat(entry.$.dur || 0);
    return {
      caption: entry._,
      startTime: start,
      endTime: start + dur
    };
  });
}

// Usage Example
(async () => {
  const videoId = "wRu0rGYXDvc"; // Video used earlier
  const language = "en"; // English

  try {
    const transcript = await getYoutubeTranscript(videoId, language);
    console.log(JSON.stringify(transcript, null, 2));
  } catch (error) {
    console.error("❌ Failed to get transcript:", error.message);
  }
})();
