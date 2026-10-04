import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, space, stickerBorder } from '../tokens';

export interface CardProps {
  children: ReactNode;
  /**
   * `panel` — the black scoreboard board (default).
   * `sticker` — a featured panel with the LED-amber frame (one per screen).
   * `soft` — the secondary grass-green card.
   */
  kind?: 'panel' | 'sticker' | 'soft';
  /** Fill override for special cards (e.g. the welcome gift). */
  tint?: string;
  /** Frame color override for `sticker`. */
  frame?: string;
  style?: ViewStyle;
  padding?: number;
}

/** Flat scoreboard panel. No shadows: depth comes from the dark board on the grass. */
export function Card({ children, kind = 'panel', tint, frame, style, padding = space.lg }: CardProps) {
  const fill = tint ?? (kind === 'soft' ? colors.surfaceRaised : colors.board);
  const border =
    kind === 'sticker'
      ? { borderWidth: stickerBorder - 1, borderColor: frame ?? colors.led }
      : kind === 'panel'
        ? { borderWidth: 2, borderColor: colors.border }
        : null;
  return <View style={[styles.face, { padding, backgroundColor: fill }, border, style]}>{children}</View>;
}

const styles = StyleSheet.create({
  face: { borderRadius: radius.card, overflow: 'hidden' },
});
