import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, AvatarBadge, CurrencyPill, Skeleton } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useMyState } from '@/features/profile/hooks';

/** Avatar + name on the right (start), currencies on the left (end) — RTL. */
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
          <AvatarBadge avatarId={data.profile.avatar_id} level={data.profile.level} size={44} />
          <AppText variant="label" numberOfLines={1} style={styles.name}>
            {data.profile.username}
          </AppText>
        </Pressable>
      ) : (
        <Skeleton width={140} height={44} />
      )}
      <View style={styles.wallet}>
        {data ? (
          <>
            <CurrencyPill currency="coins" amount={data.wallet.coins} />
            <CurrencyPill currency="gems" amount={data.wallet.gems} />
          </>
        ) : (
          <Skeleton width={150} height={36} />
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
    paddingHorizontal: space.lg,
    paddingTop: space.sm,
    paddingBottom: space.xs,
    gap: space.sm,
  },
  who: { flexDirection: 'row', alignItems: 'center', gap: space.sm, flexShrink: 1 },
  name: { flexShrink: 1, color: colors.text },
  wallet: { flexDirection: 'row', gap: space.sm },
});
