import type { OpenPackResult, PackSlug } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Image, Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import Animated, {
  Easing,
  FadeIn,
  FadeOut,
  Keyframe,
  runOnJS,
  cancelAnimation,
  interpolate,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
  type SharedValue,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Defs, Path, RadialGradient, Stop } from 'react-native-svg';
import { AppText, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, rarityColors, space } from '@/design-system/tokens';
import { LegendCard } from '@/features/collection/LegendCard';
import { CARD_BACK_IMAGE, PACK_GLOW, PACK_NAMES, PACK_RATIO, PackArt, STAGE_IMAGE } from '@/features/collection/PackArt';
import { collectionApi, requestId } from '@/features/collection/api';
import { useCollection } from '@/features/collection/hooks';
import { RpcError } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';

const t = strings.packs;
const RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'iconic'] as const;
type Rarity = (typeof RANK)[number];
const TAPS = 3;
const PACK_W = 230;
const PACK_H = PACK_W * PACK_RATIO;
const TEAR_Y = PACK_H * 0.13; // just under the crimped top of the foil
const GLOW_GOLD = '#FFE08A';
const SHADOW = { textShadowColor: 'rgba(0,0,0,0.75)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 8 } as const;

/* ------------------------------------------------------------------ */
/* Light & particles                                                   */
/* ------------------------------------------------------------------ */

/** A soft round glow that breathes. Never spins. */
function Halo({ color, size, strength }: { color: string; size: number; strength: SharedValue<number> }) {
  const reduced = useReducedMotion();
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    breath.value = withRepeat(withTiming(1, { duration: 1800, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(breath);
  }, [reduced, breath]);
  const style = useAnimatedStyle(() => ({
    opacity: 0.45 + strength.value * 0.45 + breath.value * 0.1,
    transform: [{ scale: 0.9 + strength.value * 0.35 + breath.value * 0.06 }],
  }));
  const id = `halo${color.replace('#', '')}`;
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size }, style]}>
      <Svg width={size} height={size}>
        <Defs>
          <RadialGradient id={id} cx="50%" cy="50%" r="50%">
            <Stop offset="0" stopColor="#FFFFFF" stopOpacity={0.55} />
            <Stop offset="0.18" stopColor={color} stopOpacity={0.75} />
            <Stop offset="0.5" stopColor={color} stopOpacity={0.22} />
            <Stop offset="1" stopColor={color} stopOpacity={0} />
          </RadialGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={size / 2} fill={`url(#${id})`} />
      </Svg>
    </Animated.View>
  );
}

/** Tiny lights drifting upward across the stage. */
function Mote({ x, delay, color, size, height, duration }: { x: number; delay: number; color: string; size: number; height: number; duration: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withRepeat(withTiming(1, { duration, easing: Easing.linear }), -1));
    return () => cancelAnimation(p);
  }, [p, delay, duration]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.15, 0.75, 1], [0, 0.9, 0.7, 0]),
    transform: [{ translateY: height * (1 - p.value) }, { translateX: Math.sin(p.value * Math.PI * 2) * 12 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[{ position: 'absolute', top: 0, left: x, width: size, height: size, borderRadius: size / 2, backgroundColor: color, shadowColor: color, shadowOpacity: 1, shadowRadius: 6, elevation: 4 }, style]}
    />
  );
}

function Motes({ color, count = 16 }: { color: string; count?: number }) {
  const reduced = useReducedMotion();
  const { width, height } = useWindowDimensions();
  const list = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        x: Math.random() * width,
        delay: Math.random() * 4000,
        size: 2 + Math.random() * 4,
        duration: 5000 + Math.random() * 4000,
        color: i % 3 === 0 ? '#FFFFFF' : color,
      })),
    [count, width, color],
  );
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {list.map((m, i) => (
        <Mote key={i} {...m} height={height} />
      ))}
    </View>
  );
}

