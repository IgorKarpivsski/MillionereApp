import type { PackSlug } from '@fm/shared';
import { Image, View } from 'react-native';

export const PACK_NAMES: Record<PackSlug, string> = {
  bronze: 'חבילת ארד',
  silver: 'חבילת כסף',
  gold: 'חבילת זהב',
  epic: 'חבילה אפית',
  legendary: 'חבילה אגדית',
};

/* eslint-disable @typescript-eslint/no-require-imports */
export const PACK_IMAGES: Record<PackSlug, number> = {
  bronze: require('../../../assets/packs/bronze.webp'),
  silver: require('../../../assets/packs/silver.webp'),
  gold: require('../../../assets/packs/gold.webp'),
  epic: require('../../../assets/packs/epic.webp'),
  legendary: require('../../../assets/packs/legendary.webp'),
};
/* eslint-enable @typescript-eslint/no-require-imports */

/** Glow color behind each pack tier. */
export const PACK_GLOW: Record<PackSlug, string> = {
  bronze: '#D98A4E',
  silver: '#9CC8FF',
  gold: '#FFC93C',
  epic: '#C35CFF',
  legendary: '#FF7AD9',
};

/** A 3D foil pack (AI-illustrated, see tools art manifest). */
export function PackArt({ slug, width = 120 }: { slug: PackSlug; width?: number }) {
  const height = width * 1.45;
  return (
    <View
      accessible
      accessibilityRole="image"
      accessibilityLabel={PACK_NAMES[slug]}
      style={{ width, height, borderRadius: width * 0.08, overflow: 'hidden' }}
    >
      <Image source={PACK_IMAGES[slug]} style={{ width, height }} resizeMode="cover" />
    </View>
  );
}
