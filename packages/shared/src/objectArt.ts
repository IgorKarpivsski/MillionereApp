/**
 * Illustrations for the object albums — stadiums, shirts, balls, fictional club
 * crests and fan merch. Every picture is drawn here in code: original, no real
 * clubs, kits, logos or text. viewBox 0 0 100 125 (the sticker art window).
 *
 * objectSvg('stadiums_03', 'common', 120) → '<svg …>'
 */

type Rarity = 'common' | 'uncommon' | 'rare' | 'epic' | 'legendary' | 'iconic';

const INK = '#14110F';
const W = '#FFF8EA';
const S = (w = 2) => `stroke="${INK}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;

const ALBUM_BG: Record<string, [string, string]> = {
  stadiums: ['#BDE8FF', '#7FD1FF'],
  shirts: ['#FFE08A', '#FFB000'],
  balls: ['#9FF0C1', '#3DDC84'],
  clubs: ['#B8C3FF', '#5C7CFF'],
  merch: ['#FFC6E3', '#FF6FB5'],
};

function dots(color: string, opacity: number): string {
  let out = '';
  for (let y = 6; y < 125; y += 9) for (let x = (y / 9) % 2 ? 6 : 10.5; x < 100; x += 9) out += `<circle cx="${x}" cy="${y}" r="1.6"/>`;
  return `<g fill="${color}" opacity="${opacity}">${out}</g>`;
}

function rays(cx: number, cy: number, n: number, color: string, opacity: number): string {
  return Array.from({ length: n }, (_, i) => {
    const a = (i * 2 * Math.PI) / n, b = a + Math.PI / n;
    return `<path d="M${cx} ${cy} L${(cx + 140 * Math.cos(a)).toFixed(1)} ${(cy + 140 * Math.sin(a)).toFixed(1)} L${(cx + 140 * Math.cos(b)).toFixed(1)} ${(cy + 140 * Math.sin(b)).toFixed(1)} Z" fill="${color}" opacity="${opacity}"/>`;
  }).join('');
}

function sparkle(x: number, y: number, r: number, c = '#FFFFFF'): string {
  return `<path d="M${x} ${y - r} Q${x + r * 0.18} ${y - r * 0.18} ${x + r} ${y} Q${x + r * 0.18} ${y + r * 0.18} ${x} ${y + r} Q${x - r * 0.18} ${y + r * 0.18} ${x - r} ${y} Q${x - r * 0.18} ${y - r * 0.18} ${x} ${y - r} Z" fill="${c}"/>`;
}

function star(cx: number, cy: number, r: number, fill: string, stroke = true): string {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5, rr = i % 2 ? r * 0.45 : r;
    return `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  }).join(' ');
  return `<polygon points="${pts}" fill="${fill}" ${stroke ? S(1.2) : ''}/>`;
}

/** Background by rarity: the rarer, the louder. */
function background(album: string, rarity: Rarity, uid: string): string {
  const [a, b] = ALBUM_BG[album] ?? ['#DDD', '#AAA'];
  const grad = (c1: string, c2: string) =>
    `<defs><radialGradient id="bg${uid}" cx="50%" cy="40%" r="75%"><stop offset="0" stop-color="${c1}"/><stop offset="1" stop-color="${c2}"/></radialGradient></defs><rect width="100" height="125" fill="url(#bg${uid})"/>`;
  switch (rarity) {
    case 'common':
      return grad(a, b) + dots('#FFFFFF', 0.25);
    case 'uncommon':
      return grad(a, b) + rays(50, 60, 14, '#FFFFFF', 0.18) + dots('#FFFFFF', 0.18);
    case 'rare':
      return grad('#FFFFFF', b) + rays(50, 60, 18, '#FFFFFF', 0.3) + sparkle(14, 16, 4) + sparkle(86, 108, 5);
    case 'epic':
      return grad('#B49CFF', '#2A145E') + rays(50, 60, 18, '#E6DCFF', 0.14) + sparkle(14, 18, 4) + sparkle(84, 14, 3) + sparkle(88, 104, 5, '#FFE08A');
    case 'legendary':
      return grad('#FFF1A8', '#E08A00') + rays(50, 60, 20, '#FFFDE8', 0.4) + sparkle(14, 16, 5) + sparkle(86, 20, 4) + sparkle(84, 108, 5) + sparkle(16, 104, 3);
    case 'iconic':
      return grad('#5B3FA8', '#0B0620') +
        `<path d="M-10 110 Q50 40 110 110" fill="none" stroke="#FF6FB5" stroke-width="5" opacity="0.5"/><path d="M-10 116 Q50 46 110 116" fill="none" stroke="#FFC93C" stroke-width="5" opacity="0.5"/><path d="M-10 122 Q50 52 110 122" fill="none" stroke="#7FD1FF" stroke-width="5" opacity="0.5"/>` +
        [[10, 12], [26, 30], [80, 10], [90, 40], [70, 22], [14, 70], [36, 8], [62, 6], [88, 78]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 2 ? 0.9 : 1.4}" fill="#FFF"/>`).join('') +
        sparkle(84, 24, 5, '#FFE08A') + sparkle(16, 40, 4);
  }
}

// ------------------------------------------------------------------ balls
function classicBall(cx: number, cy: number, r: number, base = W, panel = INK): string {
  const p = (a: number, rr: number) => `${(cx + rr * Math.cos(a)).toFixed(1)},${(cy + rr * Math.sin(a)).toFixed(1)}`;
  const pent = Array.from({ length: 5 }, (_, i) => p(-Math.PI / 2 + (i * 2 * Math.PI) / 5, r * 0.4)).join(' ');
  const spokes = Array.from({ length: 5 }, (_, i) => {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    return `M${p(a, r * 0.4)} L${p(a, r * 0.98)}`;
  }).join(' ');
  return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${base}" ${S(2.4)}/><polygon points="${pent}" fill="${panel}"/>` +
    `<path d="${spokes}" stroke="${panel}" stroke-width="1.8"/>` +
    `<path d="M${cx - r * 0.55} ${cy - r * 0.6} Q${cx - r * 0.15} ${cy - r * 0.9} ${cx + r * 0.2} ${cy - r * 0.82}" stroke="#FFF" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.85"/>`;
}

