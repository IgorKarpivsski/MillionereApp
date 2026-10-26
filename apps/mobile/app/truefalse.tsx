import type { TfPayload } from '@fm/shared';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeOut, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appAlert, AppText, Backdrop, EmptyState, Led, Sloth, StickerButton, TrophyLogo } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound, preloadSounds } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { useEnergySheet } from '@/features/engage/EnergySheet';
import { useEnergy, useRefreshEconomy } from '@/features/engage/hooks';
import { tfApi, useTfInfo } from '@/features/modes/api';
import { RpcError } from '@/features/profile/api';
import { QuestionImageView } from '@/features/quiz/QuestionImage';
import { markModeSeen } from '@/features/settings/store';
import { useStore } from '@/features/store/hooks';
import { gameFinished } from '@/features/store/interstitial';
import { ShareResultButton } from '@/features/teen/ShareResult';
import { goHome } from '@/lib/goHome';
import { fmt, strings } from '@/lib/i18n';

const t = strings.tf;
const ACCENT = '#14B8A6';
const GREEN = '#22C55E';
const RED = '#EF4444';

type Phase = 'intro' | 'starting' | 'countdown' | 'playing' | 'finishing' | 'done' | 'error';

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

function BigButton({ yes, onPress, disabled, lit }: { yes: boolean; onPress: () => void; disabled: boolean; lit: 'good' | 'bad' | null }) {
  const bg = yes ? GREEN : RED;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={yes ? t.yes : t.no}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.big,
        { backgroundColor: bg, opacity: disabled && !lit ? 0.5 : 1, transform: [{ scale: pressed ? 0.96 : 1 }] },
        lit === 'good' && styles.litGood,
        lit === 'bad' && styles.litBad,
      ]}
    >
      <Ionicons name={yes ? 'checkmark-circle' : 'close-circle'} size={44} color="#fff" />
      <AppText variant="title" color="#fff">
        {yes ? t.yes : t.no}
      </AppText>
    </Pressable>
  );
}

