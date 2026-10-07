/**
 * Five alternative pack looks (the owner picks one; see PACK_STYLE in PackArt.tsx).
 * Pure SVG strings, viewBox 0 0 100 145, original art, no text.
 *
 *   retro     cream sticker-wrapper with racing stripes and a big ball emblem
 *   neon      black pack with neon outlines and a synthwave grid
 *   jersey    the pack is a folded football shirt sealed in cellophane
 *   holo      iridescent holographic foil with a star-and-lightning crest
 *   mascot    "האלוף" the lion bursting out of a torn foil pack
 */
import { avatarSvg, type AvatarSpec } from '@fm/shared';

export type PackTier = 'bronze' | 'silver' | 'gold' | 'epic' | 'legendary';
export type PackStyle = 'retro' | 'neon' | 'jersey' | 'holo' | 'mascot';

const INK = '#14110F';
const TIER: Record<PackTier, { c: string; d: string; l: string; n: number }> = {
  bronze: { c: '#D98A4E', d: '#7A3F14', l: '#F6C9A0', n: 1 },
  silver: { c: '#B9C2CC', d: '#5E6B78', l: '#F4F6F8', n: 2 },
  gold: { c: '#FFB000', d: '#8A5A00', l: '#FFF0B8', n: 3 },
  epic: { c: '#9B6BFF', d: '#3B1F86', l: '#E6DCFF', n: 4 },
  legendary: { c: '#FF5A4E', d: '#7E140C', l: '#FFD3C9', n: 5 },
};

const crimps = (y0: number, dir: number, fill: string) =>
  `<path d="${Array.from({ length: 12 }, (_, i) => `M${8 + i * 7} ${y0} L${11.5 + i * 7} ${y0 + dir * 6} L${15 + i * 7} ${y0} Z`).join(' ')}" fill="${fill}"/>`;

function star(cx: number, cy: number, r: number, fill: string, sw = 1): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="${INK}" stroke-width="${sw}" stroke-linejoin="round"/>`;
}

const tierStars = (n: number, y: number, fill = '#FFD34D') =>
  Array.from({ length: n }, (_, i) => star(50 + (i - (n - 1) / 2) * 9, y, 3.6, fill)).join('');

function ball(cx: number, cy: number, r: number, base = '#FFF8EA', panel = INK, outline = INK): string {
  const p = (a: number, rr: number) => `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  const pent = Array.from({ length: 5 }, (_, i) => p(-Math.PI / 2 + (i * 2 * Math.PI) / 5, r * 0.42)).join(' ');
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `M${p(a, r * 0.42)} L${p(a, r * 0.96)}`;
  }).join(' ');
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${base}" stroke="${outline}" stroke-width="2"/><polygon points="${pent}" fill="${panel}"/><path d="${spokes}" stroke="${panel}" stroke-width="1.6"/>`;
}

function retro(t: PackTier, uid: string): string {
  const { c, d, l, n } = TIER[t];
  return `<defs><clipPath id="r${uid}"><path d="M8 10 L92 10 L92 135 L8 135 Z"/></clipPath></defs>` +
    `<path d="M8 10 L92 10 L92 135 L8 135 Z" fill="#FFF3DC" stroke="${INK}" stroke-width="2.5"/>` +
    `<g clip-path="url(#r${uid})">` +
    Array.from({ length: 12 }, (_, i) => `<circle cx="${12 + (i % 4) * 26}" cy="${18 + Math.floor(i / 4) * 44}" r="9" fill="${l}" opacity="0.5"/>`).join('') +
    `<path d="M-10 92 L110 32 L110 52 L-10 112 Z" fill="${c}"/><path d="M-10 100 L110 40 L110 44 L-10 104 Z" fill="${d}"/><path d="M-10 116 L110 56 L110 60 L-10 120 Z" fill="${c}"/>` +
    `</g>` +
    crimps(10, -1, d) + crimps(135, 1, d) +
    `<circle cx="50" cy="62" r="26" fill="${c}" stroke="${INK}" stroke-width="2.5"/><circle cx="50" cy="62" r="20" fill="#FFF3DC" stroke="${INK}" stroke-width="1.5"/>` +
    ball(50, 62, 15) + tierStars(n, 122);
}