function ballArt(n: number): string {
  const cx = 50, cy = 64, r = 26;
  switch (n) {
    case 1:
      return `<ellipse cx="50" cy="96" rx="26" ry="5" fill="${INK}" opacity="0.2"/>` +
        `<path d="M27 62 Q26 40 48 37 Q72 35 75 58 Q78 84 52 90 Q28 92 27 62 Z" fill="#C9B08A" ${S(2.4)}/>` +
        `<path d="M34 50 Q46 46 58 52 L54 62 Q44 58 36 60 Z" fill="#7FD1FF" ${S(1.5)}/><path d="M44 70 Q56 66 68 72 L64 82 Q54 78 46 80 Z" fill="#FF6FB5" ${S(1.5)}/>` +
        `<path d="M30 66 Q50 58 74 62 M40 40 Q46 62 44 88 M60 38 Q64 62 58 88" stroke="${INK}" stroke-width="1.4" fill="none" stroke-dasharray="3 2"/>`;
    case 2:
      return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#A0582A" ${S(2.4)}/>` +
        `<path d="M${cx - r} ${cy} Q${cx} ${cy - 12} ${cx + r} ${cy} M${cx - r + 4} ${cy + 12} Q${cx} ${cy + 2} ${cx + r - 4} ${cy + 12} M${cx} ${cy - r} Q${cx - 8} ${cy} ${cx} ${cy + r}" stroke="#5B2E12" stroke-width="2" fill="none"/>` +
        `<path d="M44 42 L56 42 M44 46 L56 46 M44 50 L56 50 M45 41 L55 51 M55 41 L45 51" stroke="#F6E2C0" stroke-width="1.8"/>` +
        `<path d="M34 50 Q40 44 46 43" stroke="#F6C9A0" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    case 3:
      return `<ellipse cx="50" cy="96" rx="22" ry="4" fill="${INK}" opacity="0.2"/>` + classicBall(cx, cy, r);
    case 4: {
      const cols = ['#FF5A4E', '#FFF8EA', '#FFC93C', '#FFF8EA', '#3F7CF0', '#FFF8EA'];
      const wedges = cols.map((c, i) => {
        const a0 = (i * Math.PI) / 3 - Math.PI / 2, a1 = a0 + Math.PI / 3;
        return `<path d="M${cx} ${cy} L${(cx + r * Math.cos(a0)).toFixed(1)} ${(cy + r * Math.sin(a0)).toFixed(1)} A${r} ${r} 0 0 1 ${(cx + r * Math.cos(a1)).toFixed(1)} ${(cy + r * Math.sin(a1)).toFixed(1)} Z" fill="${c}"/>`;
      }).join('');
      return `<rect x="0" y="94" width="100" height="31" fill="#F6D9A0"/><path d="M0 92 Q25 86 50 92 Q75 98 100 92 L100 96 L0 96 Z" fill="#3B95C4"/>` +
        wedges + `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" ${S(2.4)}/><circle cx="${cx}" cy="${cy}" r="4" fill="${W}" ${S(1.4)}/>` +
        `<path d="M34 50 Q40 43 47 42" stroke="#FFF" stroke-width="3" fill="none" stroke-linecap="round"/>`;
    }
    case 5: {
      const bricks = Array.from({ length: 8 }, (_, row) => Array.from({ length: 6 }, (_, col) =>
        `<rect x="${col * 18 - (row % 2 ? 9 : 0)}" y="${row * 12}" width="17" height="11" fill="#C0582A" opacity="0.45"/>`).join('')).join('');
      return bricks + classicBall(cx, cy, r, '#E8E2D0', '#3A3F4A') +
        `<rect x="30" y="58" width="22" height="6" fill="#9AA3AD" opacity="0.9" transform="rotate(-25 41 61)" ${S(1)}/>` +
        `<rect x="52" y="70" width="18" height="6" fill="#9AA3AD" opacity="0.9" transform="rotate(20 61 73)" ${S(1)}/>` +
        `<path d="M24 92 L30 86 M72 40 L80 34 M78 46 L86 44" ${S(2)}/>`;
    }
    case 6: {
      const flakes = ([[16, 20], [80, 16], [24, 44], [86, 52], [12, 80], [88, 88]] as [number, number][]).map(([x, y]) =>
        `<path d="M${x - 4} ${y} L${x + 4} ${y} M${x} ${y - 4} L${x} ${y + 4} M${x - 3} ${y - 3} L${x + 3} ${y + 3} M${x + 3} ${y - 3} L${x - 3} ${y + 3}" stroke="#FFF" stroke-width="1.4"/>`).join('');
      return flakes + `<path d="M0 96 Q30 88 60 94 Q80 98 100 92 L100 125 L0 125 Z" fill="#FFFFFF"/>` + classicBall(cx, cy, r, '#FF8A3D', '#7A3F14');
    }
    case 7:
      return `<rect width="100" height="125" fill="#0B1020" opacity="0.85"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${r + 8}" fill="#3DDC84" opacity="0.18"/><circle cx="${cx}" cy="${cy}" r="${r + 3}" fill="#3DDC84" opacity="0.25"/>` +
        classicBall(cx, cy, r, '#1A2A1F', '#FF6FB5').replace(`stroke="${INK}" stroke-width="2.4"`, 'stroke="#3DDC84" stroke-width="3"');
    case 8:
      return `<rect x="0" y="92" width="100" height="33" fill="#2E9C5E"/>` +
        `<path d="M14 100 L20 84 L26 100 Z" fill="#FF8A3D" ${S(1.5)}/><path d="M74 104 L80 88 L86 104 Z" fill="#FF8A3D" ${S(1.5)}/>` +
        `<path d="M10 56 L22 56 M8 64 L20 64 M12 72 L24 72" ${S(2.6)}/>` + classicBall(54, 62, 24, '#FFE08A', '#14110F') +
        `<path d="M40 72 L46 66 M60 50 L64 46" stroke="#7A4A00" stroke-width="1.6"/>`;
    case 9:
      return `<path d="M30 0 L70 0 L84 125 L16 125 Z" fill="#FFFBE0" opacity="0.35"/>` +
        [[18, 20, '#FF5A4E'], [80, 30, '#3DDC84'], [26, 40, '#FFC93C'], [74, 14, '#7FD1FF'], [86, 56, '#FF6FB5'], [12, 62, '#B49CFF']].map(([x, y, c]) =>
          `<rect x="${x}" y="${y}" width="5" height="3" fill="${c}" transform="rotate(30 ${x} ${y})"/>`).join('') +
        `<path d="M36 92 L64 92 L60 104 L40 104 Z" fill="#E8E2D0" ${S(2)}/><rect x="32" y="104" width="36" height="8" rx="2" fill="#B8C9C0" ${S(2)}/>` +
        classicBall(50, 66, 24);
    case 10:
      return `<path d="M20 100 Q14 80 26 70 Q24 86 34 88 Q28 72 40 60 Q42 76 50 80 M80 100 Q86 80 74 70 Q76 86 66 88" fill="#FF8A3D" opacity="0.8"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${r + 6}" fill="#FF5A4E" opacity="0.35"/>` +
        `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#5A1208" ${S(2.4)}/>` +
        `<path d="M32 52 L42 58 L38 70 L48 74 L46 86 M58 40 L56 52 L66 58 L64 70 L74 72 M42 58 L56 52 M48 74 L64 70" stroke="#FFB000" stroke-width="2.6" fill="none"/>` +
        `<path d="M32 52 L42 58 L38 70 L48 74 L46 86 M58 40 L56 52 L66 58 L64 70 L74 72" stroke="#FFF1A8" stroke-width="1" fill="none"/>`;
    case 11:
      return `<rect x="22" y="30" width="56" height="70" rx="3" fill="#FFFFFF" opacity="0.25" ${S(2)}/>` +
        `<path d="M28 34 L40 34 L28 52 Z" fill="#FFF" opacity="0.55"/>` +
        classicBall(50, 64, 20, '#FFD34D', '#A86F00') +
        `<rect x="16" y="100" width="68" height="10" rx="2" fill="#5B2E12" ${S(2)}/>` + sparkle(70, 46, 5) + sparkle(36, 82, 3);
    case 12:
      return `<ellipse cx="50" cy="104" rx="22" ry="4" fill="#7FD1FF" opacity="0.6"/>` +
        `<ellipse cx="50" cy="62" rx="38" ry="10" fill="none" stroke="#7FD1FF" stroke-width="2" opacity="0.8" transform="rotate(-15 50 62)"/>` +
        `<circle cx="${cx}" cy="${cy - 2}" r="${r}" fill="#D9E6F2" ${S(2.4)}/>` +
        `<path d="M30 50 L40 50 L44 46 M58 44 L66 44 L70 50 M32 74 L42 74 L46 80 M60 82 L66 76 L74 76" stroke="#3F7CF0" stroke-width="1.8" fill="none"/>` +
        `<circle cx="42" cy="58" r="3.4" fill="${INK}"/><circle cx="58" cy="58" r="3.4" fill="${INK}"/><circle cx="43" cy="57" r="1.1" fill="#FFF"/><circle cx="59" cy="57" r="1.1" fill="#FFF"/>` +
        `<path d="M42 68 Q50 75 58 68" ${S(2.2)} fill="none"/><ellipse cx="36" cy="66" rx="3" ry="1.8" fill="#FF6FB5" opacity="0.6"/><ellipse cx="64" cy="66" rx="3" ry="1.8" fill="#FF6FB5" opacity="0.6"/>`;
    default:
      return classicBall(cx, cy, r);
  }
}

