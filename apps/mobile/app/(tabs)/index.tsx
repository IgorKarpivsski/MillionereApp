import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import {
  AppText,
  Card,
  Icon,
  CoinIcon,
  Led,
  LiveTicker,
  Screen,
  Skeleton,
  StatTile,
  StickerButton,
  useCountdownToMidnight,
  useToast,
} from '@/design-system/components';
import { colors, palette, space } from '@/design-system/tokens';
import { QuickPlayCard, WorldsStrip } from '@/features/worlds/WorldCards';
import { useCountdownTo, usePass, useWheel } from '@/features/engage/hooks';
import { useDailyStatus, useLeaderboard } from '@/features/quiz/hooks';
import { useUnreadTotal } from '@/features/social/hooks';
import { useLeague } from '@/features/league/api';
import { LeagueBadge } from '@/features/league/LeagueBadge';
import { LoginCalendar } from '@/features/engage/LoginCalendar';
import { useCollection } from '@/features/collection/hooks';
import { PackArt } from '@/features/collection/PackArt';
import { useClaimWelcomeBonus, useMyState } from '@/features/profile/hooks';
import { RpcError } from '@/features/profile/api';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';
import { useIsOnline } from '@/lib/network';

const t = strings.home;

function WelcomeBonus() {
  const claim = useClaimWelcomeBonus();
  const toast = useToast();
  const online = useIsOnline();
  const amount = 500; // display only; the server decides what is actually paid

  return (
    <Card tint={colors.prize} style={styles.noBorder}>
      <View style={styles.welcomeRow}>
        <CoinIcon size={56} />
        <View style={styles.flex}>
          <AppText variant="heading" color={colors.textOnBright}>
            {t.welcomeTitle}
          </AppText>
          <AppText variant="bodyStrong" color={colors.textOnBright}>
            {fmt(t.welcomeBody, { n: formatNumber(amount) })}
          </AppText>
        </View>
      </View>
      <StickerButton
        label={t.welcomeCta}
        tone="ghost"
        fullWidth
        size="md"
        loading={claim.isPending}
        disabled={!online}
        style={styles.welcomeBtn}
        onPress={() =>
          claim.mutate(undefined, {
            onSuccess: ({ amount: paid }) => toast(fmt(t.welcomeDone, { n: formatNumber(paid) }), 'success'),
            onError: (e) =>
              toast(e instanceof RpcError && e.code === 'rate_limited' ? strings.errors.rateLimited : strings.errors.generic, 'error'),
          })
        }
      />
    </Card>
  );
}

/** The daily challenge: the same 10 mixed questions for everyone, once a day. */
function DailyCard() {
  const countdown = useCountdownToMidnight();
  const { data: daily } = useDailyStatus();
  const done = daily?.state === 'done';
  return (
    <View style={styles.matchShell}>
      <LinearGradient colors={['#3E8EF7', '#5C4CE0', '#7B2FD0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.matchHead}>
        <View style={styles.dailyTitle}>
          <Icon name="daily" size={40} />
          <AppText variant="heading">{t.dailyTitle}</AppText>
        </View>
        <Led color={colors.led} size="number">{countdown}</Led>
      </View>
      {done ? (
        <View style={styles.dailyDots} accessible accessibilityLabel={fmt(strings.session.correctOf, { n: daily?.correct ?? 0, total: 10 })}>
          {Array.from({ length: 10 }, (_, i) => (
            <View key={i} style={[styles.dailyDot, { backgroundColor: i < (daily?.correct ?? 0) ? colors.correct : 'rgba(255,255,255,0.25)' }]} />
          ))}
        </View>
      ) : null}
      <AppText color={colors.text} align="center">
        {done ? fmt(t.dailyDone, { n: daily?.coins ?? 0 }) : t.dailyBody}
      </AppText>
      {daily?.streak ? (
        <AppText variant="label" color={colors.led} align="center">
          {`🔥 ${fmt(t.streakDays, { n: daily.streak })}`}
        </AppText>
      ) : null}
      {done ? null : (
        <StickerButton
          label={daily?.state === 'in_progress' ? t.dailyContinue : t.dailyCta}
          icon="calendar"
          size="lg"
          fullWidth
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'daily' } })}
        />
      )}
    </View>
  );
}

