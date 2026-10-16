import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, Led } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { strings } from '@/lib/i18n';
import { useCountdownTo, useDeals } from './hooks';
import { RewardIcon } from './rewards';

const t = strings.engage;

/**
 * The current deal as a slim banner on the home screen (it used to pop up on
 * launch; now nothing pops up by itself). Tapping opens the shop where it can be bought.
 */
export function DealBanner() {
  const { data } = useDeals();
  const left = useCountdownTo(data?.ends_at);
  if (!data || data.bought) return null;
  const { deal } = data;
  const off = Math.round((1 - deal.price.amount / deal.was) * 100);
  return (
    <Pressable
      onPress={() => router.push('/shop')}
      accessibilityRole="button"
      accessibilityLabel={`${t.dealTitle}: ${deal.title}, -${off}%`}
      style={({ pressed }) => [styles.row, pressed && styles.pressed]}
    >
      <View style={styles.badge}>
        <AppText variant="label" color={colors.text} style={styles.bold}>
          {`-${off}%`}
        </AppText>
      </View>
      {deal.rewards[0] ? <RewardIcon r={deal.rewards[0]} size={36} /> : null}
      <View style={styles.flex}>
        <AppText variant="caption" color={colors.danger} style={styles.bold}>
          {t.dealTitle}
        </AppText>
        <AppText variant="label" numberOfLines={1}>
          {deal.title}
        </AppText>
      </View>
      {left ? (
        <Led size="ledS" color={colors.textMuted}>
          {left}
        </Led>
      ) : null}
      <Ionicons name="chevron-back" size={20} color={colors.text} />
    </Pressable>
  );
}

/** Kept for older imports: the deal no longer pops up by itself. */
export function DealPopup() {
  return null;
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: 18,
    backgroundColor: 'rgba(184,50,42,0.22)',
    borderWidth: 1,
    borderColor: 'rgba(255,90,78,0.55)',
  },
  pressed: { transform: [{ scale: 0.98 }] },
  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 8, backgroundColor: colors.danger },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  flex: { flex: 1 },
});
