import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, lip, palette, radius, space, stickerBorder } from '../tokens';

export interface CardProps {
  children: ReactNode;
  /** `panel` for containers; `sticker` adds the white die-cut edge for featured items. */
  kind?: 'panel' | 'sticker';
  /** Accent fill for featured cards (e.g. the daily challenge). */
  tint?: string;
  style?: ViewStyle;
  padding?: number;
}

export function Card({ children, kind = 'panel', tint, style, padding = space.lg }: CardProps) {
  const isSticker = kind === 'sticker';
  return (
    <View style={[styles.wrap, style]}>
      <View style={[styles.lip, { top: lip.card }]} />
      <View
        style={[
          styles.face,
          { padding, backgroundColor: tint ?? colors.surface },
          isSticker
            ? { borderWidth: stickerBorder, borderColor: colors.sticker }
            : { borderWidth: 2, borderColor: colors.border },
        ]}
      >
        {children}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { paddingBottom: lip.card },
  lip: {
    position: 'absolute',
    start: 0,
    end: 0,
    bottom: 0,
    borderRadius: radius.card,
    backgroundColor: palette.night950,
  },
  face: { borderRadius: radius.card, overflow: 'hidden' },
});