function neon(t: PackTier, uid: string): string {
  const { c, l, n } = TIER[t];
  const glow = (d: string, w: number) => `<path d="${d}" fill="none" stroke="${c}" stroke-width="${w + 5}" opacity="0.25"/><path d="${d}" fill="none" stroke="${l}" stroke-width="${w}"/>`;
  const grid = Array.from({ length: 6 }, (_, i) => `M8 ${100 + i * 6} L92 ${100 + i * 6}`).join(' ') +
    ' ' + Array.from({ length: 9 }, (_, i) => `M${50 + (i - 4) * 4} 100 L${50 + (i - 4) * 14} 135`).join(' ');
  return `<defs><clipPath id="n${uid}"><path d="M8 10 L92 10 L92 135 L8 135 Z"/></clipPath></defs>` +
    `<path d="M8 10 L92 10 L92 135 L8 135 Z" fill="#0B0A16"/>` +
    `<g clip-path="url(#n${uid})"><path d="${grid}" stroke="${c}" stroke-width="0.8" opacity="0.6"/>` +
    [[20, 24], [80, 30], [30, 90], [72, 20], [86, 80]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1" fill="#FFF"/>`).join('') + `</g>` +
    crimps(10, -1, c) + crimps(135, 1, c) +
    glow('M8 10 L92 10 L92 135 L8 135 Z', 1.6) +
    `<circle cx="50" cy="60" r="26" fill="${c}" opacity="0.15"/>` + ball(50, 60, 20, '#0B0A16', l, l) +
    `<circle cx="50" cy="60" r="20" fill="none" stroke="${c}" stroke-width="6" opacity="0.25"/>` + tierStars(n, 120, l);
}

function jersey(t: PackTier, uid: string): string {
  const { c, d, l, n } = TIER[t];
  const J = 'M30 30 L41 24 Q50 30 59 24 L70 30 L86 44 L77 58 L70 53 L70 122 L30 122 L30 53 L23 58 L14 44 Z';
  return `<defs><linearGradient id="cel${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFFFFF" stop-opacity="0.5"/><stop offset="0.5" stop-color="#FFFFFF" stop-opacity="0.05"/><stop offset="1" stop-color="#FFFFFF" stop-opacity="0.35"/></linearGradient>` +
    `<clipPath id="j${uid}"><path d="${J}"/></clipPath></defs>` +
    `<path d="M8 10 L92 10 L92 135 L8 135 Z" fill="${d}" opacity="0.35" stroke="${INK}" stroke-width="2"/>` +
    `<path d="${J}" fill="${c}"/><g clip-path="url(#j${uid})"><rect x="44" y="20" width="12" height="110" fill="${l}" opacity="0.8"/><path d="M14 44 L30 30 L30 40 Z M86 44 L70 30 L70 40 Z" fill="${d}"/></g>` +
    `<path d="${J}" fill="none" stroke="${INK}" stroke-width="2.4" stroke-linejoin="round"/><path d="M41 24 Q50 34 59 24" fill="none" stroke="${INK}" stroke-width="2.4"/>` +
    ball(50, 72, 9) + tierStars(n, 104) +
    `<path d="M8 10 L92 10 L92 135 L8 135 Z" fill="url(#cel${uid})"/><path d="M14 20 L30 14 M70 128 L86 122" stroke="#FFF" stroke-width="2" opacity="0.7"/>` +
    crimps(10, -1, '#E5E5E5') + crimps(135, 1, '#E5E5E5');
}

function holo(t: PackTier, uid: string): string {
  const { c, d, n } = TIER[t];
  return `<defs><linearGradient id="h${uid}" x1="0" y1="0" x2="1" y2="1">` +
    `<stop offset="0" stop-color="#FF6FB5"/><stop offset="0.25" stop-color="#FFE08A"/><stop offset="0.5" stop-color="#7FD1FF"/><stop offset="0.75" stop-color="#B49CFF"/><stop offset="1" stop-color="#FF6FB5"/></linearGradient>` +
    `<clipPath id="hc${uid}"><path d="M8 10 L92 10 L92 135 L8 135 Z"/></clipPath></defs>` +
    `<path d="M8 10 L92 10 L92 135 L8 135 Z" fill="url(#h${uid})" stroke="${INK}" stroke-width="2.5"/>` +
    `<g clip-path="url(#hc${uid})">` + Array.from({ length: 10 }, (_, i) => `<path d="M${-40 + i * 16} 145 L${10 + i * 16} 0" stroke="#FFFFFF" stroke-width="3" opacity="0.25"/>`).join('') +
    `<path d="M0 135 L100 135 L100 100 Q50 120 0 100 Z" fill="${d}" opacity="0.55"/></g>` +
    crimps(10, -1, d) + crimps(135, 1, d) +
    star(50, 60, 30, c, 2.4) +
    `<path d="M54 36 L42 62 L50 62 L44 84 L60 56 L52 56 L58 36 Z" fill="#FFF8EA" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
    ball(68, 80, 8) + tierStars(n, 120, '#FFF8EA');
}

const LION: AvatarSpec = { species: 8, skin: 6, face: 0, eyes: 1, brows: 2, mouth: 1, hair: 4, hairColor: 4, outfit: 4, outfitColor: 11, bg: 0, accessory: 9 };

function mascot(t: PackTier, uid: string): string {
  const { c, d, l, n } = TIER[t];
  const lion = avatarSvg(LION, { size: 100, uid: `lion${uid}` })
    .replace(/^<svg[^>]*>/, '').replace(/<\/svg>$/, '')
    .replace(/<rect width="100" height="100" fill="url\(#bg[^)]*\)"\/>/, ''); // keep the lion, drop its square background
  return `<defs><linearGradient id="m${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${d}"/><stop offset="0.5" stop-color="${c}"/><stop offset="1" stop-color="${d}"/></linearGradient></defs>` +
    `<path d="M8 40 L18 34 L28 42 L40 33 L52 42 L64 34 L76 42 L92 36 L92 135 L8 135 Z" fill="url(#m${uid})" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"/>` +
    `<g transform="translate(14 0) scale(0.72)">${lion}</g>` +
    `<path d="M8 74 L92 74 L92 135 L8 135 Z" fill="url(#m${uid})" stroke="${INK}" stroke-width="2.5"/>` +
    `<path d="M8 74 L18 68 L28 76 L40 67 L52 76 L64 68 L76 76 L92 70" fill="none" stroke="${INK}" stroke-width="2"/>` +
    `<path d="M14 84 L40 84 M60 128 L86 128" stroke="${l}" stroke-width="2.4" opacity="0.8"/>` +
    ball(76, 96, 9) + tierStars(n, 120) + crimps(135, 1, d) +
    `<path d="M12 24 l2 5 5 2 -5 2 -2 5 -2 -5 -5 -2 5 -2 Z M86 18 l1.5 4 4 1.5 -4 1.5 -1.5 4 -1.5 -4 -4 -1.5 4 -1.5 Z" fill="#FFE08A"/>`;
}

export function packStyleSvg(style: PackStyle, tier: PackTier, width = 100, uid = `${style}${tier}`): string {
  const body = style === 'retro' ? retro(tier, uid) : style === 'neon' ? neon(tier, uid) : style === 'jersey' ? jersey(tier, uid) : style === 'holo' ? holo(tier, uid) : mascot(tier, uid);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${(width * 1.45).toFixed(1)}" viewBox="0 0 100 145">${body}</svg>`;
}
