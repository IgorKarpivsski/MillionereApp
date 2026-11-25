import { Ionicons } from '@expo/vector-icons';
import type { Reward } from '@fm/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Backdrop, Card, Confetti, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRefreshEconomy } from '@/features/engage/hooks';
import { RewardIcon, rewardLabel } from '@/features/engage/rewards';
import { rpc } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';

const t = strings.streak;

export interface StreakState {
  streak: number;
  best: number;
  claimed_today: boolean;
  config: { milestones: { day: number; rewards: Reward[] }[] };
}

export function useStreak() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['streak'],
    queryFn: () => rpc('streak_state', undefined, (x) => x as StreakState),
    enabled: !!session,
    staleTime: 60_000,
  });
}

/** "רצף ימים": come back every day, the prizes grow (some wardrobe items only come from here). */
export default function StreakScreen() {
  const { data } = useStreak();
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = useRefreshEconomy();
  const [busy, setBusy] = useState(false);
  const [party, setParty] = useState(0);
  const streak = data?.streak ?? 0;
  const ms = data?.config.milestones ?? [];

  const claim = async () => {
    setBusy(true);
    try {
      const r = await rpc('login_claim', undefined, (x) => x as { reward: Reward; streak: number; milestone: Reward[]; lucky: Reward | null });
      haptic('success');
      playSound(r.milestone.length ? 'level_up' : 'coins');
      toast(fmt(strings.login.got, { label: rewardLabel(r.reward) }), 'success');
      if (r.milestone.length) {
        setParty((p) => p + 1);
        toast(fmt(t.milestoneGot, { n: r.streak }), 'success');
      }
      if (r.lucky) toast(fmt(t.lucky, { label: rewardLabel(r.lucky) }), 'success');
      refresh();
      void qc.invalidateQueries({ queryKey: ['streak'] });
      void qc.invalidateQueries({ queryKey: ['login-calendar'] });
      void qc.invalidateQueries({ queryKey: queryKeys.wardrobe });
    } catch {
      void qc.invalidateQueries({ queryKey: ['streak'] });
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Backdrop />
      {party ? <Confetti key={party} /> : null}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <Ionicons name="chevron-forward" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
          {t.title}
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <Animated.View entering={ZoomIn.springify()} style={styles.hero}>
          <AppText style={styles.flame}>🔥</AppText>
          <AppText variant="title" align="center">
            {streak === 0 ? t.none : streak === 1 ? t.oneDay : fmt(t.days, { n: streak })}
          </AppText>
          {data?.best ? (
            <AppText variant="caption" color={colors.textMuted}>
              {fmt(t.best, { n: data.best })}
            </AppText>
          ) : null}
        </Animated.View>

        {data && !data.claimed_today ? (
          <StickerButton label={t.claimToday} icon="gift" size="lg" tone="prize" fullWidth loading={busy} onPress={claim} />
        ) : (
          <AppText variant="label" color={colors.correct} align="center">
            {t.doneToday}
          </AppText>
        )}

        <AppText variant="caption" color={colors.textMuted} align="center">
          {t.howTo}
        </AppText>

        <View style={styles.path}>
          {ms.map((m, k) => {
            const reached = streak >= m.day;
            const left = m.day - streak;
            return (
              <View key={m.day} style={styles.stepRow}>
                <View style={styles.rail}>
                  <View style={[styles.dot, reached && styles.dotOn]}>
                    <AppText variant="label" color={reached ? colors.textOnBright : colors.text} style={styles.bold}>
                      {m.day}
                    </AppText>
                  </View>
                  {k < ms.length - 1 ? <View style={[styles.line, streak >= ms[k + 1]!.day && styles.lineOn]} /> : null}
                </View>
                <Card kind="soft" padding={space.sm} style={reached ? { ...styles.prize, ...styles.prizeOn } : styles.prize}>
                  <AppText variant="label" style={styles.bold}>
                    {fmt(t.milestone, { n: m.day })}
                    {'  '}
                    <AppText variant="caption" color={reached ? colors.correct : colors.textMuted}>
                      {reached ? t.reached : fmt(t.left, { n: left })}
                    </AppText>
                  </AppText>
                  <View style={styles.rewards}>
                    {m.rewards.map((r, j) => (
                      <View key={j} style={styles.reward}>
                        <RewardIcon r={r} size={r.kind === 'cosmetic' ? 52 : 30} />
                        <AppText variant="caption" align="center" numberOfLines={2} style={styles.rewardText}>
                          {rewardLabel(r)}
                        </AppText>
                        {r.kind === 'cosmetic' ? (
                          <AppText variant="caption" color={colors.led} style={styles.bold}>
                            {t.exclusive}
                          </AppText>
                        ) : null}
                      </View>
                    ))}
                  </View>
                </Card>
              </View>
            );
          })}
        </View>
        <AppText variant="caption" color={colors.textDim} align="center">
          {t.again}
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  body: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  hero: { alignItems: 'center', gap: space.xs },
  flame: { fontSize: 72, lineHeight: 86 },
  path: { gap: 0 },
  stepRow: { flexDirection: 'row', gap: space.sm, alignItems: 'stretch' },
  rail: { alignItems: 'center', width: 44 },
  dot: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: colors.surfaceRaised,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: 'rgba(255,214,140,0.3)',
  },
  dotOn: { backgroundColor: colors.led, borderColor: colors.led },
  line: { flex: 1, width: 4, backgroundColor: colors.surfaceRaised, marginVertical: 2, borderRadius: 2 },
  lineOn: { backgroundColor: colors.led },
  prize: { flex: 1, marginBottom: space.sm, gap: space.xs, borderRadius: radius.card },
  prizeOn: { borderWidth: 1, borderColor: 'rgba(61,220,132,0.5)' },
  rewards: { flexDirection: 'row', gap: space.md, flexWrap: 'wrap' },
  reward: { alignItems: 'center', gap: 2, maxWidth: 110 },
  rewardText: { maxWidth: 110 },
});
