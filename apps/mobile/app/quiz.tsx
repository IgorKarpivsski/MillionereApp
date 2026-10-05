import { Ionicons } from '@expo/vector-icons';
import { LADDER } from '@fm/economy-config';
import type { LifelineKind, ReportReason } from '@fm/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppText,
  BottomSheet,
  Card,
  EmptyState,
  Led,
  ProgressBar,
  StickerButton,
  TrophyLogo,
  useToast,
} from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound, preloadSounds } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { quizApi } from '@/features/quiz/api';
import { useAdReward } from '@/features/store/hooks';
import { AnswerTile, LifelineButton, type AnswerState } from '@/features/quiz/ui';
import { useQuizRun, type QuizRunState } from '@/features/quiz/useQuizRun';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.quiz;

const LIFELINES: ReadonlyArray<{ kind: LifelineKind; label: string; icon: 'contrast-outline' | 'mic-outline' | 'people-outline' | 'tv-outline' }> = [
  { kind: 'fifty', label: '50:50', icon: 'contrast-outline' },
  { kind: 'expert', label: t.lifelines.expert, icon: 'mic-outline' },
  { kind: 'fans', label: t.lifelines.fans, icon: 'people-outline' },
  { kind: 'var', label: 'VAR', icon: 'tv-outline' },
];

const REPORT_REASONS: ReportReason[] = ['wrong_answer', 'typo', 'unclear', 'other'];

function coinsAt(correct: number): number {
  return correct > 0 ? (LADDER[Math.min(correct, 12) - 1]?.coins ?? 0) : 0;
}

/* ------------------------------------------------------------------ */
/* Clock                                                               */
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

/* ------------------------------------------------------------------ */
/* Scoreboard header                                                   */
/* ------------------------------------------------------------------ */

