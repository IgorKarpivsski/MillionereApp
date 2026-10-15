import { Ionicons } from '@expo/vector-icons';
import { MATCH_PUZZLES, MODE_LABEL, isTrueEquation, parseEquation, readEquation, type Glyph } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { FadeIn, useAnimatedStyle, useSharedValue, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound, preloadSounds } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { puzzleApi, usePuzzlesState } from '@/features/puzzles/api';
import { MatchBoard } from '@/features/puzzles/MatchBoard';
import { RpcError } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';

const t = strings.puzzles;

export default function PuzzleScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const puzzle = MATCH_PUZZLES.find((p) => p.id === Number(id));
  const { width } = useWindowDimensions();
  const qc = useQueryClient();
  const toast = useToast();
  const reduced = useReducedMotion();
  const { data } = usePuzzlesState();
  const [glyphs, setGlyphs] = useState<Glyph[]>(() => (puzzle ? parseEquation(puzzle.start) : []));
  const [held, setHeld] = useState(false);
  const [used, setUsed] = useState(0);
  const [result, setResult] = useState<'good' | 'bad' | null>(null);
  const [reward, setReward] = useState<{ coins: number; pack: string | null } | null>(null);
  const [hint, setHint] = useState<string | null>(null);
  const shake = useSharedValue(0);
  const shakeStyle = useAnimatedStyle(() => ({ transform: [{ translateX: shake.value }] }));

  useEffect(() => preloadSounds(['pick', 'place', 'solved', 'answer_wrong', 'coins']), []);

  const reset = useCallback(() => {
    if (!puzzle) return;
    setGlyphs(parseEquation(puzzle.start));
    setHeld(false);
    setUsed(0);
    setResult(null);
  }, [puzzle]);

  useEffect(reset, [reset]);

  const check = useCallback(
    async (g: Glyph[]) => {
      if (!puzzle) return;
      const eq = readEquation(g);
      if (isTrueEquation(eq)) {
        setResult('good');
        playSound('solved');
        haptic('success');
        try {
          const r = await puzzleApi.solve(puzzle.id, eq!);
          void qc.invalidateQueries({ queryKey: queryKeys.puzzles });
          void qc.invalidateQueries({ queryKey: queryKeys.myState });
          if (r.pack) void qc.invalidateQueries({ queryKey: queryKeys.collection });
          setReward({ coins: r.coins, pack: r.pack });
          if (r.coins > 0) setTimeout(() => playSound('coins'), 600);
        } catch {
          setReward({ coins: 0, pack: null });
        }
      } else {
        setResult('bad');
        playSound('answer_wrong');
        haptic('error');
        if (!reduced) shake.value = withSequence(withTiming(-10, { duration: 60 }), withTiming(10, { duration: 60 }), withTiming(-6, { duration: 60 }), withTiming(0, { duration: 60 }));
        setTimeout(reset, 1100);
      }
    },
    [puzzle, qc, reduced, reset, shake],
  );

  const onSlot = useCallback(
    (gi: number, si: number, filled: boolean) => {
      if (!puzzle || result) return;
      const next = glyphs.map((g) => ({ ...g })) as Glyph[];
      const g = next[gi]!;
      if (g.kind === 'eq') return;
      if (puzzle.mode === 'move') {
        if (filled && !held) {
          g.mask ^= 1 << si;
          setHeld(true);
          playSound('pick');
          haptic('select');
          setGlyphs(next);
        } else if (!filled && held) {
          g.mask ^= 1 << si;
          setHeld(false);
          playSound('place');
          haptic('tap');
          const n = used + 1;
          setUsed(n);
          setGlyphs(next);
          if (n >= puzzle.count) void check(next);
        }
      } else if (puzzle.mode === 'add' && !filled) {
        g.mask ^= 1 << si;
        playSound('place');
        const n = used + 1;
        setUsed(n);
        setGlyphs(next);
        if (n >= puzzle.count) void check(next);
      } else if (puzzle.mode === 'remove' && filled) {
        g.mask ^= 1 << si;
        playSound('pick');
        const n = used + 1;
        setUsed(n);
        setGlyphs(next);
        if (n >= puzzle.count) void check(next);
      }
    },
    [puzzle, result, glyphs, held, used, check],
  );

  const alreadySolved = useMemo(() => (data?.solved ?? []).includes(Number(id)), [data, id]);
  if (!puzzle) return null;
  const next = MATCH_PUZZLES.find((p) => p.id === puzzle.id + 1);
  const placeable = !result && ((puzzle.mode === 'move' && held) || puzzle.mode === 'add');
  const selectable = !result && ((puzzle.mode === 'move' && !held) || puzzle.mode === 'remove');

  const askHint = async () => {
    try {
      const a = await puzzleApi.hint(puzzle.id);
      setHint(a);
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
      void qc.invalidateQueries({ queryKey: queryKeys.puzzles });
    } catch (e) {
      toast(e instanceof RpcError && e.message.includes('insufficient') ? strings.session.noCoins : strings.errors.generic, 'error');
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <LinearGradient colors={['#5A2EA6', colors.bg]} style={styles.glow} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <Ionicons name="arrow-forward" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="heading" style={styles.flex}>
          {fmt(t.puzzleN, { n: puzzle.id })}
        </AppText>
        <View style={styles.levelChip}>
          <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
            {t.levels[puzzle.level - 1]}
          </AppText>
        </View>
      </View>

      <View style={styles.body}>
        <View style={styles.task}>
          <AppText variant="heading" align="center">
            {MODE_LABEL[puzzle.mode](puzzle.count)}
          </AppText>
          <AppText variant="caption" color={colors.textMuted} align="center">
            {puzzle.mode === 'move' ? (held ? t.placeIt : t.pickOne) : puzzle.mode === 'add' ? t.tapEmpty : t.tapStick}
          </AppText>
        </View>

        <Animated.View style={[styles.board, shakeStyle]}>
          <MatchBoard glyphs={glyphs} width={width - space.md * 4} placeable={placeable} selectable={selectable} onSlot={onSlot} highlight={result} />
        </Animated.View>

        <View style={styles.counter}>
          {Array.from({ length: puzzle.count }, (_, i) => (
            <View key={i} style={[styles.pip, i < used && styles.pipOn]} />
          ))}
        </View>

        {result === 'good' ? (
          <Animated.View entering={reduced ? undefined : ZoomIn.springify()} style={styles.win}>
            <AppText style={styles.winEmoji}>🎉</AppText>
            <AppText variant="title" align="center">
              {t.solved}
            </AppText>
            {reward ? (
              <AppText color={colors.led} align="center" variant="heading">
                {reward.coins > 0 ? fmt(t.reward, { n: reward.coins }) : alreadySolved ? t.again : ''}
              </AppText>
            ) : null}
            {reward?.pack ? (
              <AppText color={colors.correct} align="center" variant="label">
                {t.packReward}
              </AppText>
            ) : null}
          </Animated.View>
        ) : result === 'bad' ? (
          <Animated.View entering={FadeIn}>
            <AppText variant="heading" color={colors.danger} align="center">
              {t.notYet}
            </AppText>
          </Animated.View>
        ) : null}

        {hint && result !== 'good' ? (
          <View style={styles.hint}>
            <Ionicons name="bulb" size={18} color={colors.led} />
            <AppText variant="bodyStrong">{fmt(t.hintText, { eq: hint })}</AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.footer}>
        {result === 'good' ? (
          next ? (
            <StickerButton label={t.next} icon="arrow-back" size="lg" fullWidth onPress={() => router.replace({ pathname: '/puzzles/[id]', params: { id: String(next.id) } })} />
          ) : (
            <StickerButton label={t.allDone} icon="trophy" size="lg" fullWidth onPress={() => router.back()} />
          )
        ) : (
          <View style={styles.row}>
            <StickerButton label={t.restart} icon="refresh" tone="ghost" style={styles.flex} onPress={reset} />
            <StickerButton label={hint ? t.hintShown : t.hint} icon="bulb" tone="outline" style={styles.flex} disabled={!!hint} onPress={() => void askHint()} />
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, padding: space.md },
  levelChip: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: radius.chip, backgroundColor: colors.led },
  body: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingHorizontal: space.md },
  task: { gap: space.xs, paddingHorizontal: space.md },
  board: {
    padding: space.md,
    borderRadius: radius.card,
    backgroundColor: '#2B1B5E',
    borderWidth: 3,
    borderColor: '#4A3591',
  },
  counter: { flexDirection: 'row', gap: space.sm },
  pip: { width: 26, height: 8, borderRadius: 4, backgroundColor: '#4A3591' },
  pipOn: { backgroundColor: colors.led },
  win: { alignItems: 'center', gap: space.xs },
  winEmoji: { fontSize: 48, lineHeight: 58 },
  hint: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.board, backgroundColor: colors.surfaceRaised },
  footer: { padding: space.md },
  row: { flexDirection: 'row', gap: space.sm },
});
