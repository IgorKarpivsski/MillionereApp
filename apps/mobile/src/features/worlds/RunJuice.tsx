import { Ionicons } from '@expo/vector-icons';
import type { Reward } from '@fm/shared';
import { useEffect, useRef, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  ZoomIn,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withSpring,
  withTiming,
} from 'react-native-reanimated';
import { AppText, CoinIcon, Led, Sloth, SparkBurst, StickerButton } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { RewardIcon, rewardLabel } from '@/features/engage/rewards';
import { FlyTarget } from '@/features/home/RewardFly';
import { formatNumber, ltr } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.juice;

/** Counts up smoothly to `value` (a number that only grows during a run). */
function useCountUp(value: number, ms = 650): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  useEffect(() => {
    const start = Date.now();
    const a = from.current;
    if (a === value) return;
    let raf = 0;
    const step = () => {
      const p = Math.min(1, (Date.now() - start) / ms);
      const v = Math.round(a + (value - a) * (1 - Math.pow(1 - p, 3)));
      setShown(v);
      if (p < 1) raf = requestAnimationFrame(step);
      else from.current = value;
    };
    // let the flying coins land first
    const id = setTimeout(() => (raf = requestAnimationFrame(step)), 700);
    return () => {
      clearTimeout(id);
      cancelAnimationFrame(raf);
      from.current = value;
    };
  }, [value, ms]);
  return shown;
}

/** The coins earned in this game, live in the top bar. Coins from each right answer fly into it. */
export function RunCoins({ coins }: { coins: number }) {
  const shown = useCountUp(coins);
  return (
    <FlyTarget kind="run">
      <View style={styles.coins} accessible accessibilityLabel={fmt(t.coinsA11y, { n: coins })}>
        <CoinIcon size={20} />
        <Led size="number">{formatNumber(shown)}</Led>
      </View>
    </FlyTarget>
  );
}

/** 🔥 x3 — grows and glows hotter with every right answer in a row. */
export function ComboFlame({ combo }: { combo: number }) {
  const reduced = useReducedMotion();
  const pulse = useSharedValue(1);
  useEffect(() => {
    if (reduced || combo < 2) return;
    pulse.value = withSequence(withSpring(1.45, { damping: 6 }), withSpring(1, { damping: 8 }));
  }, [combo, pulse, reduced]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: pulse.value }] }));
  if (combo < 2) return null;
  const hot = combo >= 5 ? '#FF3D3D' : combo >= 4 ? '#FF7A1A' : combo >= 3 ? '#FFA41B' : colors.led;
  return (
    <Animated.View style={[styles.combo, { borderColor: hot, backgroundColor: hot + '33' }, style]} accessible accessibilityLabel={fmt(t.comboA11y, { n: combo })}>
      <AppText variant="label" style={styles.flame}>
        🔥
      </AppText>
      <AppText variant="label" color={hot} style={styles.bold}>
        {ltr(`x${combo}`)}
      </AppText>
    </Animated.View>
  );
}

/**
 * The goals of this game, on a ladder of 10: a chest at 5 right answers, the champion's prize at 10.
 * Each dot is one question (green right, red wrong); the gift and crown sit on their steps.
 */
