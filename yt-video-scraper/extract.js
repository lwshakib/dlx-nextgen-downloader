const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'source.html');

try {
  const content = fs.readFileSync(sourcePath, 'utf8');
  
  // YouTube typically stores the video stream details in ytInitialPlayerResponse
  const playerResMatch = content.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);
  
  let streamingData = null;

  if (playerResMatch) {
    try {
      const data = JSON.parse(playerResMatch[1]);
      if (data.streamingData) {
        streamingData = data.streamingData;
      }
    } catch(e) {
      console.error('Error parsing ytInitialPlayerResponse:', e.message);
    }
  }

  // Fallback: look for streamingData directly
  if (!streamingData) {
    const streamingDataMatch = content.match(/"streamingData":({.+?},"playbackTracking")/);
    if (streamingDataMatch) {
      try {
        streamingData = JSON.parse(streamingDataMatch[1]);
      } catch(e) {
         // ignore
      }
    }
  }

  if (streamingData) {
    const urls = [];
    
    // Formats usually contain combined audio/video streams (like standard 360p/720p mp4)
    if (streamingData.formats) {
      streamingData.formats.forEach(f => {
        if (f.url) {
          urls.push({ type: 'Format (Video+Audio)', quality: f.qualityLabel, mimeType: f.mimeType, url: f.url });
        } else if (f.signatureCipher) {
          urls.push({ type: 'Format Cipher (Needs Decryption)', quality: f.qualityLabel, cipher: f.signatureCipher });
        }
      });
    }

    // Adaptive formats usually contain separated audio and video streams
    if (streamingData.adaptiveFormats) {
      streamingData.adaptiveFormats.forEach(f => {
        // Here we just grab the best/first URL as an example, but there are many pieces
        if (f.url && f.mimeType && f.mimeType.includes('video/mp4')) {
          urls.push({ type: 'Adaptive (Video Only/Mp4)', quality: f.qualityLabel, mimeType: f.mimeType, url: f.url });
        }
      });
    }

    if (urls.length > 0) {
      console.log('--- Successfully Extracted Media Stream URLs ---');
      urls.forEach((stream, i) => {
        console.log(`\n[Stream ${i + 1}] | Type: ${stream.type} | Quality: ${stream.quality}`);
        if (stream.url) {
          console.log(`URL:\n${stream.url}\n`);
        } else {
           console.log(`Cipher:\n${stream.cipher}\n`);
        }
      });
    } else {
      console.log('Found streaming data but no usable URLs easily matchable.');
    }
  } else {
    console.log('Could not find stream URLs (streamingData) in the file.');
  }

} catch (error) {
  console.error('Error reading source.html:', error);
}
