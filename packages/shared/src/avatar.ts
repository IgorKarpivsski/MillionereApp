/**
 * Custom avatars — an original, hand-drawn-in-code chibi portrait.
 *
 * The avatar is stored as a short code in profiles.avatar_id:
 *   av1_ + 12 base36 slots, in AVATAR_SLOTS order.
 * The server validates the same ranges (supabase/migrations/*_custom_avatars.sql),
 * so keep the `count` values here and there in sync.
 *
 * Nothing here is based on a real person, club, kit or brand.
 */

export const AVATAR_SLOTS = [
  { key: 'species', count: 12 },
  { key: 'skin', count: 10 },
  { key: 'face', count: 4 },
  { key: 'eyes', count: 8 },
  { key: 'brows', count: 6 },
  { key: 'mouth', count: 8 },
  { key: 'hair', count: 14 },
  { key: 'hairColor', count: 12 },
  { key: 'outfit', count: 6 },
  { key: 'outfitColor', count: 12 },
  { key: 'bg', count: 14 },
  { key: 'accessory', count: 18 },
] as const;

export type AvatarSlot = (typeof AVATAR_SLOTS)[number]['key'];
export type AvatarSpec = Record<AvatarSlot, number>;

export const SPECIES = ['boy', 'girl', 'cat', 'dog', 'bear', 'fox', 'panda', 'bunny', 'lion', 'frog', 'penguin', 'owl'] as const;
export type Species = (typeof SPECIES)[number];

/** Accessories that must be earned (season pass). Value = cosmetic item id. */
export const PREMIUM_ACCESSORIES: Readonly<Record<number, string>> = { 8: 'avatar_shades', 9: 'avatar_crown' };

/**
 * Items sold in the avatar shop (prices live on the server: app_config 'avatar.shop').
 * Cosmetic id = avatar_<slot>_<base36 value>, e.g. avatar_acc_a.
 */
export const SHOP_ACCESSORIES = [10, 11, 12, 13, 14, 15, 16, 17] as const;
export const SHOP_BACKGROUNDS = [10, 11, 12, 13] as const;
export function cosmeticFor(slot: 'accessory' | 'bg', value: number): string | null {
  if (slot === 'accessory') return PREMIUM_ACCESSORIES[value] ?? (value >= 10 ? `avatar_acc_${value.toString(36)}` : null);
  return value >= 10 ? `avatar_bg_${value.toString(36)}` : null;
}

export const AVATAR_CODE_REGEX = /^av1_[0-9a-z]{12}$/;
const B36 = '0123456789abcdefghijklmnopqrstuvwxyz';

export const DEFAULT_AVATAR: AvatarSpec = {
  species: 0, skin: 2, face: 0, eyes: 1, brows: 1, mouth: 0, hair: 1, hairColor: 1,
  outfit: 1, outfitColor: 0, bg: 0, accessory: 0,
};

export function encodeAvatar(s: AvatarSpec): string {
  return 'av1_' + AVATAR_SLOTS.map(({ key, count }) => B36[clampSlot(s[key], count)]).join('');
}

export function decodeAvatar(code: string): AvatarSpec | null {
  if (!AVATAR_CODE_REGEX.test(code)) return null;
  const out = {} as AvatarSpec;
  for (let i = 0; i < AVATAR_SLOTS.length; i++) {
    const { key, count } = AVATAR_SLOTS[i]!;
    const v = B36.indexOf(code[4 + i]!);
    if (v < 0 || v >= count) return null;
    out[key] = v;
  }
  return out;
}

export function isAvatarCode(code: string): boolean {
  return decodeAvatar(code) !== null;
}

/** Legacy 'avatar_NN' ids become a matching custom avatar (same shirt color). */
export function legacyToSpec(avatarId: string): AvatarSpec {
  const n = Number(avatarId.replace('avatar_', '')) || 1;
  return { ...DEFAULT_AVATAR, outfitColor: (n - 1) % 12, bg: (n - 1) % 10, hair: (n * 5) % 14, skin: (n * 3) % 10 };
}

export function specFromAvatarId(avatarId: string): AvatarSpec {
  return decodeAvatar(avatarId) ?? legacyToSpec(avatarId);
}

/** A random avatar that never uses an earned accessory. */
export function randomAvatar(rand: () => number = Math.random): AvatarSpec {
  const out = {} as AvatarSpec;
  for (const { key, count } of AVATAR_SLOTS) out[key] = Math.floor(rand() * count);
  if (cosmeticFor('accessory', out.accessory)) out.accessory = 0;
  if (cosmeticFor('bg', out.bg)) out.bg = out.bg % 10;
  return out;
}

function clampSlot(v: number, count: number): number {
  return Number.isInteger(v) && v >= 0 && v < count ? v : 0;
}

// ---------------------------------------------------------------- palettes

export const AVATAR_SKIN = ['#FFE0C7', '#F6D3B8', '#EEC09B', '#E0A97F', '#C98D62', '#B27B52', '#97633F', '#7C4E31', '#603A24', '#47291A'];
export const AVATAR_FUR = ['#F29A4A', '#A86B3C', '#9AA3AD', '#F1D9B5', '#3A3F4A', '#FAFAF5', '#E3B04B', '#F7A8C4', '#7FB8F0', '#7CC56B'];
export const AVATAR_HAIR = ['#1E1A17', '#3B2A1E', '#6B4A2B', '#8A3B1E', '#D2662A', '#E6C67E', '#F3E9D2', '#8E8E8E', '#3F7CF0', '#FF6FB5', '#9B6BFF', '#2FBF71'];
export const AVATAR_OUTFIT = ['#FFB000', '#3DDC84', '#FF5A4E', '#7FD1FF', '#B49CFF', '#FF8A3D', '#F2F5EF', '#FF6FB5', '#2E3A59', '#C6E05A', '#5C7CFF', '#1E1A17'];
export const AVATAR_BG: ReadonlyArray<[string, string]> = [
  ['#FFE08A', '#FFB000'], ['#9FF0C1', '#3DDC84'], ['#FFB3AC', '#FF5A4E'], ['#BDE8FF', '#7FD1FF'], ['#DCD0FF', '#B49CFF'],
  ['#FFD0A8', '#FF8A3D'], ['#FFC6E3', '#FF6FB5'], ['#2A5A49', '#0B2B22'], ['#F7F3E8', '#D9CFB8'], ['#B8C3FF', '#5C7CFF'],
  // shop backgrounds: gold rays, galaxy, stadium lights, fire
  ['#FFF1A8', '#FFB000'], ['#5B3FA8', '#120B2E'], ['#1F5C45', '#06130F'], ['#FFD45A', '#E8371F'],
];