/** The first thing on the screen: quick play, then the worlds. */
function PlayNowHero() {
  return (
    <>
      <QuickPlayCard />
      <View style={styles.matchHead}>
        <AppText variant="heading">{strings.worlds.title}</AppText>
        <Pressable onPress={() => router.push('/(tabs)/play')} hitSlop={8} accessibilityRole="button">
          <AppText variant="label" color={colors.led}>
            {strings.worlds.all}
          </AppText>
        </Pressable>
      </View>
      <WorldsStrip />
    </>
  );
}

/** Wheel + season pass, side by side. */
function DailyExtras() {
  const { data: wheel } = useWheel();
  const { data: pass } = usePass();
  const next = useCountdownTo(wheel?.next_free_at);
  const e = strings.engage;
  return (
    <View style={styles.tiles}>
      <Pressable
        style={({ pressed }) => [styles.extra, pressed && styles.pressed]}
        onPress={() => router.push('/wheel')}
        accessibilityRole="button"
        accessibilityLabel={e.wheelTitle}
      >
        <LinearGradient colors={['#FFC93C', '#FF8A3D']} style={StyleSheet.absoluteFill} />
        <Icon name="wheel" size={52} />
        <AppText variant="label" color={colors.textOnBright}>{e.wheelTitle}</AppText>
        <AppText variant="caption" color={colors.textOnBright} align="center" style={styles.sideTight}>
          {wheel?.free_available ? e.wheelEntry : next ? fmt(e.nextFree, { t: next }) : e.wheelBody}
        </AppText>
        {wheel?.free_available ? <View style={styles.dot} /> : null}
      </Pressable>
      <Pressable
        style={({ pressed }) => [styles.extra, pressed && styles.pressed]}
        onPress={() => router.push('/pass')}
        accessibilityRole="button"
        accessibilityLabel={e.passTitle}
      >
        <LinearGradient colors={['#B49CFF', '#5C7CFF']} style={StyleSheet.absoluteFill} />
        <Icon name="pass" size={52} />
        <AppText variant="label" color={colors.textOnBright}>{e.passTitle}</AppText>
        <AppText variant="caption" color={colors.textOnBright} align="center" style={styles.sideTight}>
          {pass?.active
            ? fmt(e.passEntry, { n: pass.tier, left: pass.xp_per_tier - (pass.xp - pass.tier * pass.xp_per_tier) })
            : e.noSeason}
        </AppText>
      </Pressable>
    </View>
  );
}