// ------------------------------------------------------------------ shirts
const JERSEY = 'M30 32 L41 26 Q50 32 59 26 L70 32 L86 46 L77 60 L70 55 L70 106 L30 106 L30 55 L23 60 L14 46 Z';

function jersey(uid: string, base: string, pattern: string, extra = '', shape = JERSEY): string {
  return `<defs><clipPath id="j${uid}"><path d="${shape}"/></clipPath></defs>` +
    `<path d="M50 26 L50 16 Q50 10 56 10 Q61 11 60 16" fill="none" ${S(2)}/><path d="M24 30 L50 20 L76 30" fill="none" ${S(2)}/>` +
    `<path d="${shape}" fill="${base}"/><g clip-path="url(#j${uid})">${pattern}</g>` +
    `<path d="${shape}" fill="none" ${S(2.4)}/>` + extra;
}

const ROUND_COLLAR = `<path d="M41 26 Q50 36 59 26" fill="none" ${S(2.4)}/>`;

function shirtArt(n: number, uid: string): string {
  switch (n) {
    case 1:
      return jersey(uid, '#FFFFFF', `<path d="M30 55 L30 106" stroke="#E5E5E5" stroke-width="8"/>`, ROUND_COLLAR + `<path d="M34 40 Q36 60 34 90" stroke="#FFF" stroke-width="3" opacity="0.7"/>`);
    case 2:
      return jersey(uid, '#FFFFFF', [14, 30, 46, 62, 78].map((x) => `<rect x="${x}" y="20" width="8" height="90" fill="${INK}"/>`).join(''), ROUND_COLLAR);
    case 3:
      return jersey(uid, '#F2E6C9', `<rect x="10" y="64" width="80" height="6" fill="#A0582A" opacity="0.5"/>`,
        `<path d="M41 26 L50 40 L59 26" fill="#E8D7B0" ${S(2)}/><path d="M46 31 L54 31 M47 35 L53 35" stroke="#5B2E12" stroke-width="1.4"/>` +
        `<circle cx="50" cy="46" r="1.6" fill="#5B2E12"/><circle cx="50" cy="52" r="1.6" fill="#5B2E12"/>`);
    case 4:
      return jersey(uid, '#FF8A3D',
        `<path d="M14 106 L14 92 Q20 80 24 90 Q26 74 34 86 Q38 70 46 84 Q50 68 56 82 Q62 70 66 84 Q72 72 76 88 Q82 80 86 90 L86 106 Z" fill="#FF5A4E"/>` +
        `<path d="M14 106 L14 100 Q22 92 28 100 Q36 88 44 100 Q52 90 58 100 Q66 90 72 100 Q80 92 86 98 L86 106 Z" fill="#FFC93C"/>`, ROUND_COLLAR);
    case 5:
      return jersey(uid, '#3DDC84', [36, 52, 68, 84, 100].map((y) => `<rect x="10" y="${y}" width="80" height="8" fill="#FFFFFF"/>`).join(''), ROUND_COLLAR);
    case 6:
      return jersey(uid, '#FFFFFF', `<path d="M20 30 L36 22 L84 104 L68 112 Z" fill="#FF5A4E"/>`, ROUND_COLLAR);
    case 7: {
      const zig = (y: number, c: string) => `<path d="M10 ${y} L20 ${y - 8} L30 ${y} L40 ${y - 8} L50 ${y} L60 ${y - 8} L70 ${y} L80 ${y - 8} L90 ${y} L90 ${y + 10} L10 ${y + 10} Z" fill="${c}"/>`;
      return jersey(uid, '#C6E05A', zig(42, '#FF6FB5') + zig(60, '#7FD1FF') + zig(78, '#FFB000') + zig(96, '#B49CFF'),
        ROUND_COLLAR + `<circle cx="20" cy="50" r="4" fill="${INK}" opacity="0.6"/><circle cx="80" cy="50" r="4" fill="${INK}" opacity="0.6"/>`);
    }
    case 8: {
      const wide = 'M27 32 L40 25 Q50 31 60 25 L73 32 L92 48 L82 64 L74 58 L75 110 L25 110 L26 58 L18 64 L8 48 Z';
      return jersey(uid, '#5C7CFF',
        `<path d="M10 60 L40 40 L52 60 L82 36 L90 50 L52 76 L40 58 L10 80 Z" fill="#FFC93C"/><path d="M10 90 L30 80 L50 96 L90 74 L90 84 L50 106 L30 92 L10 102 Z" fill="#FF6FB5"/>` +
        `<circle cx="66" cy="92" r="5" fill="#3DDC84"/>`, `<path d="M40 25 Q50 37 60 25" fill="none" ${S(2.4)}/>`, wide);
    }
    case 9:
      return jersey(uid, '#3F7CF0', `<rect x="10" y="20" width="40" height="90" fill="#FF5A4E"/>`, ROUND_COLLAR);
    case 10:
      return jersey(uid, '#6B7F3A',
        [[30, 46, 10, 6, '#3E4F22'], [56, 40, 12, 7, '#8E9B5A'], [44, 64, 14, 6, '#3E4F22'], [64, 74, 10, 8, '#2B3518'], [34, 88, 12, 7, '#8E9B5A'], [58, 96, 12, 6, '#3E4F22'], [18, 50, 6, 4, '#8E9B5A'], [80, 52, 6, 5, '#2B3518']]
          .map(([x, y, rx, ry, c]) => `<ellipse cx="${x}" cy="${y}" rx="${rx}" ry="${ry}" fill="${c}" transform="rotate(${Number(x) % 40 - 20} ${x} ${y})"/>`).join(''), ROUND_COLLAR);
    case 11:
      return `<defs><linearGradient id="g${uid}" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#FFF1A8"/><stop offset="0.5" stop-color="#FFB000"/><stop offset="1" stop-color="#A86F00"/></linearGradient></defs>` +
        jersey(uid, `url(#g${uid})`, `<path d="M20 30 L30 30 L60 110 L50 110 Z M40 30 L44 30 L74 110 L70 110 Z" fill="#FFFDE8" opacity="0.55"/>`, ROUND_COLLAR + sparkle(76, 40, 5) + sparkle(30, 92, 4));
    case 12:
      return `<defs><linearGradient id="n${uid}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#2E3A80"/><stop offset="1" stop-color="#0B0620"/></linearGradient></defs>` +
        jersey(uid, `url(#n${uid})`,
          [[36, 44], [60, 40], [48, 58], [66, 66], [38, 78], [56, 88], [44, 98], [28, 64], [72, 90]].map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1 : 1.8}" fill="#FFF"/>`).join('') +
          `<path d="M40 70 Q52 60 62 74 Q50 82 40 70 Z" fill="#B49CFF" opacity="0.5"/>` + star(56, 50, 4, '#FFE08A', false),
          ROUND_COLLAR.replace(INK, '#FFE08A'));
    default:
      return jersey(uid, '#FFF', '', ROUND_COLLAR);
  }
}

// ------------------------------------------------------------------ stadiums
function goal(x: number, y: number, w: number, h: number): string {
  return `<path d="M${x} ${y + h} L${x} ${y} L${x + w} ${y} L${x + w} ${y + h}" fill="none" stroke="#FFF" stroke-width="2.4"/>` +
    `<path d="M${x + w / 4} ${y} L${x + w / 4} ${y + h} M${x + w / 2} ${y} L${x + w / 2} ${y + h} M${x + (3 * w) / 4} ${y} L${x + (3 * w) / 4} ${y + h} M${x} ${y + h / 2} L${x + w} ${y + h / 2}" stroke="#FFF" stroke-width="0.8" opacity="0.7"/>`;
}

function stands(y: number, color: string, crowd = true): string {
  return `<path d="M0 ${y} Q50 ${y - 18} 100 ${y} L100 ${y + 18} L0 ${y + 18} Z" fill="${color}" ${S(1.6)}/>` +
    (crowd ? Array.from({ length: 16 }, (_, i) => `<circle cx="${4 + i * 6.2}" cy="${y + 4 - Math.sin((i / 15) * Math.PI) * 10}" r="1.5" fill="${['#FFF', '#FFC93C', '#FF5A4E', '#7FD1FF'][i % 4]}"/>`).join('') : '');
}

