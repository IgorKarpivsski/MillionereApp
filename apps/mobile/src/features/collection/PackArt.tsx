import type { PackSlug } from '@fm/shared';
import { useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { packSvg } from './packScenes';

export const PACK_NAMES: Record<PackSlug, string> = {
  bronze: 'חבילת ארד',
  silver: 'חבילת כסף',
  gold: 'חבילת זהב',
  epic: 'חבילה אפית',
  legendary: 'חבילה אגדית',
};

/** A foil pack with an illustrated scene per tier (see ./packArt.ts). Original art. */
export function PackArt({ slug, width = 120 }: { slug: PackSlug; width?: number }) {
  const xml = useMemo(() => packSvg(slug, width, `${slug}${Math.round(width)}`), [slug, width]);
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={PACK_NAMES[slug]} style={{ width, height: width * 1.45 }}>
      <SvgXml xml={xml} width={width} height={width * 1.45} />
    </View>
  );
}
