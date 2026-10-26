import type { SurvivalInfo, SurvivalPayload } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Dimensions, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appAlert, AppText, Backdrop, CoinIcon, EmptyState, GemIcon, Led, Sloth, StickerButton, TrophyLogo } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound, preloadSounds } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { useEnergySheet } from '@/features/engage/EnergySheet';
import { useEnergy, useRefreshEconomy } from '@/features/engage/hooks';
import { useMyState } from '@/features/profile/hooks';
import { LeagueCountdown } from '@/features/league/LeagueView';
import { survivalApi, useSurvivalInfo } from '@/features/modes/api';
import { RpcError } from '@/features/profile/api';
import { QuestionImageView } from '@/features/quiz/QuestionImage';
import { AnswerTile, type AnswerState } from '@/features/quiz/ui';
import { markModeSeen } from '@/features/settings/store';
import { useStore } from '@/features/store/hooks';
import { gameFinished } from '@/features/store/interstitial';
import { RankList } from '@/features/teen/RankList';
import { ShareResultButton } from '@/features/teen/ShareResult';
import { formatNumber } from '@/lib/format';
import { goHome } from '@/lib/goHome';
import { fmt, strings } from '@/lib/i18n';

const SMALL = Dimensions.get('window').height < 760;
const t = strings.survival;
const ACCENT = '#8E5CFF';

type Phase = 'intro' | 'starting' | 'countdown' | 'playing' | 'down' | 'finishing' | 'done' | 'error';

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

/** Week table with prizes and the countdown to the end of the week. */
function WeekBoard({ info }: { info: SurvivalInfo }) {
  const secs = Math.max(0, Math.floor((new Date(info.ends_at).getTime() - Date.now()) / 1000));
  return (
    <View style={styles.board}>
      <View style={styles.prizeBox}>
        <AppText variant="bodyStrong" color={colors.led}>
          {t.prizesTitle}
        </AppText>
        <AppText color={colors.textMuted}>{t.prizesBody}</AppText>
        <LeagueCountdown seconds={secs} label={t.endsIn} color={colors.text} />
      </View>
      <View style={styles.prizes}>
        {info.prizes.map((p, i) => (
          <View key={i} style={styles.prize}>
            <AppText variant="caption" color={colors.textDim}>
              {['🥇', '🥈', '🥉'][i]} {fmt(t.place, { r: i + 1 })}
            </AppText>
            <View style={styles.amt}>
              <CoinIcon size={16} />
              <Led size="number" color={colors.led}>
                {formatNumber(p.coins)}
              </Led>
            </View>
            <View style={styles.amt}>
              <GemIcon size={14} />
              <AppText variant="caption" color={colors.gem}>{`+${p.gems}`}</AppText>
            </View>
          </View>
        ))}
      </View>
      <AppText variant="heading">{t.weekTable}</AppText>
      {info.me ? (
        <AppText variant="label" color={colors.led}>
          {fmt(t.yourRank, { r: info.me.rank })}
        </AppText>
      ) : null}
      {info.rows.length ? (
        <RankList rows={info.rows.slice(0, 10)} />
      ) : (
        <AppText color={colors.textMuted} align="center">
          {t.emptyTable}
        </AppText>
      )}
      {info.last_winners.length ? (
        <>
          <AppText variant="heading">{t.lastWinners}</AppText>
          <RankList rows={info.last_winners} />
        </>
      ) : null}
    </View>
  );
}

