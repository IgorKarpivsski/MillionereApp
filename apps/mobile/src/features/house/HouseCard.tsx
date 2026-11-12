import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, CoinIcon, ProgressBar } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useMyState } from '@/features/profile/hooks';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';
import { nextHouseGoal, useHouse } from './api';
import { Room } from './Room';

const t = strings.house;

/** Home screen goal: the sloth's house, how furnished it is, and what the coins buy next. */
export function HouseCard() {
  const { data: st } = useHouse();
  const { data: me } = useMyState();
  if (!st || st.items.length === 0) return null;
  const have = st.items.filter((i) => st.owned.includes(i.id)).length;
  const goal = nextHouseGoal(st);
  const coins = me?.wallet.coins ?? 0;
  const need = goal ? Math.max(0, goal.price - coins) : 0;
  const goalName = goal ? (t.names[goal.id as keyof typeof t.names] ?? '') : '';
  const line = !goal ? t.cardDone : need === 0 ? t.cardCan : fmt(t.cardNeed, { n: formatNumber(need) });
  return (
    <Pressable
      onPress={() => router.push('/house')}
      accessibilityRole="button"
      accessibilityLabel={`${t.cardTitle}. ${fmt(t.progress, { n: have, total: st.items.length })}. ${goal ? fmt(t.cardNext, { name: goalName }) : ''} ${line}`}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}
    >
      <LinearGradient colors={['#7A4A1E', '#3B2266']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Room width={96} owned={st.owned} hat={st.hat} interactive={false} />
      <View style={styles.text}>
        <AppText variant="heading">{`🏡 ${t.cardTitle}`}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {fmt(t.progress, { n: have, total: st.items.length })}
        </AppText>
        <ProgressBar value={have / st.items.length} height={8} accessibilityLabel={`${have}/${st.items.length}`} />
        {goal ? (
          <AppText variant="label" numberOfLines={1} style={styles.bold}>
            {fmt(t.cardNext, { name: goalName })}
          </AppText>
        ) : null}
        <View style={styles.need}>
          {goal && need > 0 ? <CoinIcon size={14} /> : null}
          <AppText variant="caption" color={need === 0 ? colors.correct : colors.led} style={styles.bold}>
            {line}
          </AppText>
        </View>
        {goal && need > 0 ? <ProgressBar value={coins / goal.price} height={5} color={colors.led} accessibilityLabel={line} /> : null}
      </View>
      <Ionicons name="chevron-back" size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: 'rgba(255,214,140,0.45)',
  },
  pressed: { transform: [{ scale: 0.97 }] },
  text: { flex: 1, gap: 4 },
  need: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});
