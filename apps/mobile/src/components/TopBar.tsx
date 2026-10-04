import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, AvatarBadge, CoinIcon, GemIcon, Led, Skeleton } from '@/design-system/components';
import { colors, radius, space } from '@/design-system/tokens';
import { useMyState } from '@/features/profile/hooks';
import { formatCompact, formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';
import { rankTitle } from '@/lib/rank';

function Meter({ kind, amount }: { kind: 'coins' | 'gems'; amount: number }) {
  const Icon = kind === 'coins' ? CoinIcon : GemIcon;
  return (
    <View
      style={styles.meter}
      accessible
      accessibilityLabel={`${formatNumber(amount)} ${strings.common[kind]}`}
    >
      <View style={styles.meterRow}>
        <Icon size={16} />
        <Led color={kind === 'coins' ? colors.led : colors.gem}>{formatCompact(amount)}</Led>
      </View>
      <AppText variant="caption" color={colors.textDim}>
        {strings.common[kind]}
      </AppText>
    </View>
  );
}

/** The scoreboard header: player on the right (start), LED wallet on the left (end). */
export function TopBar() {
  const { data } = useMyState();
  return (
    <View style={styles.bar}>
      {data ? (
        <Pressable
          onPress={() => router.push('/(tabs)/profile')}
          accessibilityRole="button"
          accessibilityLabel={`הפרופיל של ${data.profile.username}`}
          style={styles.who}
        >
          <AvatarBadge avatarId={data.profile.avatar_id} level={data.profile.level} size={40} />
          <View style={styles.whoText}>
            <AppText variant="label" numberOfLines={1}>
              {data.profile.username}
            </AppText>
            <AppText variant="caption" color={colors.textDim} numberOfLines={1}>
              {fmt(strings.topBar.levelLine, { n: data.profile.level, rank: rankTitle(data.profile.level) })}
            </AppText>
          </View>
        </Pressable>
      ) : (
        <Skeleton width={140} height={40} />
      )}
      <View style={styles.wallet}>
        {data ? (
          <>
            <Meter kind="coins" amount={data.wallet.coins} />
            <Meter kind="gems" amount={data.wallet.gems} />
          </>
        ) : (
          <Skeleton width={120} height={40} />
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginHorizontal: space.md,
    marginTop: space.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    gap: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.border,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  whoText: { flexShrink: 1 },
  wallet: { flexDirection: 'row', gap: space.lg },
  meter: { alignItems: 'center' },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
