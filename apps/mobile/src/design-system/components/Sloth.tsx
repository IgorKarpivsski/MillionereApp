/* eslint-disable @typescript-eslint/no-require-imports */
import { useEffect } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { useReducedMotion } from '../feedback/reducedMotion';
import { colors, palette, space } from '../tokens';
import { AppText } from './AppText';

const FULL = require('../../../assets/mascot/sloth.webp');
const HEAD = require('../../../assets/mascot/sloth_head.webp');
const FULL_RATIO = 946 / 728; // height / width of the cut-out
const HEAD_RATIO = 0.62 * FULL_RATIO;

/**
 * "העצלן" — the app's mascot. Breathes gently (unless reduced motion is on),
 * and can say something in a speech bubble.
 */
export function Sloth({
  size = 150,
  say,
  head = false,
  flip = false,
  bob = true,
  bubbleSide = 'top',
  style,
}: {
  /** width in px */
  size?: number;
  say?: string;
  head?: boolean;
  flip?: boolean;
  bob?: boolean;
  bubbleSide?: 'top' | 'side';
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced || !bob) return;
    t.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, bob, t]);
  const anim = useAnimatedStyle(() => ({
    transform: [
      { translateY: -4 * t.value },
      { rotate: `${(flip ? -1 : 1) * (t.value - 0.5) * 3}deg` },
      { scaleX: flip ? -1 : 1 },
    ],
  }));
  const h = size * (head ? HEAD_RATIO : FULL_RATIO);
  return (
    <View style={[styles.wrap, bubbleSide === 'side' && styles.row, style]} importantForAccessibility="no-hide-descendants">
      {say ? <Speech text={say} side={bubbleSide} /> : null}
      <Animated.View style={anim}>
        <Image source={head ? HEAD : FULL} style={{ width: size, height: h }} resizeMode="contain" />
      </Animated.View>
    </View>
  );
}

function Speech({ text, side }: { text: string; side: 'top' | 'side' }) {
  const reduced = useReducedMotion();
  const pop = useSharedValue(reduced ? 1 : 0.6);
  useEffect(() => {
    if (reduced) return;
    pop.value = withDelay(250, withSequence(withTiming(1.06, { duration: 220 }), withTiming(1, { duration: 160 })));
  }, [reduced, pop, text]);
  const s = useAnimatedStyle(() => ({ transform: [{ scale: pop.value }] }));
  return (
    <Animated.View entering={reduced ? undefined : FadeIn.delay(200)} style={[styles.bubble, side === 'side' && styles.bubbleSide, s]}>
      <AppText variant="label" color={palette.night950} align="center" style={styles.bold}>
        {text}
      </AppText>
      <View style={[styles.tail, side === 'side' ? styles.tailSide : styles.tailDown]} />
    </Animated.View>
  );
}

/** A small round sloth face, for buttons and badges. */
export function SlothFace({ size = 32 }: { size?: number }) {
  return (
    <View style={[styles.face, { width: size, height: size, borderRadius: size / 2 }]}>
      <Image source={HEAD} style={{ width: size * 1.25, height: size * 1.25 * HEAD_RATIO, marginTop: size * 0.12 }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
  bubble: {
    backgroundColor: '#FFF8EA',
    borderRadius: 18,
    paddingHorizontal: space.md,
    paddingVertical: space.xs + 2,
    marginBottom: 10,
    maxWidth: 230,
    borderWidth: 2,
    borderColor: colors.led,
    shadowColor: '#000',
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 6,
  },
  bubbleSide: { marginBottom: 0, maxWidth: 180 },
  tail: { position: 'absolute', width: 14, height: 14, backgroundColor: '#FFF8EA', borderColor: colors.led },
  tailDown: { bottom: -8, alignSelf: 'center', transform: [{ rotate: '45deg' }], borderRightWidth: 2, borderBottomWidth: 2 },
  tailSide: { end: -8, top: '40%', transform: [{ rotate: '-45deg' }], borderRightWidth: 2, borderBottomWidth: 2 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  face: { backgroundColor: '#6A2BD8', alignItems: 'center', justifyContent: 'center', overflow: 'hidden', borderWidth: 1.5, borderColor: '#FFE7A0' },
});
