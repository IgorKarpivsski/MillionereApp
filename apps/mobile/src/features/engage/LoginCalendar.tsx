import type { Reward } from '@fm/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { AppText, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';
import { fmt, strings } from '@/lib/i18n';
import { useRefreshEconomy } from './hooks';
import { RewardIcon, rewardLabel } from './rewards';

interface LoginState {
  days: Reward[];
  day: number;
  claimable: boolean;
}
const t = strings.login;

/** Pops up once a day with the 7-day calendar; day 7 is the big prize. */
export function LoginCalendar() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = useRefreshEconomy();
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const { data } = useQuery({
    queryKey: ['login-calendar'],
    queryFn: () => rpc('login_state', undefined, (x) => x as LoginState),
    enabled: !!session,
    staleTime: 60_000,
  });
  if (!data) return null;
  const open = data.claimable && !dismissed;

  const claim = async () => {
    setBusy(true);
    try {
      const r = await rpc('login_claim', undefined, (x) => x as { day: number; reward: Reward });
      haptic('success');
      playSound(r.day === 6 ? 'level_up' : 'coins');
      toast(fmt(t.got, { label: rewardLabel(r.reward) }), 'success');
      refresh();
      void qc.invalidateQueries({ queryKey: ['login-calendar'] });
      setDismissed(true);
    } catch {
      setDismissed(true);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setDismissed(true)} statusBarTranslucent>
      <View style={styles.scrim}>
        <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(13)} style={styles.card} accessibilityViewIsModal>
          <AppText variant="title" align="center">
            {t.title}
          </AppText>
          <AppText color={colors.textMuted} align="center">
            {t.body}
          </AppText>
          <View style={styles.grid}>
            {data.days.map((r, i) => {
              const done = i < data.day;
              const today = i === data.day;
              const big = i === 6;
              return (
                <View
                  key={i}
                  style={[styles.day, big && styles.dayBig, done && styles.dayDone, today && styles.dayToday]}
                  accessible
                  accessibilityLabel={`${fmt(t.day, { n: i + 1 })}: ${rewardLabel(r)}${done ? `, ${t.taken}` : today ? `, ${t.today}` : ''}`}
                >
                  <AppText variant="caption" color={today ? colors.textOnBright : colors.textMuted} style={styles.bold}>
                    {fmt(t.day, { n: i + 1 })}
                  </AppText>
                  <RewardIcon r={r} size={big ? 44 : 30} />
                  <AppText variant="caption" color={today ? colors.textOnBright : colors.text} numberOfLines={1}>
                    {done ? '✓' : rewardLabel(r)}
                  </AppText>
                </View>
              );
            })}
          </View>
          <StickerButton label={t.claim} icon="gift" tone="prize" size="lg" fullWidth loading={busy} onPress={() => void claim()} />
          <AppText variant="caption" color={colors.textDim} align="center">
            {t.hint}
          </AppText>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    gap: space.md,
    padding: space.lg,
    borderRadius: radius.sheet,
    backgroundColor: colors.bg,
    borderWidth: 3,
    borderColor: colors.led,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  day: {
    width: '22%',
    minHeight: 92,
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 2,
    padding: space.xs,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.border,
  },
  dayBig: { width: '47%', backgroundColor: palette.night700, borderColor: colors.gem },
  dayDone: { opacity: 0.45 },
  dayToday: { backgroundColor: colors.led, borderColor: palette.chalk },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});