export default function TrueFalseScreen() {
  useEffect(() => markModeSeen('tf'), []);
  const reduced = useReducedMotion();
  const qc = useQueryClient();
  const refresh = useRefreshEconomy();
  const { data: info } = useTfInfo();
  const { data: energy } = useEnergy();
  const showEnergy = useEnergySheet((s) => s.show);
  const { data: store } = useStore();
  const adFree = !!store?.ad_free;
  const [phase, setPhase] = useState<Phase>('intro');
  const [error, setError] = useState<string | null>(null);
  const [p, setP] = useState<TfPayload | null>(null);
  const [flash, setFlash] = useState<{ pick: boolean; ok: boolean; right: string | null } | null>(null);
  const [streak, setStreak] = useState(0);
  const { left, sync } = useDeadline();
  const total = p?.total_seconds ?? info?.seconds ?? 60;
  const penalty = info?.penalty_seconds ?? 3;
  const busy = useRef(false);

  useEffect(() => {
    preloadSounds(['whistle', 'answer_correct', 'answer_wrong', 'coins', 'level_up']);
  }, []);

  const start = useCallback(async () => {
    if (energy && !energy.unlimited && energy.tickets < 1) {
      showEnergy();
      return;
    }
    setPhase('starting');
    setStreak(0);
    setFlash(null);
    try {
      const r = await tfApi.start();
      setP(r);
      sync(r.seconds_left);
      setPhase('countdown');
      refresh();
    } catch (e) {
      setError(e instanceof RpcError && e.message.includes('no_energy') ? 'no_energy' : 'error');
      setPhase('error');
    }
  }, [energy, showEnergy, sync, refresh]);

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
        const r = await tfApi.finish(p.run_id);
        setP(r);
        setPhase('done');
        playSound(r.new_best ? 'level_up' : 'coins');
        haptic('success');
        void qc.invalidateQueries({ queryKey: ['tf-info'] });
        refresh();
        void gameFinished(adFree);
        return;
      } catch (e) {
        if (e instanceof RpcError && e.message.includes('still running')) await new Promise((res) => setTimeout(res, 700));
        else await new Promise((res) => setTimeout(res, 1200));
      }
    }
    setError('error');
    setPhase('error');
  }, [p, qc, refresh, adFree]);

  useEffect(() => {
    if (phase === 'playing' && left <= 0) void finish();
  }, [phase, left, finish]);

  useEffect(() => {
    if (phase !== 'playing' && phase !== 'countdown') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      appAlert(strings.match.exitTitle, '', [
        { text: strings.common.cancel, style: 'cancel' },
        { text: strings.match.exit, style: 'destructive', onPress: () => router.back() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [phase]);

  const answer = async (pick: boolean) => {
    if (!p || busy.current || phase !== 'playing') return;
    busy.current = true;
    haptic('tap');
    try {
      const r = await tfApi.answer(p.run_id, pick);
      const ok = !!r.was_correct;
      setFlash({ pick, ok, right: r.right_answer ?? null });
      playSound(ok ? 'answer_correct' : 'answer_wrong');
      haptic(ok ? 'success' : 'error');
      setStreak((s) => (ok ? s + 1 : 0));
      sync(r.seconds_left);
      await new Promise((res) => setTimeout(res, ok ? 250 : 900));
      setP(r);
      setFlash(null);
      if (r.status === 'done') void finish();
    } catch {
      // ignore, try again
    } finally {
      busy.current = false;
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
          <Sloth size={140} say={`${t.yes}? ${t.no}?`} />
          <AppText variant="title" align="center">
            {t.title}
          </AppText>
          <View style={styles.demo}>
            <View style={[styles.demoPill, { backgroundColor: GREEN }]}>
              <AppText variant="bodyStrong" color="#fff">{`✓ ${t.yes}`}</AppText>
            </View>
            <View style={[styles.demoPill, { backgroundColor: RED }]}>
              <AppText variant="bodyStrong" color="#fff">{`✗ ${t.no}`}</AppText>
            </View>
          </View>
          <AppText color={colors.textMuted} align="center">
            {fmt(t.intro, { n: penalty })}
          </AppText>
          <AppText variant="label" color={colors.led} align="center">
            {info?.best ? fmt(t.best, { n: info.best }) : t.noBest}
          </AppText>
          <StickerButton label={t.start} icon="flash" tone="prize" size="lg" fullWidth loading={phase === 'starting'} onPress={() => void start()} />
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
        <Backdrop accent={ACCENT} />
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
        <Backdrop accent={p.new_best ? '#FFB000' : ACCENT} />
        <ScrollView contentContainerStyle={[styles.intro, styles.grow]}>
          <AppText variant="title" align="center">
            {t.timeUp}
          </AppText>
          {p.new_best ? <TrophyLogo size={96} /> : null}
          <Animated.View entering={reduced ? undefined : ZoomIn.delay(150).springify()}>
            <Led size="ledXL">{String(p.correct)}</Led>
          </Animated.View>
          <AppText variant="heading" align="center">
            {fmt(t.score, { n: p.correct })}
          </AppText>
          <AppText color={colors.textMuted} align="center">
            {fmt(t.answered, { n: p.answered })}
          </AppText>
          {p.new_best ? (
            <AppText variant="heading" color={colors.led} align="center">
              {t.newBest}
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
        </ScrollView>
      </SafeAreaView>
    );
  }

  // playing
  const q = p?.question;
  const frac = Math.max(0, Math.min(1, left / total));
  const urgent = left <= 10;
  return (
    <SafeAreaView style={styles.root}>
      <Backdrop accent={urgent ? '#E8463A' : ACCENT} />
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
          {flash && !flash.ok ? (
            <Animated.View entering={reduced ? undefined : ZoomIn} exiting={reduced ? undefined : FadeOut}>
              <AppText variant="label" color={colors.danger}>
                {fmt(t.penalty, { n: penalty })}
              </AppText>
            </Animated.View>
          ) : streak >= 3 ? (
            <AppText variant="label" color={colors.led}>{`🔥 ${streak}`}</AppText>
          ) : null}
        </View>
      </View>
      <View style={styles.track}>
        <View style={[styles.fill, { width: `${frac * 100}%`, backgroundColor: urgent ? colors.danger : colors.led }]} />
      </View>
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.body}>
        {q ? (
          <View key={q.id} style={styles.qCard}>
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
            <AppText variant="caption" color={colors.cardMuted}>
              {t.isIt}
            </AppText>
            <View style={[styles.claim, flash && { borderColor: flash.ok ? GREEN : RED }]}>
              <AppText variant="title" color={colors.cardText} align="center">
                {q.claim}
              </AppText>
            </View>
            {flash && !flash.ok && flash.right ? (
              <AppText variant="label" color={GREEN} align="center">
                {fmt(t.rightWas, { a: flash.right })}
              </AppText>
            ) : null}
          </View>
        ) : null}
      </ScrollView>
      <View style={styles.dock}>
        <BigButton yes disabled={!!flash} lit={flash && flash.pick ? (flash.ok ? 'good' : 'bad') : null} onPress={() => void answer(true)} />
        <BigButton yes={false} disabled={!!flash} lit={flash && !flash.pick ? (flash.ok ? 'good' : 'bad') : null} onPress={() => void answer(false)} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollArea: { flex: 1 },
  root: { flex: 1, backgroundColor: colors.bgDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.sm },
  intro: { padding: space.xl, gap: space.md, alignItems: 'center' },
  grow: { flexGrow: 1, justifyContent: 'center' },
  demo: { flexDirection: 'row', gap: space.md },
  demoPill: { paddingHorizontal: space.lg, paddingVertical: space.sm, borderRadius: radius.control },
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
  claim: {
    paddingVertical: space.md,
    paddingHorizontal: space.md,
    borderRadius: radius.card,
    borderWidth: 3,
    borderColor: 'rgba(0,0,0,0.12)',
    backgroundColor: 'rgba(255,255,255,0.6)',
  },
  dock: { flexDirection: 'row', gap: space.md, paddingHorizontal: space.md, paddingBottom: space.md, paddingTop: space.xs },
  big: { flex: 1, height: 110, borderRadius: radius.card, alignItems: 'center', justifyContent: 'center', gap: 4 },
  litGood: { borderWidth: 4, borderColor: '#fff' },
  litBad: { borderWidth: 4, borderColor: '#000' },
});
