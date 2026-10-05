import type { DealsState } from '@fm/shared';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, CoinIcon, GemIcon, StickerButton, useToast } from '@/design-system/components';
import { playSound } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { RpcError } from '@/features/profile/api';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';
import { useBuyDeal, useCountdownTo } from './hooks';
import { RewardIcon, rewardLabel } from './rewards';

const t = strings.engage;

/** The current rotating deal: what you get, the price, the old price and a timer. */
export function DealCard({ state, onDone }: { state: DealsState; onDone?: () => void }) {
  const { deal, bought } = state;
  const left = useCountdownTo(state.ends_at);
  const buy = useBuyDeal();
  const toast = useToast();
  const off = Math.round((1 - deal.price.amount / deal.was) * 100);
  const Price = deal.price.currency === 'coins' ? CoinIcon : GemIcon;

  return (
    <Card kind="sticker" frame={colors.danger} padding={space.lg} style={styles.card}>
      <View style={styles.ribbon} accessibilityElementsHidden>
        <AppText variant="label" color={colors.text} style={styles.bold}>
          {`-${off}%`}
        </AppText>
      </View>
      <AppText variant="caption" color={colors.danger} style={styles.bold}>
        {t.dealTitle}
      </AppText>
      <AppText variant="heading">{deal.title}</AppText>
      <AppText color={colors.textMuted}>{deal.body}</AppText>
      <View style={styles.rewards}>
        {deal.rewards.map((r, i) => (
          <View key={i} style={styles.reward} accessible accessibilityLabel={rewardLabel(r)}>
            <RewardIcon r={r} size={40} />
            <AppText variant="caption" align="center">
              {rewardLabel(r)}
            </AppText>
          </View>
        ))}
      </View>
      <View style={styles.priceRow}>
        <Price size={20} />
        <AppText variant="heading" color={colors.led}>
          {formatNumber(deal.price.amount)}
        </AppText>
        <AppText variant="caption" color={colors.textDim} style={styles.was}>
          {fmt(t.dealWas, { n: formatNumber(deal.was) })}
        </AppText>
      </View>
      {bought ? (
        <AppText variant="label" color={colors.correct} align="center">
          {fmt(t.dealSold, { t: left ?? '' })}
        </AppText>
      ) : (
        <StickerButton
          label={fmt(t.buyFor, { n: formatNumber(deal.price.amount) })}
          tone="prize"
          size="lg"
          fullWidth
          loading={buy.isPending}
          onPress={() =>
            buy.mutate(
              { deal: deal.id, window: state.window },
              {
                onSuccess: () => {
                  playSound('coins');
                  toast(t.dealBought, 'success');
                  onDone?.();
                },
                onError: (e) => {
                  const code = e instanceof RpcError ? e.code : 'unknown';
                  const msg =
                    code === 'insufficient_funds'
                      ? deal.price.currency === 'coins'
                        ? t.notEnoughCoins
                        : t.notEnoughGems
                      : code === 'invalid_state'
                        ? t.dealExpired
                        : strings.errors.generic;
                  toast(msg, 'error');
                },
              },
            )
          }
        />
      )}
      {left && !bought ? (
        <AppText variant="caption" color={colors.textDim} align="center">
          {fmt(t.dealEnds, { t: left })}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { gap: space.sm },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  ribbon: {
    position: 'absolute',
    top: 0,
    end: 0,
    backgroundColor: colors.danger,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderBottomStartRadius: radius.sticker,
  },
  rewards: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, paddingVertical: space.sm },
  reward: { alignItems: 'center', gap: space.xs, maxWidth: 110 },
  priceRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  was: { textDecorationLine: 'line-through' },
});
