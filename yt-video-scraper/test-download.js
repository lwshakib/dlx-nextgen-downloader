const https = require('https');
const fs = require('fs');
const path = require('path');

const sourcePath = path.join(__dirname, 'source.html');
const content = fs.readFileSync(sourcePath, 'utf8');
const playerResMatch = content.match(/ytInitialPlayerResponse\s*=\s*(\{.*?\});/);

if (playerResMatch) {
  const data = JSON.parse(playerResMatch[1]);
  if (data.streamingData && data.streamingData.formats && data.streamingData.formats[0]) {
    const stream = data.streamingData.formats[0];
    const url = stream.url || stream.signatureCipher;
    console.log('Testing URL:', url);
    
    https.get(url, (res) => {
      console.log('HTTP Status Code:', res.statusCode);
      console.log('Headers:', res.headers);
      
      // Consume response data to free up memory
      res.on('data', () => {});
      res.on('end', () => console.log('Request finished.'));
    }).on('error', (e) => {
      console.error(e);
    });
  }
}
