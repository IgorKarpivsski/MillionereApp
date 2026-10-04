/**
 * Procedural caricature art for the "אגדות" album.
 *
 * Every legend is an ORIGINAL, fictional character: the face is assembled from
 * generic parts (head shape, hair, brows, nose, moustache…) chosen by the
 * item's art parameters. No real player, club crest or kit is depicted.
 * Pure function → SVG markup, so the same art renders in the app (SvgXml)
 * and in tooling (previews, store screenshots).
 */

export interface LegendArtParams {
  skin: number; // 0..5
  hair: HairStyle;
  hairColor: number; // 0..7
  head: 'oval' | 'square' | 'long' | 'round';
  brows: 'angry' | 'flat' | 'raised';
  eyes: 'wide' | 'dots' | 'sleepy';
  nose: 'bulb' | 'hook' | 'button';
  mouth: 'smile' | 'grin' | 'shout' | 'smirk';
  mustache: 'chevron' | 'handlebar' | 'pencil' | null;
  beard: 'full' | 'goatee' | 'stubble' | null;
  sideburns: boolean;
  headband: boolean;
  kit: { a: string; b: string; pattern: 'plain' | 'stripes' | 'hoops' | 'sash' | 'half' };
  collar: 'round' | 'v' | 'polo';
}

export type HairStyle = 'afro' | 'mullet' | 'bald' | 'curly' | 'sidepart' | 'buzz' | 'long' | 'spiky' | 'receding';

export const SKIN = ['#F6D3B8', '#EAB690', '#D29B6F', '#B27B52', '#8B5B3C', '#5F3B27'];
export const HAIR = ['#1E1A17', '#3B2A1E', '#6B4A2B', '#C99A4A', '#E6C67E', '#B5532A', '#8E8E8E', '#E9E9E9'];
const INK = '#1A1714';

function shade(hex: string, f: number): string {
  const n = parseInt(hex.slice(1), 16);
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v * f)));
  return `#${[(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => c(v).toString(16).padStart(2, '0')).join('')}`;
}

const HEAD: Record<LegendArtParams['head'], string> = {
  oval: 'M50 112 C50 70 72 52 100 52 C128 52 150 70 150 112 C150 150 128 172 100 172 C72 172 50 150 50 112 Z',
  square: 'M52 98 Q52 52 100 52 Q148 52 148 98 L146 132 Q140 170 100 172 Q60 170 54 132 Z',
  long: 'M56 108 C56 64 76 46 100 46 C124 46 144 64 144 108 C144 152 126 176 100 176 C74 176 56 152 56 108 Z',
  round: 'M46 114 C46 74 70 58 100 58 C130 58 154 74 154 114 C154 150 130 170 100 170 C70 170 46 150 46 114 Z',
};

