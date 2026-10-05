import type { OpenPackResult, PackSlug } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  FadeOut,
  ZoomIn,
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
import Svg, { Path } from 'react-native-svg';
import { AppText, StickerButton, TrophyLogo, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, palette, radius, rarityColors, space } from '@/design-system/tokens';
import { LegendCard } from '@/features/collection/LegendCard';
import { PackArt, PACK_NAMES } from '@/features/collection/PackArt';
import { collectionApi, requestId } from '@/features/collection/api';
import { useCollection } from '@/features/collection/hooks';
import { RpcError } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';

const t = strings.packs;
const RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'iconic'] as const;
type Rarity = (typeof RANK)[number];
const TAPS = 3;

/* ------------------------------------------------------------------ */
/* Light rays behind the pack / a big reveal                           */
/* ------------------------------------------------------------------ */
function Rays({ size, color, speed = 9000, opacity = 0.55 }: { size: number; color: string; speed?: number; opacity?: number }) {
  const reduced = useReducedMotion();
  const rot = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    rot.value = withRepeat(withTiming(360, { duration: speed, easing: Easing.linear }), -1);
    return () => cancelAnimation(rot);
  }, [reduced, rot, speed]);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));
  const c = size / 2;
  const n = 14;
  const d = Array.from({ length: n }, (_, i) => {
    const a0 = (i / n) * Math.PI * 2;
    const a1 = a0 + Math.PI / n;
    return `M${c} ${c} L${c + c * Math.cos(a0)} ${c + c * Math.sin(a0)} L${c + c * Math.cos(a1)} ${c + c * Math.sin(a1)} Z`;
  }).join(' ');
  return (
    <Animated.View pointerEvents="none" style={[{ position: 'absolute', width: size, height: size, opacity }, style]}>
      <Svg width={size} height={size}>
        <Path d={d} fill={color} />
      </Svg>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Confetti burst                                                      */
/* ------------------------------------------------------------------ */
function Particle({ p, angle, dist, color, size }: { p: SharedValue<number>; angle: number; dist: number; color: string; size: number }) {
  const style = useAnimatedStyle(() => ({
    opacity: interpolate(p.value, [0, 0.1, 0.8, 1], [0, 1, 1, 0]),
    transform: [
      { translateX: Math.cos(angle) * dist * p.value },
      { translateY: Math.sin(angle) * dist * p.value + 120 * p.value * p.value },
      { rotate: `${p.value * 540}deg` },
      { scale: 1 - p.value * 0.4 },
    ],
  }));
  return <Animated.View style={[{ position: 'absolute', width: size, height: size * 0.6, borderRadius: 2, backgroundColor: color }, style]} />;
}

function Burst({ colorsList, count = 26, radius: rr = 220 }: { colorsList: string[]; count?: number; radius?: number }) {
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: 1100, easing: Easing.out(Easing.cubic) });
  }, [p]);
  const parts = useMemo(
    () =>
      Array.from({ length: count }, (_, i) => ({
        angle: (i / count) * Math.PI * 2 + Math.random() * 0.4,
        dist: rr * (0.55 + Math.random() * 0.6),
        color: colorsList[i % colorsList.length]!,
        size: 8 + Math.random() * 8,
      })),
    [count, rr, colorsList],
  );
  return (
    <View pointerEvents="none" style={styles.burst}>
      {parts.map((x, i) => (
        <Particle key={i} p={p} {...x} />
      ))}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Cards                                                               */
/* ------------------------------------------------------------------ */
function CardBack({ width, glow }: { width: number; glow?: string }) {
  const pulse = useSharedValue(0);
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!glow || reduced) return;
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 500 }), withTiming(0.3, { duration: 500 })), -1);
    return () => cancelAnimation(pulse);
  }, [glow, reduced, pulse]);
  const style = useAnimatedStyle(() => (glow ? { shadowOpacity: pulse.value, borderColor: glow } : {}));
  return (
    <Animated.View
      style={[styles.back, { width, height: width * 1.25 + 34 }, glow ? { shadowColor: glow, shadowRadius: 18, elevation: 14 } : null, style]}
    >
      <View style={styles.backStripe} />
      <TrophyLogo size={width * 0.5} color={glow ?? colors.led} />
    </Animated.View>
  );
}

