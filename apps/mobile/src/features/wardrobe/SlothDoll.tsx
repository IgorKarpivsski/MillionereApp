import { useEffect } from 'react';
import { Image, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { Speech } from '@/design-system/components/Sloth';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { DOLL_BASE, DOLL_H, DOLL_W, LAYERS } from './art';

/** Drawing order, bottom to top: clothes, then shoes, jewellery, glasses, and the hat last. */
export const LAYER_ORDER = ['outfit', 'shoes', 'necklace', 'bracelet', 'earrings', 'glasses', 'hat'] as const;

export const DOLL_RATIO = DOLL_H / DOLL_W;

/**
 * The full-body sloth wearing an outfit (slot -> item id). Every item is cut from the same
 * picture of the same pose, so it sits exactly on the body at any size.
 */
export function SlothDoll({
  width,
  outfit,
  say,
  bob = true,
  style,
}: {
  width: number;
  outfit: Record<string, string | undefined | null>;
  say?: string;
  bob?: boolean;
  style?: ViewStyle;
}) {
  const reduced = useReducedMotion();
  const t = useSharedValue(0);
  useEffect(() => {
    if (reduced || !bob) return;
    t.value = withRepeat(withTiming(1, { duration: 2400, easing: Easing.inOut(Easing.sin) }), -1, true);
  }, [reduced, bob, t]);
  const anim = useAnimatedStyle(() => ({ transform: [{ translateY: -4 * t.value }, { rotate: `${(t.value - 0.5) * 2}deg` }] }));
  const k = width / DOLL_W;
  const h = width * DOLL_RATIO;
  return (
    <View style={[styles.wrap, style]} importantForAccessibility="no-hide-descendants">
      {say ? <Speech text={say} side="top" /> : null}
      <Animated.View style={[{ width, height: h }, styles.ltr, anim]}>
        <Image source={DOLL_BASE} style={{ width, height: h }} resizeMode="stretch" />
        {LAYER_ORDER.map((slot) => {
          const id = outfit[slot];
          const l = id ? LAYERS[id] : undefined;
          if (!l) return null;
          const [x, y, w, hh] = l.box;
          return (
            <Image
              key={slot}
              source={l.src}
              resizeMode="stretch"
              style={{ position: 'absolute', left: x * k, top: y * k, width: w * k, height: hh * k }}
            />
          );
        })}
      </Animated.View>
    </View>
  );
}

/** Just one item, framed on its own (shop cards). */
export function ItemThumb({ id, size }: { id: string; size: number }) {
  const l = LAYERS[id];
  if (!l) return <View style={{ width: size, height: size }} />;
  const [, , w, h] = l.box;
  const k = size / Math.max(w, h);
  return (
    <View style={[styles.thumb, { width: size, height: size }]}>
      <Image source={l.src} style={{ width: w * k, height: h * k }} resizeMode="contain" />
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center' },
  ltr: { direction: 'ltr' },
  thumb: { alignItems: 'center', justifyContent: 'center' },
});
