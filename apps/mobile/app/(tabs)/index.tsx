import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { type ReactNode, useCallback, useEffect, useMemo, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { cancelAnimation, Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming } from 'react-native-reanimated';
import { TopBar } from '@/components/TopBar';
import { AppText, Icon, Screen, Sheen, Sloth, StickerButton } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, space } from '@/design-system/tokens';
import { usePlaySession } from '@/features/engage/EnergySheet';
import { RewardGrid, useRewardBubbles } from '@/features/home/RewardBubbles';
import { useLeague } from '@/features/league/api';
import { LeagueBadge } from '@/features/league/LeagueBadge';
import { useReferral } from '@/features/referral/api';
import { useMyState } from '@/features/profile/hooks';
import { useUnreadTotal } from '@/features/social/hooks';
import { TourTarget, useTourStore } from '@/features/tour/Tour';
import { useSettingsStore } from '@/features/settings/store';
import { MissionsCard, NewbieBanner, NextGoal } from '@/features/teen/HomeCards';
import { fmt, gx, strings } from '@/lib/i18n';
import { GenderPrompt, useGenderPromptStore } from '@/features/profile/gender';
import { showName } from '@/lib/names';

const t = strings.modes;
const h = strings.home;

/** The sloth with a game tip (a new one every few seconds, or on tap) and the two ways in. */
/** The one button that matters on the home screen breathes gently, so the eye finds it first. */
function Breathe({ off, children }: { off: boolean; children: ReactNode }) {
  const v = useSharedValue(0);
  useEffect(() => {
    if (off) return;
    v.value = withRepeat(withTiming(1, { duration: 1100, easing: Easing.inOut(Easing.quad) }), -1, true);
    return () => cancelAnimation(v);
  }, [off, v]);
  const style = useAnimatedStyle(() => ({ transform: [{ scale: 1 + v.value * 0.035 }] }));
  return <Animated.View style={[styles.stretch, style]}>{children}</Animated.View>;
}

function Hero() {
  const { data } = useMyState();
  const play = usePlaySession();
  const name = showName(data?.profile.username) ?? '';
  const gender = data?.profile.gender;
  const reduced = useReducedMotion();
  // first a hello, then tips; a different start each time the app opens
  const lines = useMemo(() => {
    const hello = t.slothHello[Math.floor(Math.random() * t.slothHello.length)]!;
    const start = Math.floor(Math.random() * h.tips.length);
    return [name ? fmt(hello, { name }) : t.slothHello[2]!, ...h.tips.slice(start), ...h.tips.slice(0, start)];
  }, [name]);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (reduced) return;
    const id = setInterval(() => setI((x) => (x + 1) % lines.length), 7000);
    return () => clearInterval(id);
  }, [lines.length, reduced]);
  return (
    <View style={styles.hero}>
      <LinearGradient colors={['rgba(255,214,140,0.16)', 'rgba(255,255,255,0.02)']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
      <Pressable
        onPress={() => setI((x) => (x + 1) % lines.length)}
        accessibilityRole="button"
        accessibilityLabel={`${gx(lines[i % lines.length]!, gender)}. ${h.tipA11y}`}
        style={styles.slothWrap}
      >
        <Sloth size={124} say={gx(lines[i % lines.length]!, gender)} />
      </Pressable>
      <TourTarget id="play" style={styles.stretch}>
        <Breathe off={reduced}>
          <StickerButton label={strings.home.playCta} icon="play" size="lg" tone="prize" fullWidth onPress={() => play('mix')} />
        </Breathe>
      </TourTarget>
      <TourTarget id="modes" style={styles.stretch}>
        <StickerButton label={h.allGames} icon="game-controller" tone="outline" size="sm" fullWidth onPress={() => router.push('/(tabs)/play')} />
      </TourTarget>
    </View>
  );
}

function SectionTitle({ children }: { children: string }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionLine} />
      <AppText variant="heading">{children}</AppText>
      <View style={styles.sectionLine} />
    </View>
  );
}

/** Every gift and bonus waiting to be collected. */
function Rewards() {
  const bubbles = useRewardBubbles();
  return (
    <View style={styles.rewards}>
      <SectionTitle>{`🎁 ${h.rewardsTitle}`}</SectionTitle>
      <RewardGrid bubbles={bubbles} empty={h.rewardsEmpty} />
    </View>
  );
}

