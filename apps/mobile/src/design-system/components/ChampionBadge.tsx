import { avatarSvg, type AvatarSpec } from '@fm/shared';
import { memo, useMemo } from 'react';
import { View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors } from '../tokens';

/** "האלוף" — the game's own rival mascot: a crowned lion in a black tracksuit (original art). */
export const CHAMPION: AvatarSpec = {
  species: 8, skin: 6, face: 0, eyes: 7, brows: 3, mouth: 3, hair: 4, hairColor: 4,
  outfit: 4, outfitColor: 11, bg: 0, accessory: 9,
};

export const ChampionBadge = memo(function ChampionBadge({ size = 56, ring = colors.led }: { size?: number; ring?: string }) {
  const xml = useMemo(() => avatarSvg(CHAMPION, { size, round: true, uid: 'champ' + size }), [size]);
  return (
    <View
      style={{ width: size, height: size, borderRadius: size / 2, borderWidth: 2, borderColor: ring, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' }}
      accessible
      accessibilityRole="image"
      accessibilityLabel="האלוף"
    >
      <SvgXml xml={xml} width={size - 4} height={size - 4} />
    </View>
  );
});
