/**
 * Illustrations for the general-knowledge albums: animals, world wonders,
 * space, inventions, dinosaurs and food. All drawn here in code (original art,
 * no photos, no logos). viewBox 0 0 100 125 — the art window of a sticker.
 * The rarity background is drawn by objectArt.ts.
 */

const K = '#14110F';
const W = '#FFF8EA';
const S = (w = 2) => `stroke="${K}" stroke-width="${w}" stroke-linejoin="round" stroke-linecap="round"`;
const eye = (x: number, y: number, r = 3) => `<circle cx="${x}" cy="${y}" r="${r}" fill="${K}"/><circle cx="${x + r * 0.35}" cy="${y - r * 0.35}" r="${r * 0.33}" fill="#FFF"/>`;
const ground = (y: number, c: string) => `<path d="M-2 ${y} Q50 ${y - 6} 102 ${y} L102 127 L-2 127 Z" fill="${c}" ${S(2)}/>`;

export const KNOWLEDGE_ALBUM_BG: Record<string, [string, string]> = {
  animals: ['#C8F5B8', '#5FCB52'],
  wonders: ['#FFE6B8', '#F2A64A'],
  space: ['#9DB0FF', '#2C2A7A'],
  inventions: ['#C9F1FF', '#38A8D8'],
  dinos: ['#E4F7A8', '#8BBF2E'],
  food: ['#FFD3C2', '#FF7E5F'],
};

// ------------------------------------------------------------------ animals
function animal(n: number): string {
  switch (n) {
    case 1: // penguin
      return ground(108, '#E6F6FF') +
        `<path d="M50 24 Q72 30 72 70 Q72 100 50 104 Q28 100 28 70 Q28 30 50 24 Z" fill="#26304A" ${S(2.4)}/>` +
        `<path d="M50 40 Q63 46 63 72 Q63 96 50 98 Q37 96 37 72 Q37 46 50 40 Z" fill="${W}"/>` +
        eye(43, 38) + eye(57, 38) + `<path d="M46 45 L54 45 L50 52 Z" fill="#FFA62B" ${S(1.6)}/>` +
        `<path d="M28 60 Q18 74 24 86 L31 76 Z M72 60 Q82 74 76 86 L69 76 Z" fill="#26304A" ${S(2)}/>` +
        `<path d="M40 104 L36 110 L46 110 Z M60 104 L54 110 L64 110 Z" fill="#FFA62B" ${S(1.6)}/>`;
    case 2: // frog
      return `<ellipse cx="50" cy="104" rx="38" ry="9" fill="#2E8F5A" ${S(2)}/>` +
        `<path d="M18 92 Q14 62 50 58 Q86 62 82 92 Q50 104 18 92 Z" fill="#62D26F" ${S(2.4)}/>` +
        `<circle cx="34" cy="56" r="11" fill="#62D26F" ${S(2.4)}/><circle cx="66" cy="56" r="11" fill="#62D26F" ${S(2.4)}/>` +
        `<circle cx="34" cy="56" r="6" fill="${W}"/><circle cx="66" cy="56" r="6" fill="${W}"/>` + eye(35, 56, 3.4) + eye(67, 56, 3.4) +
        `<path d="M34 80 Q50 90 66 80" fill="none" ${S(2.4)}/><circle cx="28" cy="78" r="3" fill="#FF8FA3"/><circle cx="72" cy="78" r="3" fill="#FF8FA3"/>`;
    case 3: // owl
      return `<path d="M20 100 L80 100" ${S(4)}/>` +
        `<path d="M50 26 Q78 30 76 66 Q74 98 50 100 Q26 98 24 66 Q22 30 50 26 Z" fill="#A9743F" ${S(2.4)}/>` +
        `<path d="M28 34 L34 22 L40 32 M72 34 L66 22 L60 32" fill="#A9743F" ${S(2)}/>` +
        `<circle cx="39" cy="52" r="11" fill="${W}" ${S(2)}/><circle cx="61" cy="52" r="11" fill="${W}" ${S(2)}/>` +
        `<circle cx="39" cy="52" r="6" fill="#FFB000"/><circle cx="61" cy="52" r="6" fill="#FFB000"/>` + eye(39, 52, 3.4) + eye(61, 52, 3.4) +
        `<path d="M46 62 L54 62 L50 70 Z" fill="#FFB000" ${S(1.6)}/>` +
        `<path d="M38 78 Q42 82 46 78 M54 78 Q58 82 62 78 M44 88 Q48 92 52 88 M52 88 Q56 92 60 88" fill="none" stroke="#6E4520" stroke-width="2"/>`;
    case 4: // tortoise
      return ground(104, '#B9E58C') +
        `<path d="M18 92 Q20 50 52 48 Q84 50 84 92 Z" fill="#7BB34A" ${S(2.4)}/>` +
        `<path d="M30 92 L36 66 L52 58 L68 66 L74 92 M36 66 L52 76 L68 66 M52 76 L52 92" fill="none" stroke="#3F6E23" stroke-width="2.2"/>` +
        `<path d="M84 84 Q98 82 96 70 Q94 62 86 68" fill="#C9D98A" ${S(2.2)}/>` + eye(91, 70, 1.8) +
        `<path d="M24 92 L22 102 L32 102 L32 92 M64 92 L64 102 L74 102 L72 92" fill="#C9D98A" ${S(2)}/>`;
    case 5: // giraffe
      return `<path d="M44 108 L44 60 L36 24 Q38 14 48 16 L56 26 L58 60 L58 108" fill="#F5C24B" ${S(2.4)}/>` +
        `<path d="M40 40 L46 42 L44 48 Z M48 56 L54 58 L52 66 Z M46 74 L54 72 L54 82 L46 82 Z M46 92 L54 92 L52 100 L46 100 Z M42 30 L46 30 L46 34 Z" fill="#B66B1E"/>` +
        `<path d="M40 20 L38 10 M46 16 L46 8" ${S(2.2)}/><circle cx="38" cy="9" r="2.4" fill="#B66B1E"/><circle cx="46" cy="7" r="2.4" fill="#B66B1E"/>` +
        eye(44, 22, 2.4) + `<path d="M58 30 Q66 34 62 40" fill="none" ${S(2)}/>`;
    case 6: // elephant
      return ground(108, '#D8C49A') +
        `<path d="M22 100 L22 66 Q24 40 56 40 Q82 40 84 66 L84 100 L72 100 L72 84 L36 84 L36 100 Z" fill="#9FA9B8" ${S(2.4)}/>` +
        `<path d="M30 54 Q10 50 12 74 Q14 88 24 86" fill="#B8C1CE" ${S(2.2)}/>` +
        `<path d="M24 64 Q16 78 22 100 Q28 104 30 98 Q28 84 34 72" fill="#9FA9B8" ${S(2.2)}/>` + eye(36, 56, 2.6) +
        `<path d="M30 70 Q34 78 40 74" fill="${W}" ${S(1.6)}/>`;
    case 7: // dolphin
      return `<path d="M-2 98 Q25 90 50 98 Q75 106 102 98 L102 127 L-2 127 Z" fill="#3E8EF7" ${S(2)}/>` +
        `<path d="M14 84 Q30 40 70 38 Q86 38 90 48 L80 50 Q78 64 64 72 Q46 82 30 80 Z" fill="#7FC4F2" ${S(2.4)}/>` +
        `<path d="M52 40 L60 26 L64 40 Z" fill="#7FC4F2" ${S(2)}/><path d="M18 82 L6 88 L12 74" fill="#7FC4F2" ${S(2)}/>` +
        `<path d="M40 70 Q50 74 62 68 Q54 66 40 70" fill="${W}"/>` + eye(74, 46, 2.4) +
        `<circle cx="88" cy="28" r="3" fill="none" stroke="#FFF" stroke-width="2"/><circle cx="94" cy="20" r="2" fill="none" stroke="#FFF" stroke-width="1.6"/>`;
    case 8: // chameleon
      return `<path d="M6 96 Q50 88 96 94" ${S(4)}/>` +
        `<path d="M20 88 Q22 58 52 56 Q78 56 80 78 Q80 92 64 92 Q60 100 52 94 Q40 96 32 92 Z" fill="#5BD05B" ${S(2.4)}/>` +
        `<path d="M78 72 Q94 70 90 86 Q86 98 74 92 Q82 88 80 80" fill="#5BD05B" ${S(2.2)}/>` +
        `<path d="M20 88 Q14 98 22 104 Q30 108 30 98 Q26 96 28 92" fill="none" ${S(2.2)}/>` +
        `<circle cx="34" cy="68" r="7" fill="#FFD34D" ${S(2)}/>` + eye(35, 68, 2.6) +
        `<path d="M42 62 Q50 70 58 62 Q66 70 74 64" fill="none" stroke="#2E8F3A" stroke-width="2"/><path d="M14 72 Q2 70 4 62" fill="none" stroke="#FF6FB5" stroke-width="2.4"/>`;
    case 9: // panda
      return `<path d="M30 104 L28 90 Q20 60 50 58 Q80 60 72 90 L70 104" fill="${W}" ${S(2.4)}/>` +
        `<circle cx="50" cy="46" r="22" fill="${W}" ${S(2.4)}/><circle cx="32" cy="28" r="8" fill="${K}"/><circle cx="68" cy="28" r="8" fill="${K}"/>` +
        `<ellipse cx="41" cy="46" rx="6" ry="8" fill="${K}" transform="rotate(-20 41 46)"/><ellipse cx="59" cy="46" rx="6" ry="8" fill="${K}" transform="rotate(20 59 46)"/>` +
        `<circle cx="42" cy="45" r="2" fill="#FFF"/><circle cx="58" cy="45" r="2" fill="#FFF"/><ellipse cx="50" cy="55" rx="3.4" ry="2.4" fill="${K}"/>` +
        `<path d="M28 78 Q20 70 24 62 L36 70 Z M72 78 Q80 70 76 62 L64 70 Z" fill="${K}"/>` +
        `<path d="M76 66 L88 30" stroke="#5BA83A" stroke-width="5" stroke-linecap="round"/><path d="M84 42 L94 36 M82 50 L92 50" stroke="#5BA83A" stroke-width="3" stroke-linecap="round"/>`;
    case 10: // tiger
      return `<circle cx="50" cy="60" r="32" fill="#FF9A2E" ${S(2.6)}/>` +
        `<path d="M24 34 L22 20 L36 28 M76 34 L78 20 L64 28" fill="#FF9A2E" ${S(2.2)}/>` +
        `<path d="M50 30 L46 42 M50 30 L54 42 M22 52 L34 56 M20 64 L32 64 M78 52 L66 56 M80 64 L68 64 M30 40 L38 48 M70 40 L62 48" ${S(3)}/>` +
        `<path d="M32 72 Q50 94 68 72 Q60 66 50 70 Q40 66 32 72 Z" fill="${W}" ${S(2)}/>` +
        eye(39, 56, 3.2) + eye(61, 56, 3.2) + `<path d="M45 70 L55 70 L50 76 Z" fill="#FF6FA3" ${S(1.6)}/>`;
    case 11: // lion
      return Array.from({ length: 14 }, (_, i) => {
        const a = (i / 14) * Math.PI * 2;
        return `<circle cx="${(50 + 30 * Math.cos(a)).toFixed(1)}" cy="${(60 + 30 * Math.sin(a)).toFixed(1)}" r="11" fill="#C9661E" ${S(2)}/>`;
      }).join('') +
        `<circle cx="50" cy="60" r="26" fill="#FFC24B" ${S(2.4)}/>` + eye(41, 55, 3.2) + eye(59, 55, 3.2) +
        `<path d="M44 66 L56 66 L50 73 Z" fill="#7A3E12" ${S(1.6)}/><path d="M50 73 L50 77 M43 78 Q50 83 57 78" fill="none" ${S(2)}/>` +
        `<path d="M30 74 L22 72 M30 78 L22 80 M70 74 L78 72 M70 78 L78 80" stroke="${K}" stroke-width="1.4"/>`;
    case 12: // blue whale
      return `<path d="M-2 104 Q25 96 50 104 Q75 112 102 104 L102 127 L-2 127 Z" fill="#2E6FD8" opacity="0.6"/>` +
        `<path d="M6 78 Q10 48 52 46 Q84 46 88 70 L98 60 L96 84 L86 78 Q78 96 46 96 Q12 96 6 78 Z" fill="#4C7FE8" ${S(2.4)}/>` +
        `<path d="M10 82 Q40 92 80 82" fill="none" stroke="#BFD4FF" stroke-width="2"/>` + eye(22, 66, 2.6) +
        `<path d="M30 46 Q26 30 32 22 M30 46 Q36 30 44 26" fill="none" stroke="#BFE6FF" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M50 86 L60 98 L66 86 Z" fill="#4C7FE8" ${S(2)}/>`;
    default:
      return '';
  }
}