/** Extra art layered on the shop backgrounds. */
function bgDecor(bg: number): string {
  switch (bg) {
    case 10:
      return Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6, b = a + Math.PI / 14;
        return `<path d="M50 45 L${(50 + 90 * Math.cos(a)).toFixed(1)} ${(45 + 90 * Math.sin(a)).toFixed(1)} L${(50 + 90 * Math.cos(b)).toFixed(1)} ${(45 + 90 * Math.sin(b)).toFixed(1)} Z" fill="#FFF8D0" opacity="0.45"/>`;
      }).join('');
    case 11:
      return [[10, 12, 1.2], [24, 30, 0.8], [80, 10, 1.5], [90, 40, 0.9], [70, 24, 0.7], [14, 52, 1], [35, 8, 0.9], [62, 6, 1.1], [88, 78, 1.3], [8, 86, 0.9]]
        .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#FFF" opacity="0.9"/>`).join('') +
        `<path d="M84 22 l1.2 2.6 2.8 .3 -2.1 1.9 .6 2.8 -2.5 -1.4 -2.5 1.4 .6 -2.8 -2.1 -1.9 2.8 -.3 Z" fill="#FFE08A"/>` +
        `<ellipse cx="22" cy="20" rx="12" ry="5" fill="#B49CFF" opacity="0.35" transform="rotate(-20 22 20)"/>`;
    case 12:
      return `<path d="M4 0 L18 0 L52 100 L30 100 Z" fill="#FFFBE0" opacity="0.18"/><path d="M82 0 L96 0 L70 100 L48 100 Z" fill="#FFFBE0" opacity="0.18"/>` +
        `<rect x="2" y="2" width="16" height="7" rx="2" fill="#FFF8D0"/><rect x="82" y="2" width="16" height="7" rx="2" fill="#FFF8D0"/>` +
        `<path d="M0 88 Q50 80 100 88 L100 100 L0 100 Z" fill="#3DDC84" opacity="0.5"/>`;
    case 13:
      return `<path d="M0 100 L0 74 Q8 60 12 72 Q16 52 24 66 Q30 50 36 68 Q44 56 48 72 Q56 54 62 70 Q68 52 74 68 Q82 56 86 72 Q94 58 100 70 L100 100 Z" fill="#FF5A4E" opacity="0.75"/>` +
        `<path d="M0 100 L0 86 Q10 76 16 86 Q24 72 32 86 Q42 74 50 86 Q60 72 68 86 Q78 74 86 86 Q94 76 100 84 L100 100 Z" fill="#FFB000" opacity="0.8"/>`;
    default:
      return '';
  }
}

// ---------------------------------------------------------------- drawing

const INK = '#2B2420';

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  const f = (c: number) => Math.max(0, Math.min(255, Math.round(amt < 0 ? c * (1 + amt) : c + (255 - c) * amt)));
  const r = f((n >> 16) & 255), g = f((n >> 8) & 255), b = f(n & 255);
  return '#' + ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1);
}

const isHuman = (sp: Species) => sp === 'boy' || sp === 'girl';

function headShape(face: number, fill: string, stroke: string): string {
  const s = `fill="${fill}" stroke="${stroke}" stroke-width="1.6"`;
  switch (face) {
    case 1: return `<ellipse cx="50" cy="47" rx="23.5" ry="28.5" ${s}/>`;
    case 2: return `<rect x="24.5" y="20" width="51" height="55" rx="17" ${s}/>`;
    case 3: return `<path d="M24 42 Q24 19 50 19 Q76 19 76 42 Q76 63 50 76 Q24 63 24 42 Z" ${s}/>`;
    default: return `<ellipse cx="50" cy="47" rx="26" ry="27.5" ${s}/>`;
  }
}

function hairBack(style: number, c: string): string {
  const s = `fill="${c}" stroke="${shade(c, -0.35)}" stroke-width="1.4"`;
  switch (style) {
    case 4: return `<circle cx="50" cy="38" r="33" ${s}/>`;
    case 7: return `<path d="M21 42 Q19 15 50 14 Q81 15 79 42 L81 86 Q66 90 50 88 Q34 90 19 86 Z" ${s}/>`;
    case 8: return `<path d="M72 30 Q92 34 88 58 Q86 74 78 80 Q82 62 74 50 Z" ${s}/>`;
    case 9: return `<circle cx="27" cy="20" r="10" ${s}/><circle cx="73" cy="20" r="10" ${s}/>`;
    case 10: return `<path d="M21 44 Q19 14 50 13 Q81 14 79 44 L80 70 Q50 74 20 70 Z" ${s}/>`;
    case 11:
      return `<path d="M22 46 L19 84 L27 84 L29 46 Z" ${s}/><path d="M78 46 L81 84 L73 84 L71 46 Z" ${s}/>` +
        `<circle cx="23" cy="86" r="3.2" fill="${AVATAR_OUTFIT[0]}"/><circle cx="77" cy="86" r="3.2" fill="${AVATAR_OUTFIT[0]}"/>`;
    case 13: return `<circle cx="50" cy="13" r="8.5" ${s}/>`;
    default: return '';
  }
}

