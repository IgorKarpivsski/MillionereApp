import type { PackSlug } from '@fm/shared';
import Svg, { Circle, Defs, LinearGradient, Path, Rect, Stop } from 'react-native-svg';

export const PACK_NAMES: Record<PackSlug, string> = {
  bronze: 'חבילת ארד',
  silver: 'חבילת כסף',
  gold: 'חבילת זהב',
  epic: 'חבילה אפית',
  legendary: 'חבילה אגדית',
};

const FOIL: Record<PackSlug, [string, string, string]> = {
  bronze: ['#8A4B22', '#D98A4E', '#F2B98A'],
  silver: ['#7D8794', '#C9CED6', '#F4F6F8'],
  gold: ['#A86F00', '#FFB000', '#FFE08A'],
  epic: ['#4B2C9E', '#B49CFF', '#E3D9FF'],
  legendary: ['#8E1A12', '#FF5A4E', '#FFC2B8'],
};

// LED trophy dots (same mark as the app logo), scaled into the pack face.
const DOTS: Array<[number, number]> = [
  [30, 20], [46, 20], [62, 20], [78, 20], [94, 20], [110, 20], [14, 36], [30, 36], [46, 36], [62, 36], [78, 36], [94, 36],
  [110, 36], [126, 36], [14, 52], [46, 52], [62, 52], [78, 52], [94, 52], [126, 52], [30, 68], [46, 68], [62, 68], [78, 68],
  [94, 68], [110, 68], [62, 84], [78, 84], [62, 100], [78, 100], [46, 116], [62, 116], [78, 116], [94, 116],
];

/** A foil pack with crimped ends and the trophy mark. Original art. */
export function PackArt({ slug, width = 120 }: { slug: PackSlug; width?: number }) {
  const [d, m, l] = FOIL[slug];
  const h = width * 1.45;
  const id = `foil-${slug}`;
  return (
    <Svg width={width} height={h} viewBox="0 0 100 145" accessibilityLabel={PACK_NAMES[slug]}>
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="1" y2="1">
          <Stop offset="0" stopColor={d} />
          <Stop offset="0.45" stopColor={m} />
          <Stop offset="0.6" stopColor={l} />
          <Stop offset="1" stopColor={d} />
        </LinearGradient>
      </Defs>
      <Path d="M8 10 L92 10 L92 135 L8 135 Z" fill={`url(#${id})`} stroke="#1A1714" strokeWidth={2.5} />
      {Array.from({ length: 12 }, (_, i) => (
        <Path key={`t${i}`} d={`M${8 + i * 7} 10 L${11.5 + i * 7} 4 L${15 + i * 7} 10 Z`} fill={d} />
      ))}
      {Array.from({ length: 12 }, (_, i) => (
        <Path key={`b${i}`} d={`M${8 + i * 7} 135 L${11.5 + i * 7} 141 L${15 + i * 7} 135 Z`} fill={d} />
      ))}
      <Rect x={18} y={36} width={64} height={64} rx={10} fill="#06130F" opacity={0.85} />
      {DOTS.map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={22 + x * 0.4} cy={41 + y * 0.42} r={2.4} fill={m} />
      ))}
      <Path d="M8 22 L92 22" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.5} />
      <Path d="M8 120 L92 120" stroke="#FFFFFF" strokeOpacity={0.35} strokeWidth={1.5} />
    </Svg>
  );
}