export function RunLadder({ results, total, current, chestAt, chestOpened }: { results: boolean[]; total: number; current: number; chestAt: number; chestOpened: boolean }) {
  const correct = results.filter(Boolean).length;
  const reduced = useReducedMotion();
  const wiggle = useSharedValue(0);
  const close = !chestOpened && correct === chestAt - 1;
  useEffect(() => {
    if (reduced || !close) return;
    wiggle.value = withRepeat(withSequence(withTiming(1, { duration: 120 }), withTiming(-1, { duration: 120 }), withTiming(0, { duration: 120 }), withTiming(0, { duration: 700 })), -1);
  }, [close, reduced, wiggle]);
  const giftStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${wiggle.value * 14}deg` }, { scale: 1 + Math.abs(wiggle.value) * 0.15 }] }));
  return (
    <View style={styles.ladder} accessible accessibilityLabel={fmt(t.ladderA11y, { n: correct, chest: chestAt, total })}>
      <View style={styles.dots}>
        {Array.from({ length: total }, (_, i) => {
          const r = results[i];
          const bg = r === true ? colors.correct : r === false ? colors.danger : i === current - 1 ? colors.text : palette.night600;
          return <View key={i} style={[styles.dot, { backgroundColor: bg }, i === current - 1 && r === undefined && styles.dotNow]} />;
        })}
      </View>
      <View style={styles.goals}>
        <Animated.View style={[styles.goal, chestOpened && styles.goalDone, giftStyle]}>
          <Ionicons name={chestOpened ? 'checkmark-circle' : 'gift'} size={14} color={chestOpened ? colors.correct : colors.led} />
          <AppText variant="caption" color={chestOpened ? colors.correct : colors.text} style={styles.bold}>
            {chestOpened ? t.chestDone : ltr(`${Math.min(correct, chestAt)}/${chestAt}`)}
          </AppText>
        </Animated.View>
        <View style={[styles.goal, correct >= total && styles.goalDone]}>
          <AppText variant="caption">👑</AppText>
          <AppText variant="caption" color={colors.text} style={styles.bold}>
            {ltr(`${correct}/${total}`)}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const QUIPS_OK = t.quipsOk;
const QUIPS_HOT = t.quipsHot;
const QUIPS_BAD = t.quipsBad;

/** The sloth reacts to the answer (a different line each time). */
export function SlothCheer({ result, combo, seed }: { result: 'correct' | 'wrong' | 'timeout'; combo: number; seed: number }) {
  const list = result === 'correct' ? (combo >= 3 ? QUIPS_HOT : QUIPS_OK) : QUIPS_BAD;
  const line = list[seed % list.length]!;
  const say = result === 'correct' && combo >= 3 ? line.replace('{n}', String(combo)) : line;
  return (
    <Animated.View entering={ZoomIn.springify().damping(12)} style={styles.cheer}>
      <Sloth size={64} head say={say} bubbleSide="side" />
    </Animated.View>
  );
}

/** The surprise chest at 5 right answers: shakes, pops open, shows what was inside. */
export function MidChest({ reward, onClose }: { reward: Reward | null; onClose: () => void }) {
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);
  const shake = useSharedValue(0);
  useEffect(() => {
    if (!reward) return;
    setOpen(false);
    haptic('heavy');
    if (!reduced) {
      shake.value = withSequence(
        ...Array.from({ length: 6 }, (_, i) => withTiming(i % 2 ? -1 : 1, { duration: 70, easing: Easing.linear })),
        withTiming(0, { duration: 70 }),
      );
    }
    const id = setTimeout(() => {
      setOpen(true);
      playSound('chest_open');
      haptic('success');
    }, reduced ? 0 : 550);
    return () => clearTimeout(id);
  }, [reward, reduced, shake]);
  const chestStyle = useAnimatedStyle(() => ({ transform: [{ rotate: `${shake.value * 10}deg` }, { scale: 1 + Math.abs(shake.value) * 0.08 }] }));
  return (
    <Modal visible={!!reward} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={styles.scrim} onPress={open ? onClose : undefined} accessibilityRole="button" accessibilityLabel={t.collect}>
        <AppText variant="title" align="center" color={colors.led}>
          {t.chestTitle}
        </AppText>
        <View style={styles.chestBox}>
          {open ? (
            <Animated.View entering={ZoomIn.springify().damping(9)} style={styles.prize}>
              <SparkBurst count={14} radius={130} />
              {reward ? <RewardIcon r={reward} size={96} /> : null}
            </Animated.View>
          ) : (
            <Animated.View style={chestStyle}>
              <AppText style={styles.chestEmoji}>🎁</AppText>
            </Animated.View>
          )}
        </View>
        {open && reward ? (
          <Animated.View entering={ZoomIn.delay(150)} style={styles.prizeText}>
            <AppText variant="title" align="center">
              {rewardLabel(reward)}
            </AppText>
            <StickerButton label={t.collect} icon="checkmark" size="lg" tone="prize" onPress={onClose} />
          </Animated.View>
        ) : null}
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  coins: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    minWidth: 72,
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.chip,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.led,
  },
  combo: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: radius.chip,
    borderWidth: 2,
  },
  flame: { fontSize: 16, lineHeight: 20 },
  ladder: { alignItems: 'center', gap: 4 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 14, height: 8, borderRadius: 4 },
  dotNow: { width: 22 },
  goals: { flexDirection: 'row', gap: space.sm },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: radius.chip,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  goalDone: { backgroundColor: 'rgba(61,220,132,0.18)' },
  cheer: { alignSelf: 'flex-start' },
  scrim: { flex: 1, backgroundColor: 'rgba(8,4,24,0.88)', alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  chestBox: { width: 220, height: 220, alignItems: 'center', justifyContent: 'center' },
  chestEmoji: { fontSize: 150, lineHeight: 180 },
  prize: { alignItems: 'center', justifyContent: 'center' },
  prizeText: { alignItems: 'center', gap: space.md },
});