// ------------------------------------------------------------------ wonders
function wonder(n: number): string {
  const sky = ground(106, '#BFE39A');
  switch (n) {
    case 1: // leaning tower of Pisa
      return sky + `<g transform="rotate(8 50 104)"><rect x="36" y="22" width="28" height="84" fill="${W}" ${S(2.4)}/>` +
        [34, 48, 62, 76, 90].map((y) => `<path d="M34 ${y} L66 ${y}" ${S(2)}/>` + [40, 47, 54].map((x) => `<rect x="${x}" y="${y - 10}" width="4" height="8" rx="2" fill="#C9B88E"/>`).join('')).join('') +
        `<rect x="40" y="12" width="20" height="10" fill="${W}" ${S(2)}/></g>`;
    case 2: // Big Ben
      return sky + `<rect x="38" y="36" width="24" height="70" fill="#D9B46A" ${S(2.4)}/>` +
        `<path d="M36 36 L50 8 L64 36 Z" fill="#7A6A4A" ${S(2.2)}/><rect x="34" y="34" width="32" height="6" fill="#D9B46A" ${S(2)}/>` +
        `<circle cx="50" cy="52" r="9" fill="${W}" ${S(2)}/><path d="M50 52 L50 46 M50 52 L54 54" ${S(1.6)}/>` +
        [66, 76, 86, 96].map((y) => `<path d="M42 ${y} L42 ${y + 6} M50 ${y} L50 ${y + 6} M58 ${y} L58 ${y + 6}" stroke="#8A6B2E" stroke-width="2"/>`).join('');
    case 3: // Statue of Liberty
      return `<path d="M24 112 L30 92 L70 92 L76 112 Z" fill="#B9A27A" ${S(2)}/>` +
        `<path d="M38 92 L40 52 Q50 44 60 52 L62 92 Z" fill="#7BC8A4" ${S(2.4)}/>` +
        `<circle cx="50" cy="42" r="8" fill="#7BC8A4" ${S(2.2)}/>` +
        `<path d="M42 36 L38 28 M46 34 L44 25 M50 34 L50 24 M54 34 L56 25 M58 36 L62 28" ${S(2)}/>` +
        `<path d="M58 52 L66 22" stroke="#7BC8A4" stroke-width="6" stroke-linecap="round"/><path d="M66 22 L66 22" ${S(8)}/>` +
        `<path d="M62 18 Q66 8 70 18 Z" fill="#FFB000" ${S(1.6)}/><rect x="40" y="62" width="10" height="12" fill="#5FA986" ${S(1.6)}/>`;
    case 4: // Sydney opera house
      return `<path d="M-2 100 L102 100 L102 127 L-2 127 Z" fill="#3E8EF7" ${S(2)}/><rect x="10" y="88" width="80" height="12" fill="#E6D3B3" ${S(2)}/>` +
        `<path d="M14 88 Q20 54 40 50 Q34 70 38 88 Z M34 88 Q44 44 66 42 Q56 66 60 88 Z M58 88 Q68 58 86 60 Q78 74 82 88 Z" fill="${W}" ${S(2.2)}/>` +
        `<path d="M22 84 Q28 66 36 58 M44 84 Q50 62 60 52 M66 84 Q72 70 80 64" fill="none" stroke="#C9C1B0" stroke-width="1.6"/>`;
    case 5: // Eiffel tower
      return sky + `<path d="M30 106 Q42 70 46 30 L54 30 Q58 70 70 106 L60 106 Q54 88 50 88 Q46 88 40 106 Z" fill="#8C6B4A" ${S(2.4)}/>` +
        `<path d="M36 76 L64 76 M40 56 L60 56 M44 40 L56 40" ${S(2.4)}/><path d="M48 30 L50 10 L52 30" fill="#8C6B4A" ${S(2)}/>` +
        `<path d="M42 66 L58 66 M38 86 L62 86" stroke="#6B4E33" stroke-width="1.4"/>`;
    case 6: // Colosseum
      return sky + `<path d="M8 104 L8 56 Q50 40 92 56 L92 104 Z" fill="#E2B985" ${S(2.4)}/>` +
        `<path d="M8 70 Q50 56 92 70 M8 86 Q50 74 92 86" fill="none" ${S(2)}/>` +
        [14, 26, 38, 50, 62, 74, 84].map((x) => `<path d="M${x} 104 L${x} 96 Q${x + 4} 91 ${x + 8} 96 L${x + 8} 104 Z M${x} 84 L${x} 78 Q${x + 4} 74 ${x + 8} 78 L${x + 8} 84 Z" fill="#8A5A2B"/>`).join('') +
        `<path d="M70 50 L92 56 L92 64 L74 60 Z" fill="#C9965E" ${S(1.6)}/>`;
    case 7: // Taj Mahal
      return `<rect x="-2" y="104" width="104" height="23" fill="#7FC4F2"/><rect x="18" y="64" width="64" height="40" fill="${W}" ${S(2.4)}/>` +
        `<path d="M32 64 Q30 36 50 28 Q70 36 68 64 Z" fill="${W}" ${S(2.4)}/><path d="M50 28 L50 18" ${S(2)}/><circle cx="50" cy="17" r="2" fill="#FFB000"/>` +
        `<path d="M42 104 L42 84 Q50 74 58 84 L58 104" fill="#E6DCC8" ${S(2)}/>` +
        `<path d="M10 104 L10 42 M90 104 L90 42" ${S(4)}/><circle cx="10" cy="40" r="4" fill="${W}" ${S(1.6)}/><circle cx="90" cy="40" r="4" fill="${W}" ${S(1.6)}/>` +
        `<path d="M22 64 Q22 54 28 52 Q34 54 34 64 M66 64 Q66 54 72 52 Q78 54 78 64" fill="${W}" ${S(1.8)}/>`;
    case 8: // Machu Picchu
      return `<path d="M50 16 L84 104 L16 104 Z" fill="#5E9B4C" ${S(2.4)}/><path d="M64 30 Q74 20 84 34 L96 104 L70 104 Z" fill="#4A7F3B" ${S(2.2)}/>` +
        `<path d="M10 104 L20 84 L44 84 L52 74 L70 74 L80 104 Z" fill="#C9B48A" ${S(2)}/>` +
        `<path d="M24 92 L40 92 M54 82 L66 82 M30 98 L48 98" stroke="#8A7650" stroke-width="2"/>` +
        `<path d="M14 26 Q24 20 34 26" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>`;
    case 9: // Petra
      return `<rect x="-2" y="10" width="104" height="104" fill="#D9805A"/><path d="M-2 10 Q20 30 6 60 L6 114 L-2 114 Z M102 10 Q80 30 94 60 L94 114 L102 114 Z" fill="#B85F3E"/>` +
        `<rect x="22" y="58" width="56" height="48" fill="#E9A07A" ${S(2)}/><path d="M18 58 L50 44 L82 58 Z" fill="#E9A07A" ${S(2)}/>` +
        `<rect x="40" y="20" width="20" height="24" fill="#E9A07A" ${S(2)}/><path d="M36 22 L50 12 L64 22 Z" fill="#E9A07A" ${S(1.8)}/>` +
        [28, 38, 62, 72].map((x) => `<path d="M${x} 62 L${x} 104" stroke="#B85F3E" stroke-width="3"/>`).join('') + `<rect x="44" y="80" width="12" height="26" fill="#6B3420"/>`;
    case 10: // Christ the Redeemer
      return `<path d="M10 112 Q30 80 50 84 Q70 80 90 112 Z" fill="#4A8F4C" ${S(2.2)}/>` +
        `<path d="M14 46 L86 46 L86 54 L56 54 L58 96 L42 96 L44 54 L14 54 Z" fill="${W}" ${S(2.4)}/>` +
        `<circle cx="50" cy="38" r="7" fill="${W}" ${S(2.2)}/><path d="M46 60 L54 60 M45 72 L55 72" stroke="#C9C1B0" stroke-width="1.6"/>` +
        `<path d="M12 22 Q24 16 36 22 M64 18 Q76 12 88 18" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>`;
    case 11: // Great Wall
      return `<path d="M-2 70 Q30 50 52 66 Q74 82 102 56 L102 127 L-2 127 Z" fill="#6BB04F" ${S(2)}/>` +
        `<path d="M-2 82 Q30 60 52 76 Q74 92 102 66 L102 78 Q74 104 52 88 Q30 72 -2 94 Z" fill="#D7B98A" ${S(2.2)}/>` +
        `<rect x="18" y="56" width="14" height="22" fill="#C9A66E" ${S(2)}/><rect x="70" y="62" width="14" height="22" fill="#C9A66E" ${S(2)}/>` +
        `<path d="M18 56 L18 52 L22 52 L22 56 M26 56 L26 52 L30 52 L30 56 M70 62 L70 58 L74 58 L74 62 M78 62 L78 58 L82 58 L82 62" ${S(1.6)}/>` +
        `<path d="M-2 106 Q50 86 102 104" fill="none" stroke="#4E8F38" stroke-width="2"/>`;
    case 12: // Great Pyramid
      return `<rect x="-2" y="96" width="104" height="31" fill="#F2D28A"/>` +
        `<circle cx="80" cy="24" r="10" fill="#FFE08A"/>` +
        `<path d="M50 20 L92 100 L8 100 Z" fill="#E6B65A" ${S(2.6)}/><path d="M50 20 L62 100 L92 100 Z" fill="#C99437"/>` +
        [40, 60, 80].map((y) => `<path d="M${50 - (y - 20) * 0.52} ${y} L${50 + (y - 20) * 0.52} ${y}" stroke="#B5843A" stroke-width="1.6"/>`).join('') +
        `<path d="M14 100 L24 82 L34 100 Z" fill="#E6B65A" ${S(1.8)}/>`;
    default:
      return '';
  }
}

