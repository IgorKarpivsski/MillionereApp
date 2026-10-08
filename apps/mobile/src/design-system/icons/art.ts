/**
 * "האלוף" icon set — original, sticker-style illustrated icons (drawn here,
 * no icon font, no third-party art). 48×48, thick ink outline, two-tone fill
 * and a highlight, like a sticker peeled off the album.
 *
 * `mono` renders the same drawing in muted greys (inactive tabs).
 */

export const ICON_NAMES = [
  'home', 'play', 'packs', 'album', 'podium', 'wheel', 'pass', 'shop', 'friends', 'chat',
  'deal', 'ticket', 'daily', 'trophy', 'whistle', 'gloves', 'boot', 'gem', 'coin', 'fire', 'settings', 'lock',
] as const;
export type IconName = (typeof ICON_NAMES)[number];

interface Ink {
  ink: string;
  pad?: number; // extra outline width (sticker halo pass)
  a: string; // main
  a2: string; // main shade
  b: string; // second
  b2: string;
  c: string; // accent
  w: string; // white / paper
  hi: string; // highlight
}

const COLOR: Ink = {
  ink: '#1A1036', a: '#FFB000', a2: '#D98C00', b: '#3DDC84', b2: '#1E9E5A', c: '#FF5A4E', w: '#FFF8EA', hi: 'rgba(255,255,255,0.55)',
};
const MONO: Ink = {
  ink: '#5E7A6E', a: '#3A5A4D', a2: '#2E4A3F', b: '#34544A', b2: '#2A463C', c: '#47685B', w: '#4A6A5D', hi: 'rgba(255,255,255,0.12)',
};

const S = (k: Ink, w = 2.6) => `stroke="${k.ink}" stroke-width="${w + (k.pad ?? 0)}" stroke-linejoin="round" stroke-linecap="round"`;
/** Sticker cut-out: the same drawing, all paper-white with a fat outline, under the colored pass. */
const HALO: Ink = { ink: '#FFF8EA', pad: 4.4, a: '#FFF8EA', a2: '#FFF8EA', b: '#FFF8EA', b2: '#FFF8EA', c: '#FFF8EA', w: '#FFF8EA', hi: '#FFF8EA' };

