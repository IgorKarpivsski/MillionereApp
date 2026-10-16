import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { colors, radius, space } from '../tokens';

export interface CardProps {
  children: ReactNode;
  /**
   * `panel` — frosted violet glass with a thin gold hairline (default).
   * `sticker` — a featured panel with a glowing gold frame (one per screen).
   * `soft` — a lighter glass for secondary content.
   */
  kind?: 'panel' | 'sticker' | 'soft';
  /** Fill override for special cards (e.g. the welcome gift). */
  tint?: string;
  /** Frame color override for `sticker`. */
  frame?: string;
  style?: ViewStyle;
  padding?: number;
}

const GLASS: Record<NonNullable<CardProps['kind']>, readonly [string, string]> = {
  panel: ['rgba(58,40,138,0.78)', 'rgba(20,12,51,0.88)'],
  sticker: ['#43299A', '#170D3A'],
  soft: ['rgba(80,60,170,0.55)', 'rgba(40,26,99,0.7)'],
};

/** Premium glass panel: violet gradient, a light sheen on top, a gold hairline frame. */
export function Card({ children, kind = 'panel', tint, frame, style, padding = space.lg }: CardProps) {
  const featured = kind === 'sticker';
  const edge = featured ? (frame ?? colors.led) : 'rgba(255,214,140,0.22)';
  return (
    <View
      style={[
        styles.face,
        { padding, borderColor: edge, borderWidth: featured ? 2 : 1 },
        featured && { backgroundColor: '#170D3A', shadowColor: edge, shadowOpacity: 0.6, shadowRadius: 14, elevation: 10 },
        tint ? { backgroundColor: tint } : null,
        style,
      ]}
    >
      {tint ? null : <LinearGradient colors={GLASS[kind]} start={{ x: 0, y: 0 }} end={{ x: 0.4, y: 1 }} style={StyleSheet.absoluteFill} />}
      <LinearGradient
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        locations={[0, 0.5]}
        style={styles.sheen}
        pointerEvents="none"
      />
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  face: { borderRadius: radius.card, overflow: 'hidden', backgroundColor: 'rgba(20,12,51,0.6)' },
  sheen: { position: 'absolute', top: 0, left: 0, right: 0, height: 60 },
});

/** Hairline gold edge used by glass surfaces. */
export const GLASS_EDGE = 'rgba(255,214,140,0.24)';

/**
 * Drop-in glass fill for custom surfaces (top bar, tab bar, list rows):
 * put it as the first child of a view with `overflow: 'hidden'` and a radius.
 */
export function GlassFill({ strong = false }: { strong?: boolean }) {
  return (
    <>
      <LinearGradient
        pointerEvents="none"
        colors={strong ? ['rgba(52,34,128,0.96)', 'rgba(18,10,46,0.98)'] : GLASS.panel}
        start={{ x: 0, y: 0 }}
        end={{ x: 0.4, y: 1 }}
        style={StyleSheet.absoluteFill}
      />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(255,255,255,0.10)', 'rgba(255,255,255,0)']}
        locations={[0, 0.6]}
        style={StyleSheet.absoluteFill}
      />
    </>
  );
}

/** A soft top gloss for bright gradient tiles (makes flat color look like lit glass). */
export function Sheen({ strength = 0.28 }: { strength?: number }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[`rgba(255,255,255,${strength})`, 'rgba(255,255,255,0)', 'rgba(0,0,0,0.18)']}
      locations={[0, 0.48, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}