// ------------------------------------------------------------------ space
const stars = (pts: [number, number][]) => pts.map(([x, y], i) => `<circle cx="${x}" cy="${y}" r="${i % 3 ? 1 : 1.6}" fill="#FFF"/>`).join('');
const STARS: [number, number][] = [[10, 12], [24, 30], [84, 14], [92, 44], [14, 92], [88, 98], [8, 60], [70, 112], [40, 10], [60, 22]];
function space(n: number): string {
  switch (n) {
    case 1: // moon
      return stars(STARS) + `<circle cx="50" cy="62" r="30" fill="#E6E2D6" ${S(2.6)}/>` +
        `<circle cx="40" cy="52" r="7" fill="#C9C3B2" ${S(1.6)}/><circle cx="62" cy="70" r="9" fill="#C9C3B2" ${S(1.6)}/><circle cx="58" cy="46" r="4" fill="#C9C3B2" ${S(1.4)}/><circle cx="38" cy="76" r="4" fill="#C9C3B2" ${S(1.4)}/>`;
    case 2: // comet
      return stars(STARS) + `<path d="M74 34 Q40 50 10 100 Q30 70 66 50 Q40 74 26 108 Q50 74 80 46 Z" fill="#9FE3FF" opacity="0.85"/>` +
        `<circle cx="76" cy="40" r="11" fill="#E6F7FF" ${S(2.4)}/><circle cx="73" cy="37" r="3" fill="#FFF"/>`;
    case 3: // Mars
      return stars(STARS) + `<circle cx="50" cy="62" r="30" fill="#E0623B" ${S(2.6)}/>` +
        `<path d="M24 54 Q40 48 50 56 Q62 64 78 56 M28 74 Q44 70 54 78 Q64 84 74 78" fill="none" stroke="#A8391D" stroke-width="3"/>` +
        `<path d="M40 34 Q50 30 60 34 Q50 38 40 34 Z" fill="${W}"/>`;
    case 4: // telescope
      return stars(STARS) + `<path d="M50 70 L32 108 M50 70 L50 108 M50 70 L68 108" ${S(3)}/>` +
        `<g transform="rotate(-28 50 62)"><rect x="22" y="54" width="62" height="16" rx="3" fill="#5C7CFF" ${S(2.4)}/><rect x="80" y="51" width="10" height="22" rx="2" fill="#3E5AD8" ${S(2)}/><rect x="14" y="57" width="10" height="10" rx="2" fill="#3E5AD8" ${S(2)}/></g>` +
        `<circle cx="50" cy="70" r="4" fill="#FFB000" ${S(1.6)}/>`;
    case 5: // satellite
      return stars(STARS) + `<rect x="40" y="52" width="20" height="20" rx="3" fill="#D9DDE6" ${S(2.4)}/>` +
        `<rect x="6" y="54" width="28" height="16" fill="#3E5AD8" ${S(2)}/><rect x="66" y="54" width="28" height="16" fill="#3E5AD8" ${S(2)}/>` +
        `<path d="M13 54 L13 70 M20 54 L20 70 M27 54 L27 70 M73 54 L73 70 M80 54 L80 70 M87 54 L87 70 M34 62 L40 62 M60 62 L66 62" stroke="${K}" stroke-width="1.4"/>` +
        `<path d="M50 52 L50 40" ${S(2)}/><path d="M42 40 Q50 30 58 40 Z" fill="${W}" ${S(1.8)}/>`;
    case 6: // Saturn
      return stars(STARS) + `<ellipse cx="50" cy="62" rx="44" ry="12" fill="none" stroke="#E8C77E" stroke-width="7" transform="rotate(-14 50 62)"/>` +
        `<circle cx="50" cy="62" r="24" fill="#F2C46B" ${S(2.4)}/><path d="M28 56 Q50 50 72 56 M28 68 Q50 74 72 68" fill="none" stroke="#C99437" stroke-width="2.4"/>` +
        `<path d="M8 74 Q50 60 92 50" fill="none" stroke="#E8C77E" stroke-width="7" stroke-linecap="round"/>`;
    case 7: // rocket
      return stars(STARS) + `<path d="M50 14 Q66 30 64 74 L36 74 Q34 30 50 14 Z" fill="${W}" ${S(2.6)}/>` +
        `<circle cx="50" cy="44" r="7" fill="#7FD1FF" ${S(2)}/><path d="M36 60 L24 82 L36 76 Z M64 60 L76 82 L64 76 Z" fill="#FF5A4E" ${S(2)}/>` +
        `<path d="M42 74 Q50 108 58 74 Z" fill="#FFB000" ${S(1.8)}/><path d="M46 74 Q50 96 54 74 Z" fill="#FFF3A8"/>`;
    case 8: // astronaut
      return stars(STARS) + `<rect x="30" y="64" width="40" height="40" rx="10" fill="${W}" ${S(2.4)}/>` +
        `<circle cx="50" cy="46" r="22" fill="${W}" ${S(2.6)}/><rect x="34" y="36" width="32" height="20" rx="10" fill="#2C2A7A" ${S(2)}/>` +
        `<path d="M40 42 Q46 38 50 42" fill="none" stroke="#9DB0FF" stroke-width="2.4" stroke-linecap="round"/>` +
        `<rect x="40" y="74" width="20" height="12" rx="2" fill="#5C7CFF" ${S(1.6)}/><path d="M30 74 L18 66 M70 74 L82 66" ${S(4)}/>`;
    case 9: // Jupiter
      return stars(STARS) + `<circle cx="50" cy="62" r="32" fill="#E9C79A" ${S(2.6)}/>` +
        `<path d="M20 50 Q50 44 80 50 L80 56 Q50 50 20 56 Z M19 66 Q50 72 81 66 L80 72 Q50 78 20 72 Z" fill="#C98A5A"/>` +
        `<ellipse cx="62" cy="78" rx="8" ry="5" fill="#C9502E" ${S(1.6)}/>`;
    case 10: // galaxy
      return stars(STARS) + `<g transform="rotate(-20 50 62)"><path d="M50 62 Q76 40 86 62 Q74 92 46 80 Q24 70 34 50 Q46 30 70 40" fill="none" stroke="#C9B8FF" stroke-width="8" stroke-linecap="round" opacity="0.8"/>` +
        `<path d="M50 62 Q24 84 14 62 Q26 32 54 44 Q76 54 66 74 Q54 94 30 84" fill="none" stroke="#FFB6E6" stroke-width="6" stroke-linecap="round" opacity="0.7"/></g>` +
        `<circle cx="50" cy="62" r="9" fill="#FFF6C9"/><circle cx="50" cy="62" r="4" fill="#FFF"/>`;
    case 11: // Sun
      return Array.from({ length: 12 }, (_, i) => {
        const a = (i / 12) * Math.PI * 2;
        return `<path d="M${(50 + 34 * Math.cos(a)).toFixed(1)} ${(62 + 34 * Math.sin(a)).toFixed(1)} L${(50 + 46 * Math.cos(a + 0.13)).toFixed(1)} ${(62 + 46 * Math.sin(a + 0.13)).toFixed(1)} L${(50 + 34 * Math.cos(a + 0.26)).toFixed(1)} ${(62 + 34 * Math.sin(a + 0.26)).toFixed(1)} Z" fill="#FF8A3D" ${S(1.6)}/>`;
      }).join('') + `<circle cx="50" cy="62" r="30" fill="#FFC93C" ${S(2.6)}/><circle cx="40" cy="52" r="8" fill="#FFE58A"/>`;
    case 12: // black hole
      return stars(STARS) + `<ellipse cx="50" cy="62" rx="46" ry="14" fill="none" stroke="#FF8A3D" stroke-width="8" transform="rotate(-12 50 62)"/>` +
        `<ellipse cx="50" cy="62" rx="46" ry="14" fill="none" stroke="#FFE08A" stroke-width="3" transform="rotate(-12 50 62)"/>` +
        `<circle cx="50" cy="62" r="20" fill="#000" stroke="#FFB000" stroke-width="3"/>` +
        `<path d="M8 70 Q50 84 92 52" fill="none" stroke="#FF8A3D" stroke-width="8" stroke-linecap="round" opacity="0.9"/>`;
    default:
      return '';
  }
}

