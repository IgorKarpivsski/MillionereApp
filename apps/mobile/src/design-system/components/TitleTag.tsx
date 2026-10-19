import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useState } from 'react';
import { StyleSheet, View, type LayoutChangeEvent } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../feedback/reducedMotion';
import { AppText } from './AppText';

export type TitleTier = 'basic' | 'rare' | 'epic' | 'legendary';

const LEGENDARY = new Set([
  'מלך הגבעה', 'מלכת הגבעה', 'אלוף החודש', 'אלופת החודש', 'אגדת הליגה',
  'בלתי ניתן לעצירה', 'בלתי ניתנת לעצירה',
]);
const EPIC = new Set([
  'שגריר האלוף', 'שגרירת האלוף', 'כובש הגבעה', 'כובשת הגבעה', 'מהיר כמו הבזק', 'מהירה כמו הבזק',
  'מוח על', 'מושלם', 'מושלמת',
]);
const RARE = new Set([
  'שורד', 'שורדת', 'סוחר ממולח', 'סוחרת ממולחת', 'נדיב הלב', 'נדיבת הלב',
  'זריז כמו ברק', 'מנצח סדרתי', 'מתמיד', 'אספן מדבקות',
]);

/** How special a title is, by name. World champions ("אלוף הגאוגרפיה") count as epic. */
export function titleTier(text: string): TitleTier {
  if (LEGENDARY.has(text)) return 'legendary';
  if (EPIC.has(text) || text.startsWith('אלוף ה') || text.startsWith('אלופת ה')) return 'epic';
  if (RARE.has(text)) return 'rare';
  return 'basic';
}

const LOOK: Record<TitleTier, { bg: [string, string, ...string[]]; text: string; glow: string; border: string; mark: string }> = {
  basic: { bg: ['#2B3A67', '#22305A'], text: '#BFD4FF', glow: 'rgba(120,170,255,0.6)', border: 'rgba(150,190,255,0.55)', mark: '•' },
  rare: { bg: ['#1E8BFF', '#14C8B4'], text: '#FFFFFF', glow: '#5FE6FF', border: '#9FF3FF', mark: '◆' },
  epic: { bg: ['#9B3CFF', '#FF4FB0'], text: '#FFFFFF', glow: '#FF8BE0', border: '#FFB8F0', mark: '✦' },
  legendary: { bg: ['#FFF3A6', '#FFC21A', '#E08A00', '#FFD84D'], text: '#3A2200', glow: '#FFE066', border: '#FFF6C2', mark: '★' },
};

const SIZES = {
  sm: { font: 'caption' as const, padH: 8, padV: 1, radius: 8 },
  md: { font: 'label' as const, padH: 10, padV: 2, radius: 10 },
  lg: { font: 'bodyStrong' as const, padH: 14, padV: 4, radius: 14 },
};

/**
 * A player's title as a small glowing badge under their name.
 * Rare titles glow, epic ones pulse, legendary ones shimmer in gold.
 */
export const TitleTag = memo(function TitleTag({
  title,
  size = 'md',
  center = false,
}: {
  title: string;
  size?: keyof typeof SIZES;
  center?: boolean;
}) {
  const tier = titleTier(title);
  const look = LOOK[tier];
  const s = SIZES[size];
  const reduced = useReducedMotion();
  const [w, setW] = useState(0);
  const sweep = useSharedValue(0);
  const pulse = useSharedValue(0);

  useEffect(() => {
    if (reduced) return;
    if (tier === 'legendary' || tier === 'epic') {
      sweep.value = withRepeat(
        withSequence(withTiming(1, { duration: 1300, easing: Easing.inOut(Easing.quad) }), withDelay(tier === 'legendary' ? 900 : 2200, withTiming(0, { duration: 0 }))),
        -1,
      );
    }
    if (tier !== 'basic') {
      pulse.value = withRepeat(withTiming(1, { duration: tier === 'rare' ? 1600 : 1100, easing: Easing.inOut(Easing.sin) }), -1, true);
    }
  }, [reduced, tier, sweep, pulse]);

  const shine = useAnimatedStyle(() => ({ transform: [{ translateX: (sweep.value * 2 - 1) * (w / 2 + 50) }, { skewX: '-20deg' }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.5, transform: [{ scale: 1 + pulse.value * 0.06 }] }));
  const onLayout = (e: LayoutChangeEvent) => setW(e.nativeEvent.layout.width);

  return (
    <View style={[styles.wrap, center && styles.center]} accessibilityRole="text" accessibilityLabel={title}>
      {tier !== 'basic' ? (
        <Animated.View pointerEvents="none" style={[styles.halo, { borderRadius: s.radius + 4, backgroundColor: look.glow }, halo]} />
      ) : null}
      <View onLayout={onLayout} style={[styles.chip, { borderRadius: s.radius, borderColor: look.border, paddingHorizontal: s.padH, paddingVertical: s.padV }]}>
        <LinearGradient colors={look.bg} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        {/* glossy top half */}
        <LinearGradient colors={['rgba(255,255,255,0.35)', 'rgba(255,255,255,0)']} style={styles.gloss} pointerEvents="none" />
        {tier === 'legendary' || tier === 'epic' ? (
          <View pointerEvents="none" style={styles.shineTrack}>
            <Animated.View style={[styles.shine, shine]}>
              <LinearGradient
                colors={['rgba(255,255,255,0)', 'rgba(255,255,255,0.85)', 'rgba(255,255,255,0)']}
                start={{ x: 0, y: 0.5 }}
                end={{ x: 1, y: 0.5 }}
                style={StyleSheet.absoluteFill}
              />
            </Animated.View>
          </View>
        ) : null}
        <AppText
          variant={s.font}
          color={look.text}
          numberOfLines={1}
          style={[
            styles.text,
            tier !== 'legendary' && { textShadowColor: look.glow, textShadowRadius: tier === 'basic' ? 4 : 8, textShadowOffset: { width: 0, height: 0 } },
            tier === 'legendary' && styles.goldText,
          ]}
        >
          {`${look.mark} ${title} ${look.mark}`}
        </AppText>
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignSelf: 'flex-start', alignItems: 'center', justifyContent: 'center' },
  center: { alignSelf: 'center' },
  halo: { position: 'absolute', top: -3, bottom: -3, left: -4, right: -4 },
  chip: { overflow: 'hidden', borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  gloss: { position: 'absolute', top: 0, left: 0, right: 0, height: '50%' },
  shineTrack: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  shine: { width: 44, height: '140%' },
  text: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  goldText: { textShadowColor: 'rgba(255,255,255,0.9)', textShadowRadius: 2, textShadowOffset: { width: 0, height: 1 } },
});