function pitch(y: number): string {
  return `<rect x="0" y="${y}" width="100" height="${125 - y}" fill="#2E9C5E"/>` +
    [0, 1, 2, 3].map((i) => `<rect x="${i * 25}" y="${y}" width="12.5" height="${125 - y}" fill="#3DDC84" opacity="0.35"/>`).join('') +
    `<path d="M0 ${y + 18} L100 ${y + 18}" stroke="#FFF" stroke-width="1.4" opacity="0.8"/><ellipse cx="50" cy="${y + 18}" rx="12" ry="4" fill="none" stroke="#FFF" stroke-width="1.4" opacity="0.8"/>`;
}

function stadiumArt(n: number): string {
  switch (n) {
    case 1:
      return `<rect x="4" y="22" width="30" height="70" fill="#E0A97F" ${S(2)}/><rect x="66" y="30" width="30" height="62" fill="#B8C3FF" ${S(2)}/>` +
        [0, 1, 2, 3, 4].map((r) => `<rect x="9" y="${28 + r * 12}" width="8" height="7" fill="#FFF8D0"/><rect x="21" y="${28 + r * 12}" width="8" height="7" fill="#FFF8D0"/><rect x="71" y="${36 + r * 11}" width="8" height="6" fill="#FFF8D0"/><rect x="83" y="${36 + r * 11}" width="8" height="6" fill="#FFF8D0"/>`).join('') +
        `<rect x="0" y="92" width="100" height="33" fill="#8E8E8E"/><path d="M0 94 L100 94" stroke="#FFF" stroke-width="1" stroke-dasharray="6 4"/>` +
        `<rect x="22" y="98" width="12" height="9" rx="2" fill="#FF5A4E" ${S(1.6)}/><rect x="66" y="98" width="12" height="9" rx="2" fill="#3F7CF0" ${S(1.6)}/>` +
        classicBall(50, 108, 7);
    case 2:
      return `<circle cx="78" cy="24" r="10" fill="#FFE08A"/><rect x="0" y="62" width="100" height="18" fill="#3B95C4"/>` +
        `<path d="M0 64 Q12 60 24 64 Q36 68 48 64 Q60 60 72 64 Q84 68 100 64" fill="none" stroke="#FFF" stroke-width="1.6"/>` +
        `<rect x="0" y="80" width="100" height="45" fill="#F6D9A0"/>` + goal(30, 68, 40, 22) +
        classicBall(70, 104, 7) + `<path d="M14 100 Q16 92 22 94" fill="none" stroke="#2E9C5E" stroke-width="2"/>`;
    case 3:
      return `<path d="M0 70 Q30 52 60 64 Q80 56 100 66 L100 125 L0 125 Z" fill="#7CC56B"/>` +
        `<path d="M0 82 L100 82" ${S(1.6)}/>` + [6, 22, 38, 54, 70, 86].map((x) => `<rect x="${x}" y="74" width="4" height="16" fill="#C98D62" ${S(1.2)}/>`).join('') +
        `<path d="M0 78 L100 78" stroke="#C98D62" stroke-width="3"/>` +
        `<ellipse cx="74" cy="64" rx="13" ry="8" fill="#FFF" ${S(1.6)}/><circle cx="70" cy="62" r="3" fill="${INK}"/><circle cx="79" cy="66" r="2.4" fill="${INK}"/>` +
        `<ellipse cx="88" cy="58" rx="6" ry="5" fill="#FFF" ${S(1.6)}/><ellipse cx="91" cy="60" rx="3" ry="2" fill="#FFB8C8"/><path d="M68 72 L68 76 M80 72 L80 76" ${S(2)}/>` +
        `<rect x="0" y="92" width="100" height="33" fill="#3DDC84"/>` + goal(20, 92, 30, 16) + classicBall(66, 110, 6);
    case 4: {
      const rain = Array.from({ length: 18 }, (_, i) => `<path d="M${(i * 13) % 100} ${(i * 29) % 70} l-4 9" stroke="#DCEBFF" stroke-width="1.4"/>`).join('');
      return `<rect width="100" height="70" fill="#5E6B78"/>` + stands(52, '#3A3F4A', false) +
        [16, 40, 66, 86].map((x, i) => `<path d="M${x - 6} ${50 - (i % 2) * 4} Q${x} ${42 - (i % 2) * 4} ${x + 6} ${50 - (i % 2) * 4} Z" fill="${['#FF5A4E', '#FFC93C', '#3F7CF0', '#FF6FB5'][i]}" ${S(1.2)}/>`).join('') +
        pitch(70) + `<ellipse cx="30" cy="104" rx="12" ry="3" fill="#7FD1FF" opacity="0.7"/><ellipse cx="72" cy="114" rx="14" ry="3" fill="#7FD1FF" opacity="0.7"/>` + rain;
    }
    case 5:
      return `<ellipse cx="50" cy="66" rx="46" ry="38" fill="#E8371F" ${S(2)}/>` +
        Array.from({ length: 40 }, (_, i) => {
          const a = (i * 2 * Math.PI) / 40;
          return `<circle cx="${(50 + 40 * Math.cos(a)).toFixed(1)}" cy="${(66 + 32 * Math.sin(a)).toFixed(1)}" r="1.3" fill="${i % 3 ? '#FFF' : '#FFC93C'}"/>`;
        }).join('') +
        `<ellipse cx="50" cy="66" rx="30" ry="22" fill="#2E9C5E" ${S(1.6)}/><path d="M50 44 L50 88" stroke="#FFF" stroke-width="1.2"/><circle cx="50" cy="66" r="6" fill="none" stroke="#FFF" stroke-width="1.2"/>` +
        `<rect x="22" y="58" width="6" height="16" fill="none" stroke="#FFF" stroke-width="1.2"/><rect x="72" y="58" width="6" height="16" fill="none" stroke="#FFF" stroke-width="1.2"/>`;
    case 6:
      return `<rect width="100" height="125" fill="#120B2E" opacity="0.9"/>` +
        [[12, 12], [30, 20], [70, 10], [88, 26], [52, 6], [18, 38], [80, 44]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#FFF"/>`).join('') +
        pitch(86) + `<path d="M4 90 Q50 18 96 90" fill="#BDE8FF" opacity="0.22" ${S(2)}/>` +
        `<path d="M20 90 Q50 30 80 90 M35 90 Q50 40 65 90 M12 70 L88 70 M24 52 L76 52" fill="none" stroke="#BDE8FF" stroke-width="1" opacity="0.6"/>`;
    case 7:
      return `<path d="M-6 100 L30 30 L44 52 L62 18 L106 100 Z" fill="#7E8E86" ${S(2)}/>` +
        `<path d="M30 30 L24 42 L32 40 L36 46 L44 52 Z M62 18 L54 32 L62 30 L68 36 L72 32 Z" fill="#FFF"/>` +
        `<ellipse cx="62" cy="24" rx="14" ry="5" fill="#E8371F" ${S(1.6)}/><ellipse cx="62" cy="23" rx="8" ry="2.6" fill="#3DDC84"/>` +
        `<path d="M8 60 Q14 52 22 58 Q28 50 36 58 Q40 64 34 66 L10 66 Q4 64 8 60 Z" fill="#FFF" opacity="0.9"/>` +
        `<rect x="0" y="100" width="100" height="25" fill="#5E6B78"/>`;
    case 8:
      return pitch(96) + `<rect x="6" y="40" width="88" height="56" fill="#9AA3AD" ${S(2)}/>` +
        Array.from({ length: 11 }, (_, i) => `<rect x="${6 + i * 8}" y="34" width="5" height="7" fill="#9AA3AD" ${S(1.4)}/>`).join('') +
        `<rect x="4" y="24" width="18" height="72" fill="#8E8E8E" ${S(2)}/><rect x="78" y="24" width="18" height="72" fill="#8E8E8E" ${S(2)}/>` +
        `<path d="M2 24 L13 8 L24 24 Z M76 24 L87 8 L98 24 Z" fill="#E8371F" ${S(2)}/>` +
        `<path d="M13 8 L13 0 L22 3 L13 6 M87 8 L87 0 L96 3 L87 6" fill="#FFC93C" ${S(1.2)}/>` +
        `<path d="M38 96 L38 70 Q50 58 62 70 L62 96 Z" fill="#5B2E12" ${S(2)}/>` +
        [[30, 54], [60, 50], [44, 80], [70, 78]].map(([x, y]) => `<path d="M${x} ${y} l6 0 m-3 -2 l0 4" stroke="#7E8E86" stroke-width="1"/>`).join('');
    case 9:
      return `<rect x="0" y="86" width="100" height="39" fill="#3B95C4"/>` +
        `<path d="M0 90 Q12 84 24 90 Q36 96 48 90 Q60 84 72 90 Q84 96 100 90" fill="none" stroke="#FFF" stroke-width="2"/>` +
        `<path d="M6 70 L94 70 L84 96 L16 96 Z" fill="#8E1A12" ${S(2)}/><path d="M6 70 L94 70 L90 64 L10 64 Z" fill="#2E9C5E" ${S(2)}/>` +
        `<path d="M50 64 L50 70 M30 64 L28 70 M70 64 L72 70" stroke="#FFF" stroke-width="1.2"/>` +
        `<path d="M50 64 L50 20" ${S(2.4)}/><path d="M50 22 L74 34 L50 46 Z" fill="#FFF" ${S(1.6)}/>` +
        [24, 36, 64, 76].map((x) => `<circle cx="${x}" cy="82" r="3" fill="#FFF8D0" ${S(1)}/>`).join('');
    case 10: {
      const burst = (x: number, y: number, c: string, r: number) => Array.from({ length: 12 }, (_, i) => {
        const a = (i * Math.PI) / 6;
        return `<path d="M${(x + r * 0.3 * Math.cos(a)).toFixed(1)} ${(y + r * 0.3 * Math.sin(a)).toFixed(1)} L${(x + r * Math.cos(a)).toFixed(1)} ${(y + r * Math.sin(a)).toFixed(1)}" stroke="${c}" stroke-width="2" stroke-linecap="round"/>`;
      }).join('') + `<circle cx="${x}" cy="${y}" r="2" fill="${c}"/>`;
      return `<rect width="100" height="125" fill="#120B2E" opacity="0.85"/>` +
        burst(26, 26, '#FF6FB5', 16) + burst(70, 18, '#FFC93C', 14) + burst(56, 46, '#3DDC84', 12) + burst(16, 56, '#7FD1FF', 10) + burst(86, 52, '#FF8A3D', 10) +
        stands(84, '#2E3A59') + `<rect x="0" y="100" width="100" height="25" fill="#2E9C5E"/>`;
    }
    case 11:
      return `<path d="M50 6 L94 30 L6 30 Z" fill="#FFD34D" ${S(2)}/>` + `<rect x="8" y="30" width="84" height="8" fill="#FFB000" ${S(2)}/>` +
        [16, 32, 48, 64, 80].map((x) => `<rect x="${x - 4}" y="38" width="8" height="52" fill="#FFE08A" ${S(1.6)}/><path d="M${x - 1} 42 L${x - 1} 86" stroke="#FFF" stroke-width="1.4" opacity="0.7"/>`).join('') +
        `<rect x="4" y="90" width="92" height="8" fill="#FFB000" ${S(2)}/><rect x="0" y="98" width="100" height="27" fill="#2E9C5E"/>` +
        `<path d="M40 38 L30 125 L70 125 L60 38 Z" fill="#FFFDE8" opacity="0.3"/>` + classicBall(50, 18, 5);
    case 12:
      return `<path d="M-10 90 Q50 20 110 90" fill="none" stroke="#FF6FB5" stroke-width="5" opacity="0.7"/><path d="M-10 96 Q50 26 110 96" fill="none" stroke="#FFC93C" stroke-width="5" opacity="0.7"/><path d="M-10 102 Q50 32 110 102" fill="none" stroke="#7FD1FF" stroke-width="5" opacity="0.7"/>` +
        `<path d="M8 96 Q4 84 16 82 Q18 70 32 74 Q40 64 52 72 Q64 64 72 74 Q86 70 88 82 Q98 84 92 96 Z" fill="#FFF" ${S(1.6)}/>` +
        `<ellipse cx="50" cy="82" rx="30" ry="7" fill="#2E9C5E" ${S(1.6)}/><path d="M50 75 L50 89" stroke="#FFF" stroke-width="1.2"/>` +
        `<path d="M14 40 Q20 32 28 38 Q34 30 42 38 Q46 44 40 46 L18 46 Q10 46 14 40 Z" fill="#FFF" opacity="0.85"/>` + star(78, 28, 4, '#FFE08A');
    default:
      return pitch(70);
  }
}

// ------------------------------------------------------------------ clubs (fictional crests)
const SHIELD = 'M50 14 L84 24 L82 70 Q78 98 50 112 Q22 98 18 70 L16 24 Z';

function crest(color: string, inner: string, animal: string, rarity: Rarity): string {
  const top = rarity === 'legendary' || rarity === 'iconic' ? star(50, 10, 6, '#FFD34D') : rarity === 'epic' || rarity === 'rare' ? star(50, 11, 4.5, '#FFF8EA') : '';
  return `<path d="${SHIELD}" fill="${color}" ${S(2.6)}/><path d="M50 20 L78 28 L76 69 Q73 92 50 105 Q27 92 24 69 L22 28 Z" fill="${inner}" opacity="0.9"/>` +
    animal + `<path d="M14 92 Q50 104 86 92 L82 100 Q50 112 18 100 Z" fill="${color}" ${S(2)}/>` + top;
}

function eyes(x1: number, x2: number, y: number, r = 3): string {
  return `<circle cx="${x1}" cy="${y}" r="${r}" fill="#FFF" ${S(1.2)}/><circle cx="${x2}" cy="${y}" r="${r}" fill="#FFF" ${S(1.2)}/>` +
    `<circle cx="${x1 + 0.6}" cy="${y + 0.4}" r="${r * 0.55}" fill="${INK}"/><circle cx="${x2 + 0.6}" cy="${y + 0.4}" r="${r * 0.55}" fill="${INK}"/>`;
}

function clubArt(n: number, rarity: Rarity): string {
  switch (n) {
    case 1:
      return crest('#2E9C5E', '#C6E05A',
        `<ellipse cx="50" cy="66" rx="20" ry="15" fill="#3E7F35" ${S(2)}/>` +
        `<path d="M40 58 L50 54 L60 58 L60 68 L50 72 L40 68 Z" fill="#7CC56B" ${S(1.2)}/>` +
        `<ellipse cx="50" cy="44" rx="10" ry="9" fill="#7CC56B" ${S(2)}/><rect x="40" y="38" width="20" height="4" fill="#FF5A4E" ${S(1)}/>` + eyes(46, 54, 45, 2.4) +
        `<path d="M46 50 Q50 53 54 50" ${S(1.4)} fill="none"/><ellipse cx="34" cy="76" rx="5" ry="3" fill="#7CC56B" ${S(1.4)}/><ellipse cx="66" cy="76" rx="5" ry="3" fill="#7CC56B" ${S(1.4)}/>`, rarity);
    case 2:
      return crest('#3B95C4', '#BDE8FF',
        `<path d="M24 80 Q37 74 50 80 Q63 86 76 80" fill="none" stroke="#3B95C4" stroke-width="3"/>` +
        `<ellipse cx="52" cy="62" rx="15" ry="12" fill="#9AA3AD" ${S(2)}/><path d="M50 60 Q60 52 68 62 Q60 66 50 60 Z" fill="#7E8E86" ${S(1.4)}/>` +
        `<circle cx="42" cy="48" r="8" fill="#9AA3AD" ${S(2)}/><path d="M34 48 L28 50 L34 52 Z" fill="#FFB000" ${S(1.2)}/>` + `<circle cx="40" cy="46" r="2.4" fill="#FFF" ${S(1.2)}/><circle cx="39.6" cy="46.4" r="1.3" fill="${INK}"/>` +
        `<path d="M47 52 Q50 56 48 58" stroke="#3DDC84" stroke-width="2" fill="none"/>` + classicBall(62, 36, 6), rarity);
    case 3:
      return crest('#7E8E86', '#F2F5EF',
        `<path d="M24 82 L38 62 L46 72 L56 58 L76 82 Z" fill="#5E6B78"/>` +
        `<ellipse cx="50" cy="56" rx="11" ry="13" fill="#F1D9B5" ${S(2)}/>` +
        `<path d="M41 46 Q30 40 32 30 Q38 26 40 34 Q40 40 44 44 M59 46 Q70 40 68 30 Q62 26 60 34 Q60 40 56 44" fill="none" ${S(3)}/>` + eyes(45, 55, 54, 2.2) +
        `<ellipse cx="50" cy="62" rx="4" ry="2.6" fill="#C98D62"/><path d="M47 68 L50 76 L53 68 Z" fill="#FFF" ${S(1.2)}/>`, rarity);
    case 4:
      return crest('#FFB000', '#FFF1A8',
        `<path d="M50 30 L66 39 L66 57 L50 66 L34 57 L34 39 Z" fill="none" stroke="#E08A00" stroke-width="1.4" opacity="0.6"/>` +
        `<ellipse cx="38" cy="54" rx="9" ry="6" fill="#FFF" opacity="0.85" ${S(1.2)}/><ellipse cx="62" cy="54" rx="9" ry="6" fill="#FFF" opacity="0.85" ${S(1.2)}/>` +
        `<ellipse cx="50" cy="66" rx="12" ry="14" fill="#FFC93C" ${S(2)}/><path d="M39 62 L61 62 M38 70 L62 70" stroke="${INK}" stroke-width="3.4"/>` +
        `<path d="M46 80 L50 88 L54 80" fill="${INK}"/><circle cx="50" cy="48" r="8" fill="#FFC93C" ${S(2)}/>` + eyes(46, 54, 47, 2.2) +
        `<path d="M46 40 Q42 32 38 32 M54 40 Q58 32 62 32" ${S(1.4)} fill="none"/><path d="M46 52 Q50 55 54 52" ${S(1.2)} fill="none"/>`, rarity);
    case 5:
      return crest('#A86B3C', '#F1D9B5',
        Array.from({ length: 11 }, (_, i) => {
          const a = Math.PI + (i * Math.PI) / 10;
          return `<path d="M${(50 + 14 * Math.cos(a)).toFixed(1)} ${(66 + 14 * Math.sin(a)).toFixed(1)} L${(50 + 26 * Math.cos(a)).toFixed(1)} ${(66 + 26 * Math.sin(a)).toFixed(1)} L${(50 + 14 * Math.cos(a + 0.2)).toFixed(1)} ${(66 + 14 * Math.sin(a + 0.2)).toFixed(1)}" fill="#5B2E12" ${S(1.2)}/>`;
        }).join('') +
        `<path d="M26 68 Q26 44 50 42 Q74 44 74 68 Z" fill="#7A4A2A" ${S(2)}/><ellipse cx="50" cy="66" rx="14" ry="11" fill="#F1D9B5" ${S(2)}/>` +
        eyes(45, 55, 63, 2.2) + `<circle cx="50" cy="70" r="2.4" fill="${INK}"/>` + classicBall(70, 82, 6), rarity);
    case 6:
      return crest('#E0A97F', '#FFE0C7',
        `<path d="M18 80 Q34 70 50 80 Q66 70 82 80" fill="#F6D9A0"/>` +
        `<ellipse cx="32" cy="56" rx="11" ry="14" fill="#8E9AA6" ${S(2)}/><ellipse cx="68" cy="56" rx="11" ry="14" fill="#8E9AA6" ${S(2)}/>` +
        `<ellipse cx="50" cy="54" rx="13" ry="14" fill="#9AA3AD" ${S(2)}/>` + eyes(45, 55, 50, 2.2) +
        `<path d="M46 60 Q46 74 54 78 Q62 80 62 72" fill="none" stroke="#9AA3AD" stroke-width="7" stroke-linecap="round"/><path d="M46 60 Q46 74 54 78 Q62 80 62 72" fill="none" ${S(1.6)}/>` +
        classicBall(64, 64, 5.5), rarity);
    case 7:
      return crest('#E8371F', '#FFD0A8',
        `<path d="M32 50 L28 30 L44 42 Z M68 50 L72 30 L56 42 Z" fill="#F29A4A" ${S(2)}/>` +
        `<path d="M28 54 Q30 38 50 38 Q70 38 72 54 Q70 70 50 80 Q30 70 28 54 Z" fill="#F29A4A" ${S(2)}/>` +
        `<path d="M30 58 Q40 60 50 76 Q60 60 70 58 Q68 72 50 80 Q32 72 30 58 Z" fill="#FFF8EA"/>` + eyes(43, 57, 54, 2.4) +
        `<path d="M47 66 L53 66 L50 69 Z" fill="${INK}"/><path d="M44 72 Q50 76 56 70" ${S(1.4)} fill="none"/>`, rarity);
    case 8:
      return crest('#2F45B0', '#BDE8FF',
        `<path d="M22 84 Q30 78 38 84 Q46 90 54 84 Q62 78 70 84 Q76 88 80 84 L80 92 L20 92 Z" fill="#3B95C4"/>` +
        `<path d="M28 82 Q30 46 52 40 Q74 44 72 82 Z" fill="#7E8E86" ${S(2)}/><path d="M34 82 Q38 66 50 66 Q62 66 66 82 Z" fill="#FFF8EA" ${S(1.4)}/>` +
        `<path d="M38 70 L41 75 L44 70 L47 75 L50 70 L53 75 L56 70 L59 75 L62 70" fill="none" ${S(1.2)}/>` + eyes(42, 60, 56, 2.4) +
        `<path d="M52 40 L56 26 L62 42 Z" fill="#7E8E86" ${S(2)}/>`, rarity);
    case 9:
      return crest('#2E3A59', '#5C7CFF',
        `<path d="M66 30 A10 10 0 1 1 58 22 A8 8 0 1 0 66 30 Z" fill="#FFE08A"/>` +
        `<ellipse cx="50" cy="62" rx="18" ry="20" fill="#A86B3C" ${S(2)}/><path d="M34 46 L32 34 L42 42 Z M66 46 L68 34 L58 42 Z" fill="#7A4A2A" ${S(1.6)}/>` +
        `<circle cx="42" cy="56" r="7" fill="#FFF6DA" ${S(1.4)}/><circle cx="58" cy="56" r="7" fill="#FFF6DA" ${S(1.4)}/>` +
        `<circle cx="42" cy="56" r="3.4" fill="#FFB000"/><circle cx="58" cy="56" r="3.4" fill="#FFB000"/><circle cx="42" cy="56" r="1.6" fill="${INK}"/><circle cx="58" cy="56" r="1.6" fill="${INK}"/>` +
        `<path d="M47 62 L53 62 L50 68 Z" fill="#FFB000" ${S(1)}/><path d="M40 72 l3 3 l3 -3 M54 72 l3 3 l3 -3" stroke="#5B2E12" stroke-width="1.4" fill="none"/>`, rarity);
    case 10:
      return crest('#3E7F35', '#C6E05A',
        `<path d="M58 66 Q70 60 80 66 Q72 70 76 76 Q68 72 60 74 Z" fill="#FF8A3D" ${S(1.4)}/><path d="M62 68 Q70 66 76 68" stroke="#FFC93C" stroke-width="2"/>` +
        `<path d="M30 70 Q28 46 46 40 Q62 38 64 54 Q66 66 58 72 Q46 80 30 70 Z" fill="#2E9C5E" ${S(2)}/>` +
        `<path d="M38 42 L32 26 L44 38 Z M50 38 L50 22 L56 38 Z" fill="#FFF8EA" ${S(1.4)}/>` +
        `<circle cx="48" cy="52" r="3.4" fill="#FFE08A" ${S(1.2)}/><path d="M48 49 L48 55" stroke="${INK}" stroke-width="1.4"/>` +
        `<path d="M50 64 L54 66 L58 63" ${S(1.4)} fill="none"/><path d="M36 74 L38 80 M44 76 L46 82" stroke="#FFF8EA" stroke-width="1.6"/>`, rarity);
    case 11: {
      const mane = Array.from({ length: 14 }, (_, i) => {
        const a = (i * 2 * Math.PI) / 14;
        return `<circle cx="${(50 + 22 * Math.cos(a)).toFixed(1)}" cy="${(60 + 22 * Math.sin(a)).toFixed(1)}" r="8"/>`;
      }).join('');
      return crest('#FFB000', '#FFF1A8',
        `<g fill="#E08A00" ${S(1.4)}>${mane}</g><circle cx="50" cy="60" r="22" fill="#E08A00"/>` +
        `<ellipse cx="50" cy="60" rx="15" ry="16" fill="#FFD34D" ${S(2)}/>` + eyes(44, 56, 56, 2.4) +
        `<ellipse cx="50" cy="66" rx="7" ry="5" fill="#FFF1A8"/><path d="M47 63 L53 63 L50 66 Z" fill="${INK}"/><path d="M45 70 Q50 74 55 70" ${S(1.4)} fill="none"/>` +
        `<path d="M38 36 L40 28 L45 33 L50 26 L55 33 L60 28 L62 36 Z" fill="#FFD34D" ${S(1.4)}/>`, rarity);
    }
    case 12:
      return crest('#E8371F', '#FFD45A',
        `<path d="M50 50 Q30 30 16 40 Q28 46 26 54 Q38 50 46 60 Z" fill="#FF8A3D" ${S(1.6)}/><path d="M50 50 Q70 30 84 40 Q72 46 74 54 Q62 50 54 60 Z" fill="#FF8A3D" ${S(1.6)}/>` +
        `<path d="M50 50 Q30 34 20 42 M50 50 Q70 34 80 42" stroke="#FFC93C" stroke-width="2" fill="none"/>` +
        `<ellipse cx="50" cy="60" rx="8" ry="12" fill="#FF5A4E" ${S(1.8)}/><circle cx="50" cy="44" r="6" fill="#FF5A4E" ${S(1.8)}/>` +
        `<path d="M50 38 Q48 30 52 26 Q54 32 50 38" fill="#FFC93C" ${S(1)}/><circle cx="52" cy="43" r="1.4" fill="${INK}"/><path d="M55 45 L60 46 L55 48 Z" fill="#FFB000" ${S(1)}/>` +
        `<path d="M44 70 Q40 84 34 90 Q46 84 50 74 Q54 84 66 90 Q60 84 56 70 Z" fill="#FFC93C" ${S(1.6)}/>`, rarity);
    default:
      return crest('#5C7CFF', '#B8C3FF', '', rarity);
  }
}

// ------------------------------------------------------------------ merch
function trophy(cx: number, cy: number, s: number, gold = '#FFD34D', dark = '#A86F00'): string {
  const t = (x: number, y: number) => `${(cx + x * s).toFixed(1)} ${(cy + y * s).toFixed(1)}`;
  return `<path d="M${t(-14, -24)} L${t(14, -24)} L${t(12, -6)} Q${t(10, 6)} ${t(0, 7)} Q${t(-10, 6)} ${t(-12, -6)} Z" fill="${gold}" ${S(2.2)}/>` +
    `<path d="M${t(-14, -20)} Q${t(-24, -20)} ${t(-23, -12)} Q${t(-22, -4)} ${t(-12, -4)} M${t(14, -20)} Q${t(24, -20)} ${t(23, -12)} Q${t(22, -4)} ${t(12, -4)}" fill="none" ${S(2.2)}/>` +
    `<path d="M${t(-4, 7)} L${t(4, 7)} L${t(5, 16)} L${t(-5, 16)} Z" fill="${dark}" ${S(1.8)}/><rect x="${cx - 12 * s}" y="${cy + 16 * s}" width="${24 * s}" height="${7 * s}" rx="2" fill="${dark}" ${S(1.8)}/>` +
    `<path d="M${t(-7, -20)} L${t(-7.5, -6)}" stroke="#FFF" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>`;
}

function merchArt(n: number): string {
  switch (n) {
    case 1:
      return `<path d="M20 30 Q50 44 80 30 L84 44 Q50 58 16 44 Z" fill="#FF5A4E" ${S(2)}/>` +
        `<path d="M62 50 L70 106 L84 102 L76 46 Z" fill="#FF5A4E" ${S(2)}/>` +
        `<path d="M30 37 L28 50 M42 41 L41 54 M54 42 L54 55 M66 40 L67 53 M64 62 L77 60 M66 76 L79 74 M68 90 L81 88" stroke="#FFF8EA" stroke-width="4"/>` +
        Array.from({ length: 5 }, (_, i) => `<path d="M${71 + i * 3} 106 L${71 + i * 3} 114" ${S(1.6)}/>`).join('');
    case 2:
      return `<path d="M24 82 Q22 40 50 38 Q78 40 76 82 Z" fill="#3F7CF0" ${S(2.4)}/>` +
        `<path d="M30 54 Q50 46 70 54 M28 66 Q50 58 72 66" stroke="#FFF" stroke-width="5" fill="none"/>` +
        `<rect x="20" y="80" width="60" height="16" rx="5" fill="#2F45B0" ${S(2.4)}/>` +
        Array.from({ length: 9 }, (_, i) => `<path d="M${25 + i * 6.2} 82 L${25 + i * 6.2} 94" stroke="#5C7CFF" stroke-width="2"/>`).join('') +
        `<circle cx="50" cy="32" r="10" fill="#FFF8EA" ${S(2)}/><path d="M44 28 L56 36 M56 28 L44 36 M50 23 L50 41" stroke="#E5E0D0" stroke-width="1.6"/>`;
    case 3:
      return `<path d="M34 112 L34 64 Q34 56 40 56 L40 20 Q40 12 47 12 Q54 12 54 20 L54 52 Q58 48 62 52 Q66 48 70 52 Q74 50 76 56 L76 90 Q76 112 56 112 Z" fill="#FFC93C" ${S(2.4)}/>` +
        `<path d="M54 52 L54 66 M62 52 L62 66 M70 52 L70 66" ${S(1.6)}/><path d="M34 64 Q26 62 26 72 Q26 80 34 82" fill="#FFC93C" ${S(2.4)}/>` +
        `<path d="M44 20 L44 46" stroke="#FFF" stroke-width="3" stroke-linecap="round" opacity="0.7"/>`;
    case 4:
      return `<path d="M44 28 Q40 20 46 14 M54 28 Q50 20 56 14 M64 28 Q60 20 66 14" stroke="#FFF" stroke-width="2.4" fill="none" stroke-linecap="round" opacity="0.9"/>` +
        `<path d="M24 36 L76 36 L72 96 Q70 104 62 104 L38 104 Q30 104 28 96 Z" fill="#FFF8EA" ${S(2.4)}/>` +
        `<path d="M76 48 Q92 48 90 62 Q88 76 72 76" fill="none" ${S(5)}/><path d="M76 48 Q92 48 90 62 Q88 76 72 76" fill="none" stroke="#FFF8EA" stroke-width="2"/>` +
        `<ellipse cx="50" cy="36" rx="26" ry="4" fill="#5B2E12" ${S(1.6)}/>` + classicBall(50, 70, 13);
    case 5:
      return `<path d="M30 20 Q50 44 66 54" fill="none" stroke="#FF5A4E" stroke-width="3"/>` +
        `<path d="M26 60 Q26 46 40 46 L72 46 L72 60 L58 60 Q60 66 58 74 Q52 90 38 86 Q24 82 26 60 Z" fill="#D9E0E8" ${S(2.4)}/>` +
        `<circle cx="40" cy="70" r="6" fill="${INK}"/><path d="M72 46 L80 40" ${S(2.4)}/>` +
        `<path d="M80 56 Q86 60 80 66 M86 52 Q94 60 86 70" fill="none" ${S(2)}/><path d="M32 52 Q38 50 44 51" stroke="#FFF" stroke-width="2.4" fill="none" stroke-linecap="round"/>`;
    case 6:
      return `<ellipse cx="50" cy="44" rx="30" ry="9" fill="#FFF8EA" ${S(2.4)}/><path d="M20 44 L20 88 Q50 100 80 88 L80 44" fill="#FF5A4E" ${S(2.4)}/>` +
        `<path d="M20 50 L32 86 L44 52 L56 90 L68 52 L80 86" fill="none" stroke="#FFC93C" stroke-width="2.4"/>` +
        `<path d="M30 24 L46 40 M74 22 L58 40" ${S(3)}/><circle cx="30" cy="24" r="3.4" fill="#FFF8EA" ${S(1.6)}/><circle cx="74" cy="22" r="3.4" fill="#FFF8EA" ${S(1.6)}/>` +
        `<path d="M8 40 Q4 50 8 60 M92 40 Q96 50 92 60" fill="none" ${S(2)}/>`;
    case 7: {
      const boot = (x: number, y: number, c: string) =>
        `<path d="M${x} ${y} L${x + 14} ${y} L${x + 15} ${y + 16} Q${x + 24} ${y + 18} ${x + 30} ${y + 22} Q${x + 32} ${y + 28} ${x + 26} ${y + 28} L${x - 2} ${y + 28} Q${x - 4} ${y + 14} ${x} ${y} Z" fill="${c}" ${S(2)}/>` +
        `<path d="M${x + 2} ${y + 6} L${x + 12} ${y + 6} M${x + 2} ${y + 11} L${x + 13} ${y + 11}" stroke="#FFF" stroke-width="1.6"/>` +
        `<path d="M${x + 2} ${y + 30} L${x + 2} ${y + 33} M${x + 10} ${y + 30} L${x + 10} ${y + 33} M${x + 20} ${y + 30} L${x + 20} ${y + 33}" ${S(2)}/>`;
      return boot(16, 40, '#3F7CF0') + boot(46, 66, '#FF8A3D') + `<path d="M30 40 Q36 30 46 34 Q54 40 60 66" fill="none" stroke="#FFF8EA" stroke-width="1.6" stroke-dasharray="3 2"/>`;
    }
    case 8:
      return `<g transform="rotate(-8 50 62)"><path d="M14 40 L86 40 L86 54 Q80 58 86 62 L86 84 L14 84 L14 62 Q20 58 14 54 Z" fill="#FFF1A8" ${S(2.4)}/>` +
        `<path d="M66 40 L66 84" stroke="${INK}" stroke-width="1.4" stroke-dasharray="3 2"/>` +
        `<rect x="20" y="46" width="40" height="5" fill="#FF5A4E"/><rect x="20" y="74" width="40" height="4" fill="#3F7CF0"/>` + classicBall(40, 62, 8) +
        star(76, 56, 4, '#FFB000') + star(76, 70, 3, '#FFB000') + `<path d="M84 46 L90 42" ${S(1.2)}/></g>`;
    case 9:
      return Array.from({ length: 14 }, (_, i) => `<circle cx="${5 + i * 7}" cy="${108 + (i % 2) * 4}" r="4" fill="${['#2E3A59', '#5E6B78'][i % 2]}"/>`).join('') +
        `<path d="M24 112 L24 18" ${S(3)}/><circle cx="24" cy="16" r="3" fill="#FFD34D" ${S(1.4)}/>` +
        `<path d="M24 20 Q46 12 62 22 Q76 30 90 22 L90 66 Q76 74 62 66 Q46 56 24 64 Z" fill="#3DDC84" ${S(2.4)}/>` +
        `<path d="M24 34 Q46 26 62 36 Q76 44 90 36 L90 50 Q76 58 62 50 Q46 40 24 48 Z" fill="#FFF8EA"/>`;
    case 10:
      return `<circle cx="50" cy="30" r="13" fill="none" stroke="#C9CED6" stroke-width="4"/><circle cx="50" cy="30" r="13" fill="none" ${S(1)}/>` +
        `<path d="M44 42 L36 72 L42 74 L44 64 L48 66 L47 60 L50 46" fill="#C9CED6" ${S(1.6)}/>` +
        `<path d="M58 42 L66 70 L60 72 L58 64 L54 66" fill="#FFD34D" ${S(1.6)}/>` +
        `<path d="M50 42 L50 70" ${S(1.6)}/><circle cx="50" cy="84" r="16" fill="#FFD34D" opacity="0.35"/>` + classicBall(50, 84, 11);
    case 11: {
      const brick = (x: number, y: number, w: number, c: string) =>
        `<rect x="${x}" y="${y}" width="${w}" height="9" rx="1" fill="${c}" ${S(1.6)}/>` +
        Array.from({ length: Math.floor(w / 8) }, (_, i) => `<ellipse cx="${x + 4 + i * 8}" cy="${y}" rx="2.4" ry="1.2" fill="${c}" ${S(1)}/>`).join('');
      return brick(24, 28, 52, '#FFC93C') + brick(28, 38, 44, '#FFC93C') + brick(32, 48, 36, '#FF5A4E') + brick(38, 58, 24, '#3F7CF0') +
        brick(44, 68, 12, '#3DDC84') + brick(40, 78, 20, '#FFC93C') + brick(30, 88, 40, '#3F7CF0') +
        `<rect x="14" y="30" width="10" height="8" rx="1" fill="#FFC93C" ${S(1.4)}/><rect x="76" y="30" width="10" height="8" rx="1" fill="#FFC93C" ${S(1.4)}/>` +
        `<rect x="14" y="38" width="6" height="12" fill="#FFC93C" ${S(1.4)}/><rect x="80" y="38" width="6" height="12" fill="#FFC93C" ${S(1.4)}/>`;
    }
    case 12:
      return `<ellipse cx="50" cy="56" rx="34" ry="34" fill="#FFF1A8" opacity="0.4"/>` + trophy(50, 54, 1.7) +
        `<rect x="18" y="98" width="64" height="16" rx="2" fill="#E8E2D0" ${S(2)}/><path d="M22 104 Q36 100 46 108 M58 102 Q68 108 78 104" stroke="#B8C9C0" stroke-width="1.2" fill="none"/>` +
        sparkle(20, 30, 5) + sparkle(82, 40, 6) + sparkle(76, 84, 3);
    default:
      return trophy(50, 60, 1.4);
  }
}

export function objectSvg(id: string, rarity: Rarity, width = 100, uid = id): string {
  const [album, num] = id.split('_');
  const n = Number(num);
  const h = width * 1.25;
  const art =
    album === 'balls' ? ballArt(n)
      : album === 'shirts' ? shirtArt(n, uid)
        : album === 'stadiums' ? stadiumArt(n)
          : album === 'clubs' ? clubArt(n, rarity)
            : album === 'merch' ? merchArt(n)
              : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${h.toFixed(1)}" viewBox="0 0 100 125">` +
    `<defs><clipPath id="c${uid}"><rect width="100" height="125"/></clipPath></defs><g clip-path="url(#c${uid})">` +
    background(album ?? '', rarity, uid) + art + `</g></svg>`;
}