// ------------------------------------------------------------------ inventions
function invention(n: number): string {
  switch (n) {
    case 1: // wheel
      return `<circle cx="50" cy="62" r="32" fill="#B5793F" ${S(2.6)}/><circle cx="50" cy="62" r="24" fill="#E3B27A" ${S(2)}/>` +
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return `<path d="M50 62 L${(50 + 24 * Math.cos(a)).toFixed(1)} ${(62 + 24 * Math.sin(a)).toFixed(1)}" ${S(3)}/>`;
        }).join('') + `<circle cx="50" cy="62" r="7" fill="#8A5428" ${S(2)}/>`;
    case 2: // light bulb
      return `<path d="M30 14 L24 8 M70 14 L76 8 M50 8 L50 2 M18 40 L10 40 M82 40 L90 40" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M50 14 Q76 14 76 42 Q76 58 64 68 L62 82 L38 82 L36 68 Q24 58 24 42 Q24 14 50 14 Z" fill="#FFE070" ${S(2.6)}/>` +
        `<path d="M42 68 L42 52 Q46 44 50 52 Q54 44 58 52 L58 68" fill="none" stroke="#C98A00" stroke-width="2.4"/>` +
        `<rect x="38" y="82" width="24" height="16" rx="3" fill="#B9C1CE" ${S(2)}/><path d="M38 88 L62 88 M38 93 L62 93" ${S(1.4)}/><path d="M44 98 L56 98 L52 104 L48 104 Z" fill="${K}"/>`;
    case 3: // compass
      return `<circle cx="50" cy="62" r="34" fill="#C9A15A" ${S(2.6)}/><circle cx="50" cy="62" r="27" fill="${W}" ${S(2)}/>` +
        `<path d="M50 38 L56 62 L50 86 L44 62 Z" fill="${K}"/><path d="M50 38 L56 62 L44 62 Z" fill="#FF5A4E" ${S(1.4)}/>` +
        `<circle cx="50" cy="62" r="3" fill="#FFB000" ${S(1.2)}/><rect x="46" y="22" width="8" height="8" rx="3" fill="#C9A15A" ${S(2)}/>`;
    case 4: // old telephone
      return `<path d="M20 104 L26 66 L74 66 L80 104 Z" fill="#2E2E3A" ${S(2.4)}/><circle cx="50" cy="86" r="12" fill="${W}" ${S(2)}/>` +
        Array.from({ length: 8 }, (_, i) => {
          const a = (i / 8) * Math.PI * 2;
          return `<circle cx="${(50 + 8 * Math.cos(a)).toFixed(1)}" cy="${(86 + 8 * Math.sin(a)).toFixed(1)}" r="1.8" fill="${K}"/>`;
        }).join('') +
        `<path d="M18 50 Q18 36 32 38 L68 38 Q82 36 82 50 L74 58 L66 50 L34 50 L26 58 Z" fill="#2E2E3A" ${S(2.4)}/>`;
    case 5: // microscope
      return `<path d="M24 106 L76 106 L72 98 L28 98 Z" fill="#3E4A5E" ${S(2.2)}/>` +
        `<path d="M64 98 Q78 70 62 50" fill="none" stroke="#3E4A5E" stroke-width="7" stroke-linecap="round"/>` +
        `<g transform="rotate(-24 46 50)"><rect x="38" y="20" width="16" height="44" rx="3" fill="#D9DDE6" ${S(2.4)}/><rect x="40" y="12" width="12" height="10" fill="#3E4A5E" ${S(2)}/><rect x="42" y="64" width="8" height="10" fill="#3E4A5E" ${S(2)}/></g>` +
        `<rect x="30" y="82" width="36" height="5" fill="#3E4A5E" ${S(1.6)}/>`;
    case 6: // camera
      return `<rect x="14" y="44" width="72" height="50" rx="8" fill="#3E4A5E" ${S(2.6)}/><path d="M34 44 L40 34 L60 34 L66 44 Z" fill="#3E4A5E" ${S(2.2)}/>` +
        `<circle cx="50" cy="69" r="18" fill="#D9DDE6" ${S(2.4)}/><circle cx="50" cy="69" r="11" fill="#2C2A7A" ${S(2)}/><circle cx="46" cy="65" r="3" fill="#FFF"/>` +
        `<rect x="70" y="50" width="10" height="6" rx="2" fill="#FFB000" ${S(1.4)}/>`;
    case 7: // radio
      return `<path d="M30 40 L70 22" ${S(2.6)}/><circle cx="70" cy="22" r="3" fill="${K}"/>` +
        `<rect x="14" y="40" width="72" height="54" rx="10" fill="#E0623B" ${S(2.6)}/>` +
        `<circle cx="36" cy="67" r="14" fill="#F2E3C6" ${S(2)}/>` + [60, 64, 68, 72, 76].map((y) => `<path d="M30 ${y} L42 ${y}" stroke="#8A4A2A" stroke-width="1.6"/>`).join('') +
        `<circle cx="66" cy="58" r="6" fill="#F2E3C6" ${S(1.8)}/><circle cx="66" cy="78" r="6" fill="#F2E3C6" ${S(1.8)}/>`;
    case 8: // airplane
      return `<path d="M12 30 Q22 24 32 30 M66 22 Q76 16 86 22" fill="none" stroke="#FFF" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M10 66 Q14 58 30 58 L80 58 Q94 60 94 66 Q94 72 80 74 L30 74 Q14 74 10 66 Z" fill="${W}" ${S(2.4)}/>` +
        `<path d="M44 58 L32 30 L42 30 L60 58 Z M44 74 L36 100 L46 100 L60 74 Z" fill="#5C7CFF" ${S(2.2)}/>` +
        `<path d="M14 62 L8 46 L18 46 L26 58 Z" fill="#5C7CFF" ${S(2)}/>` + [66, 72, 78].map((x) => `<circle cx="${x}" cy="64" r="2.2" fill="#7FD1FF" ${S(1)}/>`).join('');
    case 9: // steam locomotive
      return `<path d="M2 104 L98 104" ${S(3)}/><rect x="16" y="54" width="44" height="30" rx="4" fill="#2E2E3A" ${S(2.4)}/>` +
        `<rect x="58" y="40" width="26" height="44" fill="#C9302C" ${S(2.4)}/><rect x="64" y="46" width="14" height="12" fill="#7FD1FF" ${S(1.6)}/>` +
        `<rect x="22" y="36" width="10" height="18" fill="#2E2E3A" ${S(2)}/>` +
        `<circle cx="26" cy="22" r="7" fill="${W}" opacity="0.9"/><circle cx="16" cy="12" r="5" fill="${W}" opacity="0.7"/>` +
        `<circle cx="28" cy="92" r="10" fill="#C9302C" ${S(2.2)}/><circle cx="52" cy="92" r="10" fill="#C9302C" ${S(2.2)}/><circle cx="74" cy="94" r="8" fill="#C9302C" ${S(2.2)}/>` +
        `<path d="M8 84 L16 70 L16 84 Z" fill="#FFB000" ${S(1.6)}/>`;
    case 10: // computer
      return `<rect x="12" y="24" width="76" height="54" rx="6" fill="#3E4A5E" ${S(2.6)}/><rect x="18" y="30" width="64" height="42" fill="#2C2A7A"/>` +
        `<path d="M24 40 L34 40 M24 48 L46 48 M24 56 L40 56 M24 64 L52 64" stroke="#3DDC84" stroke-width="3" stroke-linecap="round"/>` +
        `<path d="M42 78 L40 90 L60 90 L58 78" fill="#3E4A5E" ${S(2)}/><rect x="18" y="94" width="64" height="12" rx="3" fill="#D9DDE6" ${S(2)}/>`;
    case 11: // printing press
      return `<rect x="22" y="22" width="56" height="10" fill="#8A5428" ${S(2.2)}/><path d="M28 32 L28 104 M72 32 L72 104" ${S(5)}/>` +
        `<path d="M50 32 L50 58" ${S(4)}/><path d="M36 22 L64 22" ${S(2)}/><rect x="34" y="58" width="32" height="10" fill="#B5793F" ${S(2)}/>` +
        `<rect x="30" y="80" width="40" height="8" fill="#B5793F" ${S(2)}/><rect x="34" y="72" width="32" height="8" fill="${W}" ${S(1.6)}/>` +
        `<path d="M38 75 L60 75 M38 78 L56 78" stroke="${K}" stroke-width="1"/><path d="M16 48 L50 44" ${S(3)}/>`;
    case 12: // robot
      return `<path d="M50 20 L50 30" ${S(2.4)}/><circle cx="50" cy="18" r="4" fill="#FF5A4E" ${S(1.6)}/>` +
        `<rect x="28" y="30" width="44" height="32" rx="8" fill="#B9C6D8" ${S(2.6)}/>` +
        `<circle cx="40" cy="45" r="6" fill="#7FD1FF" ${S(1.8)}/><circle cx="60" cy="45" r="6" fill="#7FD1FF" ${S(1.8)}/><path d="M42 55 L58 55" ${S(2)}/>` +
        `<rect x="32" y="64" width="36" height="34" rx="6" fill="#B9C6D8" ${S(2.4)}/><rect x="42" y="72" width="16" height="10" rx="2" fill="#FFB000" ${S(1.6)}/>` +
        `<path d="M32 70 L18 86 M68 70 L82 86" ${S(5)}/><path d="M40 98 L40 110 M60 98 L60 110" ${S(5)}/>`;
    default:
      return '';
  }
}

