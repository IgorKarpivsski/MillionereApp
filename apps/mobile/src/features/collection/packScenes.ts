/**
 * Pack illustrations — one original scene per tier, drawn as SVG strings
 * (pure, so it also renders in tests and previews). viewBox 0 0 100 145.
 *
 *   bronze     "שכונה"   a street ball against a brick wall
 *   silver     "אצטדיון" stands and floodlights at night
 *   gold       "גביע"     a trophy in a sunburst
 *   epic       "כוכב"     a comet volley in a purple galaxy
 *   legendary  "אגדה"     a crowned crest in flames with laurels
 */
export type PackTier = 'bronze' | 'silver' | 'gold' | 'epic' | 'legendary';

const INK = '#14110F';

interface Theme {
  foil: [string, string, string]; // dark, mid, light
  panel: [string, string];
  stars: number;
}

const THEMES: Record<PackTier, Theme> = {
  bronze: { foil: ['#7A3F14', '#D98A4E', '#F6C9A0'], panel: ['#5B2E12', '#A0582A'], stars: 1 },
  silver: { foil: ['#5E6B78', '#C9CED6', '#F7F9FB'], panel: ['#0E2433', '#1D4A66'], stars: 2 },
  gold: { foil: ['#8A5A00', '#FFB000', '#FFF0B8'], panel: ['#7A4A00', '#FFB000'], stars: 3 },
  epic: { foil: ['#3B1F86', '#9B6BFF', '#E6DCFF'], panel: ['#120B2E', '#4B2C9E'], stars: 4 },
  legendary: { foil: ['#7E140C', '#FF5A4E', '#FFD3C9'], panel: ['#3A0B06', '#C0281C'], stars: 5 },
};

function ball(cx: number, cy: number, r: number): string {
  const p = (a: number, rr: number) => `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  const pent = Array.from({ length: 5 }, (_, i) => p(-Math.PI / 2 + (i * 2 * Math.PI) / 5, r * 0.42)).join(' ');
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `M${p(a, r * 0.42)} L${p(a, r * 0.95)}`;
  }).join(' ');
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#FFF8EA" stroke="${INK}" stroke-width="2"/>` +
    `<polygon points="${pent}" fill="${INK}"/><path d="${spokes}" stroke="${INK}" stroke-width="1.6"/>` +
    `<path d="M${cx - r * 0.55} ${cy - r * 0.55} Q${cx - r * 0.2} ${cy - r * 0.85} ${cx + r * 0.15} ${cy - r * 0.8}" stroke="#FFFFFF" stroke-width="2" fill="none" stroke-linecap="round" opacity="0.9"/>`;
}

function star(cx: number, cy: number, r: number, fill: string): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="${fill}" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
}

