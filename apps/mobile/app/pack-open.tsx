import type { OpenPackResult, PackSlug } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
  ZoomIn,
} from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Led, StickerButton, TrophyLogo, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, radius, rarityColors, space } from '@/design-system/tokens';
import { LegendCard } from '@/features/collection/LegendCard';
import { PackArt, PACK_NAMES } from '@/features/collection/PackArt';
import { collectionApi, requestId } from '@/features/collection/api';
import { useCollection } from '@/features/collection/hooks';
import { RpcError } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';

const t = strings.packs;
const RANK = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'iconic'];

function CardBack({ width }: { width: number }) {
  return (
    <View style={[styles.back, { width, height: width * 1.25 + 34 }]}>
      <TrophyLogo size={width * 0.55} color={colors.led} />
    </View>
  );
}

function FlipCard({
  item,
  revealed,
  onPress,
  width,
  index,
}: {
  item: { id: string; rarity: string; new: boolean; dust: number } & Record<string, unknown>;
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
  const r = rarityColors[item.rarity as keyof typeof rarityColors];

  useEffect(() => {
    if (!revealed) return;
    if (reduced) {
      flip.value = 1;
      setFace(true);
      return;
    }
    flip.value = withTiming(1, { duration: 380, easing: Easing.inOut(Easing.quad) });
    const id = setTimeout(() => setFace(true), 190);
    return () => clearTimeout(id);
  }, [revealed, reduced, flip]);

  const style = useAnimatedStyle(() => ({
    // 1 → 0 → 1: the card turns edge-on halfway and shows its face on the way back.
    transform: [{ scaleX: Math.max(0.02, Math.abs(1 - 2 * flip.value)) }],
  }));
  const glow = RANK.indexOf(item.rarity) >= 3;

  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(index * 90).springify().damping(14)}>
      <Pressable onPress={onPress} disabled={revealed} accessibilityRole="button" accessibilityLabel={revealed ? full?.name : t.tapToFlip}>
        <Animated.View style={[style, face && glow ? { shadowColor: r.fill, shadowOpacity: 0.9, shadowRadius: 16, elevation: 12 } : null]}>
          {face && full ? <LegendCard item={full} width={width} /> : <CardBack width={width} />}
        </Animated.View>
      </Pressable>
      {face ? (
        <Animated.View entering={reduced ? undefined : ZoomIn.delay(150)} style={[styles.tag, { backgroundColor: item.new ? colors.correct : colors.board }]}>
          <AppText variant="caption" color={item.new ? colors.textOnBright : colors.textMuted} style={styles.bold}>
            {item.new ? t.newCard : fmt(t.dupe, { n: item.dust })}
          </AppText>
        </Animated.View>
      ) : null}
    </Animated.View>
  );
}

export default function PackOpenScreen() {
  const params = useLocalSearchParams<{ pack: PackSlug; pay: 'token' | 'coins' | 'gems' }>();
  const pack = (params.pack ?? 'bronze') as PackSlug;
  const reduced = useReducedMotion();
  const toast = useToast();
  const qc = useQueryClient();
  const { data: coll } = useCollection();
  const req = useRef(requestId());
  const [result, setResult] = useState<OpenPackResult | null>(null);
  const [torn, setTorn] = useState(false);
  const [shown, setShown] = useState<boolean[]>([]);
  const shake = useSharedValue(0);

  useEffect(() => {
    collectionApi
      .open(pack, params.pay ?? 'token', req.current)
      .then((r) => {
        // Reveal the best card last.
        r.items.sort((a, b) => RANK.indexOf(a.rarity) - RANK.indexOf(b.rarity));
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

  useEffect(() => {
    if (reduced || torn) return;
    shake.value = withRepeat(withSequence(withTiming(-4, { duration: 70 }), withTiming(4, { duration: 70 }), withTiming(0, { duration: 70 }), withTiming(0, { duration: 600 })), -1);
  }, [reduced, torn, shake]);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value}deg` }] }));

  const allShown = shown.length > 0 && shown.every(Boolean);
  const tokensLeft = coll?.tokens[pack] ?? 0;
  const best = useMemo(() => (result ? result.items[result.items.length - 1] : null), [result]);

  const reveal = (i: number) => {
    if (!result) return;
    const it = result.items[i]!;
    const rank = RANK.indexOf(it.rarity);
    playSound(rank >= 2 ? 'rare_reveal' : 'answer_lock');
    haptic(rank >= 3 ? 'heavy' : 'tap');
    setShown((s) => s.map((v, k) => (k === i ? true : v)));
  };

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <AppText variant="heading" color={colors.led}>
          {PACK_NAMES[pack]}
        </AppText>
        <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
      </View>

      {!torn ? (
        <Pressable
          style={styles.center}
          disabled={!result}
          onPress={() => {
            playSound('pack_open');
            haptic('heavy');
            setTorn(true);
          }}
          accessibilityRole="button"
          accessibilityLabel={t.tapToOpen}
        >
          <Animated.View style={shakeStyle}>
            <PackArt slug={pack} width={190} />
          </Animated.View>
          <AppText variant="label" color={colors.textMuted}>
            {result ? t.tapToOpen : '…'}
          </AppText>
        </Pressable>
      ) : result ? (
        <View style={styles.body}>
          <View style={styles.cards}>
            {result.items.map((it, i) => (
              <FlipCard key={`${it.id}-${i}`} item={it} index={i} width={result.items.length > 4 ? 96 : 104} revealed={!!shown[i]} onPress={() => reveal(i)} />
            ))}
          </View>
          {!allShown ? (
            <StickerButton label={t.tapToFlip} tone="ghost" onPress={() => reveal(shown.findIndex((v) => !v))} />
          ) : (
            <Animated.View entering={reduced ? undefined : FadeIn.duration(300)} style={styles.summary}>
              {result.dust_gained > 0 ? (
                <AppText variant="label" color={colors.textMuted} align="center">
                  {fmt(t.dustTotal, { n: result.dust_gained })}
                </AppText>
              ) : null}
              {best && RANK.indexOf(best.rarity) >= 4 ? (
                <Led size="ledM">LEGEND!</Led>
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
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  body: { flex: 1, justifyContent: 'center', padding: space.lg, gap: space.xl },
  cards: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.md },
  back: { borderRadius: radius.sticker, borderWidth: 3, borderColor: colors.led, backgroundColor: colors.board, alignItems: 'center', justifyContent: 'center' },
  tag: { alignSelf: 'center', marginTop: 6, paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.chip },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  summary: { gap: space.md, alignItems: 'center' },
});