function draw(name: IconName, k: Ink): string {
  const s = S(k);
  switch (name) {
    case 'home': // a little stadium with floodlights
      return `<path d="M6 40 L6 24 Q24 14 42 24 L42 40 Z" fill="${k.b}" ${s}/>` +
        `<path d="M6 30 Q24 21 42 30" fill="none" stroke="${k.b2}" stroke-width="2.4"/>` +
        `<path d="M18 40 L18 32 Q24 29 30 32 L30 40 Z" fill="${k.w}" ${s}/>` +
        `<path d="M9 22 L9 8 M39 22 L39 8" ${s}/><rect x="5" y="4" width="8" height="6" rx="2" fill="${k.a}" ${s}/><rect x="35" y="4" width="8" height="6" rx="2" fill="${k.a}" ${s}/>` +
        `<path d="M11 27 Q18 23 24 23" stroke="${k.hi}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    case 'play': // a lit idea bulb with sparks
      return `<path d="M24 6 Q38 6 38 20 Q38 27 32 31 L32 35 L16 35 L16 31 Q10 27 10 20 Q10 6 24 6 Z" fill="${k.a}" ${s}/>` +
        `<rect x="16" y="35" width="16" height="7" rx="2" fill="${k.w}" ${s}/>` +
        `<path d="M19 45 L29 45" ${s}/>` +
        `<path d="M19 22 Q21 17 24 21 Q27 17 29 22 L29 31 M19 22 L19 31" fill="none" stroke="${k.a2}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M4 12 L8 14 M44 12 L40 14 M3 24 L7 24 M45 24 L41 24" ${s}/>` +
        `<path d="M15 14 Q17 10 21 9" stroke="${k.hi}" stroke-width="2.6" fill="none" stroke-linecap="round"/>`;
    case 'packs': // foil pack with tear strip and star
      return `<path d="M10 9 L38 9 L36 41 L12 41 Z" fill="${k.c}" ${s}/>` +
        `<path d="M10 9 L13 5 L16 9 L19 5 L22 9 L25 5 L28 9 L31 5 L34 9 L37 5 L38 9" fill="${k.w}" ${s}/>` +
        `<path d="M11 15 L37 15" stroke="${k.ink}" stroke-width="2" stroke-dasharray="3 2.4"/>` +
        `<path d="M24 19 L27 25.5 L34 26.2 L28.7 30.8 L30.3 37.6 L24 34 L17.7 37.6 L19.3 30.8 L14 26.2 L21 25.5 Z" fill="${k.a}" ${S(k, 2)}/>` +
        `<path d="M15 19 L13.6 36" stroke="${k.hi}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'album': // open sticker book
      return `<path d="M24 12 Q15 7 5 10 L5 39 Q15 36 24 41 Q33 36 43 39 L43 10 Q33 7 24 12 Z" fill="${k.w}" ${s}/>` +
        `<path d="M24 12 L24 41" ${s}/>` +
        `<rect x="9" y="15" width="10" height="13" rx="2" fill="${k.b}" ${S(k, 2)}/>` +
        `<rect x="29" y="15" width="10" height="13" rx="2" fill="${k.a}" ${S(k, 2)} transform="rotate(6 34 21)"/>` +
        `<path d="M10 33 L18 33 M30 33 L38 33" stroke="${k.ink}" stroke-width="2" stroke-linecap="round" opacity="0.5"/>`;
    case 'podium':
      return `<rect x="17" y="20" width="14" height="22" fill="${k.a}" ${s}/>` +
        `<rect x="4" y="28" width="13" height="14" fill="${k.b}" ${s}/><rect x="31" y="32" width="13" height="10" fill="${k.c}" ${s}/>` +
        `<path d="M24 5 L26.2 9.6 L31 10.2 L27.5 13.5 L28.4 18.4 L24 16 L19.6 18.4 L20.5 13.5 L17 10.2 L21.8 9.6 Z" fill="${k.a}" ${S(k, 2)}/>` +
        `<path d="M22 26 L24 24.5 L24 35" stroke="${k.ink}" stroke-width="2.2" fill="none"/>`;
    case 'wheel':
      return `<circle cx="24" cy="25" r="18" fill="${k.w}" ${s}/>` +
        `<path d="M24 25 L24 7 A18 18 0 0 1 39.6 16 Z" fill="${k.a}"/><path d="M24 25 L39.6 34 A18 18 0 0 1 24 43 Z" fill="${k.b}"/>` +
        `<path d="M24 25 L8.4 34 A18 18 0 0 1 8.4 16 Z" fill="${k.c}"/>` +
        `<circle cx="24" cy="25" r="18" fill="none" ${s}/><circle cx="24" cy="25" r="4" fill="${k.ink}"/>` +
        `<path d="M24 1 L29 8 L19 8 Z" fill="${k.c}" ${S(k, 2)}/>`;
    case 'pass': // season pass ticket with star
      return `<path d="M5 13 L43 13 L43 20 Q39 24 43 28 L43 35 L5 35 L5 28 Q9 24 5 20 Z" fill="${k.a}" ${s}/>` +
        `<path d="M32 15 L32 33" stroke="${k.ink}" stroke-width="2" stroke-dasharray="2.6 2.6"/>` +
        `<path d="M18 16.5 L20.4 21.4 L25.8 22 L21.8 25.6 L22.9 30.9 L18 28.2 L13.1 30.9 L14.2 25.6 L10.2 22 L15.6 21.4 Z" fill="${k.w}" ${S(k, 2)}/>` +
        `<path d="M36 20 L39 20 M36 24 L39 24 M36 28 L39 28" stroke="${k.a2}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'shop': // shopping bag with coin
      return `<path d="M16 15 Q16 6 24 6 Q32 6 32 15" fill="none" ${s}/>` +
        `<path d="M8 15 L40 15 L37 42 L11 42 Z" fill="${k.c}" ${s}/>` +
        `<circle cx="24" cy="29" r="7" fill="${k.a}" ${s}/><path d="M24 25.5 L24 32.5" stroke="${k.ink}" stroke-width="2.2"/>` +
        `<path d="M12 19 L11.5 30" stroke="${k.hi}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'friends': // two shirts side by side
      return `<path d="M20 12 L12 16 L15 23 L18 22 L18 40 L32 40 L32 22 L35 23 L38 16 L30 12 Q28 15 25 15 Q22 15 20 12 Z" fill="${k.b}" ${s} transform="translate(-6 0)"/>` +
        `<path d="M20 12 L12 16 L15 23 L18 22 L18 40 L32 40 L32 22 L35 23 L38 16 L30 12 Q28 15 25 15 Q22 15 20 12 Z" fill="${k.a}" ${s} transform="translate(8 3)"/>` +
        `<path d="M30 26 L36 26 M33 23 L33 31" stroke="${k.ink}" stroke-width="2.4" stroke-linecap="round"/>`;
    case 'chat':
      return `<path d="M6 10 Q6 6 10 6 L38 6 Q42 6 42 10 L42 29 Q42 33 38 33 L20 33 L11 41 L12 33 L10 33 Q6 33 6 29 Z" fill="${k.w}" ${s}/>` +
        `<circle cx="16" cy="20" r="2.8" fill="${k.b2}"/><circle cx="24" cy="20" r="2.8" fill="${k.a2}"/><circle cx="32" cy="20" r="2.8" fill="${k.c}"/>`;
    case 'deal': // price tag with flame
      return `<path d="M24 5 L42 5 L42 23 L22 43 L4 25 Z" fill="${k.c}" ${s}/>` +
        `<circle cx="35" cy="12" r="3" fill="${k.w}" ${S(k, 2)}/>` +
        `<path d="M22 34 Q14 30 17 22 Q19 26 21 25 Q19 18 26 14 Q25 20 29 23 Q31 30 22 34 Z" fill="${k.a}" ${S(k, 2)}/>`;
    case 'ticket': // energy ticket with bolt
      return `<path d="M5 14 L43 14 L43 21 Q39 24 43 27 L43 34 L5 34 L5 27 Q9 24 5 21 Z" fill="${k.b}" ${s}/>` +
        `<path d="M26 16 L17 26 L23 26 L20 33 L31 22 L25 22 Z" fill="${k.a}" ${S(k, 2)}/>`;
    case 'daily': // calendar with ball
      return `<rect x="6" y="9" width="36" height="33" rx="5" fill="${k.w}" ${s}/>` +
        `<path d="M6 14 Q6 9 11 9 L37 9 Q42 9 42 14 L42 18 L6 18 Z" fill="${k.c}" ${s}/>` +
        `<path d="M15 5 L15 12 M33 5 L33 12" ${s}/>` +
        `<circle cx="24" cy="30" r="7.5" fill="${k.w}" ${S(k, 2.2)}/><path d="M24 26.5 L27.3 28.8 L26 32.5 L22 32.5 L20.7 28.8 Z" fill="${k.ink}"/>`;
    case 'trophy':
      return `<path d="M14 7 L34 7 L33 20 Q32 29 24 30 Q16 29 15 20 Z" fill="${k.a}" ${s}/>` +
        `<path d="M14 11 Q6 11 7 17 Q8 23 15 23 M34 11 Q42 11 41 17 Q40 23 33 23" fill="none" ${s}/>` +
        `<path d="M21 30 L27 30 L28 36 L20 36 Z" fill="${k.a2}" ${s}/><rect x="14" y="36" width="20" height="6" rx="2" fill="${k.b}" ${s}/>` +
        `<path d="M19 11 L18.4 20" stroke="${k.hi}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 'whistle':
      return `<path d="M8 22 Q8 14 16 14 L38 14 L38 22 L28 22 Q30 26 28 32 Q24 40 16 38 Q8 36 8 28 Z" fill="${k.a}" ${s}/>` +
        `<circle cx="17" cy="28" r="4" fill="${k.ink}"/><path d="M38 14 L42 10" ${s}/><path d="M12 18 Q14 16 18 16" stroke="${k.hi}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
    case 'gloves':
      return `<path d="M12 42 L12 26 Q8 22 10 18 L12 12 Q13 8 16 10 L16 7 Q17 3 20 5 L21 4 Q24 2 25 6 L27 6 Q30 5 30 9 L30 26 L32 22 Q36 18 38 22 L33 34 Q31 38 30 42 Z" fill="${k.b}" ${s}/>` +
        `<rect x="11" y="36" width="20" height="7" rx="2" fill="${k.a}" ${s}/>`;
    case 'boot':
      return `<path d="M12 6 L24 6 L25 22 Q32 24 40 28 Q44 31 42 36 L8 36 Q5 30 9 22 Z" fill="${k.c}" ${s}/>` +
        `<path d="M8 36 L42 36 L41 40 L9 40 Z" fill="${k.ink}"/><path d="M13 42 L13 40 M22 42 L22 40 M32 42 L32 40" ${s}/>` +
        `<path d="M15 14 L22 14 M15 19 L23 19" stroke="${k.w}" stroke-width="2.2" stroke-linecap="round"/>`;
    case 'gem':
      return `<path d="M12 8 L36 8 L44 18 L24 42 L4 18 Z" fill="${k === MONO ? MONO.a : '#7FD1FF'}" ${s}/>` +
        `<path d="M4 18 L44 18 M16 8 L13 18 L24 42 L35 18 L32 8" fill="none" stroke="${k.ink}" stroke-width="2"/>` +
        `<path d="M14 18 L24 9 L34 18" fill="rgba(255,255,255,0.45)"/>`;
    case 'coin':
      return `<ellipse cx="24" cy="26" rx="17" ry="17" fill="${k.a2}" ${s}/><ellipse cx="24" cy="23" rx="17" ry="17" fill="${k.a}" ${s}/>` +
        `<circle cx="24" cy="23" r="11" fill="none" stroke="${k.a2}" stroke-width="2.4"/>` +
        `<path d="M24 16.5 L26 21 L30.8 21.4 L27.2 24.6 L28.2 29.2 L24 26.8 L19.8 29.2 L20.8 24.6 L17.2 21.4 L22 21 Z" fill="${k.w}"/>`;
    case 'fire':
      return `<path d="M24 44 Q9 40 10 26 Q11 18 17 13 Q17 20 21 21 Q19 10 28 4 Q27 13 33 18 Q40 24 38 33 Q36 42 24 44 Z" fill="${k.c}" ${s}/>` +
        `<path d="M24 42 Q16 39 18 31 Q20 27 22 26 Q22 31 25 31 Q24 24 29 21 Q32 30 31 36 Q30 41 24 42 Z" fill="${k.a}"/>`;
    case 'settings':
      return `<path d="M21 4 L27 4 L28 10 L32 12 L37 8 L41 12 L37 17 L39 21 L44 22 L44 27 L39 28 L37 32 L41 37 L37 41 L32 37 L28 39 L27 44 L21 44 L20 39 L16 37 L11 41 L7 37 L11 32 L9 28 L4 27 L4 22 L9 21 L11 17 L7 12 L11 8 L16 12 L20 10 Z" fill="${k.b}" ${s}/>` +
        `<circle cx="24" cy="24.5" r="7" fill="${k.w}" ${s}/>`;
    case 'lock':
      return `<path d="M15 21 L15 14 Q15 5 24 5 Q33 5 33 14 L33 21" fill="none" ${s}/>` +
        `<rect x="9" y="20" width="30" height="23" rx="5" fill="${k.a}" ${s}/><circle cx="24" cy="30" r="3.2" fill="${k.ink}"/><path d="M24 31 L24 37" ${s}/>`;
  }
}

export function iconSvg(name: IconName, opts: { size?: number; mono?: boolean; sticker?: boolean } = {}): string {
  const size = opts.size ?? 48;
  const sticker = (opts.sticker ?? true) && !opts.mono;
  const body = (sticker ? draw(name, HALO) : '') + draw(name, opts.mono ? MONO : COLOR);
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="-3 -3 54 54">${body}</svg>`;
}