function scene(tier: PackTier, th: Theme, uid: string): string {
  const [, mid, light] = th.foil;
  switch (tier) {
    case 'bronze': {
      const bricks = Array.from({ length: 7 }, (_, row) =>
        Array.from({ length: 5 }, (_, col) => {
          const x = 14 + col * 15 - (row % 2 ? 7 : 0);
          return `<rect x="${x}" y="${30 + row * 10.6}" width="14" height="9.6" rx="1" fill="#8E4A22" opacity="0.55"/>`;
        }).join(''),
      ).join('');
      return bricks +
        `<path d="M14 92 L86 92 L86 104 L14 104 Z" fill="#3B1F0E" opacity="0.8"/>` +
        `<path d="M24 56 L36 56 M20 64 L34 64 M26 72 L38 72" stroke="${light}" stroke-width="3" stroke-linecap="round" opacity="0.85"/>` +
        ball(58, 64, 17) +
        `<ellipse cx="58" cy="96" rx="15" ry="3.5" fill="${INK}" opacity="0.45"/>`;
    }
    case 'silver':
      return `<path d="M14 30 L30 30 L46 104 L14 104 Z" fill="#FFFBE0" opacity="0.14"/><path d="M86 30 L70 30 L54 104 L86 104 Z" fill="#FFFBE0" opacity="0.14"/>` +
        `<rect x="18" y="34" width="10" height="5" rx="1.5" fill="#FFF8D0"/><rect x="72" y="34" width="10" height="5" rx="1.5" fill="#FFF8D0"/>` +
        `<path d="M23 39 L23 70 M77 39 L77 70" stroke="${light}" stroke-width="2"/>` +
        `<path d="M14 78 Q50 58 86 78 L86 88 L14 88 Z" fill="${mid}" stroke="${INK}" stroke-width="1.5"/>` +
        Array.from({ length: 9 }, (_, i) => `<circle cx="${20 + i * 7.5}" cy="${79 - Math.sin((i / 8) * Math.PI) * 9}" r="1.6" fill="#FFFFFF" opacity="0.8"/>`).join('') +
        `<path d="M14 88 L86 88 L86 104 L14 104 Z" fill="#2E9C5E"/>` +
        `<path d="M26 88 L22 104 M38 88 L36 104 M50 88 L50 104 M62 88 L64 104 M74 88 L78 104" stroke="#3DDC84" stroke-width="3" opacity="0.6"/>` +
        `<ellipse cx="50" cy="96" rx="9" ry="3" fill="none" stroke="#FFFFFF" stroke-width="1.2" opacity="0.8"/>`;
    case 'gold': {
      const rays = Array.from({ length: 16 }, (_, i) => {
        const a = (i * Math.PI) / 8, b = a + Math.PI / 16;
        return `<path d="M50 62 L${(50 + 70 * Math.cos(a)).toFixed(1)} ${(62 + 70 * Math.sin(a)).toFixed(1)} L${(50 + 70 * Math.cos(b)).toFixed(1)} ${(62 + 70 * Math.sin(b)).toFixed(1)} Z" fill="#FFF0B8" opacity="0.35"/>`;
      }).join('');
      return rays +
        `<path d="M36 40 L64 40 L62 58 Q60 70 50 71 Q40 70 38 58 Z" fill="#FFD34D" stroke="${INK}" stroke-width="2"/>` +
        `<path d="M36 44 Q26 44 27 52 Q28 59 38 59 M64 44 Q74 44 73 52 Q72 59 62 59" fill="none" stroke="${INK}" stroke-width="2"/>` +
        `<path d="M46 71 L54 71 L55 80 L45 80 Z" fill="#E09A00" stroke="${INK}" stroke-width="1.6"/>` +
        `<rect x="38" y="80" width="24" height="8" rx="2" fill="#7A4A00" stroke="${INK}" stroke-width="1.6"/>` +
        `<path d="M43 45 L42.5 57" stroke="#FFFFFF" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>` +
        star(50, 52, 6, '#FFF8EA') + star(24, 36, 3, '#FFF8EA') + star(78, 92, 3.5, '#FFF8EA');
    }
    case 'epic': {
      const dots = [[20, 36], [80, 40], [30, 92], [74, 98], [62, 34], [18, 70], [84, 74]]
        .map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 1 : 1.5}" fill="#FFFFFF"/>`).join('');
      return dots +
        `<path d="M18 92 Q40 70 62 58" stroke="url(#trail${uid})" stroke-width="10" stroke-linecap="round" fill="none"/>` +
        ball(66, 54, 11) +
        `<path d="M40 34 L30 58 L40 58 L34 78 L52 50 L42 50 L50 34 Z" fill="#FFE08A" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
        star(26, 46, 4, '#E6DCFF') + star(78, 88, 5, '#E6DCFF');
    }
    case 'legendary': {
      const flames = `<path d="M14 104 L14 84 Q20 72 24 82 Q26 64 34 76 Q38 58 46 74 Q50 56 56 72 Q62 58 66 74 Q72 62 76 80 Q80 70 86 82 L86 104 Z" fill="#FF8A3D" opacity="0.9"/>` +
        `<path d="M14 104 L14 94 Q22 84 28 94 Q36 80 44 94 Q52 82 58 94 Q66 82 72 94 Q80 86 86 92 L86 104 Z" fill="#FFC93C"/>`;
      const laurel = (side: number) => Array.from({ length: 5 }, (_, i) => {
        const y = 78 - i * 8, x = 50 + side * (20 - i * 1.5);
        return `<ellipse cx="${x}" cy="${y}" rx="5" ry="2.4" fill="#3DDC84" stroke="${INK}" stroke-width="0.8" transform="rotate(${side * (40 + i * 6)} ${x} ${y})"/>`;
      }).join('');
      return flames + laurel(-1) + laurel(1) +
        `<path d="M36 46 L64 46 L62 66 Q50 76 38 66 Z" fill="${mid}" stroke="${INK}" stroke-width="2"/>` +
        ball(50, 58, 8) +
        `<path d="M37 44 L39 33 L44 39 L50 30 L56 39 L61 33 L63 44 Z" fill="#FFD34D" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<circle cx="50" cy="36" r="1.8" fill="#7FD1FF"/>`;
    }
  }
}

export function packSvg(tier: PackTier, width = 100, uid: string = tier): string {
  const th = THEMES[tier];
  const [d, m, l] = th.foil;
  const h = width * 1.45;
  const crimps = (y0: number, dir: number) =>
    Array.from({ length: 12 }, (_, i) => `M${8 + i * 7} ${y0} L${11.5 + i * 7} ${y0 + dir * 6} L${15 + i * 7} ${y0} Z`).join(' ');
  const stars = Array.from({ length: th.stars }, (_, i) => star(50 + (i - (th.stars - 1) / 2) * 9, 120, 3.6, '#FFD34D')).join('');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h.toFixed(1)}" viewBox="0 0 100 145">` +
    `<defs>` +
    `<linearGradient id="foil${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${d}"/><stop offset="0.42" stop-color="${m}"/><stop offset="0.55" stop-color="${l}"/><stop offset="0.7" stop-color="${m}"/><stop offset="1" stop-color="${d}"/></linearGradient>` +
    `<linearGradient id="panel${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="${th.panel[1]}"/><stop offset="1" stop-color="${th.panel[0]}"/></linearGradient>` +
    `<linearGradient id="trail${uid}" x1="0" y1="1" x2="1" y2="0"><stop offset="0" stop-color="#FF6FB5" stop-opacity="0"/><stop offset="1" stop-color="#FFE08A"/></linearGradient>` +
    `<clipPath id="clip${uid}"><rect x="14" y="30" width="72" height="74" rx="8"/></clipPath>` +
    `</defs>` +
    `<path d="M8 10 L92 10 L92 135 L8 135 Z" fill="url(#foil${uid})" stroke="${INK}" stroke-width="2.5"/>` +
    `<path d="${crimps(10, -1)}" fill="${d}"/><path d="${crimps(135, 1)}" fill="${d}"/>` +
    // tear line
    `<path d="M10 22 L90 22" stroke="${INK}" stroke-width="1" stroke-dasharray="3 2" opacity="0.55"/>` +
    `<path d="M80 16 l3 3 m0 -3 l-3 3" stroke="${INK}" stroke-width="1" opacity="0.55"/>` +
    // illustrated window
    `<rect x="14" y="30" width="72" height="74" rx="8" fill="url(#panel${uid})"/>` +
    `<g clip-path="url(#clip${uid})">${scene(tier, th, uid)}</g>` +
    `<rect x="14" y="30" width="72" height="74" rx="8" fill="none" stroke="${INK}" stroke-width="2"/>` +
    // holographic sheen
    `<path d="M8 70 L40 10 L52 10 L8 92 Z" fill="#FFFFFF" opacity="0.16"/><path d="M60 135 L92 76 L92 92 L70 135 Z" fill="#FFFFFF" opacity="0.12"/>` +
    // rarity stars band
    `<rect x="22" y="112" width="56" height="16" rx="8" fill="${INK}" opacity="0.55"/>` + stars +
    `</svg>`;
}
