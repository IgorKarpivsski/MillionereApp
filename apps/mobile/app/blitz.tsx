import type { BlitzPayload } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Backdrop, EmptyState, Led, Sloth, StickerButton, TrophyLogo } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound, preloadSounds } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { useEnergySheet } from '@/features/engage/EnergySheet';
import { useEnergy, useRefreshEconomy } from '@/features/engage/hooks';
import { useFly } from '@/features/home/RewardFly';
import { blitzApi, useBlitzInfo } from '@/features/modes/api';
import { RpcError } from '@/features/profile/api';
import { QuestionImageView } from '@/features/quiz/QuestionImage';
import { AnswerTile, type AnswerState } from '@/features/quiz/ui';
import { goHome } from '@/lib/goHome';
import { fmt, strings } from '@/lib/i18n';
import { useStore } from '@/features/store/hooks';
import { gameFinished } from '@/features/store/interstitial';

const t = strings.blitz;

type Phase = 'intro' | 'starting' | 'countdown' | 'playing' | 'finishing' | 'done' | 'error';

/** Local clock synced to the server's "seconds left" each time a payload arrives. */
function useDeadline() {
  const [deadline, setDeadline] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => {
    const id = setInterval(() => tick((x) => x + 1), 100);
    return () => clearInterval(id);
  }, []);
  const sync = useCallback((secondsLeft: number) => setDeadline(Date.now() + secondsLeft * 1000), []);
  return { left: Math.max(0, (deadline - Date.now()) / 1000), sync };
}