function hairFront(style: number, c: string): string {
  const s = `fill="${c}" stroke="${shade(c, -0.35)}" stroke-width="1.4" stroke-linejoin="round"`;
  const hi = shade(c, 0.35);
  switch (style) {
    case 0: return `<path d="M25 37 Q26 18 50 17 Q74 18 75 37 Q63 28 50 28 Q37 28 25 37 Z" ${s} opacity="0.9"/>`;
    case 1:
      return `<path d="M24 41 Q22 14 50 14 Q78 14 76 41 Q71 30 61 30 Q49 25 40 30 Q30 30 24 41 Z" ${s}/>` +
        `<path d="M38 20 Q46 17 54 19" stroke="${hi}" stroke-width="2" fill="none" stroke-linecap="round"/>`;
    case 2: return `<path d="M24 39 L21 22 L32 26 L33 11 L43 21 L50 6 L57 21 L67 11 L68 26 L79 22 L76 39 Q62 28 50 29 Q38 28 24 39 Z" ${s}/>`;
    case 3:
    case 4: {
      const r = style === 4 ? 10.5 : 8.5;
      const pts = [[27, 31], [33, 21], [43, 15], [55, 14], [66, 19], [73, 29]];
      return pts.map(([x, y]) => `<circle cx="${x}" cy="${y}" r="${r}" ${s}/>`).join('') +
        `<path d="M27 33 Q50 22 73 33 L73 26 Q50 14 27 26 Z" fill="${c}"/>`;
    }
    case 5:
      return `<path d="M24 43 Q20 13 52 12 Q81 14 76 40 Q72 25 56 23 Q40 29 24 43 Z" ${s}/>` +
        `<path d="M56 14 Q55 19 56 23" stroke="${shade(c, -0.45)}" stroke-width="1.4" fill="none"/>`;
    case 6:
      return `<path d="M25 37 Q26 18 50 17 Q74 18 75 37 Q63 28 50 28 Q37 28 25 37 Z" fill="${c}" opacity="0.45"/>` +
        `<path d="M43 29 Q42 9 50 3 Q58 9 57 29 Z" ${s}/>`;
    case 7: return `<path d="M23 45 Q22 14 50 13 Q78 14 77 45 Q71 27 50 26 Q29 27 23 45 Z" ${s}/>`;
    case 10: return `<path d="M23 44 Q22 14 50 13 Q78 14 77 44 L76 35 Q50 31 24 35 Z" ${s}/>`;
    case 11:
      return `<path d="M24 41 Q24 14 50 14 Q76 14 76 41 Q67 26 52 24 L50 17 L48 24 Q33 26 24 41 Z" ${s}/>`;
    case 12: return `<path d="M24 43 Q21 13 50 12 Q81 13 77 35 Q66 22 45 33 Q35 38 24 43 Z" ${s}/>`;
    default: // 8 ponytail, 9 buns, 13 man bun: slicked back
      return `<path d="M24 41 Q24 15 50 14 Q76 15 76 41 Q66 25 50 25 Q34 25 24 41 Z" ${s}/>` +
        `<path d="M36 22 Q50 18 64 22" stroke="${hi}" stroke-width="1.6" fill="none" stroke-linecap="round"/>`;
  }
}