function hairBack(p: LegendArtParams, c: string): string {
  switch (p.hair) {
    case 'afro':
      return `<g fill="${c}" stroke="${INK}" stroke-width="3">${[[100, 78, 66], [52, 100, 34], [148, 100, 34], [66, 60, 34], [134, 60, 34], [100, 44, 34]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}"/>`).join('')}</g>`;
    case 'mullet':
      return `<path d="M58 110 C50 150 56 182 70 196 L130 196 C144 182 150 150 142 110 Z" fill="${c}" stroke="${INK}" stroke-width="3"/>`;
    case 'long':
      return `<path d="M50 100 C44 150 48 196 64 214 L136 214 C152 196 156 150 150 100 C140 60 60 60 50 100 Z" fill="${c}" stroke="${INK}" stroke-width="3"/>`;
    default:
      return '';
  }
}

function hairFront(p: LegendArtParams, c: string): string {
  const s = `fill="${c}" stroke="${INK}" stroke-width="3" stroke-linejoin="round"`;
  switch (p.hair) {
    case 'afro':
      return `<path d="M56 92 C62 66 82 58 100 60 C118 58 138 66 144 92 C130 80 116 76 100 78 C84 76 70 80 56 92 Z" ${s}/>`;
    case 'mullet':
    case 'sidepart':
      return `<path d="M52 104 C48 66 72 46 102 46 C132 46 152 64 148 100 C140 84 126 78 112 78 C96 80 82 70 76 62 C70 76 62 88 52 104 Z" ${s}/>`;
    case 'bald':
      return `<path d="M50 112 C50 98 54 92 58 90 L60 116 Z" ${s}/><path d="M150 112 C150 98 146 92 142 90 L140 116 Z" ${s}/>` +
        `<ellipse cx="86" cy="66" rx="14" ry="6" fill="#FFFFFF" opacity="0.45" transform="rotate(-18 86 66)"/>`;
    case 'curly':
      return `<g ${s}>${Array.from({ length: 9 }, (_, i) => {
        const a = Math.PI * (1.05 + (i / 8) * 0.9);
        return `<circle cx="${(100 + Math.cos(a) * 46).toFixed(1)}" cy="${(98 + Math.sin(a) * 44).toFixed(1)}" r="15"/>`;
      }).join('')}</g>`;
    case 'buzz':
      return `<path d="M52 100 C50 66 74 50 100 50 C126 50 150 66 148 100 C134 80 118 74 100 74 C82 74 66 80 52 100 Z" fill="${c}" opacity="0.85" stroke="${INK}" stroke-width="2"/>`;
    case 'long':
      return `<path d="M50 108 C48 64 74 46 100 46 C126 46 152 64 150 108 C140 84 120 70 100 66 C80 70 60 84 50 108 Z" ${s}/><path d="M100 50 L100 68" stroke="${INK}" stroke-width="2"/>`;
    case 'spiky':
      return `<path d="M50 104 L52 70 L64 78 L68 50 L82 66 L92 40 L102 62 L114 40 L122 66 L136 50 L138 78 L150 70 L150 104 C136 84 118 78 100 78 C82 78 64 84 50 104 Z" ${s}/>`;
    case 'receding':
      return `<path d="M52 108 C50 80 58 64 70 58 C70 74 72 82 80 86 C70 90 60 98 52 108 Z" ${s}/><path d="M148 108 C150 80 142 64 130 58 C130 74 128 82 120 86 C130 90 140 98 148 108 Z" ${s}/>`;
  }
}

function face(p: LegendArtParams, skin: string, hair: string): string {
  const out: string[] = [];
  // brows
  const bw = `fill="${hair === HAIR[7] ? '#BDBDBD' : hair}" stroke="${INK}" stroke-width="2"`;
  const brow = { angry: [8, -8], flat: [0, 0], raised: [-8, 8] }[p.brows];
  out.push(`<rect x="66" y="96" width="26" height="8" rx="4" ${bw} transform="rotate(${brow[0]} 79 100)"/>`);
  out.push(`<rect x="108" y="96" width="26" height="8" rx="4" ${bw} transform="rotate(${brow[1]} 121 100)"/>`);
  // eyes
  if (p.eyes === 'wide') {
    for (const x of [80, 120]) out.push(`<ellipse cx="${x}" cy="114" rx="9" ry="10" fill="#FFF" stroke="${INK}" stroke-width="2.5"/><circle cx="${x + 1}" cy="116" r="4.5" fill="${INK}"/>`);
  } else if (p.eyes === 'dots') {
    for (const x of [80, 120]) out.push(`<circle cx="${x}" cy="115" r="5" fill="${INK}"/><circle cx="${x + 2}" cy="113" r="1.5" fill="#FFF"/>`);
  } else {
    for (const x of [80, 120]) out.push(`<ellipse cx="${x}" cy="116" rx="9" ry="6" fill="#FFF" stroke="${INK}" stroke-width="2.5"/><circle cx="${x}" cy="118" r="3.5" fill="${INK}"/><path d="M${x - 10} 114 Q${x} 108 ${x + 10} 114" fill="${skin}" stroke="${INK}" stroke-width="2.5"/>`);
  }
  // nose
  const nf = `fill="${shade(skin, 0.92)}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;
  out.push({
    bulb: `<path d="M98 112 C94 124 84 132 88 140 C92 148 108 148 112 140 C116 132 106 124 102 112" ${nf}/>`,
    hook: `<path d="M98 110 C96 124 90 134 92 142 C98 146 106 144 110 140 C104 136 104 126 104 112" ${nf}/>`,
    button: `<ellipse cx="100" cy="136" rx="9" ry="7" ${nf}/>`,
  }[p.nose]);
  // mouth
  out.push({
    smile: `<path d="M84 154 Q100 166 116 154" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
    grin: `<path d="M82 150 Q100 170 118 150 Z" fill="#FFF" stroke="${INK}" stroke-width="3" stroke-linejoin="round"/><path d="M86 153 L114 153" stroke="${INK}" stroke-width="1.5"/>`,
    shout: `<ellipse cx="100" cy="157" rx="11" ry="9" fill="#5A1E1E" stroke="${INK}" stroke-width="3"/><ellipse cx="100" cy="161" rx="6" ry="3.5" fill="#D9646A"/>`,
    smirk: `<path d="M86 156 Q104 160 116 150" fill="none" stroke="${INK}" stroke-width="3" stroke-linecap="round"/>`,
  }[p.mouth]);
  // cheeks
  out.push(`<circle cx="70" cy="136" r="7" fill="#E46A5A" opacity="0.18"/><circle cx="130" cy="136" r="7" fill="#E46A5A" opacity="0.18"/>`);
  // facial hair
  const fh = `fill="${hair}" stroke="${INK}" stroke-width="2.5" stroke-linejoin="round"`;
  if (p.beard === 'full') out.push(`<path d="M56 128 C58 162 78 178 100 178 C122 178 142 162 144 128 C134 150 122 160 100 162 C78 160 66 150 56 128 Z" ${fh}/>`);
  if (p.beard === 'goatee') out.push(`<path d="M90 164 C92 176 108 176 110 164 C104 168 96 168 90 164 Z" ${fh}/>`);
  if (p.beard === 'stubble') out.push(`<path d="M60 134 C64 160 80 172 100 172 C120 172 136 160 140 134 C130 152 118 160 100 160 C82 160 70 152 60 134 Z" fill="${hair}" opacity="0.28"/>`);
  if (p.mustache === 'chevron') out.push(`<path d="M80 150 C86 140 96 142 100 146 C104 142 114 140 120 150 C112 148 106 150 100 152 C94 150 88 148 80 150 Z" ${fh}/>`);
  if (p.mustache === 'handlebar') out.push(`<path d="M74 142 C80 150 92 142 100 146 C108 142 120 150 126 142 C126 152 112 154 100 150 C88 154 74 152 74 142 Z" ${fh}/>`);
  if (p.mustache === 'pencil') out.push(`<path d="M86 147 Q100 143 114 147" fill="none" stroke="${hair}" stroke-width="3.5" stroke-linecap="round"/>`);
  if (p.sideburns) out.push(`<path d="M52 104 L58 104 L60 134 L54 130 Z" ${fh}/><path d="M148 104 L142 104 L140 134 L146 130 Z" ${fh}/>`);
  return out.join('');
}

function shirt(p: LegendArtParams): string {
  const body = 'M14 250 C18 206 52 188 100 186 C148 188 182 206 186 250 Z';
  const { a, b, pattern } = p.kit;
  const parts = [`<clipPath id="shirt"><path d="${body}"/></clipPath>`, `<path d="${body}" fill="${a}"/>`];
  const g: string[] = [];
  if (pattern === 'stripes') for (let x = 30; x < 180; x += 28) g.push(`<rect x="${x}" y="180" width="14" height="80" fill="${b}"/>`);
  if (pattern === 'hoops') for (let y = 198; y < 252; y += 22) g.push(`<rect x="0" y="${y}" width="200" height="11" fill="${b}"/>`);
  if (pattern === 'sash') g.push(`<path d="M40 190 L70 182 L170 252 L132 252 Z" fill="${b}"/>`);
  if (pattern === 'half') g.push(`<rect x="100" y="180" width="100" height="80" fill="${b}"/>`);
  parts.push(`<g clip-path="url(#shirt)">${g.join('')}</g>`);
  parts.push(`<path d="${body}" fill="none" stroke="${INK}" stroke-width="3"/>`);
  if (p.collar === 'round') parts.push(`<path d="M78 190 Q100 206 122 190" fill="none" stroke="${b === '#FFFFFF' ? INK : b}" stroke-width="7" stroke-linecap="round"/>`);
  if (p.collar === 'v') parts.push(`<path d="M80 188 L100 214 L120 188" fill="none" stroke="${b}" stroke-width="7" stroke-linejoin="round"/>`);
  if (p.collar === 'polo') parts.push(`<path d="M76 186 L98 200 L86 212 Z" fill="${b}" stroke="${INK}" stroke-width="2.5"/><path d="M124 186 L102 200 L114 212 Z" fill="${b}" stroke="${INK}" stroke-width="2.5"/>`);
  return parts.join('');
}

/** Card art: head-and-shoulders on a sunburst. `bg` is the rarity colour. */
export function legendSvg(p: LegendArtParams, bg: string, size = 200): string {
  const skin = SKIN[p.skin % SKIN.length]!;
  const hair = HAIR[p.hairColor % HAIR.length]!;
  const rays = Array.from({ length: 18 }, (_, i) => {
    const a1 = (i / 18) * Math.PI * 2;
    const a2 = a1 + Math.PI / 18;
    const r = 260;
    return i % 2 ? '' : `<path d="M100 120 L${(100 + Math.cos(a1) * r).toFixed(1)} ${(120 + Math.sin(a1) * r).toFixed(1)} L${(100 + Math.cos(a2) * r).toFixed(1)} ${(120 + Math.sin(a2) * r).toFixed(1)} Z" fill="#FFFFFF" opacity="0.13"/>`;
  }).join('');
  const dots = Array.from({ length: 40 }, (_, i) => {
    const x = 8 + (i % 8) * 12;
    const y = 160 + Math.floor(i / 8) * 12;
    return `<circle cx="${x}" cy="${y}" r="${(2.6 - Math.floor(i / 8) * 0.4).toFixed(1)}" fill="#000" opacity="0.10"/>`;
  }).join('');
  const neck = `<path d="M84 160 L84 194 Q100 202 116 194 L116 160 Z" fill="${shade(skin, 0.86)}" stroke="${INK}" stroke-width="3"/>`;
  const ears = `<ellipse cx="50" cy="118" rx="9" ry="14" fill="${skin}" stroke="${INK}" stroke-width="3"/><ellipse cx="150" cy="118" rx="9" ry="14" fill="${skin}" stroke="${INK}" stroke-width="3"/>`;
  const head = `<path d="${HEAD[p.head]}" fill="${skin}" stroke="${INK}" stroke-width="3.5" stroke-linejoin="round"/>`;
  const band = p.headband ? `<path d="M50 92 Q100 74 150 92 L150 104 Q100 86 50 104 Z" fill="${p.kit.b}" stroke="${INK}" stroke-width="2.5"/>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size * 1.25}" viewBox="0 0 200 250">` +
    `<defs>${''}</defs><rect width="200" height="250" fill="${bg}"/>${rays}${dots}` +
    `${hairBack(p, hair)}${shirt(p)}${neck}${ears}${head}${face(p, skin, hair)}${hairFront(p, hair)}${band}</svg>`;
}

