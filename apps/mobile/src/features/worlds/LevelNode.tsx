import { Ionicons } from '@expo/vector-icons';
import { memo } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';
import Svg, { Circle, Defs, Ellipse, RadialGradient, Stop } from 'react-native-svg';
import { shade } from './worldArt';
import { CHEST_IMAGE } from './worldImages';

/**
 * A glossy, 3D-looking level button: a raised disc in the world's colour with a
 * light rim, a shine on top and a soft shadow. Done levels get a gold rim,
 * locked ones turn to grey stone.
 */
export const LevelNode = memo(function LevelNode({
  size,
  level,
  color,
  state,
  chest,
  label,
  crown = false,
}: {
  size: number;
  level: number;
  /** Number shown on the node (defaults to the level). */
  label?: number;
  /** Champion tier node. */
  crown?: boolean;
  color: string;
  state: 'done' | 'current' | 'open' | 'locked';
  chest: boolean;
}) {
  const locked = state === 'locked';
  const base = locked ? '#8D8AA6' : color;
  const light = locked ? '#C9C6DA' : shade(color, 0.45);
  const dark = locked ? '#55516E' : shade(color, -0.45);
  const rim = state === 'done' ? '#FFD23F' : state === 'current' ? '#FFFFFF' : locked ? '#A9A6BD' : shade(color, 0.7);
  const r = size / 2;
  const id = `n${level}${state}`;
  return (
    <View style={{ width: size, height: size + 8 }}>
      <Svg width={size} height={size + 8}>
        <Defs>
          <RadialGradient id={id} cx="40%" cy="30%" r="75%">
            <Stop offset="0" stopColor={light} />
            <Stop offset="0.55" stopColor={base} />
            <Stop offset="1" stopColor={dark} />
          </RadialGradient>
        </Defs>
        <Ellipse cx={r} cy={size + 2} rx={r * 0.82} ry={6} fill="rgba(0,0,0,0.28)" />
        <Circle cx={r} cy={r + 6} r={r - 3} fill={dark} />
        <Circle cx={r} cy={r} r={r - 3} fill={`url(#${id})`} stroke={rim} strokeWidth={state === 'done' ? 5 : 4} />
        <Ellipse cx={r * 0.82} cy={r * 0.5} rx={r * 0.48} ry={r * 0.22} fill="rgba(255,255,255,0.42)" />
      </Svg>
      <View style={[StyleSheet.absoluteFill, styles.center, { height: size }]}>
        {locked ? (
          <Ionicons name="lock-closed" size={size * 0.36} color="#ECEAF6" />
        ) : chest ? (
          <Image source={CHEST_IMAGE} style={{ width: size * 0.66, height: size * 0.66 }} resizeMode="contain" />
        ) : (
          <Text maxFontSizeMultiplier={1.1} style={[styles.num, { fontSize: size * 0.38 }]}>{label ?? level}</Text>
        )}
      </View>
      {crown && !locked ? (
        <View style={styles.crown} pointerEvents="none">
          <Text style={{ fontSize: size * 0.3 }}>👑</Text>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  crown: { position: 'absolute', top: -14, left: 0, right: 0, alignItems: 'center' },
  center: { alignItems: 'center', justifyContent: 'center' },
  num: {
    color: '#FFFFFF',
    fontFamily: 'IBMPlexSansHebrew_700Bold',
    textShadowColor: 'rgba(0,0,0,0.45)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 3,
  },
});
