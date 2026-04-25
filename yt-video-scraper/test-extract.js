const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'source.html');

try {
  const content = fs.readFileSync(sourcePath, 'utf8');
  
  // Try to find streamingData
  const streamingDataMatch = content.match(/"streamingData":({.+?},"playbackTracking")/);
  if (streamingDataMatch) {
    try {
      const streamingData = JSON.parse(streamingDataMatch[1]);
      const urls = [];
      if (streamingData.formats) {
        streamingData.formats.forEach(f => {
          if (f.url) urls.push({type: 'format', quality: f.qualityLabel, url: f.url});
          // Sometimes it is encrypted in signatureCipher
          if (f.signatureCipher) urls.push({type: 'format (cipher)', cipher: f.signatureCipher});
        });
      }
      if (streamingData.adaptiveFormats) {
        streamingData.adaptiveFormats.forEach(f => {
          if (f.url) urls.push({type: 'adaptive', itag: f.itag, mimeType: f.mimeType, url: f.url});
          if (f.signatureCipher) urls.push({type: 'adaptive (cipher)', mimeType: f.mimeType, cipher: f.signatureCipher});
        });
      }
      console.log('Found URLs:', urls.length);
      console.log('First URL:', urls[0]);
    } catch(e) {
      console.error('Error parsing streamingData match', e.message);
    }
  } else {
    // Another common pattern: ytInitialPlayerResponse
    const playerResMatch = content.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);
    if (playerResMatch) {
      const data = JSON.parse(playerResMatch[1]);
      console.log('Got player response, has streamingData?', !!data.streamingData);
      if (data.streamingData && data.streamingData.formats) {
        console.log('First format URL:', data.streamingData.formats[0].url || data.streamingData.formats[0].signatureCipher);
      }
    } else {
        console.log('Could not find stream URLs');
    }
  }

} catch (error) {
  console.error('Error reading source.html:', error);
}