function Board({ s, onExit, daily }: { s: QuizRunState; onExit: () => void; daily: boolean }) {
  const reduced = useReducedMotion();
  const rung = s.payload?.rung ?? 1;
  // Classic: the champion scores once, when you miss. Daily: every miss is his goal.
  const rival = daily ? s.misses : s.reveal && s.reveal.result !== 'correct' ? 1 : 0;
  const minute = Math.min(90, Math.round(rung * (daily ? 9 : 7.5)));
  return (
    <View style={styles.board}>
      <Pressable onPress={onExit} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.exit}>
        <Ionicons name="close" size={24} color={colors.textDim} />
      </Pressable>
      <View style={styles.boardScore} accessible accessibilityLabel={`${t.you} ${s.score}, ${t.rival} ${rival}`}>
        <AppText variant="label">{t.you}</AppText>
        <View style={styles.digits}>
          <Animated.View key={`y${s.score}`} entering={reduced || s.score === 0 ? undefined : ZoomIn.springify().damping(9)}>
            <Led size="ledL">{s.score}</Led>
          </Animated.View>
          <Led size="ledL">:</Led>
          <Animated.View key={`r${rival}`} entering={reduced || rival === 0 ? undefined : ZoomIn.springify().damping(9)}>
            <Led size="ledL" color={rival ? colors.danger : colors.led}>
              {rival}
            </Led>
          </Animated.View>
        </View>
        <AppText variant="label">{t.rival}</AppText>
      </View>
      <Led size="number" color={colors.correct}>{`${minute}'`}</Led>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Result                                                              */
/* ------------------------------------------------------------------ */

function ResultView({ s, onAgain, daily }: { s: QuizRunState; onAgain: () => void; daily: boolean }) {
  const reduced = useReducedMotion();
  const sum = s.summary!;
  const won = daily ? sum.correct >= 6 : sum.status === 'won';
  const rival = daily ? 10 - sum.correct : sum.status === 'lost' || sum.status === 'timed_out' ? 1 : 0;
  return (
    <ScrollView contentContainerStyle={styles.result}>
      <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(12)}>
        <TrophyLogo size={won ? 120 : 84} color={won ? colors.led : colors.border} />
      </Animated.View>
      <AppText variant="title" align="center">
        {daily ? (won ? t.dailyWin : t.dailyLose) : t.result[sum.status]}
      </AppText>
      <AppText color={colors.textMuted} align="center">
        {daily ? fmt(t.dailyBody, { n: sum.correct }) : t.resultBody[sum.status]}
      </AppText>
      {daily && sum.streak ? (
        <View style={styles.streakRow}>
          <Ionicons name="flame" size={22} color={colors.danger} />
          <AppText variant="heading">{fmt(t.streakNow, { n: sum.streak })}</AppText>
        </View>
      ) : null}

      <Card kind="sticker" style={styles.finalCard}>
        <View style={styles.finalScore}>
          <AppText variant="label">{t.you}</AppText>
          <Led size="ledXL" color={colors.text}>
            {sum.correct}
          </Led>
          <Led size="ledXL" color={colors.text}>
            :
          </Led>
          <Led size="ledXL" color={rival ? colors.danger : colors.text}>
            {rival}
          </Led>
          <AppText variant="label">{t.rival}</AppText>
        </View>
        <View style={styles.earned}>
          <Animated.View entering={reduced ? undefined : FadeInDown.delay(200)} style={styles.earnedTile}>
            <Led size="ledM">{`+${formatNumber(sum.coins)}`}</Led>
            <AppText variant="caption" color={colors.textDim}>
              {t.earnedCoins}
            </AppText>
          </Animated.View>
          <Animated.View entering={reduced ? undefined : FadeInDown.delay(320)} style={styles.earnedTile}>
            <Led size="ledM" color={colors.text}>
              {formatNumber(sum.prize_points)}
            </Led>
            <AppText variant="caption" color={colors.textDim}>
              {t.earnedPoints}
            </AppText>
          </Animated.View>
          <Animated.View entering={reduced ? undefined : FadeInDown.delay(440)} style={styles.earnedTile}>
            <Led size="ledM" color={colors.correct}>{`+${sum.xp}`}</Led>
            <AppText variant="caption" color={colors.textDim}>
              {t.earnedXp}
            </AppText>
          </Animated.View>
        </View>
        {sum.leveled_up ? (
          <Animated.View entering={reduced ? undefined : ZoomIn.delay(600)} style={styles.levelUp}>
            <AppText variant="label" color={colors.textOnBright} align="center">
              {fmt(t.levelUp, { n: sum.level })}
            </AppText>
          </Animated.View>
        ) : null}
      </Card>

      {daily ? (
        <StickerButton label={t.toClassic} icon="football" size="lg" fullWidth onPress={() => router.replace('/quiz')} />
      ) : (
        <StickerButton label={t.again} icon="refresh" size="lg" fullWidth onPress={onAgain} />
      )}
      <DoubleCoins runId={s.payload?.run_id} coins={sum.coins} />
      <StickerButton label={t.home} tone="ghost" fullWidth onPress={() => router.back()} />
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

export default function QuizScreen() {
  const params = useLocalSearchParams<{ mode?: string }>();
  const daily = params.mode === 'daily';
  const total = daily ? 10 : 12;
  const { state: s, start, pick, next, lifeline, cashOut, whistle } = useQuizRun(daily ? 'daily' : 'classic');
  const toast = useToast();
  const reduced = useReducedMotion();
  const [reportOpen, setReportOpen] = useState(false);

  useEffect(() => {
    preloadSounds(['whistle', 'tick', 'answer_lock', 'answer_correct', 'answer_wrong', 'var', 'coins']);
    void start();
  }, [start]);

  useEffect(() => {
    if (s.notice === 'var') toast(t.varOverturned, 'info');
  }, [s.notice, toast]);

  const secs = useSecondsLeft(s.deadlineAt, s.phase === 'question', whistle);

  const exit = useCallback(() => {
    if (s.phase === 'finished' || s.phase === 'error' || !s.payload) {
      router.back();
      return true;
    }
    if (s.summary) {
      void next();
      return true;
    }
    if (daily) {
      Alert.alert(t.exitTitle, t.dailyExitBody, [
        { text: t.keepPlaying, style: 'cancel' },
        { text: t.exit, onPress: () => router.back() },
      ]);
      return true;
    }
    const coins = coinsAt(s.score);
    if (coins > 0) {
      Alert.alert(t.cashOutTitle, fmt(t.cashOutBody, { n: formatNumber(coins) }), [
        { text: t.keepPlaying, style: 'cancel' },
        { text: t.cashOutConfirm, onPress: () => void cashOut() },
      ]);
    } else {
      Alert.alert(t.exitTitle, t.exitBodyNothing, [
        { text: t.keepPlaying, style: 'cancel' },
        {
          text: t.exit,
          style: 'destructive',
          onPress: () => {
            void cashOut();
            router.back();
          },
        },
      ]);
    }
    return true;
  }, [s.phase, s.payload, s.summary, s.score, next, cashOut, daily]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', exit);
    return () => sub.remove();
  }, [exit]);

  /* ---------- states without a question ---------- */

  if (s.phase === 'error') {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <EmptyState
            icon="cloud-offline-outline"
            title={t.error}
            body={strings.errors.network}
            actionLabel={strings.common.retry}
            onAction={() => void start()}
          />
          <StickerButton label={t.home} tone="ghost" onPress={() => router.back()} />
        </View>
      </SafeAreaView>
    );
  }

  if (s.phase === 'finished' && s.summary) {
    return (
      <SafeAreaView style={styles.root}>
        <ResultView s={s} daily={daily} onAgain={() => void start()} />
      </SafeAreaView>
    );
  }

  const q = s.payload?.question;
  if (!s.payload || !q) {
    return (
      <SafeAreaView style={styles.root}>
        <View style={styles.center}>
          <TrophyLogo size={96} />
          <AppText color={colors.textMuted}>{t.starting}</AppText>
          <ActivityIndicator color={colors.led} />
        </View>
      </SafeAreaView>
    );
  }

  /* ---------- the question ---------- */

  const rung = s.payload.rung;
  const used = s.payload.lifelines_used;
  const hints = q.hints;
  const expert = hints.expert;
  const fans = hints.fans?.percents;
  const answering = s.phase === 'question';
  const reveal = s.reveal;

  const stateFor = (slot: number): AnswerState => {
    if (q.removed.includes(slot)) return 'removed';
    if (q.wrong_slots.includes(slot)) return 'overturned';
    if (reveal) {
      if (slot === reveal.correctSlot) return reveal.pickedSlot === slot ? 'correctPicked' : 'correctMissed';
      if (slot === reveal.pickedSlot) return 'wrongPicked';
      return 'dim';
    }
    if (s.picked === slot) return 'picked';
    if (s.phase === 'locked') return 'dim';
    return 'idle';
  };

  const expertLine = expert
    ? fmt(expert.confidence === 'sure' ? t.expertSure : expert.confidence === 'think' ? t.expertThink : t.expertGuess, {
        a: q.answers.find((a) => a.slot === expert.slot)?.text ?? '',
      })
    : null;

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Board s={s} daily={daily} onExit={exit} />

      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <ProgressBar value={(rung - 1 + (reveal ? 1 : 0)) / total} accessibilityLabel={fmt(t.questionOf, { n: rung, total })} />
        <View style={styles.infoRow}>
          <AppText variant="caption" color={colors.textDim}>
            {fmt(t.questionOf, { n: rung, total })} · {daily ? t.dailyTag : t.onTheLine}{' '}
            {daily ? null : (
              <AppText variant="caption" color={colors.led} style={styles.bold}>
                {formatNumber(LADDER[rung - 1]?.prizePoints ?? 0)}
              </AppText>
            )}
          </AppText>
          <View style={styles.clock}>
            <Led size="ledM" color={secs <= 10 && answering ? colors.danger : colors.text}>
              {String(secs).padStart(2, '0')}
            </Led>
            <AppText variant="caption" color={colors.textDim}>
              {t.seconds}
            </AppText>
          </View>
        </View>

        <Animated.View key={q.id} entering={reduced ? undefined : FadeIn.duration(250)} style={styles.qCard}>
          <View style={styles.chips}>
            {q.category_name ? (
              <View style={styles.chip}>
                <AppText variant="caption" color={colors.led} style={styles.bold}>
                  {q.category_name}
                </AppText>
              </View>
            ) : null}
            <AppText variant="caption" color={colors.cardMuted} style={styles.bold}>
              {t.difficulty[q.difficulty]}
            </AppText>
          </View>
          <AppText variant="question" color={colors.cardText}>
            {q.text}
          </AppText>
        </Animated.View>

        <View style={styles.grid}>
          {q.answers.map((a, i) => (
            <AnswerTile
              key={`${q.id}-${a.slot}`}
              index={i}
              text={a.text}
              state={stateFor(a.slot)}
              fansPct={fans ? fans[a.slot] : undefined}
              expertPick={expert?.slot === a.slot && !reveal}
              disabled={!answering}
              onPress={() => void pick(a.slot)}
            />
          ))}
        </View>

        {expertLine && !reveal ? (
          <View style={styles.hint}>
            <Ionicons name="mic" size={16} color={colors.led} />
            <AppText variant="bodyStrong" style={styles.flex}>
              {expertLine}
            </AppText>
          </View>
        ) : null}
        {q.var_armed && !reveal ? (
          <View style={[styles.hint, styles.hintVar]}>
            <Ionicons name="tv" size={16} color={colors.led} />
            <AppText variant="caption" style={styles.flex}>
              {t.varArmed}
            </AppText>
          </View>
        ) : null}

        {reveal ? (
          <Animated.View entering={reduced ? undefined : FadeInDown.springify().damping(16)}>
            <Card kind="soft" padding={space.md} style={styles.explain}>
              <AppText
                variant="heading"
                color={reveal.result === 'correct' ? colors.correct : colors.danger}
              >
                {reveal.result === 'correct' ? t.correctTitle : reveal.result === 'timeout' ? t.timeoutTitle : t.wrongTitle}
              </AppText>
              <AppText color={colors.textMuted}>{reveal.explanation}</AppText>
              <Pressable onPress={() => setReportOpen(true)} accessibilityRole="button" hitSlop={8}>
                <AppText variant="caption" color={colors.textDim} style={styles.link}>
                  {t.report}
                </AppText>
              </Pressable>
            </Card>
          </Animated.View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        {reveal ? (
          <StickerButton
            label={s.summary ? t.toSummary : t.next}
            icon={s.summary ? 'trophy' : 'arrow-back'}
            size="lg"
            fullWidth
            onPress={() => void next()}
          />
        ) : (
          <>
            <View style={[styles.lifelines, daily && styles.hidden]}>
              {LIFELINES.map((l) => (
                <LifelineButton
                  key={l.kind}
                  label={l.label}
                  icon={l.icon}
                  used={used.includes(l.kind)}
                  armed={l.kind === 'var' && q.var_armed}
                  busy={s.busyLifeline === l.kind}
                  disabled={!answering || !!s.busyLifeline}
                  onPress={() => {
                    if (used.includes(l.kind)) toast(t.lifelineUsed, 'info');
                    else void lifeline(l.kind);
                  }}
                />
              ))}
            </View>
            {s.score > 0 && !daily ? (
              <StickerButton
                label={fmt(t.cashOut, { n: formatNumber(coinsAt(s.score)) })}
                tone="outline"
                size="sm"
                fullWidth
                disabled={!answering}
                onPress={exit}
              />
            ) : null}
          </>
        )}
      </View>



      <BottomSheet visible={reportOpen} onClose={() => setReportOpen(false)} title={t.reportTitle}>
        {REPORT_REASONS.map((r) => (
          <StickerButton
            key={r}
            label={t.reportReasons[r]}
            tone="ghost"
            size="sm"
            fullWidth
            onPress={() => {
              setReportOpen(false);
              quizApi
                .report(q.id, r)
                .then(() => toast(t.reportThanks, 'success'))
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
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  board: {
    marginHorizontal: space.md,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  boardScore: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  digits: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  body: { paddingHorizontal: space.md, paddingTop: space.md, paddingBottom: space.lg, gap: space.md },
  infoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  clock: { flexDirection: 'row', alignItems: 'baseline', gap: 4 },
  qCard: {
    backgroundColor: colors.card,
    borderRadius: radius.card,
    padding: space.lg,
    gap: space.sm,
  },
  chips: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  chip: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.board },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  hint: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.board,
    backgroundColor: colors.surfaceRaised,
  },
  hintVar: { borderWidth: 1, borderColor: colors.led },
  explain: { gap: space.xs },
  link: { textDecorationLine: 'underline', marginTop: space.xs },
  footer: { paddingHorizontal: space.md, paddingBottom: space.sm, paddingTop: space.xs, gap: space.sm },
  lifelines: { flexDirection: 'row', gap: space.sm },
  hidden: { display: 'none' },
  streakRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  goal: {
    position: 'absolute',
    top: '30%',
    alignSelf: 'center',
    paddingHorizontal: space.xl,
    paddingVertical: space.md,
    borderRadius: radius.card,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.led,
  },
  result: { padding: space.xl, gap: space.lg, alignItems: 'center' },
  finalCard: { alignSelf: 'stretch', gap: space.lg },
  finalScore: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  earned: { flexDirection: 'row', gap: space.sm },
  earnedTile: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.md,
    borderRadius: radius.board,
    backgroundColor: colors.surfaceRaised,
  },
  levelUp: { alignSelf: 'center', paddingHorizontal: space.lg, paddingVertical: space.xs, borderRadius: radius.chip, backgroundColor: colors.correct },
});
