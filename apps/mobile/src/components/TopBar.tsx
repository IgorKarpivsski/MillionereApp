import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, AvatarBadge, CoinIcon, GemIcon, Led, Skeleton, TicketIcon } from '@/design-system/components';
import { colors, radius, space } from '@/design-system/tokens';
import { useEnergySheet } from '@/features/engage/EnergySheet';
import { useCountdownTo, useEnergy } from '@/features/engage/hooks';
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

/** Tickets for classic runs, with the time to the next one. Opens the refill sheet. */
function Tickets() {
  const { data } = useEnergy();
  const show = useEnergySheet((s) => s.show);
  const next = useCountdownTo(data && !data.unlimited && data.tickets < data.max ? data.next_at : null);
  if (!data) return null;
  const label = data.unlimited ? '∞' : String(data.tickets);
  return (
    <Pressable
      onPress={show}
      style={styles.meter}
      accessibilityRole="button"
      accessibilityLabel={data.unlimited ? strings.engage.unlimited : fmt(strings.engage.ticketsA11y, { n: data.tickets })}
      hitSlop={8}
    >
      <View style={styles.meterRow}>
        <TicketIcon size={16} />
        <Led color={data.tickets < 1 && !data.unlimited ? colors.danger : colors.text}>{label}</Led>
      </View>
      <AppText variant="caption" color={colors.textDim}>
        {next ?? strings.engage.tickets}
      </AppText>
    </Pressable>
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
      <Tickets />
      <Pressable
        style={styles.wallet}
        onPress={() => router.push('/shop')}
        accessibilityRole="button"
        accessibilityLabel={strings.store.title}
      >
        {data ? (
          <>
            <Meter kind="coins" amount={data.wallet.coins} />
            <Meter kind="gems" amount={data.wallet.gems} />
          </>
        ) : (
          <Skeleton width={120} height={40} />
        )}
      </Pressable>
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
  wallet: { flexDirection: 'row', gap: space.md },
  meter: { alignItems: 'center' },
  meterRow: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
