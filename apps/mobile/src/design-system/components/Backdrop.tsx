import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo } from 'react';
import { Image, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle, Defs, RadialGradient, Stop } from 'react-native-svg';
import { useReducedMotion } from '../feedback/reducedMotion';
import { palette } from '../tokens';

/* eslint-disable @typescript-eslint/no-require-imports */
/** The AI "spotlight stage" from the pack screen; only its top part (the light) is shown. */
const STAGE = require('../../../assets/packs/stage.webp');
/* eslint-enable @typescript-eslint/no-require-imports */
const STAGE_RATIO = 1344 / 752;

/** One tiny gold light drifting slowly upward. */
function Mote({ x, delay, size, height, duration, color }: { x: number; delay: number; size: number; height: number; duration: number; color: string }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1));
    return () => cancelAnimation(p);
  }, [p, delay, duration]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.2, 0.7, 1], [0, 0.75, 0.5, 0]),
    transform: [{ translateY: height * (1 - p.value) }, { translateX: Math.sin(p.value * Math.PI * 2) * 10 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', top: 0, left: x, width: size, height: size, borderRadius: size / 2, backgroundColor: color },
        style,
      ]}
    />
  );
}

/** Deterministic pseudo-random so motes don't jump between renders. */
function rand(i: number, salt: number) {
  const v = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return v - Math.floor(v);
}

/**
 * The premium backdrop every screen sits on: a soft spotlight falling on a deep
 * violet night, gold bokeh, a few drifting lights, and a dark floor so text
 * at the bottom stays readable. Same look as the pack-opening stage.
 */
export const Backdrop = memo(function Backdrop({ motes = 9, accent }: { motes?: number; accent?: string }) {
  const { width, height } = useWindowDimensions();
  const reduced = useReducedMotion();
  // Tall enough that the podium at the bottom of the art stays off-screen.
  const imgH = Math.max(height * 1.42, width * STAGE_RATIO);
  const list = useMemo(
    () =>
      Array.from({ length: motes }, (_, i) => ({
        x: rand(i, 1) * width,
        delay: rand(i, 2) * 6000,
        size: 2 + rand(i, 3) * 3,
        duration: 9000 + rand(i, 4) * 6000,
        color: i % 3 === 0 ? '#FFFFFF' : '#FFD27A',
      })),
    [motes, width],
  );
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.root]}>
      <Image source={STAGE} style={{ position: 'absolute', top: 0, left: 0, width, height: imgH }} resizeMode="cover" />
      {accent ? (
        <LinearGradient colors={[accent + '55', accent + '00']} locations={[0, 0.55]} style={StyleSheet.absoluteFill} />
      ) : null}
      <LinearGradient
        colors={['rgba(20,12,51,0.15)', 'rgba(20,12,51,0.45)', 'rgba(14,8,38,0.92)']}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFill}
      />
      {reduced ? null : list.map((m, i) => <Mote key={i} {...m} height={height} />)}
    </View>
  );
});

const styles = StyleSheet.create({
  root: { backgroundColor: palette.night950, overflow: 'hidden' },
});

/** A soft round light (static) to place behind a hero element: avatar, trophy, prize. */
export function Glow({ color = '#FFB000', size = 220, strength = 0.55 }: { color?: string; size?: number; strength?: number }) {
  const id = `glow${color.replace(/[^0-9a-z]/gi, '')}${size}`;
  return (
    <View pointerEvents="none" style={{ position: 'absolute', width: size, height: size }}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor={color} stopOpacity={strength} />
            <Stop offset="0.5" stopColor={color} stopOpacity={strength * 0.3} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </View>
  );
}
