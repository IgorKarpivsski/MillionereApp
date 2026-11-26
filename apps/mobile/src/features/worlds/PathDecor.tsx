import { useEffect, useMemo } from 'react';
import { StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withDelay, withRepeat, withTiming } from 'react-native-reanimated';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';

/** Little things that float up the level map, themed per world, so the map feels alive. */
const DECOR: Record<string, string[]> = {
  geography: ['☁️', '🎈', '🕊️', '☁️'],
  history: ['✨', '🍂', '🪶', '✨'],
  science: ['✨', '⚛️', '🫧', '💡'],
  nature: ['🦋', '🍃', '🌸', '🐝'],
  space: ['⭐', '✨', '☄️', '🌟'],
  culture: ['🎨', '✨', '🎭', '🫧'],
  screen: ['🍿', '⭐', '✨', '🎬'],
  music: ['🎵', '🎶', '✨', '🎵'],
  people: ['✨', '⭐', '💡', '🌟'],
  israel: ['🕊️', '☀️', '✨', '🌼'],
  sport: ['🏀', '⚽', '🎾', '✨'],
  food: ['🍓', '🍬', '🫧', '🍒'],
  football: ['⚽', '✨', '⭐', '⚽'],
  hanukkah: ['✨', '🕯️', '⭐', '✨'],
  tech: ['✨', '💡', '🫧', '⚡'],
  gaming: ['⭐', '🪙', '✨', '💎'],
};
const COUNT = 9;

function Floater({ glyph, x, size, delay, duration, height }: { glyph: string; x: number; size: number; delay: number; duration: number; height: number }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1));
  }, [t, delay, duration]);
  const st = useAnimatedStyle(() => {
    const p = t.value;
    return {
      opacity: p < 0.1 ? p * 7 : p > 0.85 ? (1 - p) * 4.6 : 0.7,
      transform: [
        { translateY: height + 40 - p * (height + 120) },
        { translateX: Math.sin(p * Math.PI * 4) * 16 },
        { rotate: `${Math.sin(p * Math.PI * 2) * 18}deg` },
      ],
    };
  });
  return (
    <Animated.View style={[styles.floater, { left: x }, st]}>
      <Text style={{ fontSize: size }}>{glyph}</Text>
    </Animated.View>
  );
}

export function PathDecor({ slug }: { slug: string }) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const glyphs = DECOR[slug] ?? DECOR.science!;
  // fixed pseudo-random layout per world (no Math.random, so it doesn't jump on re-render)
  const items = useMemo(
    () =>
      Array.from({ length: COUNT }, (_, i) => {
        const r = (n: number) => ((Math.sin((i + 1) * 12.9898 + n * 78.233 + slug.length) * 43758.5453) % 1 + 1) % 1;
        // mostly along the edges, where the scenery is, so the road stays clear
        const side = i % 2 === 0 ? r(1) * 0.22 : 0.78 + r(1) * 0.16;
        return { glyph: glyphs[i % glyphs.length]!, x: side * width, size: 16 + r(2) * 14, delay: i * 1400, duration: 11000 + r(3) * 7000 };
      }),
    [glyphs, width, slug],
  );
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {items.map((it, i) => (
        <Floater key={i} {...it} height={height} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  floater: { position: 'absolute', top: 0 },
});