function LeagueEntry() {
  const { data } = useLeague();
  if (!data) return null;
  const me = data.rows.find((r) => r.me);
  const label = me && data.rows.length > 1 ? fmt(strings.league.homeTile, { name: data.tier_name, r: me.rank }) : fmt(strings.league.homeTileNoRank, { name: data.tier_name });
  return (
    <Pressable
      style={({ pressed }) => [styles.friends, pressed && styles.pressed]}
      onPress={() => router.push('/(tabs)/leaderboard')}
      accessibilityRole="button"
      accessibilityLabel={label}
    >
      <LinearGradient colors={['#2E2263', '#4B2A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <LeagueBadge tier={data.tier} size={44} />
      <AppText variant="label" style={styles.flex}>
        {label}
      </AppText>
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </Pressable>
  );
}

function FriendsEntry() {
  const unread = useUnreadTotal();
  return (
    <Pressable
      style={({ pressed }) => [styles.friends, pressed && styles.pressed]}
      onPress={() => router.push('/friends')}
      accessibilityRole="button"
      accessibilityLabel={unread > 0 ? `${strings.social.entry}, ${unread}` : strings.social.entry}
    >
      <LinearGradient colors={['#14A3B8', '#2F5FD0']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <Icon name="friends" size={40} />
      <Icon name="chat" size={30} />
      <AppText variant="label" style={styles.flex}>
        {strings.social.entry}
      </AppText>
      {unread > 0 ? (
        <View style={styles.count}>
          <AppText variant="caption" color={colors.text} style={styles.sideTight}>
            {String(unread)}
          </AppText>
        </View>
      ) : null}
      <Ionicons name="chevron-back" size={22} color={colors.text} />
    </Pressable>
  );
}

export default function HomeScreen() {
  const { data, isLoading, refetch, isRefetching } = useMyState();
  const { data: daily } = useDailyStatus();
  const { data: board } = useLeaderboard();
  const streak = daily?.streak ?? 0;
  const rank = board?.me.rank;
  const { data: coll } = useCollection();
  const owned = coll ? coll.items.filter((i) => i.count > 0).length : 0;
  const packsWaiting = coll ? Object.values(coll.tokens).reduce((a, b) => a + b, 0) : 0;

  return (
    <Screen header={<TopBar />} onRefresh={() => void refetch()} refreshing={isRefetching}>
      <LiveTicker items={t.ticker} />

      {isLoading ? <Skeleton height={140} rounded={18} /> : null}
      {data && !data.welcome_bonus_claimed ? <WelcomeBonus /> : null}

      <LoginCalendar />
      <PlayNowHero />
      <DailyCard />
      <DailyExtras />
      <LeagueEntry />
      <FriendsEntry />
      {packsWaiting > 0 ? (
        <Card kind="sticker" frame={colors.correct} padding={space.md}>
          <View style={styles.seasonRow}>
            <PackArt slug="silver" width={40} />
            <View style={styles.flex}>
              <AppText variant="label">{fmt(t.packsWaiting, { n: packsWaiting })}</AppText>
              <AppText variant="caption" color={colors.textDim}>
                {t.packsWaitingBody}
              </AppText>
            </View>
            <StickerButton label={t.openPacks} size="sm" onPress={() => router.push('/(tabs)/packs')} />
          </View>
        </Card>
      ) : null}

      <View style={styles.tiles}>
        <StatTile icon="fire" value={String(streak)} label={t.statStreak} color={colors.correct} />
        <StatTile icon="podium" value={rank ? `#${rank}` : '--'} label={t.statRank} color={colors.led} />
        <StatTile icon="album" value={String(owned)} label={t.statCollection} />
      </View>

    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space.xxs },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  welcomeBtn: { marginTop: space.md },
  noBorder: { borderWidth: 0 },
  hero: {
    gap: space.md,
    padding: space.lg,
    borderRadius: 24,
    borderWidth: 3,
    borderColor: palette.night950,
    overflow: 'hidden',
  },
  heroRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  heroBall: { position: 'absolute', top: -30, end: -40, opacity: 0.18, transform: [{ rotate: '-18deg' }] },
  matchShell: {
    gap: space.md,
    padding: space.lg,
    borderRadius: 22,
    borderWidth: 3,
    borderColor: palette.night950,
    overflow: 'hidden',
  },
  pitchLines: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center', opacity: 0.12 },
  centerCircle: { width: 150, height: 150, borderRadius: 75, borderWidth: 3, borderColor: palette.chalk },
  halfway: { position: 'absolute', width: 3, top: 0, bottom: 0, backgroundColor: palette.chalk },
  sideCol: { alignItems: 'center', gap: space.xs },
  matchHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  matchDigits: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  side: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sideTight: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  tiles: { flexDirection: 'row', gap: space.sm },
  seasonRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  extra: {
    flex: 1,
    alignItems: 'center',
    gap: space.xxs,
    padding: space.md,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: palette.night950,
    overflow: 'hidden',
  },
  dailyTitle: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dailyDots: { flexDirection: 'row', justifyContent: 'center', gap: 5 },
  dailyDot: { width: 18, height: 10, borderRadius: 5 },
  dot: { position: 'absolute', top: 8, end: 8, width: 12, height: 12, borderRadius: 6, backgroundColor: colors.danger },
  pressed: { transform: [{ scale: 0.97 }] },
  friends: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: 20,
    borderWidth: 3,
    borderColor: palette.night950,
    overflow: 'hidden',
  },
  count: { minWidth: 24, height: 24, borderRadius: 12, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6 },
});