// ------------------------------------------------------------------ dinosaurs
function dino(n: number): string {
  const g = ground(108, '#A7D36A');
  switch (n) {
    case 1: // diplodocus
      return g + `<path d="M30 92 Q34 70 56 70 Q72 70 74 84 Q90 86 100 96 Q80 92 72 96 L70 104 L64 104 L62 94 L44 94 L42 104 L36 104 Z" fill="#7FB8A2" ${S(2.2)}/>` +
        `<path d="M36 76 Q20 40 14 24 Q18 16 26 22 Q28 46 46 70" fill="#7FB8A2" ${S(2.2)}/>` + eye(20, 21, 1.8);
    case 2: // stegosaurus
      return g + [26, 38, 50, 62, 74].map((x, i) => `<path d="M${x - 6} ${70 - (i === 2 ? 4 : 0)} L${x} ${50 - (i % 2 ? 4 : 0)} L${x + 6} ${70 - (i === 2 ? 4 : 0)} Z" fill="#FF8A3D" ${S(2)}/>`).join('') +
        `<path d="M14 88 Q20 66 50 66 Q80 66 86 82 L96 76 L94 84 L98 90 L88 90 L82 92 L80 104 L72 104 L70 94 L36 94 L34 104 L26 104 L26 92 Q14 94 8 90 Q8 84 14 88 Z" fill="#8BC34A" ${S(2.2)}/>` + eye(14, 86, 1.8);
    case 3: // ankylosaurus
      return g + `<path d="M18 92 Q20 66 50 64 Q80 66 82 86 Q92 84 92 92 L80 94 L78 104 L70 104 L68 96 L34 96 L32 104 L24 104 L24 96 Q12 96 10 90 Q12 86 18 92 Z" fill="#A9845A" ${S(2.2)}/>` +
        [28, 40, 52, 64, 74].map((x) => `<path d="M${x} 70 L${x + 4} 62 L${x + 8} 70" fill="#E3C79A" ${S(1.6)}/>`).join('') +
        `<circle cx="94" cy="90" r="7" fill="#7A5A3A" ${S(2)}/>` + eye(14, 88, 1.8);
    case 4: // parasaurolophus
      return g + `<path d="M24 104 L28 84 Q22 64 40 56 Q56 50 66 62 Q74 72 92 96 Q76 90 66 88 L64 104 L56 104 L54 88 L36 90 L34 104 Z" fill="#E6B65A" ${S(2.2)}/>` +
        `<path d="M40 56 Q30 38 34 28 Q38 22 44 30 L48 36 Q56 22 74 14 Q60 30 52 42" fill="#E6B65A" ${S(2.2)}/><path d="M48 36 Q60 22 74 14" stroke="#C9302C" stroke-width="5" stroke-linecap="round" fill="none"/>` + eye(40, 38, 1.8);
    case 5: // triceratops
      return g + `<path d="M40 92 Q44 66 70 66 Q92 68 92 88 L86 92 L84 104 L76 104 L74 94 L56 94 L54 104 L46 104 Z" fill="#6FA8DC" ${S(2.2)}/>` +
        `<path d="M44 52 Q20 46 16 66 Q14 84 30 88 Q40 90 46 84 Q54 70 44 52 Z" fill="#9BC5EE" ${S(2.2)}/>` +
        `<path d="M24 74 Q14 78 8 76 Q14 70 22 70 Z M26 62 L8 52 L28 58 Z M34 58 L22 42 L38 56 Z" fill="${W}" ${S(1.6)}/>` + eye(30, 68, 2);
    case 6: // pteranodon
      return `<path d="M50 60 Q30 40 2 46 Q20 58 26 70 Q38 64 50 70 Q62 64 74 70 Q80 58 98 46 Q70 40 50 60 Z" fill="#C98ADC" ${S(2.2)}/>` +
        `<path d="M50 60 Q46 50 40 44 Q48 40 56 46 Q72 38 84 36 Q66 46 58 52 Q56 62 50 70 Z" fill="#B06FCB" ${S(2)}/>` + eye(50, 48, 1.8) +
        `<path d="M10 100 Q30 92 50 100 Q70 108 90 98" fill="none" stroke="#FFF" stroke-width="3" opacity="0.6"/>`;
    case 7: // velociraptor
      return g + `<path d="M22 72 Q24 58 40 58 Q50 58 54 66 Q70 64 96 54 Q78 70 66 76 Q64 86 58 90 L62 104 L54 104 L50 92 L42 92 L40 104 L32 104 L36 88 Q28 82 22 72 Z" fill="#C9A15A" ${S(2.2)}/>` +
        `<path d="M22 72 Q10 72 8 66 Q16 60 26 64" fill="#C9A15A" ${S(2)}/>` + eye(28, 64, 2) +
        `<path d="M38 60 L36 52 L42 56 L44 50 L48 58" fill="#7A5A3A" ${S(1.4)}/><path d="M42 78 L36 84 M46 78 L42 86" ${S(1.8)}/>`;
    case 8: // mammoth
      return ground(108, '#E6F2FF') + `<path d="M22 100 L22 70 Q22 38 54 38 Q84 38 84 70 L84 100 L74 100 L74 86 L36 86 L34 100 Z" fill="#8A5A3A" ${S(2.4)}/>` +
        `<path d="M26 58 Q14 70 18 94 Q24 100 28 94 Q26 80 32 70" fill="#8A5A3A" ${S(2.2)}/>` +
        `<path d="M30 70 Q16 84 30 96 Q22 84 34 74 Z" fill="${W}" ${S(1.8)}/>` + eye(34, 54, 2.4) +
        `<path d="M44 44 L46 52 M54 42 L54 50 M64 44 L62 52 M72 50 L68 56" stroke="#5E3A22" stroke-width="2"/>`;
    case 9: // sabre-tooth cat
      return g + `<path d="M30 104 L30 82 Q24 66 40 60 L72 58 Q90 60 90 76 L90 104 L80 104 L80 88 L44 88 L42 104 Z" fill="#D9A45A" ${S(2.2)}/>` +
        `<circle cx="36" cy="52" r="18" fill="#D9A45A" ${S(2.4)}/><path d="M22 40 L24 30 L32 36 M44 36 L50 30 L50 40" fill="#D9A45A" ${S(1.8)}/>` +
        eye(30, 50, 2.4) + eye(42, 50, 2.4) + `<path d="M30 62 L28 76 L32 64 M40 62 L42 76 L38 64" fill="${W}" ${S(1.4)}/>` +
        `<path d="M34 58 L38 58 L36 61 Z" fill="${K}"/>`;
    case 10: // spinosaurus
      return `<path d="M-2 102 Q50 94 102 102 L102 127 L-2 127 Z" fill="#3E8EF7" opacity="0.7"/>` +
        `<path d="M30 70 Q40 30 58 34 Q74 36 76 68 Z" fill="#FF6F61" ${S(2.2)}/>` + [40, 48, 56, 64, 70].map((x) => `<path d="M${x} 68 L${x} ${44 + Math.abs(56 - x) * 0.6}" stroke="#B83A2E" stroke-width="1.6"/>`).join('') +
        `<path d="M10 70 Q14 62 30 66 L76 66 Q92 70 98 86 Q84 80 76 82 L72 98 L64 98 L62 86 L44 86 L42 98 L34 98 L34 82 Q20 80 10 76 Z" fill="#5E9B6A" ${S(2.2)}/>` + eye(18, 68, 1.8);
    case 11: // brachiosaurus
      return g + `<path d="M30 104 L30 80 Q30 64 52 64 Q74 64 80 80 Q92 84 100 92 Q86 90 80 92 L78 104 L70 104 L70 92 L44 92 L42 104 Z" fill="#9BB86A" ${S(2.2)}/>` +
        `<path d="M34 70 Q34 30 44 16 Q52 10 58 16 Q58 22 52 24 Q46 40 50 66" fill="#9BB86A" ${S(2.2)}/>` + eye(52, 16, 1.8);
    case 12: // T. rex
      return g + `<path d="M36 104 L40 84 Q26 74 30 56 Q32 44 44 40 L70 36 Q84 36 86 48 L86 54 L70 56 Q66 66 64 76 Q78 82 98 96 Q78 92 62 88 L58 104 L50 104 L50 90 L44 90 L44 104 Z" fill="#5E9B4C" ${S(2.4)}/>` +
        `<path d="M70 56 L86 56 L84 62 L72 62" fill="#3F6E33" ${S(1.8)}/><path d="M72 56 L74 60 L76 56 L78 60 L80 56 L82 60" fill="${W}" stroke="${K}" stroke-width="1"/>` +
        eye(72, 44, 2.4) + `<path d="M50 62 L42 68 L46 70" fill="none" ${S(2.2)}/>`;
    default:
      return '';
  }
}

