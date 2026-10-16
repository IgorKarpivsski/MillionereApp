import type { PackSlug } from '@fm/shared';
import { Image, View } from 'react-native';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';

export const PACK_NAMES: Record<PackSlug, string> = {
  bronze: 'חבילת ארד',
  silver: 'חבילת כסף',
  gold: 'חבילת זהב',
  epic: 'חבילה אפית',
  legendary: 'חבילה אגדית',
};

/* eslint-disable @typescript-eslint/no-require-imports */
/** Cut-out foil packs (transparent background, AI-illustrated, see art manifest). */
export const PACK_IMAGES: Record<PackSlug, number> = {
  bronze: require('../../../assets/packs/bronze_cut.webp'),
  silver: require('../../../assets/packs/silver_cut.webp'),
  gold: require('../../../assets/packs/gold_cut.webp'),
  epic: require('../../../assets/packs/epic_cut.webp'),
  legendary: require('../../../assets/packs/legendary_cut.webp'),
};
export const CARD_BACK_IMAGE: number = require('../../../assets/packs/card_back_tall.webp');
export const STAGE_IMAGE: number = require('../../../assets/packs/stage.webp');
/* eslint-enable @typescript-eslint/no-require-imports */

/** Height / width of the pack images. */
export const PACK_RATIO = 589 / 347;

/** Glow color behind each pack tier. */
export const PACK_GLOW: Record<PackSlug, string> = {
  bronze: '#D98A4E',
  silver: '#9CC8FF',
  gold: '#FFC93C',
  epic: '#C35CFF',
  legendary: '#FF7AD9',
};

/** A 3D foil pack with no background, so it sits on whatever is behind it. */
export function PackArt({ slug, width = 120 }: { slug: PackSlug; width?: number }) {
  const height = width * PACK_RATIO;
  return (
    <View accessible accessibilityRole="image" accessibilityLabel={PACK_NAMES[slug]} style={{ width, height }}>
      <Image source={PACK_IMAGES[slug]} style={{ width, height }} resizeMode="contain" />
    </View>
  );
}

/** The pack with a soft round glow of its tier color behind it. */
export function GlowingPack({ slug, width = 100 }: { slug: PackSlug; width?: number }) {
  const height = width * PACK_RATIO;
  const size = height * 1.15;
  const id = `pg-${slug}`;
  return (
    <View style={{ width, height, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={{ position: 'absolute' }} pointerEvents="none">
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={PACK_GLOW[slug]} stopOpacity={0.7} />
            <Stop offset="0.55" stopColor={PACK_GLOW[slug]} stopOpacity={0.18} />
            <Stop offset="1" stopColor={PACK_GLOW[slug]} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
      <PackArt slug={slug} width={width} />
    </View>
  );
}
