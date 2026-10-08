import { Ionicons } from '@expo/vector-icons';
import type { ReportReason } from '@fm/shared';
import { router, useLocalSearchParams } from 'expo-router';
import * as StoreReview from 'expo-store-review';
import { LinearGradient } from 'expo-linear-gradient';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, FadeInUp, ZoomIn, useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, BottomSheet, Card, EmptyState, Led, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound, preloadSounds } from '@/design-system/feedback/sound';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { useEnergySheet } from '@/features/engage/EnergySheet';
import { useEnergy } from '@/features/engage/hooks';
import { quizApi } from '@/features/quiz/api';
import { QuestionImageView } from '@/features/quiz/QuestionImage';
import { AnswerTile, type AnswerState } from '@/features/quiz/ui';
import { askForRemindersOnce } from '@/features/reminders/useReminders';
import { useSettingsStore } from '@/features/settings/store';
import { useAdReward } from '@/features/store/hooks';
import { useWorldsConfig, worldBySlug } from '@/features/worlds/api';
import { useSession, type SessionState } from '@/features/worlds/useSession';
import { WorldBadge } from '@/features/worlds/WorldBadge';
import { shade } from '@/features/worlds/worldArt';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.session;
const REPORT_REASONS: ReportReason[] = ['wrong_answer', 'typo', 'unclear', 'other'];
const STARS_AT = [6, 8, 10];

/* ------------------------------------------------------------------ */
/* Clock: a shrinking bar                                              */
/* ------------------------------------------------------------------ */

