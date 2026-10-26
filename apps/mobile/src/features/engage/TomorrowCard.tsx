import type { Reward } from '@fm/shared';
import { useQuery } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText, Sloth } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, radius, space } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';
import { useSettingsStore } from '@/features/settings/store';
import { fmt, strings } from '@/lib/i18n';
import { RewardIcon, rewardLabel } from './rewards';

interface LoginState {
  days: Reward[];
  day: number;
  claimable: boolean;
}

/** Today's date in Israel (YYYY-MM-DD); close enough for "once a day". */
function israelDay(): string {
  return new Date(Date.now() + 2 * 3600_000).toISOString().slice(0, 10);
}

/**
 * "Tomorrow's gift": a reason to come back, shown at the end of a game at most once a day.
 * It names tomorrow's login-calendar reward, so leaving ends with something to look forward to.
 */
export function TomorrowCard() {
  const { session } = useAuth();
  const reduced = useReducedMotion();
  const today = israelDay();
  const seen = useSettingsStore((s) => s.tomorrowDay);
  const [show] = useState(() => seen !== today);
  const { data } = useQuery({
    queryKey: ['login-calendar'],
    queryFn: () => rpc('login_state', undefined, (x) => x as LoginState),
    enabled: !!session && show,
    staleTime: 60_000,
  });
  useEffect(() => {
    if (show && data) useSettingsStore.getState().set({ tomorrowDay: today });
  }, [show, data, today]);
  if (!show || !data?.days?.length) return null;
  const next = (data.day + 1) % data.days.length;
  const r = data.days[next];
  if (!r) return null;
  const t = strings.login;
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(1100)} style={styles.card}>
      <Sloth head size={52} bob={false} />
      <View style={styles.flex}>
        <AppText variant="label" style={styles.bold}>
          {t.tomorrowTitle}
        </AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {fmt(t.cardBody2, { n: next + 1, label: rewardLabel(r) })}
          {next < 6 ? ` · ${t.tomorrowGold}` : ''}
        </AppText>
      </View>
      <RewardIcon r={r} size={40} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: radius.board,
    backgroundColor: 'rgba(255,255,255,0.08)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,140,0.45)',
  },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});