export default function BlitzScreen() {
  const reduced = useReducedMotion();
  const qc = useQueryClient();
  const refresh = useRefreshEconomy();
  const { data: info } = useBlitzInfo();
  const { data: energy } = useEnergy();
  const showEnergy = useEnergySheet((s) => s.show);
  const launch = useFly((s) => s.launch);
  const { data: store } = useStore();
  const adFree = !!store?.ad_free;
  const [phase, setPhase] = useState<Phase>('intro');
  const [error, setError] = useState<string | null>(null);
  const [p, setP] = useState<BlitzPayload | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ slot: number; correct: number | null; ok: boolean } | null>(null);
  const [streak, setStreak] = useState(0);
  const { left, sync } = useDeadline();
  const total = p?.total_seconds ?? info?.seconds ?? 60;
  const busy = useRef(false);

  useEffect(() => {
    preloadSounds(['whistle', 'answer_lock', 'answer_correct', 'answer_wrong', 'coins', 'level_up']);
  }, []);

  const start = useCallback(async () => {
    if (energy && !energy.unlimited && energy.tickets < 1) {
      showEnergy();
      return;
    }
    setPhase('starting');
    setStreak(0);
    setFlash(null);
    setPicked(null);
    try {
      const r = await blitzApi.start();
      setP(r);
      sync(r.seconds_left);
      setPhase('countdown');
      refresh();
    } catch (e) {
      setError(e instanceof RpcError && e.message.includes('no_energy') ? 'no_energy' : 'error');
      setPhase('error');
    }
  }, [energy, showEnergy, sync, refresh]);

  // countdown → play
  const inCountdown = phase === 'countdown' && left > total;
  useEffect(() => {
    if (phase === 'countdown' && left <= total) {
      playSound('whistle');
      setPhase('playing');
    }
  }, [phase, left, total]);

  const finish = useCallback(async () => {
    if (!p) return;
    setPhase('finishing');
    for (let i = 0; i < 4; i++) {
      try {
        const r = await blitzApi.finish(p.run_id);
        setP(r);
        setPhase('done');
        playSound(r.new_best ? 'level_up' : 'coins');
        haptic('success');
        void qc.invalidateQueries({ queryKey: ['blitz-info'] });
        refresh();
        void gameFinished(adFree);
        return;
      } catch (e) {
        // the server clock may be a hair behind ours
        if (e instanceof RpcError && e.message.includes('still running')) await new Promise((res) => setTimeout(res, 700));
        else await new Promise((res) => setTimeout(res, 1200));
      }
    }
    setError('error');
    setPhase('error');
  }, [p, qc, refresh, adFree]);

  // time up
  useEffect(() => {
    if (phase === 'playing' && left <= 0) void finish();
  }, [phase, left, finish]);

  // leaving mid-run needs a confirmation
  useEffect(() => {
    if (phase !== 'playing' && phase !== 'countdown') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(strings.match.exitTitle, '', [
        { text: strings.common.cancel, style: 'cancel' },
        { text: strings.match.exit, style: 'destructive', onPress: () => router.back() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [phase]);

  const answer = async (slot: number) => {
    if (!p || busy.current || phase !== 'playing') return;
    busy.current = true;
    setPicked(slot);
    playSound('answer_lock');
    haptic('tap');
    try {
      const r = await blitzApi.answer(p.run_id, slot);
      const ok = !!r.was_correct;
      setFlash({ slot, correct: r.correct_slot ?? null, ok });
      playSound(ok ? 'answer_correct' : 'answer_wrong');
      haptic(ok ? 'success' : 'error');
      setStreak((s) => (ok ? s + 1 : 0));
      sync(r.seconds_left);
      await new Promise((res) => setTimeout(res, ok ? 280 : 650));
      setP(r);
      setFlash(null);
      setPicked(null);
      if (r.status === 'done') void finish();
    } catch {
      setPicked(null);
    } finally {
      busy.current = false;
    }
  };

  // celebrate the coins once the result arrives
  const flown = useRef<string | null>(null);
  const scoreRef = useRef<View>(null);
  useEffect(() => {
    if (phase !== 'done' || !p?.coins || flown.current === p.run_id) return;
    flown.current = p.run_id;
    setTimeout(() => {
      scoreRef.current?.measureInWindow((x, y, w, h) =>
        launch({ from: { x: x + w / 2, y: y + h / 2 }, kind: 'coins', label: fmt(t.coins, { n: p.coins ?? 0 }) }),
      );
    }, 500);
  }, [phase, p, launch]);

  if (phase === 'error') {
    const noEnergy = error === 'no_energy';
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop />
        <View style={styles.center}>
          <EmptyState
            icon={noEnergy ? 'ticket-outline' : 'cloud-offline-outline'}
            title={noEnergy ? strings.engage.outTitle : strings.quiz.error}
            body={noEnergy ? strings.engage.freeModes : strings.errors.network}
            actionLabel={noEnergy ? strings.engage.refillNow : strings.common.retry}
            onAction={noEnergy ? showEnergy : () => setPhase('intro')}
          />
          <StickerButton label={strings.quiz.home} tone="ghost" onPress={goHome} />
        </View>
      </SafeAreaView>
    );
  }

  if (phase === 'intro' || phase === 'starting') {
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop accent="#FF8A3D" />
        <View style={styles.top}>
          <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
        </View>
        <ScrollView contentContainerStyle={styles.intro}>
          <Sloth size={150} say={t.slothCheer[0]} />
          <AppText variant="title" align="center">
            {t.title}
          </AppText>
          <View style={styles.bigClock}>
            <Led size="ledXL">{String(info?.seconds ?? 60)}</Led>
          </View>
          <AppText color={colors.textMuted} align="center">
            {t.intro}
          </AppText>
          <AppText variant="label" color={colors.led} align="center">
            {info?.best ? fmt(t.best, { n: info.best }) : t.noBest}
          </AppText>
          <StickerButton label={t.start} icon="timer" tone="prize" size="lg" fullWidth loading={phase === 'starting'} onPress={() => void start()} />
          <AppText variant="caption" color={colors.textDim} align="center">
            {t.cost}
          </AppText>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (inCountdown || phase === 'countdown') {
    const n = Math.max(1, Math.ceil(left - total));
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Backdrop accent="#FF8A3D" />
        <AppText variant="heading">{t.ready}</AppText>
        <Animated.View key={n} entering={reduced ? undefined : ZoomIn}>
          <Led size="ledXL">{String(n)}</Led>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (phase === 'done' || phase === 'finishing') {
    if (phase === 'finishing' || !p) {
      return (
        <SafeAreaView style={[styles.root, styles.center]}>
          <Backdrop />
          <AppText variant="title">{t.timeUp}</AppText>
          <ActivityIndicator color={colors.led} />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop accent={p.new_best ? '#FFB000' : undefined} />
        <ScrollView contentContainerStyle={[styles.intro, styles.grow]}>
          <AppText variant="title" align="center">
            {t.timeUp}
          </AppText>
          {p.new_best ? <TrophyLogo size={96} /> : null}
          <View ref={scoreRef} collapsable={false} style={styles.scoreBox}>
            <Animated.View entering={reduced ? undefined : ZoomIn.delay(150).springify()}>
              <Led size="ledXL">{String(p.correct)}</Led>
            </Animated.View>
            <AppText variant="heading" align="center">
              {fmt(t.score, { n: p.correct })}
            </AppText>
            <AppText color={colors.textMuted} align="center">
              {fmt(t.answered, { n: p.answered })}
            </AppText>
          </View>
          {p.new_best ? (
            <Animated.View entering={reduced ? undefined : FadeInDown.delay(400)} style={styles.center2}>
              <AppText variant="heading" color={colors.led} align="center">
                {t.newBest}
              </AppText>
              {p.previous_best ? (
                <AppText color={colors.textMuted} align="center">
                  {fmt(t.prevBest, { n: p.previous_best })}
                </AppText>
              ) : null}
            </Animated.View>
          ) : (
            <AppText color={colors.textMuted} align="center">
              {fmt(t.best, { n: p.best })}
            </AppText>
          )}
          {p.coins ? (
            <AppText variant="heading" color={colors.led} align="center">
              {fmt(t.coins, { n: p.coins })}
            </AppText>
          ) : null}
          <Sloth size={110} say={p.new_best ? t.newBest : t.slothCheer[2]} />
          <StickerButton
            label={t.again}
            icon="refresh"
            tone="prize"
            size="lg"
            fullWidth
            onPress={() => void start()}
          />
          <StickerButton label={strings.quiz.home} icon="home" tone="ghost" fullWidth onPress={goHome} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  // playing
  const q = p?.question;
  const frac = Math.max(0, Math.min(1, left / total));
  const urgent = left <= 10;
  const stateFor = (slot: number): AnswerState => {
    if (flash) {
      if (slot === flash.correct) return flash.slot === slot ? 'correctPicked' : 'correctMissed';
      if (slot === flash.slot) return 'wrongPicked';
      return 'dim';
    }
    if (picked === slot) return 'picked';
    return picked !== null ? 'dim' : 'idle';
  };
  return (
    <SafeAreaView style={styles.root}>
      <Backdrop accent={urgent ? '#E8463A' : '#FF8A3D'} />
      <View style={styles.hud}>
        <View style={styles.hudSide}>
          <AppText variant="caption" color={colors.textDim}>
            {t.correct}
          </AppText>
          <Animated.View key={p?.correct} entering={reduced ? undefined : ZoomIn}>
            <Led size="ledM">{String(p?.correct ?? 0)}</Led>
          </Animated.View>
        </View>
        <Led size="ledL" color={urgent ? colors.danger : colors.led}>
          {String(Math.ceil(left)).padStart(2, '0')}
        </Led>
        <View style={styles.hudSide}>
          {streak >= 3 ? (
            <Animated.View entering={reduced ? undefined : ZoomIn}>
              <AppText variant="label" color={colors.led}>{`🔥 ${streak}`}</AppText>
            </Animated.View>
          ) : null}
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${frac * 100}%`, backgroundColor: urgent ? colors.danger : colors.led }]} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {q ? (
          <Animated.View key={q.id} entering={reduced ? undefined : FadeIn.duration(160)} style={styles.qCard}>
            {q.category_name ? (
              <View style={styles.chip}>
                <AppText variant="caption" color={colors.led}>
                  {q.category_name}
                </AppText>
              </View>
            ) : null}
            <AppText variant="question" color={colors.cardText}>
              {q.text}
            </AppText>
            {q.image ? <QuestionImageView image={q.image} /> : null}
          </Animated.View>
        ) : null}
        <View style={styles.answers}>
          {q?.answers.map((a, i) => (
            <AnswerTile
              key={`${q.id}-${a.slot}`}
              fill
              index={i}
              text={a.text}
              state={stateFor(a.slot)}
              disabled={picked !== null || !!flash}
              onPress={() => void answer(a.slot)}
            />
          ))}
        </View>
        {streak >= 3 && streak % 3 === 0 ? (
          <Animated.View entering={reduced ? undefined : FadeIn} style={styles.cheer}>
            <Sloth head size={70} bob={false} say={t.slothCheer[(streak / 3) % t.slothCheer.length]} bubbleSide="side" />
          </Animated.View>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  center2: { alignItems: 'center', gap: space.xs },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.sm },
  intro: { padding: space.xl, gap: space.md, alignItems: 'center' },
  grow: { flexGrow: 1, justifyContent: 'center' },
  bigClock: {
    paddingHorizontal: space.xl,
    paddingVertical: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.border,
  },
  scoreBox: { alignItems: 'center', gap: space.xs },
  hud: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: space.md,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.border,
  },
  hudSide: { width: 80, alignItems: 'center' },
  track: { height: 8, marginHorizontal: space.md, marginTop: space.sm, borderRadius: 4, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 4 },
  body: { padding: space.md, gap: space.md },
  qCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.sm },
  chip: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.board },
  answers: { gap: space.sm },
  cheer: { alignItems: 'center' },
});
