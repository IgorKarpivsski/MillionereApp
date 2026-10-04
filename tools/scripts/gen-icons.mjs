// Generates the app icon, Android adaptive icon and splash from original vector art.
// Run: node tools/scripts/gen-icons.mjs   (needs `sharp`; set SHARP_PATH to use a global copy)
// The art is our own: the "האלוף" trophy drawn as lit dots on a stadium LED board.
// No club, league, competition or TV-show marks.
import { mkdirSync } from 'node:fs';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const sharp = await import('sharp')
  .then((m) => m.default)
  .catch(() => createRequire(import.meta.url)(process.env.SHARP_PATH ?? 'sharp'));

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'apps/mobile/assets/images');
mkdirSync(out, { recursive: true });

const GRASS = '#0B2B22', BOARD = '#06130F', EDGE = '#1F4A3C', LED = '#FFB000', OFF = '#132A20';

// Same dot map as src/design-system/components/Scoreboard.tsx (TROPHY_DOTS).
const LIT = [
  [30, 20], [46, 20], [62, 20], [78, 20], [94, 20], [110, 20],
  [14, 36], [30, 36], [46, 36], [62, 36], [78, 36], [94, 36], [110, 36], [126, 36],
  [14, 52], [46, 52], [62, 52], [78, 52], [94, 52], [126, 52],
  [30, 68], [46, 68], [62, 68], [78, 68], [94, 68], [110, 68],
  [62, 84], [78, 84],
  [62, 100], [78, 100],
  [46, 116], [62, 116], [78, 116], [94, 116],
];
const lit = new Set(LIT.map(([x, y]) => `${x},${y}`));

/** The LED matrix (unlit dots + lit trophy), centered on (cx, cy), `scale` px per unit. */
function trophy(cx, cy, scale, { matrix = true } = {}) {
  const ox = cx - 70 * scale, oy = cy - 68 * scale, r = 6 * scale;
  let off = '', on = '';
  for (let y = 20; y <= 116; y += 16)
    for (let x = 14; x <= 126; x += 16) {
      const px = ox + x * scale, py = oy + y * scale;
      if (lit.has(`${x},${y}`)) on += `<circle cx="${px}" cy="${py}" r="${r}"/>`;
      else if (matrix) off += `<circle cx="${px}" cy="${py}" r="${r}"/>`;
    }
  return `
    <g fill="${OFF}">${off}</g>
    <g fill="${LED}" filter="url(#glow)" opacity="0.55">${on}</g>
    <g fill="${LED}">${on}</g>`;
}

const defs = `<defs>
  <filter id="glow" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="14"/></filter>
  <radialGradient id="flood" cx="50%" cy="0%" r="75%">
    <stop offset="0" stop-color="#FFF0C8" stop-opacity="0.22"/><stop offset="1" stop-color="#FFF0C8" stop-opacity="0"/>
  </radialGradient>
</defs>`;

const stripes = Array.from({ length: 8 }, (_, i) =>
  i % 2 ? `<rect x="${i * 128}" y="0" width="128" height="1024" fill="#FFFFFF" fill-opacity="0.035"/>` : '',
).join('');

const icon = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}
  <rect width="1024" height="1024" fill="${GRASS}"/>${stripes}
  <rect width="1024" height="1024" fill="url(#flood)"/>
  <rect x="152" y="152" width="720" height="720" rx="120" fill="${BOARD}" stroke="${EDGE}" stroke-width="16"/>
  ${trophy(512, 512, 4.1)}
</svg>`;

// Adaptive foreground: keep the art inside the 66% safe zone; background color comes from app.config.
const adaptive = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}
  <rect x="232" y="232" width="560" height="560" rx="96" fill="${BOARD}" stroke="${EDGE}" stroke-width="12"/>
  ${trophy(512, 512, 3.1)}
</svg>`;

const splash = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">${defs}
  ${trophy(512, 512, 5.2, { matrix: false })}
</svg>`;

await sharp(Buffer.from(icon)).png().toFile(resolve(out, 'icon.png'));
await sharp(Buffer.from(adaptive)).png().toFile(resolve(out, 'adaptive-icon.png'));
await sharp(Buffer.from(splash)).png().toFile(resolve(out, 'splash-icon.png'));
console.log('icons written to', out);
