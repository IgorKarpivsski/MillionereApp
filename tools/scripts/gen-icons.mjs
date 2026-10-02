// Generates the placeholder app icon and splash from original vector art.
// Run: node tools/scripts/gen-icons.mjs   (needs `sharp`)
// The art is our own: an album sticker with a generic ball and a prize star.
// No club, league, competition or TV-show marks.
import sharp from 'sharp';
import { mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '../..');
const out = resolve(root, 'apps/mobile/assets/images');
mkdirSync(out, { recursive: true });

const NIGHT = '#1B1452', NIGHT_DEEP = '#0F0B33', GOLD = '#FFC93C', GOLD_DEEP = '#C98A00',
  PITCH = '#1FCB7F', CHALK = '#F7F4FF', FLARE = '#FF5D5D';

// Generic ball: white circle, one central pentagon, five short seams.
const ball = (cx, cy, r) => {
  const pent = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `${cx + Math.cos(a) * r * 0.36},${cy + Math.sin(a) * r * 0.36}`;
  }).join(' ');
  const seams = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const x1 = cx + Math.cos(a) * r * 0.36, y1 = cy + Math.sin(a) * r * 0.36;
    const x2 = cx + Math.cos(a) * r * 0.74, y2 = cy + Math.sin(a) * r * 0.74;
    return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${NIGHT_DEEP}" stroke-width="${r * 0.09}" stroke-linecap="round"/>`;
  }).join('');
  // Five outer pentagons, clipped by the ball outline.
  const outer = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const ox = cx + Math.cos(a) * r * 1.02, oy = cy + Math.sin(a) * r * 1.02;
    const pts = Array.from({ length: 5 }, (_, j) => {
      const b = a + Math.PI + (j * 2 * Math.PI) / 5;
      return `${ox + Math.cos(b) * r * 0.3},${oy + Math.sin(b) * r * 0.3}`;
    }).join(' ');
    return `<polygon points="${pts}" fill="${NIGHT_DEEP}"/>`;
  }).join('');
  return `<defs><clipPath id="ballclip"><circle cx="${cx}" cy="${cy}" r="${r}"/></clipPath></defs>
    <circle cx="${cx}" cy="${cy + r * 0.08}" r="${r}" fill="${NIGHT_DEEP}"/>
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="${CHALK}"/>
    <g clip-path="url(#ballclip)">${outer}</g>
    <polygon points="${pent}" fill="${NIGHT_DEEP}"/>${seams}
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${NIGHT_DEEP}" stroke-width="${r * 0.06}"/>`;
};

const star = (cx, cy, r, fill) => {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${cx + Math.cos(a) * rr},${cy + Math.sin(a) * rr}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="${NIGHT_DEEP}" stroke-width="${r * 0.12}" stroke-linejoin="round"/>`;
};

const sticker = (size, withBg) => `
<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">
  ${withBg ? `<rect width="1024" height="1024" fill="${NIGHT}"/>
  <circle cx="512" cy="512" r="380" fill="none" stroke="#30258A" stroke-width="18"/>` : ''}
  <g transform="rotate(-6 512 512)">
    <rect x="212" y="232" width="600" height="600" rx="96" fill="${GOLD_DEEP}"/>
    <rect x="212" y="196" width="600" height="600" rx="96" fill="${CHALK}"/>
    <rect x="244" y="228" width="536" height="536" rx="72" fill="${GOLD}"/>
    <path d="M244 560h536v132a72 72 0 0 1-72 72H316a72 72 0 0 1-72-72z" fill="${PITCH}"/>
    <path d="M244 560h536" stroke="${CHALK}" stroke-width="14"/>
    ${ball(512, 470, 165)}
    ${star(694, 318, 70, FLARE)}
  </g>
</svg>`;

await sharp(Buffer.from(sticker(1024, true))).png().toFile(resolve(out, 'icon.png'));
await sharp(Buffer.from(sticker(1024, false))).png().toFile(resolve(out, 'splash-icon.png'));
await sharp(Buffer.from(sticker(1024, false))).png().toFile(resolve(out, 'adaptive-icon.png'));
console.log('icons written to', out);
