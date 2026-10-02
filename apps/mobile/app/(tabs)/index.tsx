import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import {
  AppText,
  Card,
  CoinIcon,
  RarityFrame,
  Screen,
  Skeleton,
  StickerButton,
  StreakFlame,
  useToast,
} from '@/design-system/components';
import { colors, palette, space } from '@/design-system/tokens';
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
    <Card kind="sticker" tint={colors.prize}>
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

export default function HomeScreen() {
  const { data, isLoading, refetch, isRefetching } = useMyState();
  const streak = 0; // daily streaks arrive in Phase 7

  return (
    <Screen header={<TopBar />} onRefresh={() => void refetch()} refreshing={isRefetching}>
      <AppText variant="title">{data ? fmt(t.greeting, { name: data.profile.username }) : ' '}</AppText>

      {isLoading ? <Skeleton height={140} rounded={22} /> : null}
      {data && !data.welcome_bonus_claimed ? <WelcomeBonus /> : null}

      <Card tint={palette.night700}>
        <View style={styles.dailyRow}>
          <StreakFlame count={streak} />
          <View style={styles.flex}>
            <AppText variant="heading">{t.dailyTitle}</AppText>
            <AppText color={colors.textMuted}>{t.dailyBody}</AppText>
            <AppText variant="label" color={streak > 0 ? colors.danger : colors.prize} style={styles.streakLabel}>
              {streak > 0 ? fmt(t.streakDays, { n: streak }) : t.streakNone}
            </AppText>
          </View>
        </View>
        <StickerButton
          label={t.dailyCta}
          tone="danger"
          icon="calendar"
          fullWidth
          style={styles.dailyBtn}
          onPress={() => router.push('/(tabs)/play')}
        />
      </Card>

      <StickerButton label={t.playCta} icon="football" size="lg" fullWidth onPress={() => router.push('/(tabs)/play')} />

      <View style={styles.sectionHead}>
        <AppText variant="heading">{t.albumTitle}</AppText>
        <Ionicons name="albums" size={22} color={colors.gem} />
      </View>
      <View style={styles.stickers}>
        {[0, 1, 2].map((i) => (
          <RarityFrame key={i} rarity="common" locked width={96}>
            <Ionicons name="help" size={34} color={colors.textMuted} />
          </RarityFrame>
        ))}
      </View>
      <AppText color={colors.textMuted}>{t.albumEmpty}</AppText>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1, gap: space.xxs },
  welcomeRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  welcomeBtn: { marginTop: space.md },
  dailyRow: { flexDirection: 'row', gap: space.md, alignItems: 'flex-start' },
  streakLabel: { marginTop: space.xs },
  dailyBtn: { marginTop: space.lg },
  sectionHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: space.sm },
  stickers: { flexDirection: 'row', gap: space.md },
});
