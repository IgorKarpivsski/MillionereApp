import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';

/** Tier colors: bronze, silver, gold, diamond, champions. */
export const TIER_COLORS: ReadonlyArray<[string, string, string]> = [
  ['#E9A36A', '#B8682F', '#7A3F14'],
  ['#E8EDF2', '#A9B4C0', '#5E6B78'],
  ['#FFD34D', '#FFB000', '#9A6400'],
  ['#BDEBFF', '#59B8F0', '#1F5F8A'],
  ['#D9C9FF', '#9B6BFF', '#4B2A9E'],
];

/** Original league crest: a shield with a ball, more ornaments as tiers rise. */
export function leagueBadgeSvg(tier: number, size: number): string {
  const [hi, mid, dk] = TIER_COLORS[Math.max(0, Math.min(4, tier))]!;
  const ink = '#10241D';
  const stars = Array.from({ length: tier }, (_, i) => {
    const x = 24 + (i - (tier - 1) / 2) * 7;
    return `<path d="M${x} 3.6 l1.3 2.7 3 .4 -2.2 2 .6 3 -2.7 -1.5 -2.7 1.5 .6 -3 -2.2 -2 3 -.4 Z" fill="#FFF3B0" stroke="${ink}" stroke-width="1"/>`;
  }).join('');
  const wings = tier >= 3
    ? `<path d="M9 22 Q1 20 2 12 Q6 18 11 17 Z M39 22 Q47 20 46 12 Q42 18 37 17 Z" fill="${hi}" stroke="${ink}" stroke-width="1.6" stroke-linejoin="round"/>`
    : '';
  const crown = tier === 4
    ? `<path d="M17 9 L18 3 L21 6 L24 1.5 L27 6 L30 3 L31 9 Z" fill="#FFD34D" stroke="${ink}" stroke-width="1.4" stroke-linejoin="round"/>`
    : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 48 48">` +
    wings +
    `<path d="M24 8 L39 13 L38 28 Q36 39 24 45 Q12 39 10 28 L9 13 Z" fill="#FFF8EA" stroke="#FFF8EA" stroke-width="5.5" stroke-linejoin="round"/>` +
    `<path d="M24 8 L39 13 L38 28 Q36 39 24 45 Q12 39 10 28 L9 13 Z" fill="${mid}" stroke="${ink}" stroke-width="2.4" stroke-linejoin="round"/>` +
    `<path d="M24 8 L39 13 L38 28 Q36 39 24 45 Z" fill="${dk}" opacity="0.35"/>` +
    `<path d="M14 15 L23 12" stroke="${hi}" stroke-width="2.6" stroke-linecap="round"/>` +
    `<circle cx="24" cy="27" r="8.5" fill="#FFF8EA" stroke="${ink}" stroke-width="2"/>` +
    `<path d="M24 22.5 L28.2 25.6 L26.6 30.5 L21.4 30.5 L19.8 25.6 Z" fill="${ink}"/>` +
    (tier === 4 ? crown : stars) +
    `</svg>`;
}

export const LeagueBadge = memo(function LeagueBadge({ tier, size = 56, label }: { tier: number; size?: number; label?: string }) {
  const xml = useMemo(() => leagueBadgeSvg(tier, size), [tier, size]);
  return (
    <View accessible={!!label} accessibilityRole={label ? 'image' : undefined} accessibilityLabel={label} style={{ width: size, height: size }}>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
});