/** A ring of light that expands and fades: the "boom" of an opening. */
function Shockwave({ color, size, delay = 0, width = 6 }: { color: string; size: number; delay?: number; width?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 900, easing: Easing.out(Easing.cubic) }));
  }, [p, delay]);
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.1, 1], [0, 1, 0]),
    transform: [{ scale: 0.15 + p.value * 1.1 }],
  }));
  return (
    <Animated.View
      pointerEvents="none"
      style={[
        { position: 'absolute', width: size, height: size, borderRadius: size / 2, borderWidth: width, borderColor: color, shadowColor: color, shadowOpacity: 1, shadowRadius: 16, elevation: 10 },
        style,
      ]}
    />
  );
}

const STAR = 'M0 -1 Q0.12 -0.12 1 0 Q0.12 0.12 0 1 Q-0.12 0.12 -1 0 Q-0.12 -0.12 0 -1 Z';

function Star({ p, angle, dist, size, color, spin }: { p: SharedValue<number>; angle: number; dist: number; size: number; color: string; spin: number }) {
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

/** Sparkling four-point stars bursting outward. */
function StarBurst({ colorsList, count = 14, radius = 180, delay = 0 }: { colorsList: string[]; count?: number; radius?: number; delay?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withDelay(delay, withTiming(1, { duration: 1300, easing: Easing.out(Easing.quad) }));
  }, [p, delay]);
  const stars = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2 + Math.random() * 0.5,
        dist: radius * (0.5 + Math.random() * 0.6),
        size: 12 + Math.random() * 18,
        color: colorsList[i % colorsList.length]!,
        spin: (Math.random() > 0.5 ? 1 : -1) * (90 + Math.random() * 180),
      })),
    [count, radius, colorsList],
  );
  return (
    <View pointerEvents="none" style={styles.origin}>
      {stars.map((s, i) => (
        <Star key={i} p={p} {...s} />
      ))}
    </View>
  );
}

