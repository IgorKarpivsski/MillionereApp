import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, radius, rarityColors, space, stickerBorder, type RarityKey } from '../tokens';
import { AppText } from './AppText';

export interface RarityFrameProps {
  rarity: RarityKey;
  children: ReactNode;
  /** Locked items show as a silhouette slot. */
  locked?: boolean;
  width?: number;
}

/**
 * Album sticker: white die-cut edge, rarity-colored frame, rarity ribbon.
 * Card art is supplied by the collectible (original or licensed assets only).
 */
export function RarityFrame({ rarity, children, locked = false, width = 112 }: RarityFrameProps) {
  const r = rarityColors[rarity];
  const height = Math.round(width * 1.35);
  return (
    <View
      accessible
      accessibilityLabel={locked ? 'משבצת ריקה' : `פריט ${r.label}`}
      style={[
        styles.sticker,
        { width, height },
        locked ? styles.locked : { borderColor: colors.sticker, backgroundColor: r.lip },
      ]}
    >
      {locked ? (
        <View style={styles.silhouette}>{children}</View>
      ) : (
        <>
          <View style={[styles.art, { backgroundColor: r.fill }]}>{children}</View>
          <View style={[styles.ribbon, { backgroundColor: r.lip }]}>
            <AppText variant="caption" color={colors.text} numberOfLines={1}>
              {r.label}
            </AppText>
          </View>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  sticker: {
    borderRadius: radius.sticker,
    borderWidth: stickerBorder,
    padding: space.xs,
    overflow: 'hidden',
  },
  locked: {
    borderStyle: 'dashed',
    borderColor: colors.border,
    backgroundColor: colors.bgDeep,
  },
  silhouette: { flex: 1, alignItems: 'center', justifyContent: 'center', opacity: 0.5 },
  art: { flex: 1, borderRadius: radius.sticker - 4, alignItems: 'center', justifyContent: 'center' },
  ribbon: { alignItems: 'center', paddingTop: space.xs },
});
