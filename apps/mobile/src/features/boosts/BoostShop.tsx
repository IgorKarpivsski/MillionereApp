import type { BoostKind } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, StickerButton, useToast } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { requestId } from '@/features/collection/api';
import { useMyState } from '@/features/profile/hooks';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';
import { boostsApi, useBoosts } from './api';
import { BOOST_ORDER, BoostIcon, boostDesc, boostName } from './meta';

/** Boost shelf in the store: what each one does, how many you have, buy with coins. */
export function BoostShop() {
  const { data } = useBoosts();
  const { data: me } = useMyState();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState<BoostKind | null>(null);
  if (!data) return null;
  const coins = me?.wallet.coins ?? 0;

  const buy = async (b: BoostKind) => {
    setBusy(b);
    try {
      await boostsApi.buy(b, requestId());
      void qc.invalidateQueries({ queryKey: queryKeys.boosts });
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
      toast(fmt(strings.boosts.bought, { name: boostName(b) }), 'success');
    } catch (e) {
      toast((e as Error).message.includes('insufficient') ? strings.boosts.noCoins : strings.errors.generic, 'error');
    } finally {
      setBusy(null);
    }
  };

  return (
    <View style={styles.wrap}>
      <AppText variant="heading">{strings.boosts.title}</AppText>
      <AppText variant="caption" color={colors.textMuted}>
        {strings.boosts.subtitle}
      </AppText>
      <View style={styles.grid}>
        {BOOST_ORDER.map((b) => {
          const price = data.prices[b] ?? 0;
          return (
            <Card key={b} padding={space.sm} style={styles.cell}>
              <View style={styles.top}>
                <BoostIcon boost={b} size={48} count={data.counts[b] ?? 0} />
                <AppText variant="label" align="center" numberOfLines={1}>
                  {boostName(b)}
                </AppText>
                <AppText variant="caption" color={colors.textMuted} align="center" numberOfLines={2} style={styles.desc}>
                  {boostDesc(b)}
                </AppText>
              </View>
              <StickerButton
                label={fmt(strings.boosts.buyFor, { n: price })}
                size="sm"
                tone="prize"
                fullWidth
                loading={busy === b}
                disabled={!!busy || coins < price}
                disabledReason={coins < price ? strings.common.needCoins : undefined}
                onPress={() => void buy(b)}
              />
            </Card>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm, marginTop: space.xs },
  cell: { width: '48.5%', gap: space.sm },
  top: { alignItems: 'center', gap: 4 },
  desc: { minHeight: 34 },
});