/** Animals wear a small "topper" instead of hair (hair style picks it). */
function animalTopper(style: number, c: string, sp: Species): string {
  const k = style % 8;
  const top = sp === 'bunny' ? 22 : sp === 'frog' ? 24 : 20;
  const s = `stroke="${shade(c, -0.4)}" stroke-width="1.3"`;
  switch (k) {
    case 1: return `<path d="M46 ${top + 2} Q44 ${top - 8} 50 ${top - 10} Q48 ${top - 3} 54 ${top - 6} Q53 ${top} 54 ${top + 2} Z" fill="${c}" ${s}/>`;
    case 2:
      return `<path d="M50 ${top} L38 ${top - 7} L38 ${top + 7} Z M50 ${top} L62 ${top - 7} L62 ${top + 7} Z" fill="${c}" ${s} stroke-linejoin="round"/>` +
        `<circle cx="50" cy="${top}" r="3.2" fill="${shade(c, -0.15)}" ${s}/>`;
    case 3: {
      const petals = [0, 72, 144, 216, 288].map((a) => {
        const x = 64 + 5 * Math.cos((a * Math.PI) / 180), y = top + 4 + 5 * Math.sin((a * Math.PI) / 180);
        return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="3.6" fill="${c}" ${s}/>`;
      });
      return petals.join('') + `<circle cx="64" cy="${top + 4}" r="2.6" fill="#FFE08A"/>`;
    }
    case 4:
      return `<path d="M27 ${top + 14} Q27 ${top - 10} 50 ${top - 10} Q73 ${top - 10} 73 ${top + 14} Z" fill="${c}" ${s}/>` +
        `<rect x="25" y="${top + 9}" width="50" height="8" rx="4" fill="${shade(c, -0.18)}" ${s}/>` +
        `<circle cx="50" cy="${top - 12}" r="4.5" fill="${shade(c, 0.4)}" ${s}/>`;
    case 5:
      return `<path d="M26 ${top + 12} Q50 ${top} 74 ${top + 12} L74 ${top + 18} Q50 ${top + 7} 26 ${top + 18} Z" fill="${c}" ${s}/>` +
        `<path d="M74 ${top + 14} L84 ${top + 10} L82 ${top + 20} Z" fill="${c}" ${s}/>`;
    case 6:
      return `<path d="M36 ${top + 6} Q36 ${top - 6} 50 ${top - 6} Q64 ${top - 6} 64 ${top + 6} Z" fill="${c}" ${s}/>` +
        `<path d="M62 ${top + 6} L74 ${top + 7} Q72 ${top + 3} 63 ${top + 2} Z" fill="${shade(c, -0.2)}" ${s}/>`;
    case 7:
      return `<path d="M50 ${top + 2} Q40 ${top - 10} 52 ${top - 14} Q60 ${top - 4} 50 ${top + 2} Z" fill="#7CC56B" stroke="#3E7F35" stroke-width="1.3"/>`;
    default: return '';
  }
}

function eyesSvg(kind: number, y: number, lashes: boolean, sp: Species): string {
  const L = 40, R = 60;
  const big = (x: number) =>
    `<ellipse cx="${x}" cy="${y}" rx="5.4" ry="6" fill="#fff" stroke="${INK}" stroke-width="1.2"/>` +
    `<circle cx="${x + 0.6}" cy="${y + 0.8}" r="3.7" fill="${INK}"/><circle cx="${x + 1.9}" cy="${y - 0.9}" r="1.4" fill="#fff"/>`;
  const dot = (x: number) => `<circle cx="${x}" cy="${y}" r="3.3" fill="${INK}"/><circle cx="${x + 1.1}" cy="${y - 1.1}" r="1" fill="#fff"/>`;
  const arc = (x: number) => `<path d="M${x - 4.5} ${y + 1} Q${x} ${y - 4.5} ${x + 4.5} ${y + 1}" stroke="${INK}" stroke-width="2.2" fill="none" stroke-linecap="round"/>`;
  const lash = (x: number, dir: number) =>
    `<path d="M${x + dir * 4.6} ${y - 3.5} l${dir * 2.6} -2.2 M${x + dir * 3} ${y - 5.2} l${dir * 1.6} -2.6" stroke="${INK}" stroke-width="1.3" stroke-linecap="round"/>`;
  let out = '';
  switch (kind) {
    case 0: out = dot(L) + dot(R); break;
    case 2: out = arc(L) + arc(R); break;
    case 3: out = big(L) + arc(R); break;
    case 4:
      out = [L, R].map((x) =>
        `<path d="M${x - 4.8} ${y} A4.8 4.8 0 0 0 ${x + 4.8} ${y} Z" fill="${INK}"/>` +
        `<path d="M${x - 5.5} ${y - 0.2} L${x + 5.5} ${y - 0.2}" stroke="${INK}" stroke-width="1.8" stroke-linecap="round"/>`).join('');
      break;
    case 5:
      out = [L, R].map((x) => {
        const pts = Array.from({ length: 10 }, (_, i) => {
          const a = (Math.PI / 5) * i - Math.PI / 2, r = i % 2 ? 2.6 : 6;
          return `${(x + r * Math.cos(a)).toFixed(1)},${(y + r * Math.sin(a)).toFixed(1)}`;
        });
        return `<polygon points="${pts.join(' ')}" fill="#FFB000" stroke="${INK}" stroke-width="1" stroke-linejoin="round"/>`;
      }).join('');
      break;
    case 6: out = big(L) + big(R) + lash(L, -1) + lash(R, 1); lashes = false; break;
    case 7:
      out = dot(L) + dot(R) +
        `<path d="M${L - 5} ${y - 3.6} L${L + 4.5} ${y - 1.6} M${R + 5} ${y - 3.6} L${R - 4.5} ${y - 1.6}" stroke="${INK}" stroke-width="2" stroke-linecap="round"/>`;
      break;
    default: out = big(L) + big(R);
  }
  if (lashes && (kind === 0 || kind === 1 || kind === 3 || kind === 7)) out += lash(L, -1) + (kind === 3 ? '' : lash(R, 1));
  if (sp === 'owl') {
    out = `<circle cx="${L}" cy="${y}" r="9" fill="#FFF6DA" stroke="${INK}" stroke-width="1.2"/><circle cx="${R}" cy="${y}" r="9" fill="#FFF6DA" stroke="${INK}" stroke-width="1.2"/>` + out;
  }
  return out;
}

function browsSvg(kind: number, y: number, c: string): string {
  const st = (w: number) => `stroke="${c}" stroke-width="${w}" fill="none" stroke-linecap="round"`;
  switch (kind) {
    case 1: return `<path d="M34 ${y} L45 ${y}" ${st(2.2)}/><path d="M55 ${y} L66 ${y}" ${st(2.2)}/>`;
    case 2: return `<path d="M34 ${y + 1} Q39.5 ${y - 4} 45 ${y}" ${st(2.2)}/><path d="M55 ${y} Q60.5 ${y - 4} 66 ${y + 1}" ${st(2.2)}/>`;
    case 3: return `<path d="M34 ${y - 2} L45 ${y + 1.5}" ${st(2.6)}/><path d="M55 ${y + 1.5} L66 ${y - 2}" ${st(2.6)}/>`;
    case 4: return `<path d="M33.5 ${y} L45.5 ${y - 0.5}" ${st(4)}/><path d="M54.5 ${y - 0.5} L66.5 ${y}" ${st(4)}/>`;
    case 5: return `<path d="M35 ${y + 1} Q40 ${y - 3} 45 ${y - 0.5}" ${st(1.4)}/><path d="M55 ${y - 0.5} Q60 ${y - 3} 65 ${y + 1}" ${st(1.4)}/>`;
    default: return '';
  }
}

function mouthSvg(kind: number, y: number): string {
  const st = `stroke="${INK}" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"`;
  switch (kind) {
    case 1: return `<path d="M42 ${y - 1} Q50 ${y - 2} 58 ${y - 1} Q57 ${y + 7} 50 ${y + 7} Q43 ${y + 7} 42 ${y - 1} Z" fill="#fff" stroke="${INK}" stroke-width="1.6"/><path d="M42.6 ${y + 1.6} L57.4 ${y + 1.6}" stroke="${INK}" stroke-width="0.9"/>`;
    case 2: return `<path d="M42 ${y - 1} Q50 ${y - 2} 58 ${y - 1} Q57 ${y + 9} 50 ${y + 9} Q43 ${y + 9} 42 ${y - 1} Z" fill="#6B1F1A" stroke="${INK}" stroke-width="1.6"/><ellipse cx="50" cy="${y + 6.2}" rx="4.4" ry="2.4" fill="#FF7C88"/>`;
    case 3: return `<path d="M43 ${y + 1} Q50 ${y + 3} 57 ${y - 2}" ${st}/>`;
    case 4: return `<path d="M43 ${y} Q50 ${y + 5} 57 ${y}" ${st}/><path d="M47 ${y + 2.6} Q47 ${y + 8} 50.5 ${y + 8} Q54 ${y + 8} 54 ${y + 2.4}" fill="#FF7C88" stroke="${INK}" stroke-width="1.4"/>`;
    case 5: return `<ellipse cx="50" cy="${y + 1.5}" rx="3.2" ry="3.8" fill="#6B1F1A" stroke="${INK}" stroke-width="1.5"/>`;
    case 6: return `<path d="M43 ${y} Q46.5 ${y + 4} 50 ${y} Q53.5 ${y + 4} 57 ${y}" ${st}/>`;
    case 7: return `<path d="M44 ${y + 1} L56 ${y + 1}" ${st}/>`;
    default: return `<path d="M42 ${y} Q50 ${y + 7} 58 ${y}" ${st}/>`;
  }
}

function outfitSvg(kind: number, c: string, neck: string, uid: string): string {
  const dark = shade(c, -0.25), light = shade(c, 0.55), line = shade(c, -0.45);
  const body = `M12 101 Q13 81 34 76 L66 76 Q87 81 88 101 Z`;
  const base = `<path d="${body}" fill="${c}" stroke="${line}" stroke-width="1.6"/>`;
  const neckHole = `<path d="M41 76 Q50 86 59 76 Z" fill="${neck}" stroke="${line}" stroke-width="1.4"/>`;
  switch (kind) {
    case 1:
      return `<defs><clipPath id="sh${uid}"><path d="${body}"/></clipPath></defs>` + base +
        `<g clip-path="url(#sh${uid})" fill="${light}">` +
        [22, 36, 50, 64, 78].map((x) => `<rect x="${x - 3.5}" y="74" width="7" height="30"/>`).join('') +
        `</g><path d="${body}" fill="none" stroke="${line}" stroke-width="1.6"/>` +
        `<path d="M40 76 Q50 88 60 76" fill="${neck}" stroke="${dark}" stroke-width="3"/>`;
    case 2:
      return `<path d="M30 80 Q50 66 70 80 Q62 88 50 88 Q38 88 30 80 Z" fill="${dark}" stroke="${line}" stroke-width="1.4"/>` + base +
        `<path d="M40 77 Q50 90 60 77" fill="${neck}" stroke="${line}" stroke-width="1.4"/>` +
        `<path d="M45 86 L44 96 M55 86 L56 96" stroke="${light}" stroke-width="1.6" stroke-linecap="round"/>` +
        `<path d="M38 94 L62 94 L60 101 L40 101 Z" fill="${dark}"/>`;
    case 3:
      return base + neckHole +
        `<path d="M40 75 L50 84 L44 88 L36 79 Z M60 75 L50 84 L56 88 L64 79 Z" fill="${light}" stroke="${line}" stroke-width="1.2" stroke-linejoin="round"/>` +
        `<circle cx="50" cy="90" r="1.3" fill="${line}"/><circle cx="50" cy="95" r="1.3" fill="${line}"/>`;
    case 4:
      return base +
        `<path d="M40 76 L50 82 L60 76 L60 73 L40 73 Z" fill="${dark}" stroke="${line}" stroke-width="1.2"/>` +
        `<path d="M50 82 L50 101" stroke="${line}" stroke-width="1.6"/>` +
        `<path d="M18 92 Q22 82 34 78 M82 92 Q78 82 66 78" stroke="#fff" stroke-width="2.4" fill="none" opacity="0.9"/>`;
    case 5:
      return `<defs><clipPath id="gk${uid}"><path d="${body}"/></clipPath></defs>` + base +
        `<g clip-path="url(#gk${uid})" fill="${dark}">` +
        [20, 34, 48, 62, 76].map((x, i) => `<rect x="${x}" y="${86 + (i % 2) * 5}" width="7" height="7" transform="rotate(45 ${x + 3.5} ${89 + (i % 2) * 5})"/>`).join('') +
        `</g>` + `<path d="M40 76 Q50 84 60 76" fill="${neck}" stroke="${line}" stroke-width="2.6"/>`;
    default:
      return base + `<path d="M40 76 Q50 87 60 76" fill="${neck}" stroke="${dark}" stroke-width="2.6"/>`;
  }
}

function accessorySvg(kind: number, eyeY: number, sp: Species, outfit: string): string {
  const human = isHuman(sp);
  switch (kind) {
    case 1:
      return `<g fill="rgba(255,255,255,0.18)" stroke="${INK}" stroke-width="1.8"><circle cx="40" cy="${eyeY}" r="7.4"/><circle cx="60" cy="${eyeY}" r="7.4"/></g>` +
        `<path d="M47.4 ${eyeY - 1} Q50 ${eyeY - 3} 52.6 ${eyeY - 1}" stroke="${INK}" stroke-width="1.8" fill="none"/>`;
    case 2:
      return `<path d="M24.5 31 Q50 22 75.5 31 L75.5 37 Q50 28 24.5 37 Z" fill="${outfit}" stroke="${shade(outfit, -0.45)}" stroke-width="1.3"/>` +
        `<path d="M25 34 Q50 25.4 75 34" stroke="#fff" stroke-width="1.3" fill="none" opacity="0.85"/>`;
    case 3:
      return `<path d="M25 33 Q25 10 50 10 Q75 10 75 33 Z" fill="${outfit}" stroke="${shade(outfit, -0.45)}" stroke-width="1.5"/>` +
        `<path d="M25 31 Q14 31 13 35 Q20 37 27 35 Z" fill="${shade(outfit, -0.2)}" stroke="${shade(outfit, -0.45)}" stroke-width="1.3"/>` +
        `<circle cx="50" cy="10.5" r="2" fill="${shade(outfit, -0.3)}"/><path d="M50 12 L50 32 M37 14 Q41 23 40 33 M63 14 Q59 23 60 33" stroke="${shade(outfit, -0.3)}" stroke-width="0.9" fill="none"/>`;
    case 4: {
      const y = human ? 56 : 44, xl = human ? 24 : 27, xr = human ? 76 : 73;
      return `<circle cx="${xl}" cy="${y}" r="2.6" fill="#FFD34D" stroke="#B87A00" stroke-width="1"/><circle cx="${xr}" cy="${y}" r="2.6" fill="#FFD34D" stroke="#B87A00" stroke-width="1"/>`;
    }
    case 5:
      return [[33, 56], [36, 59], [31, 60], [67, 56], [64, 59], [69, 60]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="0.95" fill="#9A5A3A"/>`).join('');
    case 6:
      return `<g stroke-linecap="round" stroke-width="2.6"><path d="M30 56 L37 56" stroke="${outfit}"/><path d="M30 60 L37 60" stroke="#fff"/>` +
        `<path d="M63 56 L70 56" stroke="${outfit}"/><path d="M63 60 L70 60" stroke="#fff"/></g>`;
    case 7:
      return `<path d="M38 77 Q44 90 52 92" stroke="#E9E9E9" stroke-width="1.6" fill="none"/><path d="M62 77 Q58 88 53 92" stroke="#E9E9E9" stroke-width="1.6" fill="none"/>` +
        `<rect x="50" y="90" width="9" height="5.6" rx="2.6" fill="#C9CED6" stroke="#5C6470" stroke-width="1.1"/><circle cx="56.4" cy="92.8" r="1.4" fill="#5C6470"/>`;
    case 8:
      return `<path d="M30 ${eyeY - 5} L48 ${eyeY - 5} L46.5 ${eyeY + 4} Q39 ${eyeY + 7} 32 ${eyeY + 4} Z M52 ${eyeY - 5} L70 ${eyeY - 5} L68 ${eyeY + 4} Q61 ${eyeY + 7} 53.5 ${eyeY + 4} Z" fill="#141414" stroke="#000" stroke-width="1.2" stroke-linejoin="round"/>` +
        `<path d="M48 ${eyeY - 3.6} L52 ${eyeY - 3.6}" stroke="#141414" stroke-width="2.2"/>` +
        `<path d="M34 ${eyeY - 2.6} L38 ${eyeY + 2} M56 ${eyeY - 2.6} L60 ${eyeY + 2}" stroke="#fff" stroke-width="1.4" opacity="0.55" stroke-linecap="round"/>`;
    case 9:
      return `<path d="M33 22 L35 6 L42.5 14 L50 3 L57.5 14 L65 6 L67 22 Z" fill="#FFC93C" stroke="#A86F00" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<rect x="33" y="19" width="34" height="5" rx="2" fill="#FFB000" stroke="#A86F00" stroke-width="1.3"/>` +
        `<circle cx="50" cy="12" r="2.2" fill="#FF5A4E"/><circle cx="41" cy="21.5" r="1.6" fill="#7FD1FF"/><circle cx="59" cy="21.5" r="1.6" fill="#3DDC84"/>`;
    case 10: // headphones
      return `<path d="M22 46 Q20 10 50 10 Q80 10 78 46" fill="none" stroke="${INK}" stroke-width="4.5" stroke-linecap="round"/>` +
        `<path d="M22 46 Q20 10 50 10 Q80 10 78 46" fill="none" stroke="${outfit}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<rect x="15" y="40" width="11" height="18" rx="5" fill="${outfit}" stroke="${INK}" stroke-width="1.6"/>` +
        `<rect x="74" y="40" width="11" height="18" rx="5" fill="${outfit}" stroke="${INK}" stroke-width="1.6"/>` +
        `<rect x="17.5" y="44" width="3" height="10" rx="1.5" fill="#fff" opacity="0.6"/>`;
    case 11: { // striped scarf
      const st = shade(outfit, 0.6);
      return `<path d="M33 72 Q50 82 67 72 L69 79 Q50 90 31 79 Z" fill="${outfit}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<path d="M58 80 L64 99 L72 97 L66 78 Z" fill="${outfit}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<path d="M40 77 L42 84 M50 79 L50 86 M60 77 L58 84 M61 86 L68 84 M63 92 L70 90" stroke="${st}" stroke-width="2.2"/>`;
    }
    case 12: { // star glasses
      const star = (cx: number) => Array.from({ length: 10 }, (_, i) => {
        const a = (Math.PI / 5) * i - Math.PI / 2, r = i % 2 ? 4.4 : 9.5;
        return `${(cx + r * Math.cos(a)).toFixed(1)},${(eyeY + 0.5 + r * Math.sin(a)).toFixed(1)}`;
      }).join(' ');
      return `<polygon points="${star(40)}" fill="#FFC93C" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` +
        `<polygon points="${star(60)}" fill="#FFC93C" stroke="${INK}" stroke-width="1.4" stroke-linejoin="round"/>` +
        `<circle cx="40" cy="${eyeY + 0.5}" r="3.4" fill="#2B2420" opacity="0.85"/><circle cx="60" cy="${eyeY + 0.5}" r="3.4" fill="#2B2420" opacity="0.85"/>` +
        `<path d="M48.5 ${eyeY - 1} L51.5 ${eyeY - 1}" stroke="${INK}" stroke-width="2"/>`;
    }
    case 13: // bucket hat
      return `<path d="M28 30 Q28 10 50 10 Q72 10 72 30 Z" fill="${outfit}" stroke="${INK}" stroke-width="1.6"/>` +
        `<path d="M16 34 Q50 22 84 34 Q84 38 78 38 Q50 30 22 38 Q16 38 16 34 Z" fill="${shade(outfit, -0.15)}" stroke="${INK}" stroke-width="1.6" stroke-linejoin="round"/>` +
        `<path d="M29 26 Q50 22 71 26" stroke="${shade(outfit, 0.5)}" stroke-width="2" fill="none"/>`;
    case 14: // hero mask
      return `<path d="M26 ${eyeY - 7} Q50 ${eyeY - 11} 74 ${eyeY - 7} L72 ${eyeY + 6} Q60 ${eyeY + 9} 50 ${eyeY + 3} Q40 ${eyeY + 9} 28 ${eyeY + 6} Z ` +
        `M35 ${eyeY} a5 4.5 0 1 0 10 0 a5 4.5 0 1 0 -10 0 Z M55 ${eyeY} a5 4.5 0 1 0 10 0 a5 4.5 0 1 0 -10 0 Z" fill="${outfit}" fill-rule="evenodd" stroke="${INK}" stroke-width="1.4"/>` +
        `<path d="M74 ${eyeY - 5} L84 ${eyeY - 9} M74 ${eyeY} L85 ${eyeY + 1}" stroke="${outfit}" stroke-width="2.6" stroke-linecap="round"/>`;
    case 15: // halo
      return `<ellipse cx="50" cy="8" rx="16" ry="4.5" fill="none" stroke="#FFE08A" stroke-width="3.4"/>` +
        `<ellipse cx="50" cy="8" rx="16" ry="4.5" fill="none" stroke="#FFF8D0" stroke-width="1.2"/>`;
    case 16: { // bandana
      const dots = [[34, 28], [44, 24.5], [56, 24.5], [66, 28]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.3" fill="#fff"/>`).join('');
      return `<path d="M24 34 Q24 16 50 16 Q76 16 76 34 Q50 24 24 34 Z" fill="${outfit}" stroke="${INK}" stroke-width="1.5"/>` + dots +
        `<path d="M75 31 L86 26 L83 36 Z M75 31 L87 34 L80 40 Z" fill="${outfit}" stroke="${INK}" stroke-width="1.3" stroke-linejoin="round"/>`;
    }
    case 17: // party hat
      return `<g transform="rotate(8 52 12)"><path d="M38 22 L53 0 L66 20 Z" fill="${outfit}" stroke="${INK}" stroke-width="1.5" stroke-linejoin="round"/>` +
        `<path d="M45 13 L59 10 M49 6 L56 4.5" stroke="#fff" stroke-width="2"/>` +
        `<circle cx="53" cy="0.5" r="3.6" fill="#FFC93C" stroke="${INK}" stroke-width="1.2"/></g>`;
    default: return '';
  }
}

/** Ears/head/muzzle for each animal. Returns [behindHead, head, onFace, eyeY, mouthY, browY]. */
function animalParts(sp: Species, fur: string, hair: string, face: number): [string, string, string, number, number, number] {
  const line = shade(fur, -0.45), lt = shade(fur, 0.55), dk = shade(fur, -0.22);
  const st = `stroke="${line}" stroke-width="1.6" stroke-linejoin="round"`;
  const earScale = 1 + face * 0.08;
  const head = (rx = 27, ry = 25, cy = 49) => `<ellipse cx="50" cy="${cy}" rx="${rx}" ry="${ry}" fill="${fur}" ${st}/>`;
  const nose = (y: number, c = '#3A2A2A') => `<path d="M46.5 ${y} Q50 ${y - 1.4} 53.5 ${y} Q52 ${y + 3} 50 ${y + 3} Q48 ${y + 3} 46.5 ${y} Z" fill="${c}"/>`;
  const muzzle = (c: string, y = 58) => `<ellipse cx="50" cy="${y}" rx="10.5" ry="7.5" fill="${c}"/>`;
  const sc = (path: string, cx: number, cy: number) => `<g transform="translate(${cx} ${cy}) scale(${earScale}) translate(${-cx} ${-cy})">${path}</g>`;
  switch (sp) {
    case 'cat':
      return [
        sc(`<path d="M27 36 L25 13 L44 27 Z" fill="${fur}" ${st}/><path d="M30 31 L29 19 L39 27 Z" fill="#FFB8C8"/>`, 32, 28) +
        sc(`<path d="M73 36 L75 13 L56 27 Z" fill="${fur}" ${st}/><path d="M70 31 L71 19 L61 27 Z" fill="#FFB8C8"/>`, 68, 28),
        head(),
        muzzle(lt, 58) + nose(55, '#FF8FA8') +
        `<path d="M26 56 L37 57 M26 61 L37 59.5 M74 56 L63 57 M74 61 L63 59.5" stroke="${line}" stroke-width="1" stroke-linecap="round"/>`,
        47, 60, 38,
      ];
    case 'dog':
      return [
        '',
        head(26, 25),
        sc(`<path d="M26 30 Q14 34 17 56 Q20 62 27 56 Q30 44 30 34 Z" fill="${dk}" ${st}/>`, 24, 40) +
        sc(`<path d="M74 30 Q86 34 83 56 Q80 62 73 56 Q70 44 70 34 Z" fill="${dk}" ${st}/>`, 76, 40) +
        muzzle(lt, 59) + nose(54),
        46, 61, 37,
      ];
    case 'bear':
      return [
        sc(`<circle cx="29" cy="27" r="8.5" fill="${fur}" ${st}/><circle cx="29" cy="27" r="4.4" fill="${lt}"/>`, 29, 27) +
        sc(`<circle cx="71" cy="27" r="8.5" fill="${fur}" ${st}/><circle cx="71" cy="27" r="4.4" fill="${lt}"/>`, 71, 27),
        head(),
        muzzle(lt, 59) + nose(55),
        46, 61, 37,
      ];
    case 'fox':
      return [
        sc(`<path d="M25 38 L22 9 L45 26 Z" fill="${fur}" ${st}/><path d="M28 32 L26 16 L39 26 Z" fill="${INK}" opacity="0.7"/>`, 32, 26) +
        sc(`<path d="M75 38 L78 9 L55 26 Z" fill="${fur}" ${st}/><path d="M72 32 L74 16 L61 26 Z" fill="${INK}" opacity="0.7"/>`, 68, 26),
        `<path d="M22 44 Q24 24 50 23 Q76 24 78 44 Q78 64 50 75 Q22 64 22 44 Z" fill="${fur}" ${st}/>`,
        `<path d="M24 50 Q36 52 50 70 Q64 52 76 50 Q74 66 50 75 Q26 66 24 50 Z" fill="#FFF8EE"/>` + nose(59),
        46, 64, 37,
      ];
    case 'panda':
      return [
        sc(`<circle cx="29" cy="27" r="8.5" fill="${INK}"/>`, 29, 27) + sc(`<circle cx="71" cy="27" r="8.5" fill="${INK}"/>`, 71, 27),
        `<ellipse cx="50" cy="49" rx="27" ry="25" fill="#FAFAF5" stroke="#555" stroke-width="1.6"/>`,
        `<ellipse cx="39" cy="47" rx="7.5" ry="9" fill="${fur === '#FAFAF5' ? INK : fur}" transform="rotate(25 39 47)"/>` +
        `<ellipse cx="61" cy="47" rx="7.5" ry="9" fill="${fur === '#FAFAF5' ? INK : fur}" transform="rotate(-25 61 47)"/>` + nose(56),
        47, 61, 36,
      ];
    case 'bunny':
      return [
        sc(`<ellipse cx="38" cy="16" rx="7" ry="18" fill="${fur}" ${st} transform="rotate(-10 38 16)"/><ellipse cx="38" cy="17" rx="3.4" ry="12" fill="#FFB8C8" transform="rotate(-10 38 17)"/>`, 38, 30) +
        sc(`<ellipse cx="62" cy="16" rx="7" ry="18" fill="${fur}" ${st} transform="rotate(10 62 16)"/><ellipse cx="62" cy="17" rx="3.4" ry="12" fill="#FFB8C8" transform="rotate(10 62 17)"/>`, 62, 30),
        head(26, 25, 51),
        nose(56, '#FF8FA8') + `<path d="M48 62 L48 65.5 M52 62 L52 65.5" stroke="${INK}" stroke-width="1.3"/>`,
        48, 60, 39,
      ];
    case 'lion': {
      const mane = Array.from({ length: 14 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 14;
        return `<circle cx="${(50 + 30 * Math.cos(a)).toFixed(1)}" cy="${(49 + 29 * Math.sin(a)).toFixed(1)}" r="9.5"/>`;
      }).join('');
      return [
        `<g fill="${hair}" stroke="${shade(hair, -0.4)}" stroke-width="1.4">${mane}</g><circle cx="50" cy="49" r="30" fill="${hair}"/>` +
        `<circle cx="30" cy="28" r="6" fill="${fur}" ${st}/><circle cx="70" cy="28" r="6" fill="${fur}" ${st}/>`,
        head(25, 24),
        muzzle(lt, 59) + nose(55),
        46, 61, 37,
      ];
    }
    case 'frog':
      return [
        `<circle cx="37" cy="33" r="11" fill="${fur}" ${st}/><circle cx="63" cy="33" r="11" fill="${fur}" ${st}/>`,
        `<ellipse cx="50" cy="52" rx="30" ry="22" fill="${fur}" ${st}/>`,
        `<ellipse cx="34" cy="60" rx="4.5" ry="3" fill="#FF9AAE" opacity="0.6"/><ellipse cx="66" cy="60" rx="4.5" ry="3" fill="#FF9AAE" opacity="0.6"/>`,
        34, 59, 24,
      ];
    case 'penguin':
      return [
        '',
        `<ellipse cx="50" cy="48" rx="27" ry="27" fill="${fur === '#FAFAF5' ? '#2E3440' : fur}" stroke="#222" stroke-width="1.6"/>`,
        `<path d="M27 52 Q28 30 40 32 Q50 36 50 40 Q50 36 60 32 Q72 30 73 52 Q70 72 50 74 Q30 72 27 52 Z" fill="#FAFAF5"/>` +
        `<path d="M44 56 L56 56 L50 63 Z" fill="#FFB000" stroke="#A86F00" stroke-width="1.2" stroke-linejoin="round"/>`,
        47, 66, 37,
      ];
    case 'owl':
      return [
        `<path d="M25 34 L24 16 L38 27 Z M75 34 L76 16 L62 27 Z" fill="${dk}" ${st}/>`,
        `<ellipse cx="50" cy="50" rx="27" ry="26" fill="${fur}" ${st}/>`,
        `<path d="M46 55 L54 55 L50 62 Z" fill="#FFB000" stroke="#A86F00" stroke-width="1.2" stroke-linejoin="round"/>` +
        `<path d="M40 67 l3 3 l3 -3 M54 67 l3 3 l3 -3" stroke="${dk}" stroke-width="1.4" fill="none"/>`,
        46, 66, 34,
      ];
    default:
      return ['', head(), '', 47, 60, 38];
  }
}

/**
 * Renders the avatar as a self-contained SVG string (viewBox 0 0 100 100).
 * `uid` keeps gradient/clip ids unique when many avatars share a screen.
 */
export function avatarSvg(spec: AvatarSpec, opts: { size?: number; uid?: string; round?: boolean } = {}): string {
  const size = opts.size ?? 100;
  const uid = (opts.uid ?? encodeAvatar(spec).slice(4)).replace(/[^a-z0-9]/gi, '');
  const sp = SPECIES[spec.species] ?? 'boy';
  const human = isHuman(sp);
  const skin = human ? AVATAR_SKIN[spec.skin]! : AVATAR_FUR[spec.skin]!;
  const hair = AVATAR_HAIR[spec.hairColor]!;
  const outfit = AVATAR_OUTFIT[spec.outfitColor]!;
  const [bg1, bg2] = AVATAR_BG[spec.bg]!;
  const line = shade(skin, -0.45);

  const parts: string[] = [];
  parts.push(
    `<defs><radialGradient id="bg${uid}" cx="50%" cy="35%" r="75%"><stop offset="0" stop-color="${bg1}"/><stop offset="1" stop-color="${bg2}"/></radialGradient>` +
    (opts.round ? `<clipPath id="rc${uid}"><circle cx="50" cy="50" r="50"/></clipPath>` : '') + `</defs>`,
  );
  parts.push(`<g${opts.round ? ` clip-path="url(#rc${uid})"` : ''}>`);
  parts.push(`<rect width="100" height="100" fill="url(#bg${uid})"/>`);
  parts.push(bgDecor(spec.bg));
  // confetti dots — a little stadium-night sparkle
  parts.push(
    [[12, 14, 2], [86, 20, 1.6], [16, 70, 1.4], [88, 64, 2.2], [76, 8, 1.2]]
      .map(([x, y, r]) => `<circle cx="${x}" cy="${y}" r="${r}" fill="#fff" opacity="0.45"/>`).join(''),
  );

  let eyeY = 47, mouthY = 60, browY = 38;
  if (human) {
    parts.push(hairBack(spec.hair, hair));
    parts.push(outfitSvg(spec.outfit, outfit, skin, uid));
    parts.push(`<path d="M43 64 L43 79 Q50 83 57 79 L57 64 Z" fill="${shade(skin, -0.08)}" stroke="${line}" stroke-width="1.4"/>`);
    parts.push(`<ellipse cx="24.5" cy="50" rx="4.5" ry="6" fill="${skin}" stroke="${line}" stroke-width="1.4"/><ellipse cx="75.5" cy="50" rx="4.5" ry="6" fill="${skin}" stroke="${line}" stroke-width="1.4"/>`);
    parts.push(headShape(spec.face, skin, line));
    parts.push(`<path d="M48.5 53 Q50 56 52 53.6" stroke="${line}" stroke-width="1.5" fill="none" stroke-linecap="round"/>`);
  } else {
    const [behind, head, onFace, ey, my, by] = animalParts(sp, skin, hair, spec.face);
    eyeY = ey; mouthY = my; browY = by;
    parts.push(outfitSvg(spec.outfit, outfit, skin, uid));
    parts.push(`<path d="M42 66 L42 79 Q50 83 58 79 L58 66 Z" fill="${shade(skin, -0.08)}" stroke="${line}" stroke-width="1.4"/>`);
    parts.push(behind);
    parts.push(head);
    parts.push(onFace);
  }
  // cheeks
  parts.push(`<ellipse cx="33" cy="${mouthY - 2}" rx="4.6" ry="2.8" fill="#FF7C88" opacity="${sp === 'girl' ? 0.45 : 0.28}"/><ellipse cx="67" cy="${mouthY - 2}" rx="4.6" ry="2.8" fill="#FF7C88" opacity="${sp === 'girl' ? 0.45 : 0.28}"/>`);
  if (human) parts.push(hairFront(spec.hair, hair));
  else if (sp !== 'lion') parts.push(animalTopper(spec.hair, hair, sp));
  parts.push(eyesSvg(spec.eyes, eyeY, sp === 'girl', sp));
  parts.push(browsSvg(spec.brows, browY, human ? shade(hair, -0.2) : shade(skin, -0.5)));
  if (sp !== 'penguin' && sp !== 'owl') parts.push(mouthSvg(spec.mouth, mouthY));
  parts.push(accessorySvg(spec.accessory, eyeY, sp, outfit));
  parts.push('</g>');
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 100 100">${parts.join('')}</svg>`;
}
