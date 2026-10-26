import type { Reward } from '@fm/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  ZoomOut,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { AppText, CoinIcon, Icon, useToast, type IconName } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, palette } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { useCollection } from '@/features/collection/hooks';
import { useDeals, usePass, useRefreshEconomy, useWheel } from '@/features/engage/hooks';
import { RewardIcon, rewardLabel } from '@/features/engage/rewards';
import { RpcError, rpc } from '@/features/profile/api';
import { useClaimWelcomeBonus, useMyState } from '@/features/profile/hooks';
import { useAdReward, useStore } from '@/features/store/hooks';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';
import { kindOf, useFly } from './RewardFly';
import { TourTarget } from '@/features/tour/Tour';

const t = strings.bubbles;

type Point = { x: number; y: number };

interface BubbleDef {
  key: string;
  label: string;
  colors: [string, string];
  icon: ReactNode;
  /** something is waiting to be collected */
  ready: boolean;
  badge?: string;
  /** returns false if nothing was collected */
  onPress: (at: Point) => Promise<boolean | void> | void;
}

function Bubble({ b, index }: { b: BubbleDef; index: number }) {
  const reduced = useReducedMotion();
  const ref = useRef<View>(null);
  const [busy, setBusy] = useState(false);
  const bob = useSharedValue(0);
  const glow = useSharedValue(0);
  const press = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    bob.value = withDelay(index * 260, withRepeat(withTiming(1, { duration: 1900 + index * 170, easing: Easing.inOut(Easing.sin) }), -1, true));
    if (b.ready) glow.value = withRepeat(withTiming(1, { duration: 900, easing: Easing.inOut(Easing.quad) }), -1, true);
    else glow.value = 0;
  }, [reduced, index, b.ready, bob, glow]);
  const float = useAnimatedStyle(() => ({ transform: [{ translateY: -5 * bob.value }, { scale: press.value }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + 0.5 * glow.value, transform: [{ scale: 1 + 0.12 * glow.value }] }));

  const tap = async () => {
    if (busy) return;
    haptic('tap');
    press.value = withSequence(withTiming(0.85, { duration: 90 }), withTiming(1.12, { duration: 140 }), withTiming(1, { duration: 120 }));
    const at = await new Promise<Point>((res) =>
      ref.current ? ref.current.measureInWindow((x, y, w, h) => res({ x: x + w / 2, y: y + h / 2 })) : res({ x: 0, y: 0 }),
    );
    setBusy(true);
    try {
      await b.onPress(at);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Animated.View entering={reduced ? undefined : FadeIn.delay(100 + index * 90)} exiting={reduced ? undefined : ZoomOut.duration(260)} style={styles.slot}>
      <Pressable onPress={() => void tap()} accessibilityRole="button" accessibilityLabel={b.badge ? `${b.label}, ${b.badge}` : b.label} hitSlop={4}>
        <Animated.View style={float}>
          {b.ready ? <Animated.View style={[styles.halo, { backgroundColor: b.colors[0] }, halo]} /> : null}
          <View ref={ref} collapsable={false} style={[styles.bubble, { borderColor: b.ready ? '#FFF3C4' : 'rgba(255,255,255,0.55)' }]}>
            <LinearGradient colors={b.colors} start={{ x: 0.2, y: 0 }} end={{ x: 0.8, y: 1 }} style={StyleSheet.absoluteFill} />
            <View style={styles.shine} />
            {busy ? <ActivityIndicator color={colors.text} /> : b.icon}
          </View>
          {b.badge ? (
            <View style={[styles.badge, b.ready && styles.badgeReady]}>
              <AppText variant="caption" color={b.ready ? palette.night950 : colors.text} style={styles.badgeText} numberOfLines={1}>
                {b.badge}
              </AppText>
            </View>
          ) : null}
        </Animated.View>
        <AppText variant="caption" align="center" numberOfLines={1} style={styles.label}>
          {b.label}
        </AppText>
      </Pressable>
    </Animated.View>
  );
}

interface LoginState {
  days: Reward[];
  day: number;
  claimable: boolean;
}

/** Every bonus, gift and prize on the home screen, as floating bubbles. */
export function useRewardBubbles(): BubbleDef[] {
  const { session } = useAuth();
  const qc = useQueryClient();
  const toast = useToast();
  const refresh = useRefreshEconomy();
  const launch = useFly((s) => s.launch);
  const { data: me } = useMyState();
  const welcome = useClaimWelcomeBonus();
  const { data: wheel } = useWheel();
  const { data: pass } = usePass();
  const { data: deals } = useDeals();
  const { data: coll } = useCollection();
  const { data: store } = useStore();
  const ad = useAdReward();
  const { data: login } = useQuery({
    queryKey: ['login-calendar'],
    queryFn: () => rpc('login_state', undefined, (x) => x as LoginState),
    enabled: !!session,
    staleTime: 60_000,
  });

  const out: BubbleDef[] = [];
  const celebrate = (at: Point, r: Reward) => {
    haptic('success');
    playSound('coins');
    launch({ from: at, kind: kindOf(r), label: r.kind === 'coins' || r.kind === 'gems' ? `+${formatNumber(r.amount)}` : rewardLabel(r), reward: r });
  };

  if (login?.claimable) {
    const today = login.days[login.day];
    out.push({
      key: 'login',
      label: t.login,
      colors: ['#FFC93C', '#FF7A2F'],
      icon: <Icon name="gift" size={36} />,
      ready: true,
      badge: fmt(t.day, { n: login.day + 1 }),
      onPress: async (at) => {
        try {
          const r = await rpc('login_claim', undefined, (x) => x as { day: number; reward: Reward });
          celebrate(at, r.reward ?? today);
          if (r.day === 6) playSound('level_up');
          toast(fmt(strings.login.got, { label: rewardLabel(r.reward) }), 'success');
          refresh();
          void qc.invalidateQueries({ queryKey: ['login-calendar'] });
        } catch {
          toast(strings.errors.generic, 'error');
        }
      },
    });
  }

  if (me && !me.welcome_bonus_claimed) {
    out.push({
      key: 'welcome',
      label: t.welcome,
      colors: ['#FFE15C', '#FFA800'],
      icon: <CoinIcon size={34} />,
      ready: true,
      badge: '500',
      onPress: (at) =>
        new Promise<void>((res) =>
          welcome.mutate(undefined, {
            onSuccess: ({ amount }) => {
              celebrate(at, { kind: 'coins', amount });
              res();
            },
            onError: (e) => {
              toast(e instanceof RpcError && e.code === 'rate_limited' ? strings.errors.rateLimited : strings.errors.generic, 'error');
              res();
            },
          }),
        ),
    });
  }

  if (store?.free_pack_today) {
    out.push({
      key: 'freepack',
      label: t.freePack,
      colors: ['#3DDC84', '#14A3B8'],
      icon: <Icon name="packs" size={36} />,
      ready: true,
      badge: ad.adFree ? t.free : '▶',
      onPress: async (at) => {
        const r = await ad.run('free_pack');
        if (r) {
          celebrate(at, { kind: 'pack', amount: 1, pack: 'bronze' });
          toast(strings.store.packAdded, 'success');
        }
      },
    });
  }

  const packsWaiting = coll ? Object.values(coll.tokens).reduce((a, b) => a + b, 0) : 0;
  if (packsWaiting > 0) {
    out.push({
      key: 'packs',
      label: t.packs,
      colors: ['#FF8AD8', '#B14CFF'],
      icon: <Icon name="packs" size={36} />,
      ready: true,
      badge: String(packsWaiting),
      onPress: () => router.push('/(tabs)/packs'),
    });
  }

  if (wheel) {
    out.push({
      key: 'wheel',
      label: t.wheel,
      colors: ['#FFC93C', '#FF5A4E'],
      icon: <Icon name="wheel" size={38} />,
      ready: wheel.free_available,
      badge: wheel.free_available ? t.free : undefined,
      onPress: () => router.push('/wheel'),
    });
  }

  if (pass?.active) {
    const claimable =
      pass.tiers.filter((x) => x.tier <= pass.tier && !pass.claimed_free.includes(x.tier)).length +
      (pass.premium ? pass.tiers.filter((x) => x.tier <= pass.tier && !pass.claimed_premium.includes(x.tier)).length : 0);
    out.push({
      key: 'pass',
      label: t.pass,
      colors: ['#B49CFF', '#5C7CFF'],
      icon: <Icon name="pass" size={38} />,
      ready: claimable > 0,
      badge: claimable > 0 ? String(claimable) : fmt(t.tier, { n: pass.tier }),
      onPress: () => router.push('/pass'),
    });
  }

  if (deals && !deals.bought) {
    const off = Math.round((1 - deals.deal.price.amount / deals.deal.was) * 100);
    out.push({
      key: 'deal',
      label: t.deal,
      colors: ['#FF6B6B', '#C2185B'],
      icon: deals.deal.rewards[0] ? <RewardIcon r={deals.deal.rewards[0]} size={34} /> : <Icon name="deal" size={36} />,
      ready: false,
      badge: `-${off}%`,
      onPress: () => router.push('/shop'),
    });
  }

  return out;
}

/** Every prize waiting on home, in tidy rows (prizes ready to collect first). */
export function RewardGrid({ bubbles, empty }: { bubbles: BubbleDef[]; empty: string }) {
  // Only what can be collected right now is out front; the rest waits behind "more".
  const [all, setAll] = useState(false);
  const ready = bubbles.filter((b) => b.ready);
  const later = bubbles.filter((b) => !b.ready);
  const shown = all ? [...ready, ...later] : ready;
  if (bubbles.length === 0) {
    return (
      <AppText variant="caption" color={colors.textMuted} align="center">
        {empty}
      </AppText>
    );
  }
  return (
    <TourTarget id="bubbles">
      {shown.length ? (
        <View style={styles.grid}>
          {shown.map((b, i) => (
            <Bubble key={b.key} b={b} index={i} />
          ))}
        </View>
      ) : (
        <AppText variant="caption" color={colors.textMuted} align="center">
          {empty}
        </AppText>
      )}
      {later.length ? (
        <Pressable
          onPress={() => setAll((v) => !v)}
          accessibilityRole="button"
          style={({ pressed }) => [styles.more, pressed && { opacity: 0.7 }]}
        >
          <AppText variant="label" color={colors.led}>
            {all ? strings.home.rewardsLess : fmt(strings.home.rewardsMore, { n: later.length })}
          </AppText>
        </Pressable>
      ) : null}
    </TourTarget>
  );
}

/** Two columns of bubbles around a centre piece (the sloth). */
export function BubbleColumns({ bubbles, center }: { bubbles: BubbleDef[]; center: ReactNode }) {
  const start = bubbles.filter((_, i) => i % 2 === 0);
  const end = bubbles.filter((_, i) => i % 2 === 1);
  return (
    <View style={styles.columns}>
      {start.length ? (
        <TourTarget id="bubbles" style={styles.col}>
          {start.map((b, i) => (
            <Bubble key={b.key} b={b} index={i * 2} />
          ))}
        </TourTarget>
      ) : (
        <View style={styles.col} />
      )}
      <View style={styles.center}>{center}</View>
      <View style={styles.col}>
        {end.map((b, i) => (
          <Bubble key={b.key} b={b} index={i * 2 + 1} />
        ))}
      </View>
    </View>
  );
}

const SIZE = 60;
const styles = StyleSheet.create({
  columns: { flexDirection: 'row', alignItems: 'center' },
  more: { alignSelf: 'center', paddingHorizontal: 16, paddingVertical: 8, marginTop: 4 },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', rowGap: 10, columnGap: 6, paddingTop: 6 },
  col: { width: 74, gap: 6, alignItems: 'center', justifyContent: 'center' },
  center: { flex: 1, alignItems: 'center' },
  slot: { alignItems: 'center', width: 74 },
  bubble: {
    width: SIZE,
    height: SIZE,
    borderRadius: SIZE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
    borderWidth: 2,
  },
  shine: {
    position: 'absolute',
    top: 5,
    left: 12,
    width: 22,
    height: 12,
    borderRadius: 8,
    backgroundColor: 'rgba(255,255,255,0.55)',
    transform: [{ rotate: '-25deg' }],
  },
  halo: { position: 'absolute', width: SIZE, height: SIZE, borderRadius: SIZE / 2, top: 0, left: 0 },
  badge: {
    position: 'absolute',
    top: -4,
    end: -8,
    minWidth: 22,
    paddingHorizontal: 5,
    height: 20,
    borderRadius: 10,
    backgroundColor: palette.night950,
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.6)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeReady: { backgroundColor: colors.led, borderColor: '#FFF3C4' },
  badgeText: { fontFamily: 'IBMPlexSansHebrew_700Bold', fontSize: 11, lineHeight: 14 },
  label: { marginTop: 2, fontFamily: 'IBMPlexSansHebrew_700Bold', fontSize: 12, maxWidth: 78 },
});