/* ------------------------------------------------------------------ */
/* Deterministic parameters from a seed (used to build the catalogue). */
/* ------------------------------------------------------------------ */

function rng(seed: number) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 2 ** 32;
  };
}

const KITS: Array<[string, string]> = [
  ['#C8102E', '#FFFFFF'], ['#0B5FA5', '#FFFFFF'], ['#1E8E3E', '#FFFFFF'], ['#F2C200', '#1A1714'], ['#1A1714', '#FFFFFF'],
  ['#FFFFFF', '#C8102E'], ['#6A2C91', '#F2C200'], ['#E35205', '#1A1714'], ['#00A3AD', '#FFFFFF'], ['#7A0019', '#7FB2E5'],
  ['#FFFFFF', '#0B5FA5'], ['#2B2B2B', '#F2C200'],
];

export function legendParams(seed: number, era: '70s' | '80s' | '90s' | '00s' | 'modern'): LegendArtParams {
  const r = rng(seed);
  const pick = <T>(xs: readonly T[]): T => xs[Math.floor(r() * xs.length)]!;
  const retro = era === '70s' || era === '80s';
  const hairPool: HairStyle[] = retro
    ? ['afro', 'mullet', 'curly', 'sidepart', 'bald', 'long', 'receding']
    : era === '90s' ? ['sidepart', 'curly', 'mullet', 'buzz', 'bald', 'long'] : ['spiky', 'buzz', 'sidepart', 'curly', 'bald'];
  const kit = pick(KITS);
  return {
    skin: Math.floor(r() * SKIN.length),
    hair: pick(hairPool),
    hairColor: r() < 0.1 ? 6 : Math.floor(r() * 6),
    head: pick(['oval', 'square', 'long', 'round'] as const),
    brows: pick(['angry', 'flat', 'raised'] as const),
    eyes: pick(['wide', 'dots', 'sleepy'] as const),
    nose: pick(['bulb', 'hook', 'button'] as const),
    mouth: pick(['smile', 'grin', 'shout', 'smirk'] as const),
    mustache: retro && r() < 0.55 ? pick(['chevron', 'handlebar', 'pencil'] as const) : r() < 0.1 ? 'pencil' : null,
    beard: r() < (retro ? 0.2 : 0.35) ? pick(['full', 'goatee', 'stubble'] as const) : null,
    sideburns: retro && r() < 0.5,
    headband: r() < (retro ? 0.18 : 0.08),
    kit: { a: kit[0], b: kit[1], pattern: pick(['plain', 'stripes', 'hoops', 'sash', 'half'] as const) },
    collar: retro ? pick(['polo', 'v', 'round'] as const) : pick(['round', 'v'] as const),
  };
}
