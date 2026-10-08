/**
 * Knowledge-world badges: a round, chunky "sticker" in the world's color with a
 * white glyph — the same idea as category bubbles in the big trivia games, drawn
 * here from scratch. 64×64 viewBox.
 */

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const ch = (v: number) => Math.max(0, Math.min(255, Math.round(f < 0 ? v * (1 + f) : v + (255 - v) * f)));
  const r = ch(n >> 16), g = ch((n >> 8) & 255), b = ch(n & 255);
  return `#${((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1)}`;
}

const W = '#FFFFFF';

function glyph(icon: string, c: string): string {
  const d = shade(c, -0.35);
  const s = `stroke="${W}" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round" fill="none"`;
  switch (icon) {
    case 'globe':
      return `<circle cx="32" cy="32" r="16" fill="${W}"/>` +
        `<ellipse cx="32" cy="32" rx="7" ry="16" stroke="${d}" stroke-width="2.6" fill="none"/>` +
        `<path d="M16 32 L48 32 M18.5 24 L45.5 24 M18.5 40 L45.5 40 M32 16 L32 48" stroke="${d}" stroke-width="2.4" fill="none"/>`;
    case 'scroll':
      return `<path d="M20 18 L42 18 Q46 18 46 22 L46 44 L24 44 Q20 44 20 40 Z" fill="${W}"/>` +
        `<circle cx="20" cy="21" r="4" fill="${W}"/><circle cx="24" cy="44" r="4" fill="${W}"/>` +
        `<path d="M27 26 L40 26 M27 31 L40 31 M27 36 L36 36" stroke="${d}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 'atom':
      return `<ellipse cx="32" cy="32" rx="17" ry="7" ${s}/>` +
        `<ellipse cx="32" cy="32" rx="17" ry="7" transform="rotate(60 32 32)" ${s}/>` +
        `<ellipse cx="32" cy="32" rx="17" ry="7" transform="rotate(-60 32 32)" ${s}/>` +
        `<circle cx="32" cy="32" r="4.5" fill="${W}"/>`;
    case 'leaf':
      return `<path d="M18 46 Q16 22 44 16 Q48 40 24 44 Z" fill="${W}"/>` +
        `<path d="M20 44 Q30 32 40 22" stroke="${d}" stroke-width="2.8" fill="none" stroke-linecap="round"/>`;
    case 'planet':
      return `<circle cx="32" cy="32" r="12" fill="${W}"/>` +
        `<path d="M14 38 Q32 26 50 26" stroke="${d}" stroke-width="2.6" fill="none"/>` +
        `<ellipse cx="32" cy="32" rx="22" ry="6.5" transform="rotate(-18 32 32)" stroke="${W}" stroke-width="3.2" fill="none"/>` +
        `<circle cx="47" cy="17" r="2.2" fill="${W}"/><circle cx="16" cy="20" r="1.6" fill="${W}"/>`;
    case 'palette':
      return `<path d="M32 15 Q49 15 49 30 Q49 38 41 37 Q36 36 37 41 Q38 48 31 48 Q15 47 15 31 Q15 15 32 15 Z" fill="${W}"/>` +
        `<circle cx="24" cy="27" r="3.2" fill="${d}"/><circle cx="32" cy="22" r="3.2" fill="${d}"/><circle cx="40" cy="27" r="3.2" fill="${d}"/><circle cx="24" cy="37" r="3.2" fill="${d}"/>`;
    case 'film':
      return `<rect x="15" y="22" width="34" height="24" rx="4" fill="${W}"/>` +
        `<path d="M15 22 L19 14 L49 14 L49 22 Z" fill="${W}"/>` +
        `<path d="M23 14 L20 22 M31 14 L28 22 M39 14 L36 22 M47 14 L44 22" stroke="${d}" stroke-width="2.6"/>` +
        `<path d="M28 29 L37 34 L28 39 Z" fill="${d}"/>`;
    case 'note':
      return `<path d="M26 42 L26 18 L46 14 L46 38" ${s}/>` +
        `<ellipse cx="21" cy="43" rx="6.5" ry="5" fill="${W}"/><ellipse cx="41" cy="39" rx="6.5" ry="5" fill="${W}"/>` +
        `<path d="M26 23 L46 19" ${s}/>`;
    case 'person':
      return `<circle cx="32" cy="24" r="8" fill="${W}"/>` +
        `<path d="M17 47 Q17 34 32 34 Q47 34 47 47 Z" fill="${W}"/>` +
        `<path d="M25 17 L29 13 L32 17 L35 13 L39 17" stroke="${W}" stroke-width="2.6" fill="none" stroke-linejoin="round"/>`;
    case 'star':
      return `<path d="M32 14 L47.6 41 L16.4 41 Z" ${s}/><path d="M32 50 L16.4 23 L47.6 23 Z" ${s}/>`;
    case 'medal':
      return `<path d="M24 12 L30 28 M40 12 L34 28" stroke="${W}" stroke-width="5" stroke-linecap="round"/>` +
        `<circle cx="32" cy="38" r="11" fill="${W}"/>` +
        `<path d="M32 32 L33.8 35.8 L38 36.2 L34.8 39 L35.8 43 L32 41 L28.2 43 L29.2 39 L26 36.2 L30.2 35.8 Z" fill="${d}"/>`;
    case 'food':
      return `<path d="M14 34 L50 34 Q49 48 32 48 Q15 48 14 34 Z" fill="${W}"/>` +
        `<path d="M24 28 Q22 22 26 18 M32 28 Q30 21 34 16 M40 28 Q38 22 42 19" ${s}/>`;
    case 'ball':
      return `<circle cx="32" cy="32" r="15" fill="${W}"/>` +
        `<path d="M32 25 L38.7 29.9 L36.1 37.8 L27.9 37.8 L25.3 29.9 Z" fill="${d}"/>` +
        `<path d="M32 17 L32 25 M38.7 29.9 L46 27 M36.1 37.8 L41 44 M27.9 37.8 L23 44 M25.3 29.9 L18 27" stroke="${d}" stroke-width="2.4"/>`;
    case 'bolt':
    default:
      return `<path d="M36 12 L19 35 L30 35 L27 52 L45 27 L34 27 Z" fill="${W}"/>`;
  }
}

/** A round world badge. `locked` greys it out. */
export function worldBadgeSvg(icon: string, color: string, opts: { locked?: boolean } = {}): string {
  const c = opts.locked ? '#6E6890' : color;
  const rim = shade(c, -0.38);
  const top = shade(c, 0.22);
  const uid = `${icon}${c.slice(1)}`;
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">` +
    `<defs><radialGradient id="g${uid}" cx="0.35" cy="0.3" r="0.8"><stop offset="0" stop-color="${top}"/><stop offset="1" stop-color="${c}"/></radialGradient></defs>` +
    `<circle cx="32" cy="34" r="29" fill="${rim}"/>` +
    `<circle cx="32" cy="31" r="29" fill="url(#g${uid})"/>` +
    `<path d="M12 22 Q20 9 36 7" stroke="#FFFFFF" stroke-opacity="0.35" stroke-width="4" fill="none" stroke-linecap="round"/>` +
    `<g transform="translate(0 -1)">${glyph(icon, c)}</g>` +
    `</svg>`;
}

export { shade };