export default function SurvivalScreen() {
  useEffect(() => markModeSeen('survival'), []);
  const reduced = useReducedMotion();
  const qc = useQueryClient();
  const refresh = useRefreshEconomy();
  const { data: info } = useSurvivalInfo();
  const { data: energy } = useEnergy();
  const { data: me } = useMyState();
  const showEnergy = useEnergySheet((s) => s.show);
  const { data: store } = useStore();
  const adFree = !!store?.ad_free;
  const [phase, setPhase] = useState<Phase>('intro');
  const [error, setError] = useState<string | null>(null);
  const [p, setP] = useState<SurvivalPayload | null>(null);
  const [picked, setPicked] = useState<number | null>(null);
  const [flash, setFlash] = useState<{ slot: number; correct: number | null; ok: boolean } | null>(null);
  const [timedOut, setTimedOut] = useState(false);
  const [reviving, setReviving] = useState(false);
  const { left, sync } = useDeadline();
  const per = p?.question_seconds ?? info?.question_seconds ?? 15;
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
    setFlash(null);
    setPicked(null);
    setTimedOut(false);
    try {
      const r = await survivalApi.start();
      setP(r);
      sync(r.seconds_left);
      setPhase('countdown');
      refresh();
    } catch (e) {
      setError(e instanceof RpcError && e.message.includes('no_energy') ? 'no_energy' : 'error');
      setPhase('error');
    }
  }, [energy, showEnergy, sync, refresh]);

  const inCountdown = phase === 'countdown' && left > per;
  useEffect(() => {
    if (phase === 'countdown' && left <= per) {
      playSound('whistle');
      setPhase('playing');
    }
  }, [phase, left, per]);

  const finish = useCallback(async () => {
    if (!p) return;
    setPhase('finishing');
    for (let i = 0; i < 3; i++) {
      try {
        const r = await survivalApi.finish(p.run_id);
        setP(r);
        setPhase('done');
        playSound(r.new_best ? 'level_up' : 'coins');
        haptic('success');
        void qc.invalidateQueries({ queryKey: ['survival-info'] });
        refresh();
        void gameFinished(adFree);
        return;
      } catch {
        await new Promise((res) => setTimeout(res, 1000));
      }
    }
    setError('error');
    setPhase('error');
  }, [p, qc, refresh, adFree]);

  const answer = useCallback(
    async (slot: number) => {
      if (!p || busy.current || phase !== 'playing') return;
      busy.current = true;
      setPicked(slot >= 0 ? slot : null);
      if (slot >= 0) {
        playSound('answer_lock');
        haptic('tap');
      }
      try {
        const r = await survivalApi.answer(p.run_id, slot);
        const ok = !!r.was_correct;
        setFlash({ slot, correct: r.correct_slot ?? null, ok });
        playSound(ok ? 'answer_correct' : 'answer_wrong');
        haptic(ok ? 'success' : 'error');
        await new Promise((res) => setTimeout(res, ok ? 650 : 1300));
        setP(r);
        setFlash(null);
        setPicked(null);
        if (ok) {
          sync(r.seconds_left);
        } else {
          setTimedOut(slot < 0);
          setPhase('down');
        }
      } catch {
        setPicked(null);
      } finally {
        busy.current = false;
      }
    },
    [p, phase, sync],
  );

  // time ran out on this question
  useEffect(() => {
    if (phase === 'playing' && left <= 0 && !busy.current && !flash) void answer(-1);
  }, [phase, left, flash, answer]);

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'countdown' && phase !== 'down') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      appAlert(strings.match.exitTitle, '', [
        { text: strings.common.cancel, style: 'cancel' },
        { text: strings.match.exit, style: 'destructive', onPress: () => router.back() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [phase]);

  const revive = async () => {
    if (!p) return;
    setReviving(true);
    try {
      const r = await survivalApi.revive(p.run_id);
      setP(r);
      sync(r.seconds_left);
      setPhase('playing');
      refresh();
      playSound('whistle');
    } catch (e) {
      appAlert(e instanceof RpcError && e.code === 'insufficient_funds' ? t.noGems : strings.errors.generic);
    } finally {
      setReviving(false);
    }
  };

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
        <Backdrop accent={ACCENT} />
        <View style={styles.top}>
          <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
        </View>
        <ScrollView contentContainerStyle={styles.intro}>
          <TrophyLogo size={110} />
          <AppText variant="title" align="center">
            {t.title}
          </AppText>
          <AppText color={colors.textMuted} align="center">
            {t.intro}
          </AppText>
          <AppText variant="label" color={colors.textDim} align="center">
            {fmt(t.perQuestion, { n: info?.question_seconds ?? 15 })}
          </AppText>
          <View style={styles.bests}>
            <AppText variant="label" color={colors.led}>
              {fmt(t.weekBest, { n: info?.week_best ?? 0 })}
            </AppText>
            <AppText variant="label" color={colors.textMuted}>
              {fmt(t.best, { n: info?.best ?? 0 })}
            </AppText>
          </View>
          <StickerButton label={t.start} icon="trophy" tone="prize" size="lg" fullWidth loading={phase === 'starting'} onPress={() => void start()} />
          <AppText variant="caption" color={colors.textDim} align="center">
            {t.cost}
          </AppText>
          {info ? <WeekBoard info={info} /> : <ActivityIndicator color={colors.led} />}
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (inCountdown || phase === 'countdown') {
    const n = Math.max(1, Math.ceil(left - per));
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Backdrop accent={ACCENT} />
        <AppText variant="heading">{t.ready}</AppText>
        <Animated.View key={n} entering={reduced ? undefined : ZoomIn}>
          <Led size="ledXL">{String(n)}</Led>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (phase === 'down' && p) {
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop accent="#E8463A" />
        <ScrollView contentContainerStyle={[styles.intro, styles.grow]}>
          <AppText variant="title" align="center">
            {timedOut ? t.timeout : t.down}
          </AppText>
          <AppText color={colors.textMuted} align="center">
            {t.cheer}
          </AppText>
          <Led size="ledXL">{String(p.correct)}</Led>
          <AppText variant="heading" align="center">
            {fmt(t.score, { n: p.correct })}
          </AppText>
          {p.can_revive ? (
            <Animated.View entering={reduced ? undefined : FadeInDown} style={styles.reviveBox}>
              <AppText variant="heading" align="center">
                {t.reviveTitle}
              </AppText>
              <AppText color={colors.textMuted} align="center">
                {t.reviveBody}
              </AppText>
              {(me?.wallet.gems ?? 0) >= p.revive_gems ? (
                <StickerButton
                  label={fmt(t.revive, { n: p.revive_gems })}
                  icon="heart"
                  tone="gem"
                  size="lg"
                  fullWidth
                  loading={reviving}
                  onPress={() => void revive()}
                />
              ) : (
                <AppText variant="label" color={colors.gem} align="center">
                  {fmt(t.needGems, { n: p.revive_gems })}
                </AppText>
              )}
            </Animated.View>
          ) : null}
          <StickerButton label={t.giveUp} tone="ghost" fullWidth onPress={() => void finish()} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (phase === 'done' || phase === 'finishing') {
    if (phase === 'finishing' || !p) {
      return (
        <SafeAreaView style={[styles.root, styles.center]}>
          <Backdrop />
          <AppText variant="title">{t.over}</AppText>
          <ActivityIndicator color={colors.led} />
        </SafeAreaView>
      );
    }
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop accent={p.new_best ? '#FFB000' : ACCENT} />
        <ScrollView contentContainerStyle={[styles.intro, styles.grow]}>
          <AppText variant="title" align="center">
            {t.over}
          </AppText>
          {p.new_best || p.new_week_best ? <TrophyLogo size={96} /> : null}
          <Animated.View entering={reduced ? undefined : ZoomIn.delay(150).springify()}>
            <Led size="ledXL">{String(p.correct)}</Led>
          </Animated.View>
          <AppText variant="heading" align="center">
            {fmt(t.score, { n: p.correct })}
          </AppText>
          {p.new_best ? (
            <AppText variant="heading" color={colors.led} align="center">
              {t.newBest}
            </AppText>
          ) : p.new_week_best ? (
            <AppText variant="heading" color={colors.led} align="center">
              {t.newWeekBest}
            </AppText>
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
          <StickerButton label={t.again} icon="refresh" tone="prize" size="lg" fullWidth onPress={() => void start()} />
          {p.correct > 0 ? <ShareResultButton big={String(p.correct)} line={fmt(t.score, { n: p.correct })} /> : null}
          <StickerButton label={strings.quiz.home} icon="home" tone="ghost" fullWidth onPress={goHome} />
          {info ? <WeekBoard info={info} /> : null}
        </ScrollView>
      </SafeAreaView>
    );
  }

  // playing
  const q = p?.question;
  const frac = Math.max(0, Math.min(1, left / per));
  const urgent = left <= 5;
  const stateFor = (slot: number): AnswerState => {
    if (flash) {
      if (slot === flash.correct) return flash.slot === slot ? 'correctPicked' : 'correctMissed';
      if (slot === flash.slot) return 'wrongPicked';
      return 'dim';
    }
    if (picked === slot) return 'picked';
    return picked !== null ? 'dim' : 'idle';
  };
  const streak = p?.correct ?? 0;
  return (
    <SafeAreaView style={styles.root}>
      <Backdrop accent={urgent ? '#E8463A' : ACCENT} />
      <View style={styles.hud}>
        <View style={styles.hudSide}>
          <AppText variant="caption" color={colors.textDim}>
            {t.streak}
          </AppText>
          <Animated.View key={streak} entering={reduced ? undefined : ZoomIn}>
            <Led size="ledM">{String(streak)}</Led>
          </Animated.View>
        </View>
        <Led size="ledL" color={urgent ? colors.danger : colors.led}>
          {String(Math.ceil(left)).padStart(2, '0')}
        </Led>
        <View style={styles.hudSide}>
          <AppText variant="caption" color={colors.textDim}>
            {'👑'}
          </AppText>
          <Led size="number" color={colors.textMuted}>
            {String(Math.max(p?.week_best ?? 0, streak))}
          </Led>
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${frac * 100}%`, backgroundColor: urgent ? colors.danger : colors.led }]} />
      </View>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.body}>
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
        {streak > 0 && streak % 5 === 0 && !flash ? (
          <Animated.View entering={reduced ? undefined : FadeIn} style={styles.cheer}>
            <Sloth head size={70} bob={false} say={t.slothCheer[(streak / 5) % t.slothCheer.length]} bubbleSide="side" />
          </Animated.View>
        ) : null}
      </ScrollView>
      <View style={styles.answersDock}>
        <View style={q?.image || SMALL ? styles.grid : styles.answers}>
          {q?.answers.map((a, i) => (
            <AnswerTile
              key={`${q.id}-${a.slot}`}
              fill={!(q.image || SMALL)}
              index={i}
              text={a.text}
              state={stateFor(a.slot)}
              disabled={picked !== null || !!flash}
              onPress={() => void answer(a.slot)}
            />
          ))}
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollArea: { flex: 1 },
  answersDock: { paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.sm },
  root: { flex: 1, backgroundColor: colors.bgDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.sm },
  intro: { padding: space.xl, gap: space.md, alignItems: 'center' },
  grow: { flexGrow: 1, justifyContent: 'center' },
  bests: { alignItems: 'center', gap: 2 },
  reviveBox: {
    alignSelf: 'stretch',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.card,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.gem,
  },
  board: { alignSelf: 'stretch', gap: space.md, marginTop: space.md },
  prizeBox: { gap: 4, padding: space.md, borderRadius: radius.board, backgroundColor: colors.board, borderWidth: 1, borderColor: colors.led },
  prizes: { flexDirection: 'row', gap: space.sm },
  prize: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space.sm, borderRadius: radius.board, backgroundColor: colors.board },
  amt: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  cheer: { alignItems: 'center' },
});
