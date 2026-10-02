import { StyleSheet, View } from 'react-native';
import { formatCompact, formatNumber } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { colors, palette, radius, space } from '../tokens';
import { AppText } from './AppText';
import { CoinIcon, DustIcon, GemIcon } from './CurrencyIcons';

export interface CurrencyPillProps {
  currency: 'coins' | 'gems' | 'dust';
  amount: number;
}

const label = { coins: strings.common.coins, gems: strings.common.gems, dust: 'אבקה' };

export function CurrencyPill({ currency, amount }: CurrencyPillProps) {
  const Icon = currency === 'coins' ? CoinIcon : currency === 'gems' ? GemIcon : DustIcon;
  return (
    <View
      style={styles.pill}
      accessible
      accessibilityRole="text"
      accessibilityLabel={`${formatNumber(amount)} ${label[currency]}`}
    >
      <Icon size={22} />
      <AppText variant="number" style={styles.amount}>
        {formatCompact(amount)}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingStart: space.xs,
    paddingEnd: space.md,
    height: 36,
    borderRadius: radius.chip,
    backgroundColor: palette.night950,
    borderWidth: 2,
    borderColor: colors.border,
  },
  amount: { minWidth: 28 },
});
