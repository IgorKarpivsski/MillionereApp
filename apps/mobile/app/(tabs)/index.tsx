import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import {
  AppText,
  AvatarBadge,
  Card,
  ChampionBadge,
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
import { usePlayClassic } from '@/features/engage/EnergySheet';
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

function MatchOfTheDay() {
  const playClassic = usePlayClassic();
  const { data: me } = useMyState();
  const countdown = useCountdownToMidnight();
  const { data: daily } = useDailyStatus();
  const done = daily?.state === 'done';
  const missed = done ? 10 - (daily?.correct ?? 0) : 0;
  return (
    <View style={styles.matchShell}>
      <LinearGradient colors={['#123F31', '#0B2B22', '#2A1D52']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.pitchLines} pointerEvents="none">
        <View style={styles.centerCircle} />
        <View style={styles.halfway} />
      </View>
      <View style={styles.matchHead}>
        <AppText variant="label" color={colors.led}>
          {t.matchTitle}
        </AppText>
        <Led color={colors.led} size="number">{countdown}</Led>
      </View>
      <View style={styles.matchRow}>
        <View style={styles.sideCol}>
          {me ? <AvatarBadge avatarId={me.profile.avatar_id} size={58} ring={colors.correct} /> : <View style={styles.side} />}
          <AppText variant="caption" style={styles.sideTight}>אתה</AppText>
        </View>
        <View style={styles.matchDigits}>
          <Led size="ledXL" color={colors.text}>{done ? daily?.correct ?? 0 : 0}</Led>
          <Led size="ledXL" color={colors.text}>:</Led>
          <Led size="ledXL" color={done && missed > (daily?.correct ?? 0) ? colors.danger : colors.text}>{missed}</Led>
        </View>
        <View style={styles.sideCol}>
          <ChampionBadge size={58} />
          <AppText variant="caption" style={styles.sideTight}>האלוף</AppText>
        </View>
      </View>
      <AppText color={colors.textMuted} align="center">
        {done ? fmt(t.dailyDone, { n: daily?.coins ?? 0 }) : t.dailyBody}
      </AppText>
      {done ? (
        <StickerButton label={t.playClassic} icon="football" tone="outline" size="lg" fullWidth onPress={playClassic} />
      ) : (
        <StickerButton
          label={daily?.state === 'in_progress' ? t.dailyContinue : t.kickoff}
          icon="football"
          size="lg"
          fullWidth
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'daily' } })}
        />
      )}
    </View>
  );
}

/** The first thing on the screen: one big way to start playing right now. */
function PlayNowHero() {
  const playClassic = usePlayClassic();
  return (
    <View style={styles.hero}>
      <LinearGradient colors={['#FFC93C', '#FF8A3D', '#FF5A4E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.heroBall} pointerEvents="none">
        <Icon name="play" size={150} />
      </View>
      <View style={styles.heroRow}>
        <ChampionBadge size={76} ring={palette.night950} />
        <View style={styles.flex}>
          <AppText variant="title" color={colors.textOnBright}>
            {t.heroTitle}
          </AppText>
          <AppText variant="bodyStrong" color={colors.textOnBright}>
            {t.heroBody}
          </AppText>
        </View>
      </View>
      <StickerButton label={t.playCta} icon="football" tone="ghost" size="lg" fullWidth onPress={playClassic} />
    </View>
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
      <LinearGradient colors={['#2A1D52', '#123F31']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
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
      <LinearGradient colors={['#1E9E5A', '#0E5E3A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
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
      <MatchOfTheDay />
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
    borderColor: colors.led,
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
