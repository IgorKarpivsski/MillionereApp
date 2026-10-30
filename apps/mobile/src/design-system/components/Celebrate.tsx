import { useEffect, useMemo } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  interpolate,
  type SharedValue,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Path } from 'react-native-svg';
import { useReducedMotion } from '../feedback/reducedMotion';

// eslint-disable-next-line @typescript-eslint/no-require-imports
const TROPHY = require('../../../assets/images/trophy.webp');

const STAR = 'M0 -1 Q0.12 -0.12 1 0 Q0.12 0.12 0 1 Q-0.12 0.12 -1 0 Q-0.12 -0.12 0 -1 Z';
const PARTY = ['#FFC93C', '#FF6FB5', '#3DDC84', '#4FC3F7', '#B14CFF', '#FFFFFF'];

function Spark({ p, angle, dist, size, color, spin }: { p: SharedValue<number>; angle: number; dist: number; size: number; color: string; spin: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.1, 0.7, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: Math.cos(angle) * dist * p.value },
      { translateY: Math.sin(angle) * dist * p.value },
      { rotate: `${p.value * spin}deg` },
      { scale: interpolate(p.value, [0, 0.3, 1], [0.2, 1.2, 0.4]) },
    ],
  }));
  return (
    <Animated.View style={[{ position: 'absolute', width: size, height: size, marginLeft: -size / 2, marginTop: -size / 2 }, style]}>
      <Svg width={size} height={size} viewBox="-1 -1 2 2">
        <Path d={STAR} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/**
 * Sparkling stars bursting out of the middle of their parent (put it inside the thing that
 * earned it). Draws nothing with reduced motion.
 */
export function SparkBurst({ count = 10, radius = 90, delay = 0, colorsList = PARTY }: { count?: number; radius?: number; delay?: number; colorsList?: string[] }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.quad) }));
  }, [p, delay, reduced]);
  const sparks = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2 + Math.random() * 0.5,
        dist: radius * (0.6 + Math.random() * 0.5),
        size: 8 + Math.random() * 12,
        color: colorsList[i % colorsList.length]!,
        spin: (Math.random() > 0.5 ? 1 : -1) * (90 + Math.random() * 180),
      })),
    [count, radius, colorsList],
  );
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={styles.origin}>
      {sparks.map((s, i) => (
        <Spark key={i} p={p} {...s} />
      ))}
    </View>
  );
}

function Piece({ p, x, drift, size, color, spin, delay }: { p: SharedValue<number>; x: number; drift: number; size: number; color: string; spin: number; delay: number }) {
  const { height } = useWindowDimensions();
  const style = useAnimatedStyle(() => {
    const t = Math.max(0, Math.min(1, (p.value - delay) / (1 - delay)));
    return {
      opacity: interpolate(t, [0, 0.05, 0.85, 1], [0, 1, 1, 0]),
      transform: [
        { translateX: x + Math.sin(t * Math.PI * 3) * drift },
        { translateY: -40 + t * (height + 80) },
        { rotate: `${t * spin}deg` },
        { rotateX: `${t * spin * 2}deg` },
      ],
    };
  });
  return <Animated.View style={[{ position: 'absolute', top: 0, left: 0, width: size, height: size * 0.45, borderRadius: 2, backgroundColor: color }, style]} />;
}

/** Confetti raining over the whole screen once (a perfect game, a level up, a full album). */
export function Confetti({ count = 60, delay = 300 }: { count?: number; delay?: number }) {
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const p = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    p.value = withDelay(delay, withTiming(1, { duration: 3200, easing: Easing.linear }));
  }, [p, delay, reduced]);
  const pieces = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        drift: 10 + Math.random() * 30,
        size: 8 + Math.random() * 8,
        color: PARTY[i % PARTY.length]!,
        spin: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
        delay: Math.random() * 0.35,
      })),
    [count, width],
  );
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {pieces.map((s, i) => (
        <Piece key={i} p={p} {...s} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  origin: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
});

/** The 3D golden cup (new records, wins). Pops in with a few sparks. */
export function Trophy3D({ size = 110, burst = true }: { size?: number; burst?: boolean }) {
  const reduced = useReducedMotion();
  const s = useSharedValue(reduced ? 1 : 0.4);
  useEffect(() => {
    if (!reduced) s.value = withSpring(1, { damping: 7, stiffness: 140 });
  }, [s, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: s.value }] }));
  return (
    <Animated.View style={[{ width: size, height: size, alignSelf: 'center' }, style]}>
      {burst ? <SparkBurst count={12} radius={size * 0.9} delay={150} colorsList={['#FFC93C', '#FFFFFF', '#FFE08A']} /> : null}
      <Image source={TROPHY} style={{ width: size, height: size }} resizeMode="contain" accessibilityLabel="גביע" />
    </Animated.View>
  );
}
