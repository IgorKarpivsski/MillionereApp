import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import {
  AppText,
  Card,
  CoinIcon,
  Led,
  LiveTicker,
  Screen,
  Skeleton,
  StatTile,
  StickerButton,
  TrophyLogo,
  useCountdownToMidnight,
  useToast,
} from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useDailyStatus, useLeaderboard } from '@/features/quiz/hooks';
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
  const countdown = useCountdownToMidnight();
  const { data: daily } = useDailyStatus();
  const done = daily?.state === 'done';
  const missed = done ? 10 - (daily?.correct ?? 0) : 0;
  return (
    <Card kind="sticker" padding={space.lg} style={styles.match}>
      <View style={styles.matchHead}>
        <AppText variant="label" color={colors.led}>
          {t.matchTitle}
        </AppText>
        <Led color={colors.led} size="number">{countdown}</Led>
      </View>
      <View style={styles.matchRow}>
        <View style={styles.side}>
          <AppText variant="label">אתה</AppText>
        </View>
        <View style={styles.matchDigits}>
          <Led size="ledXL" color={colors.text}>{done ? daily?.correct ?? 0 : 0}</Led>
          <Led size="ledXL" color={colors.text}>:</Led>
          <Led size="ledXL" color={done && missed > (daily?.correct ?? 0) ? colors.danger : colors.text}>{missed}</Led>
        </View>
        <View style={styles.side}>
          <AppText variant="caption" style={styles.sideTight}>האלוף</AppText>
        </View>
      </View>
      <AppText color={colors.textMuted} align="center">
        {done ? fmt(t.dailyDone, { n: daily?.coins ?? 0 }) : t.dailyBody}
      </AppText>
      {done ? (
        <StickerButton label={t.playClassic} icon="football" tone="outline" size="lg" fullWidth onPress={() => router.push('/quiz')} />
      ) : (
        <StickerButton
          label={daily?.state === 'in_progress' ? t.dailyContinue : t.kickoff}
          icon="football"
          size="lg"
          fullWidth
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'daily' } })}
        />
      )}
    </Card>
  );
}

function ClassicCard() {
  return (
    <Card kind="soft" padding={space.md}>
      <View style={styles.seasonRow}>
        <TrophyLogo size={36} />
        <View style={styles.flex}>
          <AppText variant="label">{t.classicTitle}</AppText>
          <AppText variant="caption" color={colors.textDim}>
            {t.classicBody}
          </AppText>
        </View>
        <StickerButton label={t.play} size="sm" onPress={() => router.push('/quiz')} />
      </View>
    </Card>
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
  const toast = useToast();

  return (
    <Screen header={<TopBar />} onRefresh={() => void refetch()} refreshing={isRefetching}>
      <LiveTicker items={t.ticker} />

      {isLoading ? <Skeleton height={140} rounded={18} /> : null}
      {data && !data.welcome_bonus_claimed ? <WelcomeBonus /> : null}

      <MatchOfTheDay />
      {daily?.state === 'done' ? null : <ClassicCard />}
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
        <StatTile value={String(streak)} label={t.statStreak} color={colors.correct} />
        <StatTile value={rank ? `#${rank}` : '--'} label={t.statRank} color={colors.led} />
        <StatTile value={String(owned)} label={t.statCollection} />
      </View>

      <Card kind="soft" padding={space.md}>
        <View style={styles.seasonRow}>
          <View style={styles.flex}>
            <AppText variant="label">{t.seasonTitle}</AppText>
            <AppText variant="caption" color={colors.textDim}>
              {t.seasonBody}
            </AppText>
          </View>
          <StickerButton label={strings.common.soon} tone="outline" size="sm" onPress={() => toast(t.seasonBody, 'info')} />
        </View>
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space.xxs },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  welcomeBtn: { marginTop: space.md },
  noBorder: { borderWidth: 0 },
  match: { gap: space.md },
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
});