/** A vertical beam of light behind a big card. */
function LightPillar({ color, width }: { color: string; width: number }) {
  const reduced = useReducedMotion();
  const open = useSharedValue(reduced ? 1 : 0);
  const breath = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    open.value = withTiming(1, { duration: 450, easing: Easing.out(Easing.cubic) });
    breath.value = withDelay(450, withRepeat(withTiming(1, { duration: 1400, easing: Easing.inOut(Easing.sin) }), -1, true));
    return () => cancelAnimation(breath);
  }, [reduced, open, breath]);
  const style = useAnimatedStyle(() => ({ opacity: open.value * (0.75 + breath.value * 0.25), transform: [{ scaleX: 0.1 + open.value * 0.9 }] }));
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', top: -2000, bottom: -2000, width }, style]}>
      <LinearGradient
        colors={['transparent', color + '66', '#FFFFFFAA', color + '66', 'transparent']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={StyleSheet.absoluteFill}
      />
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */

function CardBack({ width, hint, rank }: { width: number; hint?: string; rank: number }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(0);
  const shake = useSharedValue(0);
  useEffect(() => {
    if (!hint || reduced) return;
    pulse.value = withRepeat(withTiming(1, { duration: 650, easing: Easing.inOut(Easing.sin) }), -1, true);
    if (rank >= 3) {
      shake.value = withRepeat(
        withSequence(withTiming(-2.5, { duration: 50 }), withTiming(2.5, { duration: 50 }), withTiming(0, { duration: 50 }), withTiming(0, { duration: 900 })),
        -1,
      );
    }
    return () => {
      cancelAnimation(pulse);
      cancelAnimation(shake);
    };
  }, [hint, reduced, rank, pulse, shake]);
  const style = useAnimatedStyle(() =>
    hint ? { shadowOpacity: 0.4 + pulse.value * 0.6, shadowRadius: 8 + pulse.value * 14, transform: [{ rotate: `${shake.value}deg` }] } : {},
  );
  const height = width * 1.25 + 34;
  return (
    <Animated.View
      style={[
        styles.back,
        { width, height, borderColor: hint ?? '#E9C46A' },
        hint ? { shadowColor: hint, elevation: 14 } : null,
        style,
      ]}
    >
      <Image source={CARD_BACK_IMAGE} style={{ width: width - 4, height: height - 4 }} resizeMode="stretch" />
    </Animated.View>
  );
}

/** Cards shoot up out of the opened pack, fanning into place. */
function riseFromPack(index: number, total: number) {
  const side = index - (total - 1) / 2;
  return new Keyframe({
    0: { opacity: 0, transform: [{ translateY: 260 }, { translateX: -side * 24 }, { scale: 0.2 }, { rotate: `${side * 18}deg` }] },
    65: { opacity: 1, transform: [{ translateY: -18 }, { translateX: side * 4 }, { scale: 1.06 }, { rotate: `${-side * 4}deg` }] },
    100: { opacity: 1, transform: [{ translateY: 0 }, { translateX: 0 }, { scale: 1 }, { rotate: '0deg' }] },
  })
    .duration(620)
    .delay(150 + index * 110);
}

type PackItem = OpenPackResult['items'][number];

function FlipCard({
  item,
  revealed,
  onPress,
  width,
  index,
  total,
  glow,
}: {
  item: PackItem;
  revealed: boolean;
  onPress: () => void;
  width: number;
  index: number;
  total: number;
  glow: boolean;
}) {
  const reduced = useReducedMotion();
  const flip = useSharedValue(revealed ? 1 : 0);
  const [face, setFace] = useState(revealed);
  const { data } = useCollection();
  const full = data?.items.find((i) => i.id === item.id);
  const rank = RANK.indexOf(item.rarity as Rarity);
  const r = rarityColors[item.rarity as Rarity];

  useEffect(() => {
    if (!revealed) return;
    if (reduced) {
      flip.value = 1;
      setFace(true);
      return;
    }
    const wait = rank >= 4 ? 380 : rank >= 2 ? 180 : 0; // rarer cards take a breath first
    flip.value = withDelay(wait, withTiming(1, { duration: 480, easing: Easing.inOut(Easing.cubic) }));
    const id = setTimeout(() => setFace(true), wait + 240);
    return () => clearTimeout(id);
  }, [revealed, reduced, flip, rank]);

  const style = useAnimatedStyle(() => {
    const deg = flip.value < 0.5 ? flip.value * 180 : (flip.value - 1) * 180;
    return { transform: [{ perspective: 900 }, { rotateY: `${deg}deg` }, { scale: 1 + Math.sin(flip.value * Math.PI) * 0.14 }] };
  });

  // Before it is turned, a rare card's back already glows in its color.
  const hint = !face && (rank >= 2 || glow) ? (glow ? GLOW_GOLD : r.fill) : undefined;

  return (
    <Animated.View entering={reduced ? undefined : riseFromPack(index, total)} style={styles.cardSlot}>
      {face && rank >= 2 && !reduced ? (
        <View pointerEvents="none" style={styles.fxCenter}>
          <Shockwave color={glow ? GLOW_GOLD : r.fill} size={width * 1.8} width={4} />
        </View>
      ) : null}
      <Pressable onPress={onPress} disabled={revealed} accessibilityRole="button" accessibilityLabel={revealed ? `${full?.name ?? ''}, ${r.label}` : t.tapToFlip}>
        <Animated.View style={style}>
          {face && full ? <LegendCard item={full} width={width} glow={glow} /> : <CardBack width={width} hint={revealed || rank >= 3 ? hint : undefined} rank={rank} />}
        </Animated.View>
      </Pressable>
      {face ? (
        <Animated.View entering={reduced ? undefined : FadeIn.delay(120)} style={[styles.tag, { backgroundColor: glow ? GLOW_GOLD : item.new ? colors.correct : 'rgba(10,6,30,0.85)' }]}>
          <AppText variant="caption" color={glow || item.new ? colors.textOnBright : '#FFFFFF'} style={styles.bold}>
            {glow ? t.glowNew : item.new ? t.newCard : fmt(t.dupe, { n: item.dust })}
          </AppText>
        </Animated.View>
      ) : null}
      {face && rank >= 2 && !reduced ? (
        <View pointerEvents="none" style={styles.fxCenter}>
          <StarBurst colorsList={[r.fill, '#FFFFFF', GLOW_GOLD]} count={rank >= 3 ? 10 : 6} radius={width * 0.9} />
        </View>
      ) : null}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* The big moment for epic, legendary, mythic and glowing stickers     */
/* ------------------------------------------------------------------ */

function HeroReveal({ item, glow, onDone }: { item: PackItem; glow: boolean; onDone: () => void }) {
  const reduced = useReducedMotion();
  const { width: screenW } = useWindowDimensions();
  const { data } = useCollection();
  const full = data?.items.find((i) => i.id === item.id);
  const rarity = item.rarity as Rarity;
  const r = rarityColors[rarity];
  const color = glow ? GLOW_GOLD : r.fill;
  const cardW = Math.min(screenW * 0.6, 250);
  const title = glow ? t.glowStamp : t.stamp[rarity as 'rare' | 'epic' | 'legendary' | 'iconic'] ?? r.label;
  const spin = useSharedValue(reduced ? 1 : 0);
  const [ready, setReady] = useState(reduced);

  useEffect(() => {
    if (reduced) return;
    spin.value = withTiming(1, { duration: 900, easing: Easing.out(Easing.back(1.4)) });
    const id = setTimeout(() => setReady(true), 700);
    return () => clearTimeout(id);
  }, [reduced, spin]);

  const cardStyle = useAnimatedStyle(() => ({
    opacity: interpolate(spin.value, [0, 0.15, 1], [0, 1, 1]),
    transform: [{ perspective: 1000 }, { rotateY: `${(1 - spin.value) * 540}deg` }, { scale: 0.3 + spin.value * 0.7 }],
  }));

  return (
    <Animated.View entering={FadeIn.duration(200)} exiting={FadeOut.duration(250)} style={styles.hero}>
      <Pressable style={styles.heroPress} onPress={ready ? onDone : undefined} accessibilityRole="button" accessibilityLabel={`${title} ${full?.name ?? ''}`}>
        <LinearGradient colors={['rgba(6,3,20,0.92)', color + '40', 'rgba(6,3,20,0.95)']} style={StyleSheet.absoluteFill} />
        <View style={styles.heroCenter}>
          {!reduced ? <LightPillar color={color} width={cardW * 1.5} /> : null}
          {!reduced ? (
            <>
              <Shockwave color={color} size={cardW * 2.6} delay={250} width={8} />
              <Shockwave color="#FFFFFF" size={cardW * 2.1} delay={420} width={3} />
            </>
          ) : null}
          <Animated.Text entering={reduced ? undefined : FadeIn.delay(500).duration(300)} style={[styles.heroTitle, { color, textShadowColor: color }]} maxFontSizeMultiplier={1.2}>
            {title}
          </Animated.Text>
          <Animated.View style={cardStyle}>{full ? <LegendCard item={full} width={cardW} glow={glow} /> : null}</Animated.View>
          {!reduced ? <StarBurst colorsList={[color, '#FFFFFF', GLOW_GOLD]} count={22} radius={cardW * 1.3} delay={300} /> : null}
          {full ? (
            <Animated.View entering={reduced ? undefined : FadeIn.delay(700)} style={styles.heroInfo}>
              <AppText variant="title" color="#FFFFFF" align="center" style={SHADOW}>
                {full.name}
              </AppText>
              <View style={[styles.heroChip, { backgroundColor: item.new || glow ? colors.correct : 'rgba(255,255,255,0.15)' }]}>
                <AppText variant="label" color={item.new || glow ? colors.textOnBright : '#FFFFFF'} style={styles.bold}>
                  {glow ? t.glowNew : item.new ? t.newCard : fmt(t.dupe, { n: item.dust })}
                </AppText>
              </View>
            </Animated.View>
          ) : null}
        </View>
        {ready ? (
          <Animated.View entering={FadeIn} style={styles.heroHint}>
            <AppText variant="label" color="rgba(255,255,255,0.8)" align="center">
              {t.tapToContinue}
            </AppText>
          </Animated.View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

function columnsFor(n: number) {
  if (n <= 3) return n;
  if (n === 4) return 2;
  if (n <= 6) return 3;
  return 4;
}

export default function PackOpenScreen() {
  const params = useLocalSearchParams<{ pack: PackSlug; pay: 'token' | 'coins' | 'gems' }>();
  const pack = (params.pack ?? 'bronze') as PackSlug;
  const reduced = useReducedMotion();
  const toast = useToast();
  const qc = useQueryClient();
  const { width: screenW } = useWindowDimensions();
  const { data: coll } = useCollection();
  const req = useRef(requestId());
  // Glow counts before opening: a higher count afterwards means a glowing copy came out of this pack.
  const prevGlow = useRef<Record<string, number> | null>(null);
  if (!prevGlow.current && coll) prevGlow.current = Object.fromEntries(coll.items.map((i) => [i.id, i.glow ?? 0]));

  const [result, setResult] = useState<OpenPackResult | null>(null);
  const [taps, setTaps] = useState(0);
  const [torn, setTorn] = useState(false);
  const [boom, setBoom] = useState(0);
  const [shown, setShown] = useState<boolean[]>([]);
  const [hero, setHero] = useState<{ index: number; glow: boolean } | null>(null);
  const heroQueue = useRef<{ index: number; glow: boolean }[]>([]);
  const heroBusy = useRef(false);

  const tear = useSharedValue(0);
  const fly = useSharedValue(0);
  const drop = useSharedValue(0);
  const float = useSharedValue(0);
  const shake = useSharedValue(0);
  const charge = useSharedValue(0);
  const punch = useSharedValue(1);
  const flash = useSharedValue(0);
  const tearTicks = useRef(0);

  useEffect(() => {
    collectionApi
      .open(pack, params.pay ?? 'token', req.current)
      .then((r) => {
        r.items.sort((a, b) => RANK.indexOf(a.rarity as Rarity) - RANK.indexOf(b.rarity as Rarity)); // best card last
        setResult(r);
        setShown(r.items.map(() => false));
        void qc.invalidateQueries({ queryKey: queryKeys.collection });
        void qc.invalidateQueries({ queryKey: queryKeys.myState });
      })
      .catch((e) => {
        toast(e instanceof RpcError && e.code === 'insufficient_funds' ? t.noCoins : strings.errors.generic, 'error');
        router.back();
      });
  }, [pack, params.pay, qc, toast]);

  const best = useMemo(() => (result ? result.items[result.items.length - 1] : null), [result]);
  const bestRank = best ? RANK.indexOf(best.rarity as Rarity) : 0;
  // The glow hints at the best card inside ("walkout"). Honest: the result is already decided.
  const tint = best && bestRank >= 2 ? rarityColors[best.rarity as Rarity].fill : PACK_GLOW[pack];

  useEffect(() => {
    if (reduced) return;
    float.value = withRepeat(withTiming(1, { duration: 1600, easing: Easing.inOut(Easing.sin) }), -1, true);
    return () => cancelAnimation(float);
  }, [reduced, float]);

  useEffect(() => {
    if (reduced || torn || taps === 0) return;
    const amp = 1.5 + taps * 2;
    shake.value = withRepeat(
      withSequence(withTiming(-amp, { duration: 45 }), withTiming(amp, { duration: 45 }), withTiming(0, { duration: 45 }), withTiming(0, { duration: 420 - taps * 110 })),
      -1,
    );
    return () => cancelAnimation(shake);
  }, [reduced, torn, taps, shake]);

  const packStyle = useAnimatedStyle(() => ({
    opacity: 1 - drop.value,
    transform: [
      { translateY: (float.value - 0.5) * 12 + drop.value * 140 },
      { rotate: `${shake.value}deg` },
      { scale: punch.value * (1 + charge.value * 0.1) * (1 - drop.value * 0.3) },
    ],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const tornRef = useRef(false);
  const finishTear = () => {
    if (tornRef.current) return;
    tornRef.current = true;
    playSound('pack_open');
    haptic('heavy');
    charge.value = withTiming(1, { duration: 150 });
    if (reduced) {
      setTorn(true);
      return;
    }
    setBoom((b) => b + 1);
    fly.value = withTiming(1, { duration: 520, easing: Easing.out(Easing.cubic) });
    flash.value = withSequence(withTiming(0.95, { duration: 80 }), withTiming(0, { duration: 700 }));
    drop.value = withDelay(260, withTiming(1, { duration: 420, easing: Easing.in(Easing.cubic) }));
    setTimeout(() => setTorn(true), 560);
  };

  const tick = (p: number) => {
    const n = Math.floor(p * 6);
    if (n > tearTicks.current) {
      tearTicks.current = n;
      haptic(n >= 5 ? 'heavy' : 'tap');
      playSound('tick');
    }
  };

  // Swipe along the top to tear the pack open (taps work too, for accessibility).
  const pan = Gesture.Pan()
    .enabled(!!result && !torn)
    .onUpdate((e) => {
      const p = Math.min(1, Math.abs(e.translationX) / 170);
      if (p > tear.value) tear.value = p;
      runOnJS(tick)(tear.value);
      if (tear.value >= 0.9) runOnJS(finishTear)();
    })
    .onEnd(() => {
      if (tear.value < 0.9) tear.value = withSpring(0);
    });

  const tearLight = useAnimatedStyle(() => ({ opacity: Math.max(tear.value, charge.value * 0.6), transform: [{ scaleX: Math.max(0.02, tear.value, charge.value * 0.5) }] }));
  const topPiece = useAnimatedStyle(() => ({
    opacity: 1 - fly.value,
    transform: [{ translateY: -fly.value * 260 }, { translateX: fly.value * 90 }, { rotate: `${fly.value * 40}deg` }],
  }));

  const tapPack = () => {
    if (!result) return;
    const n = taps + 1;
    charge.value = withSpring(n / TAPS, { damping: 9 });
    punch.value = withSequence(withTiming(0.92, { duration: 70 }), withSpring(1, { damping: 6, stiffness: 260 }));
    if (n < TAPS && !reduced) {
      setTaps(n);
      playSound('tick');
      haptic(n === TAPS - 1 ? 'heavy' : 'tap');
      return;
    }
    finishTear();
  };

  const isGlow = (id: string) => {
    const now = coll?.items.find((x) => x.id === id)?.glow ?? 0;
    return now > (prevGlow.current?.[id] ?? 0);
  };

  const showNextHero = () => {
    const next = heroQueue.current.shift();
    heroBusy.current = !!next;
    setHero(next ?? null);
    if (next) {
      const rank = RANK.indexOf(result!.items[next.index]!.rarity as Rarity);
      playSound(rank >= 4 || next.glow ? 'level_up' : 'rare_reveal');
      haptic('heavy');
      if (!reduced) flash.value = withSequence(withTiming(0.8, { duration: 70 }), withTiming(0, { duration: 600 }));
    }
  };

  const reveal = (i: number) => {
    if (!result || i < 0 || shown[i]) return;
    const it = result.items[i]!;
    const rank = RANK.indexOf(it.rarity as Rarity);
    const glow = isGlow(it.id);
    playSound(rank >= 2 ? 'rare_reveal' : 'answer_lock');
    haptic(rank >= 2 ? 'heavy' : 'tap');
    setShown((s) => s.map((v, k) => (k === i ? true : v)));
    if (rank >= 3 || glow) {
      heroQueue.current.push({ index: i, glow });
      if (!heroBusy.current) {
        heroBusy.current = true;
        setTimeout(showNextHero, reduced ? 0 : rank >= 4 ? 750 : 600);
      }
    }
  };

  const revealAll = () => {
    shown.forEach((v, i) => !v && setTimeout(() => reveal(i), i * 220));
  };

  const allShown = shown.length > 0 && shown.every(Boolean);
  const tokensLeft = coll?.tokens[pack] ?? 0;
  const n = result?.items.length ?? 0;
  const cols = columnsFor(n);
  const cardW = Math.min(n <= 3 ? 112 : 104, (screenW - space.lg * 2 - (cols - 1) * space.sm) / cols);
  const newCount = result?.items.filter((x) => x.new).length ?? 0;

  return (
    <View style={styles.root}>
      <Image source={STAGE_IMAGE} style={StyleSheet.absoluteFill} resizeMode="cover" />
      <LinearGradient colors={[tint + '33', 'transparent', tint + '26']} style={StyleSheet.absoluteFill} pointerEvents="none" />
      <Motes color={tint} count={torn ? 10 : 18} />

      <SafeAreaView style={styles.flex}>
        <View style={styles.top}>
          <View style={styles.flex}>
            <AppText variant="title" color={PACK_GLOW[pack]} style={[styles.bold, SHADOW]}>
              {PACK_NAMES[pack]}
            </AppText>
            {result ? (
              <AppText variant="label" color="#FFFFFF" style={SHADOW}>
                {fmt(t.items, { n: result.items.length })}
              </AppText>
            ) : null}
          </View>
          <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
        </View>

        {!torn ? (
          <Pressable style={styles.center} disabled={!result} onPress={tapPack} accessibilityRole="button" accessibilityLabel={t.tapToOpen}>
            <Halo color={tint} size={Math.min(screenW * 1.25, 520)} strength={charge} />
            {boom ? (
              <>
                <Shockwave key={`a${boom}`} color={tint} size={screenW * 1.2} width={8} />
                <Shockwave key={`b${boom}`} color="#FFFFFF" size={screenW * 0.9} delay={120} width={3} />
                <StarBurst key={`c${boom}`} colorsList={[tint, '#FFFFFF', GLOW_GOLD]} count={18} radius={screenW * 0.55} />
              </>
            ) : null}
            <GestureDetector gesture={pan}>
              <Animated.View style={packStyle}>
                <View style={{ width: PACK_W, height: PACK_H }}>
                  {/* The body stays; the crimped strip on top flies away when torn. */}
                  <View style={[styles.packClip, { top: TEAR_Y, height: PACK_H - TEAR_Y }]}>
                    <View style={{ marginTop: -TEAR_Y }}>
                      <PackArt slug={pack} width={PACK_W} />
                    </View>
                  </View>
                  <Animated.View style={[styles.packClip, { top: 0, height: TEAR_Y }, topPiece]}>
                    <PackArt slug={pack} width={PACK_W} />
                  </Animated.View>
                  <Animated.View pointerEvents="none" style={[styles.tearLight, { top: TEAR_Y - 3, backgroundColor: '#FFFFFF', shadowColor: tint }, tearLight]} />
                </View>
              </Animated.View>
            </GestureDetector>
            <View style={styles.pill}>
              <AppText variant="heading" color="#FFFFFF" align="center" style={styles.bold}>
                {!result ? '…' : taps === 0 ? t.swipeToTear : taps === TAPS - 1 ? t.tapLast : t.tapMore}
              </AppText>
              {result && bestRank >= 3 && taps > 0 ? (
                <Animated.View entering={reduced ? undefined : FadeIn}>
                  <AppText variant="label" color={tint} align="center" style={[styles.bold, SHADOW]}>
                    {t.walkoutHint}
                  </AppText>
                </Animated.View>
              ) : null}
            </View>
          </Pressable>
        ) : result ? (
          <View style={styles.body}>
            <View style={[styles.cards, { gap: space.sm }]}>
              {result.items.map((it, i) => (
                <FlipCard
                  key={`${it.id}-${i}`}
                  item={it}
                  index={i}
                  total={result.items.length}
                  width={cardW}
                  revealed={!!shown[i]}
                  glow={isGlow(it.id)}
                  onPress={() => reveal(i)}
                />
              ))}
            </View>
            {!allShown ? (
              <View style={styles.row}>
                <StickerButton label={t.tapToFlip} tone="prize" style={styles.flex} onPress={() => reveal(shown.findIndex((v) => !v))} />
                <StickerButton label={t.revealAll} tone="outline" onPress={revealAll} />
              </View>
            ) : (
              <Animated.View entering={reduced ? undefined : FadeIn.duration(300)} style={styles.summary}>
                <View style={styles.pill}>
                  <AppText variant="heading" color="#FFFFFF" align="center" style={styles.bold}>
                    {newCount === 0 ? t.summaryNone : newCount === 1 ? t.summaryOne : fmt(t.summary, { n: newCount })}
                  </AppText>
                  {result.dust_gained > 0 ? (
                    <AppText variant="label" color={colors.textMuted} align="center">
                      {fmt(t.dustTotal, { n: result.dust_gained })}
                    </AppText>
                  ) : null}
                </View>
                {tokensLeft > 0 ? (
                  <StickerButton
                    label={`${t.openAnother} (${tokensLeft})`}
                    icon="gift"
                    tone="prize"
                    size="lg"
                    fullWidth
                    onPress={() => router.replace({ pathname: '/pack-open', params: { pack, pay: 'token' } })}
                  />
                ) : null}
                <StickerButton
                  label={t.toAlbum}
                  icon="albums"
                  tone={tokensLeft > 0 ? 'outline' : 'prize'}
                  size={tokensLeft > 0 ? 'md' : 'lg'}
                  fullWidth
                  onPress={() => router.replace('/(tabs)/collection')}
                />
                {tokensLeft === 0 ? (
                  <StickerButton label={t.morePacks} tone="ghost" fullWidth onPress={() => router.replace('/(tabs)/packs')} />
                ) : null}
              </Animated.View>
            )}
          </View>
        ) : null}
      </SafeAreaView>

      {hero && result ? (
        <HeroReveal key={hero.index} item={result.items[hero.index]!} glow={hero.glow} onDone={showNextHero} />
      ) : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0C0624' },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm, gap: space.md, zIndex: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  body: { flex: 1, justifyContent: 'center', padding: space.lg, gap: space.xl },
  cards: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center' },
  cardSlot: { alignItems: 'center', justifyContent: 'center' },
  fxCenter: { position: 'absolute', top: 0, bottom: 0, left: 0, right: 0, alignItems: 'center', justifyContent: 'center' },
  origin: { position: 'absolute', top: '50%', left: '50%', width: 0, height: 0 },
  row: { flexDirection: 'row', gap: space.sm },
  back: { borderRadius: 14, borderWidth: 2, overflow: 'hidden', alignItems: 'center', justifyContent: 'center', backgroundColor: '#2A1660' },
  tag: { alignSelf: 'center', marginTop: 6, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 999 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  summary: { gap: space.md, alignItems: 'stretch' },
  pill: {
    alignSelf: 'center',
    backgroundColor: 'rgba(10,6,30,0.72)',
    borderColor: 'rgba(255,255,255,0.16)',
    borderWidth: 1,
    borderRadius: 18,
    paddingHorizontal: space.lg,
    paddingVertical: space.sm,
    gap: 2,
    maxWidth: '92%',
  },
  packClip: { position: 'absolute', left: 0, right: 0, overflow: 'hidden' },
  tearLight: { position: 'absolute', left: 14, right: 14, height: 6, borderRadius: 3, shadowOpacity: 1, shadowRadius: 14, elevation: 12 },
  flash: { backgroundColor: '#FFFFFF' },
  hero: { ...StyleSheet.absoluteFillObject, zIndex: 10 },
  heroPress: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  heroCenter: { alignItems: 'center', justifyContent: 'center', gap: space.lg },
  heroTitle: {
    fontFamily: 'IBMPlexSansHebrew_700Bold',
    fontSize: 46,
    lineHeight: 60,
    textAlign: 'center',
    textShadowOffset: { width: 0, height: 0 },
    textShadowRadius: 18,
  },
  heroInfo: { alignItems: 'center', gap: space.sm },
  heroChip: { paddingHorizontal: space.md, paddingVertical: 4, borderRadius: 999 },
  heroHint: { position: 'absolute', bottom: 48, left: 0, right: 0 },
});