/** Friend brings friend: a bright banner with progress to the next goal. */
function InviteBanner() {
  const { data } = useReferral();
  const r = strings.referral;
  const next = data?.goals.find((g) => !g.reached);
  return (
    <Pressable
      style={({ pressed }) => [styles.invite, pressed && styles.pressed]}
      onPress={() => router.push('/invite')}
      accessibilityRole="button"
      accessibilityLabel={r.homeTitle}
    >
      <LinearGradient colors={['#FF6FB5', '#FF9F43']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Sheen />
      <Icon name="gift" size={56} />
      <View style={styles.inviteText}>
        <AppText variant="heading" color={colors.textOnBright}>
          {r.homeTitle}
        </AppText>
        <AppText variant="label" color={colors.textOnBright}>
          {r.homeBody}
        </AppText>
        {data && data.qualified > 0 ? (
          <AppText variant="caption" color={colors.textOnBright}>
            {next ? `${fmt(r.homeProgress, { n: data.qualified })} · ${data.qualified}/${next.n}` : fmt(r.homeProgress, { n: data.qualified })}
          </AppText>
        ) : null}
      </View>
      <Ionicons name="chevron-back" size={26} color={colors.textOnBright} />
    </Pressable>
  );
}

function SmallEntry({
  label,
  art,
  colors: grad,
  badge,
  onPress,
}: {
  label: string;
  art: React.ReactNode;
  colors: [string, string];
  badge?: number;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={({ pressed }) => [styles.small, pressed && styles.pressed]}
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={badge ? `${label}, ${badge}` : label}
    >
      <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <Sheen />
      {art}
      <AppText variant="label" style={styles.flex} numberOfLines={1}>
        {label}
      </AppText>
      {badge ? (
        <View style={styles.count}>
          <AppText variant="caption" style={styles.bold}>
            {String(badge)}
          </AppText>
        </View>
      ) : (
        <Ionicons name="chevron-back" size={18} color={colors.text} />
      )}
    </Pressable>
  );
}

function Social() {
  const { data: league } = useLeague();
  const unread = useUnreadTotal();
  return (
    <View style={styles.row}>
      <SmallEntry
        label={league ? league.tier_name : t.league}
        art={league ? <LeagueBadge tier={league.tier} size={34} /> : <Icon name="podium" size={34} />}
        colors={['#2E2263', '#4B2A8A']}
        onPress={() => router.push('/(tabs)/leaderboard')}
      />
      <SmallEntry
        label={t.friends}
        art={<Icon name="chat" size={32} />}
        colors={['#14A3B8', '#2F5FD0']}
        badge={unread}
        onPress={() => router.push('/friends')}
      />
    </View>
  );
}

/** First launch only: the sloth introduces himself and walks the new player around. */
function FirstTour() {
  const { data } = useMyState();
  const onboarded = useSettingsStore((s) => s.onboarded);
  const tourDone = useSettingsStore((s) => s.tourDone);
  const set = useSettingsStore((s) => s.set);
  const start = useTourStore((s) => s.start);
  const stop = useTourStore((s) => s.stop);
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  const name = showName(data?.profile.username);
  const gender = data?.profile.gender;
  const genderSkipped = useGenderPromptStore((s) => s.dismissed);
  const genderPending = gender == null && !genderSkipped;
  useEffect(() => {
    if (!name || !onboarded || tourDone || !focused || genderPending) return;
    // let the screen lay out (and the targets measure) before dimming it
    const id = setTimeout(() => start(name, gender, () => set({ tourDone: true })), 1400);
    return () => {
      clearTimeout(id);
      stop();
    };
  }, [name, gender, genderPending, onboarded, tourDone, focused, start, stop, set]);
  return null;
}

/** Ask existing players whether they're a boy or a girl (once, after onboarding). */
function GenderPromptGate() {
  const onboarded = useSettingsStore((s) => s.onboarded);
  const tourDone = useSettingsStore((s) => s.tourDone);
  const seenModes = useSettingsStore((s) => s.seenModes);
  const [focused, setFocused] = useState(true);
  useFocusEffect(
    useCallback(() => {
      setFocused(true);
      return () => setFocused(false);
    }, []),
  );
  // not over the tour, and not before the first game: let new players play first
  return <GenderPrompt enabled={onboarded && tourDone && seenModes.length > 0 && focused} />;
}

export default function HomeScreen() {
  const { refetch, isRefetching } = useMyState();
  return (
    <Screen header={<TopBar />} onRefresh={() => void refetch()} refreshing={isRefetching}>
      <Hero />
      <NewbieBanner />
      <Rewards />
      <MissionsCard />
      <NextGoal />
      <InviteBanner />
      <Social />
      <FirstTour />
      <GenderPromptGate />
    </Screen>
  );
}

const styles = StyleSheet.create({
  invite: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  inviteText: { flex: 1, gap: 2 },
  hero: {
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: 26,
    borderWidth: 1,
    borderColor: 'rgba(255,214,140,0.3)',
    overflow: 'hidden',
  },
  slothWrap: { alignSelf: 'stretch', alignItems: 'center' },
  stretch: { alignSelf: 'stretch' },
  rewards: { gap: space.xs },
  section: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: space.xs },
  sectionLine: { flex: 1, height: 2, borderRadius: 1, backgroundColor: 'rgba(255,214,140,0.35)' },
  row: { flexDirection: 'row', gap: space.md },
  small: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm + 2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  pressed: { transform: [{ scale: 0.97 }] },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  count: { minWidth: 22, height: 22, borderRadius: 11, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
});