function FlipCard({
  item,
  revealed,
  onPress,
  width,
  index,
}: {
  item: { id: string; rarity: string; new: boolean; dust: number };
  revealed: boolean;
  onPress: () => void;
  width: number;
  index: number;
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
    // Rarer cards take a breath before turning: anticipation.
    const wait = rank >= 4 ? 450 : rank >= 2 ? 200 : 0;
    flip.value = withDelay(wait, withTiming(1, { duration: 520, easing: Easing.inOut(Easing.cubic) }));
    const id = setTimeout(() => setFace(true), wait + 260);
    return () => clearTimeout(id);
  }, [revealed, reduced, flip, rank]);

  const style = useAnimatedStyle(() => {
    const deg = flip.value < 0.5 ? flip.value * 180 : (flip.value - 1) * 180;
    return {
      transform: [{ perspective: 800 }, { rotateY: `${deg}deg` }, { scale: 1 + Math.sin(flip.value * Math.PI) * 0.12 }],
    };
  });

  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(index * 110).springify().damping(13)} style={styles.cardSlot}>
      {face && rank >= 3 ? <Rays size={width * 2} color={r.fill} opacity={0.35} speed={6000} /> : null}
      <Pressable
        onPress={onPress}
        disabled={revealed}
        accessibilityRole="button"
        accessibilityLabel={revealed ? `${full?.name ?? ''}, ${r.label}` : t.tapToFlip}
      >
        <Animated.View style={style}>
          {face && full ? <LegendCard item={full} width={width} /> : <CardBack width={width} glow={revealed && rank >= 2 ? r.fill : undefined} />}
        </Animated.View>
      </Pressable>
      {face ? (
        <Animated.View
          entering={reduced ? undefined : ZoomIn.delay(150)}
          style={[styles.tag, { backgroundColor: item.new ? colors.correct : colors.board }]}
        >
          <AppText variant="caption" color={item.new ? colors.textOnBright : colors.textMuted} style={styles.bold}>
            {item.new ? t.newCard : fmt(t.dupe, { n: item.dust })}
          </AppText>
        </Animated.View>
      ) : null}
      {face && rank >= 3 && !reduced ? <Burst colorsList={[r.fill, palette.chalk, colors.led]} count={14} radius={width} /> : null}
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */
export default function PackOpenScreen() {
  const params = useLocalSearchParams<{ pack: PackSlug; pay: 'token' | 'coins' | 'gems' }>();
  const pack = (params.pack ?? 'bronze') as PackSlug;
  const reduced = useReducedMotion();
  const toast = useToast();
  const qc = useQueryClient();
  const { width: screenW } = useWindowDimensions();
  const { data: coll } = useCollection();
  const req = useRef(requestId());
  const [result, setResult] = useState<OpenPackResult | null>(null);
  const [taps, setTaps] = useState(0);
  const [torn, setTorn] = useState(false);
  const [shown, setShown] = useState<boolean[]>([]);
  const [stamp, setStamp] = useState<{ rarity: Rarity; key: number } | null>(null);
  const shake = useSharedValue(0);
  const charge = useSharedValue(0);
  const flash = useSharedValue(0);

  useEffect(() => {
    collectionApi
      .open(pack, params.pay ?? 'token', req.current)
      .then((r) => {
        // Reveal the best card last.
        r.items.sort((a, b) => RANK.indexOf(a.rarity as Rarity) - RANK.indexOf(b.rarity as Rarity));
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
  // The rays hint at the best card inside ("walkout") — honest, the result is already decided.
  const hint = best && bestRank >= 2 ? rarityColors[best.rarity as Rarity].fill : colors.led;

  useEffect(() => {
    if (reduced || torn) return;
    const amp = 3 + taps * 4;
    shake.value = withRepeat(
      withSequence(withTiming(-amp, { duration: 60 }), withTiming(amp, { duration: 60 }), withTiming(0, { duration: 60 }), withTiming(0, { duration: 500 - taps * 140 })),
      -1,
    );
    return () => cancelAnimation(shake);
  }, [reduced, torn, taps, shake]);

  const packStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${shake.value}deg` }, { scale: 1 + charge.value * 0.12 }],
  }));
  const flashStyle = useAnimatedStyle(() => ({ opacity: flash.value }));

  const tapPack = () => {
    if (!result) return;
    const n = taps + 1;
    charge.value = withSpring(n / TAPS, { damping: 8 });
    if (n < TAPS && !reduced) {
      setTaps(n);
      playSound('tick');
      haptic(n === TAPS - 1 ? 'heavy' : 'tap');
      return;
    }
    playSound('pack_open');
    haptic('heavy');
    if (!reduced) flash.value = withSequence(withTiming(1, { duration: 90 }), withTiming(0, { duration: 650 }));
    setTorn(true);
  };

  const reveal = (i: number) => {
    if (!result || i < 0) return;
    const it = result.items[i]!;
    const rank = RANK.indexOf(it.rarity as Rarity);
    playSound(rank >= 2 ? 'rare_reveal' : 'answer_lock');
    haptic(rank >= 3 ? 'heavy' : 'tap');
    if (rank >= 3) {
      setTimeout(() => {
        setStamp({ rarity: it.rarity as Rarity, key: Date.now() });
        if (rank >= 4) {
          playSound('level_up');
          if (!reduced) flash.value = withSequence(withTiming(0.85, { duration: 80 }), withTiming(0, { duration: 900 }));
        }
      }, rank >= 4 ? 700 : 450);
      setTimeout(() => setStamp(null), 2400);
    }
    setShown((s) => s.map((v, k) => (k === i ? true : v)));
  };

  const allShown = shown.length > 0 && shown.every(Boolean);
  const tokensLeft = coll?.tokens[pack] ?? 0;
  const cardW = result && result.items.length > 4 ? Math.min(100, (screenW - space.lg * 2 - space.md * 2) / 3) : 112;

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <AppText variant="heading" color={colors.led}>
          {PACK_NAMES[pack]}
        </AppText>
        <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
      </View>

      {!torn ? (
        <Pressable style={styles.center} disabled={!result} onPress={tapPack} accessibilityRole="button" accessibilityLabel={t.tapToOpen}>
          {result ? <Rays size={Math.min(screenW * 1.1, 460)} color={hint} opacity={0.25 + taps * 0.18} speed={9000 - taps * 2500} /> : null}
          <Animated.View style={packStyle}>
            <PackArt slug={pack} width={200} />
          </Animated.View>
          <AppText variant="heading" color={taps > 0 ? hint : colors.textMuted} align="center">
            {!result ? '…' : taps === 0 ? t.tapToOpen : taps === TAPS - 1 ? t.tapLast : t.tapMore}
          </AppText>
          {result && bestRank >= 3 && taps > 0 ? (
            <Animated.View entering={reduced ? undefined : FadeIn}>
              <AppText variant="caption" color={hint}>
                {t.walkoutHint}
              </AppText>
            </Animated.View>
          ) : null}
        </Pressable>
      ) : result ? (
        <View style={styles.body}>
          {!reduced ? <Burst colorsList={[hint, colors.led, palette.chalk, palette.sky]} count={30} /> : null}
          <View style={styles.cards}>
            {result.items.map((it, i) => (
              <FlipCard key={`${it.id}-${i}`} item={it} index={i} width={cardW} revealed={!!shown[i]} onPress={() => reveal(i)} />
            ))}
          </View>
          {!allShown ? (
            <View style={styles.row}>
              <StickerButton label={t.tapToFlip} tone="outline" style={styles.flex} onPress={() => reveal(shown.findIndex((v) => !v))} />
              <StickerButton
                label={t.revealAll}
                tone="ghost"
                onPress={() => {
                  shown.forEach((v, i) => !v && setTimeout(() => reveal(i), i * 250));
                }}
              />
            </View>
          ) : (
            <Animated.View entering={reduced ? undefined : FadeIn.duration(300)} style={styles.summary}>
              {result.dust_gained > 0 ? (
                <AppText variant="label" color={colors.textMuted} align="center">
                  {fmt(t.dustTotal, { n: result.dust_gained })}
                </AppText>
              ) : null}
              <StickerButton label={t.toAlbum} icon="albums" size="lg" fullWidth onPress={() => router.replace('/(tabs)/collection')} />
              {tokensLeft > 0 ? (
                <StickerButton
                  label={`${t.openAnother} (${tokensLeft})`}
                  tone="outline"
                  fullWidth
                  onPress={() => router.replace({ pathname: '/pack-open', params: { pack, pay: 'token' } })}
                />
              ) : null}
            </Animated.View>
          )}
        </View>
      ) : null}

      {stamp ? (
        <Animated.View
          key={stamp.key}
          pointerEvents="none"
          entering={reduced ? undefined : ZoomIn.springify().damping(9)}
          exiting={reduced ? undefined : FadeOut}
          style={styles.stampWrap}
          accessibilityLiveRegion="assertive"
        >
          <View style={[styles.stamp, { borderColor: rarityColors[stamp.rarity].fill }]}>
            <AppText variant="title" color={rarityColors[stamp.rarity].fill} style={styles.stampText}>
              {t.stamp[stamp.rarity as 'rare' | 'epic' | 'legendary' | 'iconic']}
            </AppText>
          </View>
        </Animated.View>
      ) : null}
      <Animated.View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm, zIndex: 2 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, overflow: 'hidden' },
  body: { flex: 1, justifyContent: 'center', padding: space.lg, gap: space.xl },
  cards: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md },
  cardSlot: { alignItems: 'center', justifyContent: 'center' },
  row: { flexDirection: 'row', gap: space.sm },
  flex: { flex: 1 },
  back: {
    borderRadius: radius.sticker,
    borderWidth: 3,
    borderColor: colors.led,
    backgroundColor: palette.night800,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  backStripe: { position: 'absolute', width: '160%', height: 26, backgroundColor: palette.night700, transform: [{ rotate: '-30deg' }] },
  tag: { alignSelf: 'center', marginTop: 6, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.chip },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  summary: { gap: space.md, alignItems: 'center' },
  burst: { position: 'absolute', top: '45%', left: '50%', width: 0, height: 0, alignItems: 'center', justifyContent: 'center' },
  stampWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  stamp: {
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderWidth: 5,
    borderRadius: radius.card,
    backgroundColor: 'rgba(6,19,15,0.85)',
    transform: [{ rotate: '-8deg' }],
  },
  stampText: { fontSize: 44, lineHeight: 56, fontFamily: 'IBMPlexSansHebrew_700Bold' },
  flash: { backgroundColor: '#FFFFFF' },
});
