const { execFileSync } = require('child_process');
const path = require('path');
const fs = require('fs');

const chrome = 'C:\\Program Files\\Google\\Chrome\\Application\\chrome.exe';

// 1. Create the master SVG content
const svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" width="512" height="512">
  <defs>
    <radialGradient id="bgGrad" cx="50%" cy="40%" r="65%">
      <stop offset="0%" stop-color="#E11D74"/>
      <stop offset="45%" stop-color="#881337"/>
      <stop offset="85%" stop-color="#3B1F4A"/>
      <stop offset="100%" stop-color="#200B2B"/>
    </radialGradient>
    <radialGradient id="heartGrad1" cx="40%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#FF6B9D"/>
      <stop offset="100%" stop-color="#D6246E"/>
    </radialGradient>
    <radialGradient id="heartGrad2" cx="30%" cy="30%" r="70%">
      <stop offset="0%" stop-color="#FFD166"/>
      <stop offset="100%" stop-color="#FF9F1C"/>
    </radialGradient>
    <filter id="glow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="6" stdDeviation="12" flood-color="#1A0524" flood-opacity="0.6"/>
    </filter>
    <filter id="softGlow" x="-20%" y="-20%" width="140%" height="140%">
      <feDropShadow dx="0" dy="3" stdDeviation="6" flood-color="#FFB000" flood-opacity="0.5"/>
    </filter>
  </defs>

  <!-- Full Background for Maskable Icon Safe Zone -->
  <rect width="512" height="512" fill="url(#bgGrad)"/>

  <!-- Decorative Mandala / Ring within 80% Safe Zone (radius ~204) -->
  <circle cx="256" cy="256" r="202" fill="none" stroke="#FFB000" stroke-width="4.5" stroke-dasharray="14 10" opacity="0.65"/>
  <circle cx="256" cy="256" r="190" fill="none" stroke="#FF5C9A" stroke-width="2" opacity="0.4"/>

  <!-- Top Accent: Glowing Entwined Hearts (Pure Vector) -->
  <g transform="translate(256, 138) scale(1.15)" filter="url(#glow)">
    <!-- Left Heart (Pink) -->
    <path d="M-22,-8 C-22,-24 -4,-24 0,-10 C4,-24 22,-24 22,-8 C22,12 0,26 0,26 C0,26 -22,12 -22,-8 Z"
          transform="translate(-18, 0) rotate(-14)"
          fill="url(#heartGrad1)" stroke="#FFFFFF" stroke-width="2"/>
    <!-- Right Heart (Golden Amber) -->
    <path d="M-22,-8 C-22,-24 -4,-24 0,-10 C4,-24 22,-24 22,-8 C22,12 0,26 0,26 C0,26 -22,12 -22,-8 Z"
          transform="translate(18, 4) rotate(14)"
          fill="url(#heartGrad2)" stroke="#FFFFFF" stroke-width="2"/>
    <!-- Sparkle Stars -->
    <path d="M-45,-15 Q-45,-7 -37,-7 Q-45,-7 -45,1 Q-45,-7 -53,-7 Q-45,-7 -45,-15 Z" fill="#FFD166"/>
    <path d="M42,-12 Q42,-5 49,-5 Q42,-5 42,2 Q42,-5 35,-5 Q42,-5 42,-12 Z" fill="#FFFFFF"/>
  </g>

  <!-- Central Brand Typography: Jodi in Hindi -->
  <g filter="url(#glow)" text-anchor="middle">
    <!-- Hindi Brand Name: जोड़ी -->
    <text x="256" y="278"
          font-family="'Rozha One', 'Baloo 2', 'Noto Sans Devanagari', 'Mangal', serif, sans-serif"
          font-size="124"
          font-weight="900"
          fill="#FFFFFF"
          letter-spacing="2">जोड़ी</text>

    <!-- English Brand & Sync Tag: JODI SYNC -->
    <text x="256" y="362"
          filter="url(#softGlow)"
          font-family="'Baloo 2', system-ui, -apple-system, sans-serif"
          font-size="48"
          font-weight="900"
          fill="#FFB000"
          letter-spacing="5">JODI SYNC</text>

    <!-- Sub-tagline in Safe Zone: FOR COUPLES -->
    <text x="256" y="408"
          font-family="system-ui, -apple-system, sans-serif"
          font-size="19"
          font-weight="800"
          fill="#FFB5D0"
          letter-spacing="4"
          opacity="0.9">★ COUPLES GAME ★</text>
  </g>
</svg>`;

// Write the master SVG to assets/icon.svg
const svgPath = path.resolve(__dirname, '..', 'assets', 'icon.svg');
fs.writeFileSync(svgPath, svgContent, 'utf8');
console.log('Saved assets/icon.svg');

// Create an HTML wrapper that imports Google Fonts and embeds the SVG exactly
function createHtml(size) {
  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Baloo+2:wght@800&family=Rozha+One&display=swap" rel="stylesheet">
  <style>
    * { box-sizing: border-box; margin: 0; padding: 0; }
    html, body {
      width: ${size}px;
      height: ${size}px;
      overflow: hidden;
      background: #200B2B;
    }
    svg {
      width: ${size}px;
      height: ${size}px;
      display: block;
    }
  </style>
</head>
<body>
  ${svgContent.replace('width="512" height="512"', `width="${size}" height="${size}"`)}
</body>
</html>`;
}

const html512 = path.resolve(__dirname, 'icon_render_512.html');
const html192 = path.resolve(__dirname, 'icon_render_192.html');
fs.writeFileSync(html512, createHtml(512), 'utf8');
fs.writeFileSync(html192, createHtml(192), 'utf8');

const out512 = path.resolve(__dirname, '..', 'assets', 'icon-512.png');
const out192 = path.resolve(__dirname, '..', 'assets', 'icon-192.png');
const temp512 = path.resolve(__dirname, 'temp_512.png');
const temp192 = path.resolve(__dirname, 'temp_192.png');
const userDataDir = path.resolve(__dirname, 'chrome_tmp_profile');

console.log('Rendering 512x512 icon via Chrome headless...');
execFileSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  `--user-data-dir=${userDataDir}`,
  `--screenshot=${temp512}`,
  '--window-size=512,512',
  '--virtual-time-budget=4000',
  '--hide-scrollbars',
  `file://${html512}`
]);

console.log('Rendering 192x192 icon via Chrome headless...');
execFileSync(chrome, [
  '--headless=new',
  '--disable-gpu',
  `--user-data-dir=${userDataDir}`,
  `--screenshot=${temp192}`,
  '--window-size=192,192',
  '--virtual-time-budget=4000',
  '--hide-scrollbars',
  `file://${html192}`
]);

// Copy temp PNGs over to assets
fs.copyFileSync(temp512, out512);
fs.copyFileSync(temp192, out192);

// Clean up temporary files
fs.unlinkSync(html512);
fs.unlinkSync(html192);
fs.unlinkSync(temp512);
fs.unlinkSync(temp192);
try { fs.rmSync(userDataDir, { recursive: true, force: true }); } catch (_) {}

console.log('Icon generation complete:');
console.log(' - assets/icon.svg:', fs.statSync(svgPath).size, 'bytes');
console.log(' - assets/icon-512.png:', fs.statSync(out512).size, 'bytes');
console.log(' - assets/icon-192.png:', fs.statSync(out192).size, 'bytes');
