#!/usr/bin/env node
// Regenerate app icons from the indigo "AL" glyph.
// Reads the 512x512 source from the web admin-lite's public/ folder.

const path = require('path');
const sharp = require('/tmp/node_modules/sharp');

const OUT = path.resolve(__dirname, '..', 'assets');

const glyphSvg = (size, pad = 0) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
  ${pad > 0 ? `<rect width="${size}" height="${size}" fill="#4F46E5"/>` : ''}
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    font-weight="800" font-size="${Math.floor(size * 0.43)}" fill="#ffffff">AL</text>
</svg>`;

const adaptiveSvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    font-weight="800" font-size="360" fill="#ffffff">AL</text>
</svg>`;

const splashSvg = () => `
<svg xmlns="http://www.w3.org/2000/svg" width="432" height="432" viewBox="0 0 432 432">
  <rect width="432" height="432" rx="96" fill="#ffffff" fill-opacity="0"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    font-weight="800" font-size="220" fill="#ffffff">AL</text>
</svg>`;

(async () => {
  // Main app icon: 1024x1024 rounded-rect indigo with AL
  const iconSvg = `
<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <rect width="1024" height="1024" rx="224" fill="#4F46E5"/>
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    font-family="system-ui, -apple-system, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif"
    font-weight="800" font-size="440" fill="#ffffff">AL</text>
</svg>`;
  await sharp(Buffer.from(iconSvg)).png().toFile(path.join(OUT, 'icon.png'));
  // Adaptive icon foreground: AL glyph sized to fit in the 66% safe circle
  await sharp(Buffer.from(adaptiveSvg())).png().toFile(path.join(OUT, 'adaptive-icon.png'));
  // Splash image: small glyph, transparent background (indigo supplied via backgroundColor)
  await sharp(Buffer.from(splashSvg())).png().toFile(path.join(OUT, 'splash-icon.png'));
  // Favicon for web (harmless even though we don't export web)
  await sharp(Buffer.from(iconSvg)).resize(48, 48).png().toFile(path.join(OUT, 'favicon.png'));
  console.log('Icons generated at', OUT);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