// ------------------------------------------------------------------ food
function plate(y = 96) {
  return `<ellipse cx="50" cy="${y}" rx="42" ry="12" fill="${W}" ${S(2.2)}/><ellipse cx="50" cy="${y - 2}" rx="32" ry="8" fill="#EDE6D6"/>`;
}
function food(n: number): string {
  switch (n) {
    case 1: // falafel in pita
      return `<path d="M18 86 Q14 48 50 40 Q86 48 82 86 Z" fill="#F2D29B" ${S(2.4)}/>` +
        [[34, 56], [50, 50], [66, 56], [42, 66], [58, 66]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="8" fill="#9A5B22" ${S(1.8)}/><circle cx="${x! - 2}" cy="${y! - 2}" r="1.4" fill="#5E8F2E"/>`).join('') +
        `<path d="M22 70 Q34 62 44 72 Q56 62 66 72 Q72 66 80 70" fill="none" stroke="#5FCB52" stroke-width="4" stroke-linecap="round"/>` +
        `<path d="M26 74 Q50 82 74 74" fill="none" stroke="#FF5A4E" stroke-width="3" stroke-linecap="round"/>`;
    case 2: // hummus plate
      return plate(80) + `<ellipse cx="50" cy="76" rx="30" ry="9" fill="#F0D6A0" ${S(1.8)}/>` +
        `<path d="M30 76 Q50 66 70 76" fill="none" stroke="#C99C5A" stroke-width="2"/><ellipse cx="50" cy="74" rx="10" ry="3" fill="#C9B020"/>` +
        `<circle cx="44" cy="72" r="1.6" fill="#B5793F"/><circle cx="56" cy="72" r="1.6" fill="#B5793F"/><circle cx="50" cy="76" r="1.6" fill="#B5793F"/>` +
        `<path d="M58 70 L62 74 M38 74 L42 70" stroke="#5FCB52" stroke-width="2"/><path d="M60 40 Q76 36 84 54 L66 62 Z" fill="#F2D29B" ${S(2)}/>`;
    case 3: // pizza slice
      return `<path d="M50 112 L18 30 Q50 18 82 30 Z" fill="#FFD34D" ${S(2.4)}/><path d="M18 30 Q50 18 82 30 L80 38 Q50 26 20 38 Z" fill="#E09A3A" ${S(2)}/>` +
        [[40, 50], [60, 52], [50, 74], [44, 92], [58, 70]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="5" fill="#E2453A" ${S(1.6)}/>`).join('') +
        `<path d="M36 64 Q34 70 38 72 M62 86 Q66 90 62 92" fill="none" stroke="#5FCB52" stroke-width="3" stroke-linecap="round"/>`;
    case 4: // ice cream cone
      return `<path d="M34 64 L50 112 L66 64 Z" fill="#E6B65A" ${S(2.4)}/><path d="M38 74 L60 90 M62 74 L42 96 M40 66 L64 70" stroke="#B5843A" stroke-width="1.6"/>` +
        `<circle cx="50" cy="56" r="17" fill="#FF9EC7" ${S(2.4)}/><circle cx="50" cy="34" r="14" fill="#8A5428" ${S(2.4)}/>` +
        `<path d="M34 66 Q38 72 42 66 Q46 72 50 66 Q54 72 58 66 Q62 72 66 66" fill="#FF9EC7" ${S(1.8)}/>` +
        `<circle cx="52" cy="18" r="5" fill="#E2453A" ${S(1.6)}/><path d="M52 13 Q56 6 60 8" fill="none" ${S(1.6)}/>`;
    case 5: // sushi
      return plate(98) + [[30, 76], [70, 76]].map(([x, y]) => `<rect x="${x! - 15}" y="${y! - 8}" width="30" height="18" rx="7" fill="${W}" ${S(2)}/><rect x="${x! - 16}" y="${y! - 14}" width="32" height="10" rx="5" fill="#FF7E5F" ${S(2)}/><path d="M${x! - 10} ${y! - 10} L${x! - 4} ${y! - 6} M${x} ${y! - 12} L${x! + 6} ${y! - 6}" stroke="#FFD3C2" stroke-width="1.6"/>`).join('') +
        `<circle cx="50" cy="56" r="13" fill="#1F3B2A" ${S(2)}/><circle cx="50" cy="56" r="9" fill="${W}"/><circle cx="50" cy="56" r="4" fill="#FF7E5F"/>`;
    case 6: // burger
      return `<path d="M18 56 Q18 26 50 26 Q82 26 82 56 Z" fill="#E6A04A" ${S(2.4)}/>` +
        `<path d="M34 36 L36 34 M50 32 L52 30 M64 38 L66 36 M42 44 L44 42 M58 46 L60 44" stroke="${W}" stroke-width="2.4" stroke-linecap="round"/>` +
        `<path d="M14 58 Q24 52 34 60 Q44 52 54 60 Q64 52 74 60 Q82 54 86 58 L84 64 L16 64 Z" fill="#5FCB52" ${S(1.8)}/>` +
        `<rect x="16" y="64" width="68" height="8" fill="#FFD34D" ${S(1.6)}/><rect x="16" y="72" width="68" height="12" rx="5" fill="#7A3E1E" ${S(2)}/>` +
        `<path d="M18 86 L82 86 Q82 98 50 98 Q18 98 18 86 Z" fill="#E6A04A" ${S(2.2)}/>`;
    case 7: // shakshuka pan
      return `<path d="M86 70 L100 64" ${S(6)}/><ellipse cx="48" cy="72" rx="40" ry="22" fill="#2E2E3A" ${S(2.4)}/><ellipse cx="48" cy="70" rx="34" ry="17" fill="#D9452E"/>` +
        [[34, 66], [58, 64], [46, 78]].map(([x, y]) => `<ellipse cx="${x}" cy="${y}" rx="9" ry="7" fill="${W}" ${S(1.4)}/><circle cx="${x}" cy="${y}" r="3.6" fill="#FFC93C"/>`).join('') +
        `<path d="M24 76 L26 74 M66 76 L68 74 M40 58 L42 56" stroke="#5FCB52" stroke-width="2.4" stroke-linecap="round"/>`;
    case 8: // taco
      return `<path d="M14 92 Q14 40 50 40 Q86 40 86 92 Z" fill="#F2C46B" ${S(2.4)}/>` +
        `<path d="M20 64 Q26 52 34 60 Q40 48 50 58 Q58 46 66 58 Q74 50 80 64" fill="#5FCB52" ${S(1.8)}/>` +
        `<path d="M24 70 Q50 60 76 70 L74 76 Q50 68 26 76 Z" fill="#8A4A2A"/><circle cx="36" cy="64" r="3" fill="#E2453A"/><circle cx="60" cy="62" r="3" fill="#E2453A"/>` +
        `<path d="M22 92 Q50 82 78 92" fill="none" stroke="#C9963A" stroke-width="2"/>`;
    case 9: // croissant
      return `<path d="M10 78 Q16 50 50 44 Q84 50 90 78 Q80 84 72 74 Q60 86 50 72 Q40 86 28 74 Q20 84 10 78 Z" fill="#E6A04A" ${S(2.4)}/>` +
        `<path d="M28 74 Q34 58 46 52 M72 74 Q66 58 54 52 M50 72 L50 46" fill="none" stroke="#B56E22" stroke-width="2"/>` +
        `<path d="M30 56 Q36 52 40 54" fill="none" stroke="#FFE0A0" stroke-width="2.6" stroke-linecap="round"/>`;
    case 10: // ramen bowl
      return `<path d="M50 40 Q56 28 50 18 M62 42 Q68 30 62 20 M38 42 Q44 30 38 20" fill="none" stroke="#FFF" stroke-width="2.4" stroke-linecap="round" opacity="0.8"/>` +
        `<path d="M10 60 L90 60 Q88 98 50 100 Q12 98 10 60 Z" fill="#E2453A" ${S(2.4)}/><ellipse cx="50" cy="60" rx="40" ry="9" fill="#F2C46B" ${S(2)}/>` +
        `<path d="M22 60 Q30 54 38 60 Q46 54 54 60 Q62 54 70 60" fill="none" stroke="#FFE58A" stroke-width="2.4"/>` +
        `<ellipse cx="66" cy="58" rx="6" ry="4" fill="${W}" ${S(1.2)}/><circle cx="66" cy="58" r="2.4" fill="#FFB000"/><path d="M30 56 L38 54" stroke="#3DDC84" stroke-width="3"/>` +
        `<path d="M74 58 L96 30 M78 60 L98 36" ${S(2.2)}/>`;
    case 11: // paella pan
      return `<path d="M4 66 L14 68 M86 68 L96 66" ${S(5)}/><ellipse cx="50" cy="70" rx="40" ry="20" fill="#2E2E3A" ${S(2.4)}/><ellipse cx="50" cy="68" rx="34" ry="15" fill="#FFC93C"/>` +
        `<path d="M30 64 Q34 58 40 62 Z M60 60 Q66 56 70 62 Z" fill="#FF7E5F" ${S(1.4)}/><ellipse cx="46" cy="74" rx="6" ry="3.4" fill="#2E2E3A"/><ellipse cx="62" cy="72" rx="6" ry="3.4" fill="#2E2E3A"/>` +
        `<circle cx="36" cy="72" r="2" fill="#3DDC84"/><circle cx="54" cy="64" r="2" fill="#3DDC84"/><path d="M68 76 L76 70" stroke="#FFF3A8" stroke-width="3"/>`;
    case 12: // sufganiya (Hanukkah doughnut)
      return plate(100) + `<ellipse cx="50" cy="72" rx="32" ry="24" fill="#D98A3A" ${S(2.4)}/>` +
        `<path d="M24 62 Q50 46 76 62 Q70 54 50 50 Q30 54 24 62 Z" fill="${W}" opacity="0.9"/>` +
        `<path d="M46 52 Q50 40 56 48 Q58 54 50 56 Z" fill="#C9302C" ${S(1.6)}/>` +
        [[34, 60], [44, 56], [62, 58], [68, 64], [40, 64]].map(([x, y]) => `<circle cx="${x}" cy="${y}" r="1.2" fill="#FFF"/>`).join('');
    default:
      return '';
  }
}

export const KNOWLEDGE_ALBUMS = ['animals', 'wonders', 'space', 'inventions', 'dinos', 'food'] as const;

/** The drawing for a knowledge-album sticker (without background), or '' if unknown. */
export function knowledgeArt(album: string, n: number): string {
  switch (album) {
    case 'animals': return animal(n);
    case 'wonders': return wonder(n);
    case 'space': return space(n);
    case 'inventions': return invention(n);
    case 'dinos': return dino(n);
    case 'food': return food(n);
    default: return '';
  }
}
