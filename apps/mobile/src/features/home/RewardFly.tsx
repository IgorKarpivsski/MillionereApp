import type { Reward } from '@fm/shared';
import { useEffect, useRef, useState } from 'react';
import { StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  runOnJS,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { create } from 'zustand';
import { AppText, CoinIcon, GemIcon } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors } from '@/design-system/tokens';
import { RewardIcon } from '@/features/engage/rewards';

type Point = { x: number; y: number };
type Kind = 'coins' | 'gems' | 'other';

interface Flight {
  id: number;
  from: Point;
  kind: Kind;
  label: string;
  reward?: Reward;
}

interface FlyStore {
  targets: Partial<Record<Kind, Point>>;
  flights: Flight[];
  pulse: Record<Kind, number>;
  setTarget: (k: Kind, p: Point) => void;
  launch: (f: Omit<Flight, 'id'>) => void;
  land: (id: number, k: Kind) => void;
}

let seq = 1;
export const useFly = create<FlyStore>((set) => ({
  targets: {},
  flights: [],
  pulse: { coins: 0, gems: 0, other: 0 },
  setTarget: (k, p) => set((s) => ({ targets: { ...s.targets, [k]: p } })),
  launch: (f) => set((s) => ({ flights: [...s.flights, { ...f, id: seq++ }] })),
  land: (id, k) => set((s) => ({ flights: s.flights.filter((x) => x.id !== id), pulse: { ...s.pulse, [k]: s.pulse[k] + 1 } })),
}));

export function kindOf(r: Reward): Kind {
  return r.kind === 'coins' ? 'coins' : r.kind === 'gems' ? 'gems' : 'other';
}

const PARTICLES = 9;

function Particle({ f, i, to }: { f: Flight; i: number; to: Point }) {
  const t = useSharedValue(0);
  const land = useFly((s) => s.land);
  const last = i === PARTICLES - 1;
  // fan out a little before flying to the meter
  const spread = ((i % 3) - 1) * 46 + (i % 2 ? 12 : -12);
  const lift = 60 + (i % 4) * 22;
  useEffect(() => {
    t.value = withDelay(
      120 + i * 55,
      withTiming(1, { duration: 760, easing: Easing.inOut(Easing.cubic) }, (done) => {
        if (done && last) runOnJS(land)(f.id, f.kind);
      }),
    );
  }, [t, i, last, land, f.id, f.kind]);
  const style = useAnimatedStyle(() => {
    const p = t.value;
    const cx = f.from.x + spread;
    const cy = Math.min(f.from.y, to.y) - lift;
    const x = (1 - p) * (1 - p) * f.from.x + 2 * (1 - p) * p * cx + p * p * to.x;
    const y = (1 - p) * (1 - p) * f.from.y + 2 * (1 - p) * p * cy + p * p * to.y;
    return {
      opacity: p < 0.02 ? 0 : p > 0.96 ? (1 - p) * 25 : 1,
      transform: [{ translateX: x - 14 }, { translateY: y - 14 }, { scale: 1.25 - 0.55 * p }],
    };
  });
  return (
    <Animated.View style={[styles.particle, style]}>
      {f.kind === 'coins' ? <CoinIcon size={28} /> : f.kind === 'gems' ? <GemIcon size={28} /> : f.reward ? <RewardIcon r={f.reward} size={28} /> : <CoinIcon size={28} />}
    </Animated.View>
  );
}

function Burst({ f }: { f: Flight }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withTiming(1, { duration: 1300, easing: Easing.out(Easing.cubic) });
  }, [t]);
  const ring = useAnimatedStyle(() => ({
    opacity: 1 - t.value,
    transform: [{ translateX: f.from.x - 60 }, { translateY: f.from.y - 60 }, { scale: 0.3 + t.value * 1.6 }],
  }));
  const label = useAnimatedStyle(() => ({
    opacity: t.value < 0.75 ? 1 : (1 - t.value) * 4,
    transform: [{ translateX: f.from.x - 80 }, { translateY: f.from.y - 30 - t.value * 70 }, { scale: 0.8 + Math.min(t.value * 3, 1) * 0.4 }],
  }));
  return (
    <>
      <Animated.View style={[styles.ring, ring]} />
      <Animated.View style={[styles.label, label]}>
        <AppText variant="heading" color={colors.led} align="center" style={styles.labelText}>
          {f.label}
        </AppText>
      </Animated.View>
    </>
  );
}

function Single({ f, origin }: { f: Flight; origin: Point }) {
  const targets = useFly((s) => s.targets);
  const { width } = useWindowDimensions();
  const t0 = targets[f.kind] ?? targets.coins ?? { x: width * 0.2, y: 60 };
  const to = { x: t0.x - origin.x, y: t0.y - origin.y };
  return (
    <>
      <Burst f={f} />
      {Array.from({ length: PARTICLES }, (_, i) => (
        <Particle key={i} f={f} i={i} to={to} />
      ))}
    </>
  );
}

/** Mounted once at the root: rewards burst out of where they were tapped and fly into the wallet. */
export function RewardFlyHost() {
  const flights = useFly((s) => s.flights);
  const land = useFly((s) => s.land);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!reduced) return;
    for (const f of flights) land(f.id, f.kind);
  }, [reduced, flights, land]);
  const ref = useRef<View>(null);
  const [origin, setOrigin] = useState<Point | null>(null);
  // Always mounted (empty), so we know where this layer sits in the window:
  // positions are measured in window coordinates and shifted by that origin.
  return (
    <View
      ref={ref}
      collapsable={false}
      pointerEvents="none"
      onLayout={() => ref.current?.measureInWindow((x, y) => setOrigin({ x, y }))}
      style={styles.layer}
    >
      {!reduced && origin
        ? flights.map((f) => (
            <Single key={f.id} f={{ ...f, from: { x: f.from.x - origin.x, y: f.from.y - origin.y } }} origin={origin} />
          ))
        : null}
    </View>
  );
}

/** Wraps a wallet meter: registers where rewards should land and bumps when they do. */
export function FlyTarget({ kind, children }: { kind: Kind; children: React.ReactNode }) {
  const setTarget = useFly((s) => s.setTarget);
  const pulse = useFly((s) => s.pulse[kind]);
  const scale = useSharedValue(1);
  useEffect(() => {
    if (!pulse) return;
    scale.value = withSequence(withTiming(1.35, { duration: 140 }), withTiming(1, { duration: 220 }));
  }, [pulse, scale]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }] }));
  const ref = useRef<View>(null);
  return (
    <Animated.View style={style}>
      <View
        ref={ref}
        collapsable={false}
        onLayout={() => ref.current?.measureInWindow((x, y, w, h) => setTarget(kind, { x: x + w / 2, y: y + h / 2 }))}
      >
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // physical coordinates: no RTL mirroring of left/top in this layer
  layer: { ...StyleSheet.absoluteFillObject, zIndex: 900, elevation: 900, direction: 'ltr' },
  particle: { position: 'absolute', left: 0, top: 0 },
  ring: {
    position: 'absolute',
    left: 0,
    top: 0,
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 6,
    borderColor: colors.led,
  },
  label: { position: 'absolute', left: 0, top: 0, width: 160 },
  labelText: { textShadowColor: 'rgba(0,0,0,0.7)', textShadowRadius: 6 },
});