function useSecondsLeft(deadlineAt: number | null, running: boolean, onZero: () => void): number {
  const calc = () => (deadlineAt ? Math.max(0, Math.ceil((deadlineAt - Date.now()) / 1000)) : 0);
  const [secs, setSecs] = useState(calc);
  const fired = useRef(false);
  const last = useRef(secs);
  useEffect(() => {
    fired.current = false;
    setSecs(calc());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [deadlineAt]);
  useEffect(() => {
    if (!running || !deadlineAt) return;
    const id = setInterval(() => {
      const v = calc();
      if (v !== last.current) {
        last.current = v;
        setSecs(v);
        if (v > 0 && v <= 5) {
          playSound('tick');
          haptic('select');
        }
      }
      if (v === 0 && !fired.current) {
        fired.current = true;
        onZero();
      }
    }, 200);
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [running, deadlineAt, onZero]);
  return secs;
}

function TimerBar({ deadlineAt, total, running, color }: { deadlineAt: number | null; total: number; running: boolean; color: string }) {
  const w = useSharedValue(1);
  useEffect(() => {
    if (!deadlineAt) return;
    const left = Math.max(0, deadlineAt - Date.now());
    w.value = Math.min(1, left / (total * 1000));
    if (running) w.value = withTiming(0, { duration: left, easing: Easing.linear });
  }, [deadlineAt, running, total, w]);
  const style = useAnimatedStyle(() => ({ width: `${w.value * 100}%` }));
  return (
    <View style={styles.timerTrack}>
      <Animated.View style={[styles.timerFill, { backgroundColor: color }, style]} />
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Top bar: world, progress dots, score                                */
/* ------------------------------------------------------------------ */

function Dots({ results, total, current }: { results: boolean[]; total: number; current: number }) {
  return (
    <View style={styles.dots} accessible accessibilityLabel={fmt(t.questionOf, { n: current, total })}>
      {Array.from({ length: total }, (_, i) => {
        const r = results[i];
        const bg = r === true ? colors.correct : r === false ? colors.danger : i === current - 1 ? colors.text : palette.night600;
        return <View key={i} style={[styles.dot, { backgroundColor: bg }, i === current - 1 && r === undefined && styles.dotNow]} />;
      })}
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */

function BigStar({ lit, delay, size }: { lit: boolean; delay: number; size: number }) {
  const reduced = useReducedMotion();
  useEffect(() => {
    if (!lit) return;
    const id = setTimeout(() => {
      playSound('answer_correct');
      haptic('success');
    }, delay + 150);
    return () => clearTimeout(id);
  }, [lit, delay]);
  return (
    <Animated.View entering={reduced ? undefined : ZoomIn.delay(delay).springify().damping(8)}>
      <Ionicons name="star" size={size} color={lit ? colors.led : palette.night600} />
    </Animated.View>
  );
}

function ResultView({
  s,
  world,
  color,
  onAgain,
  onNext,
}: {
  s: SessionState;
  world: string;
  color: string;
  onAgain: () => void;
  onNext: (() => void) | null;
}) {
  const reduced = useReducedMotion();
  const sum = s.summary!;
  const quick = sum.world === 'mix';
  useEffect(() => {
    void askForRemindersOnce();
    if (sum.correct < 7 || useSettingsStore.getState().reviewAsked) return;
    const id = setTimeout(async () => {
      try {
        if (await StoreReview.isAvailableAsync()) {
          useSettingsStore.getState().set({ reviewAsked: true });
          await StoreReview.requestReview();
        }
      } catch {
        // ignore
      }
    }, 2200);
    return () => clearTimeout(id);
  }, [sum.correct]);
  const title = quick ? t.quickDone : sum.stars === 3 ? t.perfect : sum.stars > 0 ? t.passed : t.failed;
  return (
    <ScrollView contentContainerStyle={styles.result}>
      <LinearGradient colors={[shade(color, -0.2), colors.bg]} style={styles.resultGlow} />
      <View style={styles.starsRow}>
        <BigStar lit={sum.stars >= 1} delay={250} size={64} />
        <View style={styles.starMid}>
          <BigStar lit={sum.stars >= 2} delay={550} size={84} />
        </View>
        <BigStar lit={sum.stars >= 3} delay={850} size={64} />
      </View>
      <AppText variant="title" align="center">
        {title}
      </AppText>
      <AppText color={colors.textMuted} align="center">
        {quick ? fmt(t.correctOf, { n: sum.correct, total: sum.total }) : `${world} · ${fmt(strings.worlds.level, { n: sum.level })} · ${fmt(t.correctOf, { n: sum.correct, total: sum.total })}`}
      </AppText>

      <Card kind="sticker" style={styles.finalCard}>
        <View style={styles.earned}>
          <Animated.View entering={reduced ? undefined : FadeInDown.delay(300)} style={styles.earnedTile}>
            <Led size="ledM">{`+${formatNumber(sum.coins)}`}</Led>
            <AppText variant="caption" color={colors.textDim}>
              {strings.quiz.earnedCoins}
            </AppText>
          </Animated.View>
          <Animated.View entering={reduced ? undefined : FadeInDown.delay(420)} style={styles.earnedTile}>
            <Led size="ledM" color={colors.text}>
              {formatNumber(sum.prize_points)}
            </Led>
            <AppText variant="caption" color={colors.textDim}>
              {t.score}
            </AppText>
          </Animated.View>
          <Animated.View entering={reduced ? undefined : FadeInDown.delay(540)} style={styles.earnedTile}>
            <Led size="ledM" color={colors.correct}>{`+${sum.xp}`}</Led>
            <AppText variant="caption" color={colors.textDim}>
              {strings.quiz.earnedXp}
            </AppText>
          </Animated.View>
        </View>
        {sum.chest ? (
          <Animated.View entering={reduced ? undefined : ZoomIn.delay(900)} style={styles.chest}>
            <Ionicons name="gift" size={22} color={colors.textOnBright} />
            <AppText variant="label" color={colors.textOnBright} style={styles.flex}>
              {sum.chest === 'gold' ? fmt(t.chestGold, { n: sum.level }) : t.chestSilver}
            </AppText>
          </Animated.View>
        ) : null}
        {sum.leveled_up ? (
          <Animated.View entering={reduced ? undefined : ZoomIn.delay(700)} style={styles.levelUp}>
            <AppText variant="label" color={colors.textOnBright} align="center">
              {fmt(strings.quiz.levelUp, { n: sum.player_level })}
            </AppText>
          </Animated.View>
        ) : null}
      </Card>

      {onNext ? <StickerButton label={t.nextLevel} icon="arrow-back" size="lg" fullWidth onPress={onNext} /> : null}
      <StickerButton
        label={quick ? t.playAgain : sum.stars > 0 ? strings.worlds.replay : t.again}
        icon="refresh"
        size={onNext ? 'md' : 'lg'}
        tone={onNext ? 'ghost' : 'primary'}
        fullWidth
        onPress={onAgain}
      />
      <DoubleCoins runId={s.payload?.run_id} coins={sum.coins} />
      <StickerButton
        label={strings.share.cta}
        icon="share-social"
        tone="outline"
        fullWidth
        onPress={() => void Share.share({ message: fmt(t.share, { n: sum.correct, w: quick ? t.quickDone : world }) })}
      />
      <StickerButton label={quick ? t.home : t.toMap} tone="ghost" fullWidth onPress={() => router.back()} />
    </ScrollView>
  );
}

function DoubleCoins({ runId, coins }: { runId?: string; coins: number }) {
  const ad = useAdReward();
  const toast = useToast();
  const [done, setDone] = useState(false);
  if (!runId || coins <= 0 || done) return null;
  return (
    <StickerButton
      label={fmt(ad.adFree ? strings.store.doubleNoAd : strings.store.double, { n: formatNumber(ad.adFree ? coins : coins * 2) })}
      icon={ad.adFree ? 'gift' : 'play-circle'}
      tone="outline"
      fullWidth
      loading={ad.busy}
      onPress={async () => {
        const r = await ad.run('double_run', runId);
        if (r) {
          setDone(true);
          playSound('coins');
          toast(fmt(strings.store.doubled, { n: formatNumber(coins) }), 'success');
        }
      }}
    />
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function SessionScreen() {
  const params = useLocalSearchParams<{ world?: string; level?: string; run?: string }>();
  const [target, setTarget] = useState({ world: params.world ?? 'mix', level: params.level ? Number(params.level) : null });
  const worlds = useWorldsConfig();
  const w = worldBySlug(worlds, target.world);
  const { state: s, start, answer, timeUp, next, fifty } = useSession(target.world, target.level, params.run);
  const { data: energy } = useEnergy();
  const showEnergy = useEnergySheet((x) => x.show);
  const toast = useToast();
  const reduced = useReducedMotion();
  const [reportOpen, setReportOpen] = useState(false);
  const total = s.payload?.total ?? 10;
  const qWorld = worldBySlug(worlds, s.payload?.question_world ?? target.world);

  useEffect(() => {
    preloadSounds(['whistle', 'tick', 'answer_lock', 'answer_correct', 'answer_wrong', 'coins']);
    void start();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (s.notice === 'no_coins') toast(t.noCoins, 'error');
  }, [s.notice, toast]);

  // A right answer moves on by itself; a wrong one waits so the player can read the explanation.
  useEffect(() => {
    if (s.phase !== 'reveal' || s.reveal?.result !== 'correct' || s.summary) return;
    const id = setTimeout(() => void next(), 1500);
    return () => clearTimeout(id);
  }, [s.phase, s.reveal, s.summary, next]);

  const secs = useSecondsLeft(s.deadlineAt, s.phase === 'question', timeUp);

  const exit = useCallback(() => {
    if (s.phase === 'finished' || s.phase === 'error' || !s.payload) {
      router.back();
      return true;
    }
    if (s.summary) {
      void next();
      return true;
    }
    Alert.alert(t.exitTitle, t.exitBody, [
      { text: t.keep, style: 'cancel' },
      { text: t.exit, style: 'destructive', onPress: () => router.back() },
    ]);
    return true;
  }, [s.phase, s.payload, s.summary, next]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', exit);
    return () => sub.remove();
  }, [exit]);

  const again = useCallback(
    (lvl?: number) => {
      if (energy && !energy.unlimited && energy.tickets < 1) {
        showEnergy();
        return;
      }
      const nextTarget = { world: target.world, level: lvl ?? target.level };
      setTarget(nextTarget);
      void start(nextTarget);
    },
    [energy, showEnergy, start, target],
  );

  if (s.phase === 'error') {
    const noEnergy = s.notice === 'no_energy';
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <EmptyState
            icon={noEnergy ? 'ticket-outline' : s.notice === 'locked' ? 'lock-closed-outline' : 'cloud-offline-outline'}
            title={noEnergy ? strings.engage.outTitle : s.notice === 'locked' ? t.lockedErr : strings.quiz.error}
            body={noEnergy ? strings.engage.freeModes : strings.errors.network}
            actionLabel={noEnergy ? strings.engage.refillNow : strings.common.retry}
            onAction={noEnergy ? showEnergy : () => void start()}
          />
          <StickerButton label={t.home} tone="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (s.phase === 'finished' && s.summary) {
    const sum = s.summary;
    const canNext = sum.world !== 'mix' && sum.stars > 0 && sum.level < w.levels;
    return (
      <SafeAreaView style={styles.root}>
        <ResultView s={s} world={w.name} color={w.color} onAgain={() => again()} onNext={canNext ? () => again(sum.level + 1) : null} />
      </SafeAreaView>
    );
  }

  const q = s.payload?.question;
  if (!s.payload || !q) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <Animated.View entering={reduced ? undefined : ZoomIn.springify()}>
            <WorldBadge icon={w.icon} color={w.color} size={110} />
          </Animated.View>
          <AppText variant="title">{w.name}</AppText>
          {target.level ? <AppText color={colors.textMuted}>{fmt(strings.worlds.level, { n: target.level })}</AppText> : null}
          <AppText color={colors.textMuted}>{t.starting}</AppText>
          <ActivityIndicator color={colors.led} />
        </View>
      </SafeAreaView>
    );
  }

  const rung = s.payload.rung;
  const answering = s.phase === 'question';
  const reveal = s.reveal;
  const used5050 = s.payload.lifelines_used.filter((x) => x === '5050').length;
  const correctSoFar = s.results.filter(Boolean).length;

  const stateFor = (slot: number): AnswerState => {
    if (q.removed.includes(slot)) return 'removed';
    if (reveal) {
      if (slot === reveal.correctSlot) return reveal.pickedSlot === slot ? 'correctPicked' : 'correctMissed';
      if (slot === reveal.pickedSlot) return 'wrongPicked';
      return 'dim';
    }
    if (s.picked === slot) return 'picked';
    if (s.phase === 'locked') return 'dim';
    return 'idle';
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <LinearGradient colors={[shade(qWorld.color, -0.45), colors.bg]} style={styles.bgGlow} />
      <View style={styles.top}>
        <Pressable onPress={exit} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.exit}>
          <Ionicons name="close" size={26} color={colors.textMuted} />
        </Pressable>
        <View style={styles.topMid}>
          <Dots results={s.results} total={total} current={rung} />
          <View style={styles.starGoal}>
            {STARS_AT.map((n) => (
              <Ionicons key={n} name="star" size={14} color={correctSoFar >= n ? colors.led : palette.night600} />
            ))}
          </View>
        </View>
        <View style={styles.scoreBox} accessible accessibilityLabel={`${t.score} ${s.score}`}>
          <Led size="number">{formatNumber(s.score)}</Led>
        </View>
      </View>

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <View style={styles.qHead}>
          <WorldBadge icon={qWorld.icon} color={qWorld.color} size={34} />
          <AppText variant="label" color={colors.textMuted} style={styles.flex}>
            {qWorld.name}
            {s.payload.level ? ` · ${fmt(strings.worlds.level, { n: s.payload.level })}` : ''}
          </AppText>
          <Led size="ledM" color={secs <= 5 && answering ? colors.danger : colors.text}>
            {String(secs).padStart(2, '0')}
          </Led>
        </View>
        <TimerBar
          deadlineAt={s.deadlineAt}
          total={q.seconds_left > 20 ? q.seconds_left : 20}
          running={answering}
          color={secs <= 5 ? colors.danger : qWorld.color}
        />

        <Animated.View key={q.id} entering={reduced ? undefined : FadeInUp.duration(280)} style={styles.qCard}>
          <AppText variant="caption" color={colors.cardMuted} style={styles.bold}>
            {fmt(t.questionOf, { n: rung, total })} · {strings.quiz.difficulty[q.difficulty]}
          </AppText>
          <AppText variant="question" color={colors.cardText}>
            {q.text}
          </AppText>
          {q.image ? <QuestionImageView image={q.image} /> : null}
        </Animated.View>

        <View style={styles.answers}>
          {q.answers.map((a, i) => (
            <AnswerTile
              key={`${q.id}-${a.slot}`}
              index={i}
              text={a.text}
              state={stateFor(a.slot)}
              disabled={!answering}
              fill
              onPress={() => void answer(a.slot)}
            />
          ))}
        </View>

        {reveal ? (
          <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(16)} accessibilityLiveRegion="assertive">
            <Card kind="soft" padding={space.md} style={styles.explain}>
              <View style={styles.revealHead}>
                <AppText variant="heading" color={reveal.result === 'correct' ? colors.correct : colors.danger} style={styles.flex}>
                  {reveal.result === 'correct' ? t.correct : reveal.result === 'timeout' ? t.timeout : t.wrong}
                </AppText>
                {reveal.points > 0 ? (
                  <Animated.View entering={reduced ? undefined : ZoomIn.springify()}>
                    <Led size="ledM">{fmt(t.points, { n: reveal.points })}</Led>
                  </Animated.View>
                ) : null}
              </View>
              <AppText color={colors.textMuted}>{reveal.explanation}</AppText>
              <Pressable onPress={() => setReportOpen(true)} accessibilityRole="button" hitSlop={8}>
                <AppText variant="caption" color={colors.textDim} style={styles.link}>
                  {strings.quiz.report}
                </AppText>
              </Pressable>
            </Card>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {reveal ? (
          <Animated.View entering={reduced ? undefined : FadeIn}>
            <StickerButton
              label={s.summary ? t.finish : t.next}
              icon={s.summary ? 'star' : 'arrow-back'}
              size="lg"
              fullWidth
              onPress={() => void next()}
            />
          </Animated.View>
        ) : (
          <Pressable
            onPress={() => void fifty()}
            disabled={!answering || s.busy5050 || q.removed.length > 0}
            accessibilityRole="button"
            accessibilityLabel={`${t.fifty} ${used5050 ? fmt(t.fiftyCost, { n: 30 }) : t.fiftyFree}`}
            style={({ pressed }) => [styles.fifty, (q.removed.length > 0 || !answering) && styles.fiftyOff, pressed && styles.pressed]}
          >
            {s.busy5050 ? <ActivityIndicator color={colors.led} /> : <Ionicons name="contrast" size={20} color={colors.text} />}
            <AppText variant="label">{t.fifty}</AppText>
            <View style={[styles.fiftyTag, used5050 ? styles.fiftyTagPaid : null]}>
              <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
                {used5050 ? fmt(t.fiftyCost, { n: 30 }) : t.fiftyFree}
              </AppText>
            </View>
          </Pressable>
        )}
      </View>

      <BottomSheet visible={reportOpen} onClose={() => setReportOpen(false)} title={strings.quiz.reportTitle}>
        {REPORT_REASONS.map((r) => (
          <StickerButton
            key={r}
            label={strings.quiz.reportReasons[r]}
            tone="ghost"
            size="sm"
            fullWidth
            onPress={() => {
              setReportOpen(false);
              quizApi
                .report(q.id, r)
                .then(() => toast(strings.quiz.reportThanks, 'success'))
                .catch(() => toast(strings.errors.generic, 'error'));
            }}
          />
        ))}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  bgGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 320 },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.md, padding: space.xl },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  pressed: { transform: [{ scale: 0.97 }] },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingTop: space.sm },
  topMid: { flex: 1, alignItems: 'center', gap: 4 },
  dots: { flexDirection: 'row', gap: 5 },
  dot: { width: 14, height: 8, borderRadius: 4 },
  dotNow: { width: 22 },
  starGoal: { flexDirection: 'row', gap: 2 },
  scoreBox: {
    minWidth: 64,
    alignItems: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.chip,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.border,
  },
  body: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.lg, gap: space.md },
  qHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  timerTrack: { height: 8, borderRadius: 4, backgroundColor: palette.night950, overflow: 'hidden' },
  timerFill: { height: 8, borderRadius: 4 },
  qCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
    borderBottomWidth: 5,
    borderBottomColor: '#CFC6F2',
  },
  answers: { gap: space.sm },
  explain: { gap: space.xs },
  revealHead: { flexDirection: 'row', alignItems: 'center' },
  link: { textDecorationLine: 'underline', marginTop: space.xs },
  footer: { paddingHorizontal: space.md, paddingBottom: space.sm, paddingTop: space.xs },
  fifty: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
    height: 54,
    borderRadius: radius.board,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.board,
  },
  fiftyOff: { opacity: 0.45 },
  fiftyTag: { paddingHorizontal: space.sm, paddingVertical: 1, borderRadius: radius.chip, backgroundColor: colors.correct },
  fiftyTagPaid: { backgroundColor: colors.led },
  result: { padding: space.xl, gap: space.lg, alignItems: 'center' },
  resultGlow: { position: 'absolute', top: 0, left: 0, right: 0, height: 360 },
  starsRow: { flexDirection: 'row', alignItems: 'flex-end', gap: space.sm, marginTop: space.lg },
  starMid: { marginBottom: 18 },
  finalCard: { alignSelf: 'stretch', gap: space.lg },
  earned: { flexDirection: 'row', gap: space.sm },
  earnedTile: { flex: 1, alignItems: 'center', paddingVertical: space.md, borderRadius: radius.board, backgroundColor: colors.surfaceRaised },
  chest: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.md, borderRadius: radius.board, backgroundColor: colors.led },
  levelUp: { alignSelf: 'center', paddingHorizontal: space.lg, paddingVertical: space.xs, borderRadius: radius.chip, backgroundColor: colors.correct },
});
