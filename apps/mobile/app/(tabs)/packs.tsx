import type { PackCatalogEntry, PackSlug } from '@fm/shared';
import { getLocales } from 'expo-localization';
import { router } from 'expo-router';
import { useState } from 'react';
import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { appAlert, AppText,
  BottomSheet,
  Card,
  CoinIcon,
  GemIcon,
  Led,
  Screen,
  Skeleton,
  StickerButton,
  useToast, } from '@/design-system/components';
import { colors, rarityColors, space, type RarityKey } from '@/design-system/tokens';
import { GlowingPack, PACK_GLOW, PACK_NAMES } from '@/features/collection/PackArt';
import { useCollection } from '@/features/collection/hooks';
import { useMarket } from '@/features/market/api';
import { makePackTicket } from '@/features/collection/packIntent';
import { useMyState } from '@/features/profile/hooks';
import { TradeFriendSheet } from '@/features/social/FriendPicker';
import { formatNumber, ltr } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.packs;

function OddsTable({ pack }: { pack: PackCatalogEntry }) {
  return (
    <View style={styles.odds}>
      {(Object.entries(pack.odds) as [RarityKey, number][]).map(([rarity, pct]) => (
        <View key={rarity} style={styles.oddsRow}>
          <View style={[styles.swatch, { backgroundColor: rarityColors[rarity].fill }]} />
          <AppText style={styles.flex}>{rarityColors[rarity].label}</AppText>
          <Led size="number" color={colors.text}>{ltr(`${pct}%`)}</Led>
        </View>
      ))}
      <AppText variant="caption" color={colors.textMuted}>
        {fmt(t.oddsNote, { n: pack.items })}
      </AppText>
      {pack.guaranteed ? (
        <AppText variant="caption" color={colors.correct}>
          {fmt(t.guaranteed, { rarity: rarityColors[pack.guaranteed].labelF })}
        </AppText>
      ) : null}
    </View>
  );
}

export default function PacksScreen() {
  const [tradeOpen, setTradeOpen] = useState(false);
  const { data: market } = useMarket();
  const { data, isLoading, isError, error, refetch, isRefetching } = useCollection();
  const { data: me } = useMyState();
  const [oddsFor, setOddsFor] = useState<PackCatalogEntry | null>(null);
  const toast = useToast();
  const region = getLocales()[0]?.regionCode ?? '';
  const paidBlocked = !!data?.paid_blocked_regions.includes(region);

  const open = (slug: PackSlug, pay: 'token' | 'coins' | 'gems') =>
    router.push({ pathname: '/pack-open', params: { pack: slug, pay, ticket: pay === 'token' ? undefined : makePackTicket(slug, pay) } });

  const buy = (p: PackCatalogEntry) => {
    const cur = p.coins ? 'coins' : 'gems';
    const price = p.coins ?? p.gems ?? 0;
    const have = cur === 'coins' ? me?.wallet.coins ?? 0 : me?.wallet.gems ?? 0;
    if (have < price) {
      toast(cur === 'coins' ? t.noCoins : t.noGems, 'error');
      return;
    }
    appAlert(fmt(t.buyTitle, { name: PACK_NAMES[p.slug] }), fmt(cur === 'coins' ? t.buyCoins : t.buyGems, { n: formatNumber(price) }), [
      { text: strings.common.cancel, style: 'cancel' },
      { text: t.buyConfirm, onPress: () => open(p.slug, cur) },
    ]);
  };

  return (
    <Screen header={<TopBar />} onRefresh={() => void refetch()} refreshing={isRefetching}>
      <AppText variant="title">{t.title}</AppText>
      <AppText color={colors.textMuted}>{t.body}</AppText>
      {data ? (
        <AppText variant="caption" color={colors.led}>
          {fmt(t.pity, { n: data.pity_left })}
        </AppText>
      ) : null}
      <StickerButton label={t.tradeDupes} icon="swap-horizontal" tone="outline" fullWidth onPress={() => setTradeOpen(true)} />
      <StickerButton
        label={market?.news ? `${strings.market.entry} (${market.news})` : strings.market.entry}
        icon="storefront"
        tone="gem"
        fullWidth
        onPress={() => router.push('/market')}
      />
      {isLoading ? <Skeleton height={400} rounded={18} /> : null}
      {isError && !data ? (
        <Card padding={space.lg} style={styles.errorCard}>
          <AppText variant="heading" align="center">{t.loadError}</AppText>
          <AppText variant="caption" color={colors.textMuted} align="center" numberOfLines={3}>
            {String((error as Error | null)?.message ?? '')}
          </AppText>
          <StickerButton label={t.retry} icon="refresh" onPress={() => void refetch()} />
        </Card>
      ) : null}

      {data?.catalog.map((p) => {
        const tokens = data.tokens[p.slug] ?? 0;
        const price = p.coins ?? p.gems;
        return (
          <View key={p.slug} style={[styles.packCard, { borderColor: tokens > 0 ? PACK_GLOW[p.slug] : 'rgba(255,255,255,0.12)' }]}>
            <LinearGradient
              colors={[PACK_GLOW[p.slug] + '55', 'rgba(30,18,80,0.95)']}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
              style={StyleSheet.absoluteFill}
            />
            <View style={styles.packRow}>
              <GlowingPack slug={p.slug} width={92} />
              <View style={styles.flex}>
                <AppText variant="title">{PACK_NAMES[p.slug]}</AppText>
                <View style={styles.chips}>
                  <View style={styles.countChip}>
                    <AppText variant="label" color={colors.textOnBright}>
                      {fmt(t.items, { n: p.items })}
                    </AppText>
                  </View>
                  {p.guaranteed ? (
                    <View style={[styles.countChip, { backgroundColor: rarityColors[p.guaranteed].fill }]}>
                      <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
                        {fmt(t.guaranteedShort, { rarity: rarityColors[p.guaranteed].labelF })}
                      </AppText>
                    </View>
                  ) : null}
                </View>
                {tokens > 0 ? (
                  <View style={[styles.ownedPill, { backgroundColor: PACK_GLOW[p.slug] }]}>
                    <AppText variant="label" color={colors.textOnBright}>
                      {fmt(t.owned, { n: tokens })}
                    </AppText>
                  </View>
                ) : (
                  <View style={styles.price}>
                    {p.coins ? <CoinIcon size={18} /> : p.gems ? <GemIcon size={18} /> : null}
                    <AppText variant="bodyStrong" color={colors.text}>
                      {price ? formatNumber(price) : t.rewardsOnly}
                    </AppText>
                  </View>
                )}
              </View>
            </View>
            <View style={styles.actions}>
              {tokens > 0 ? (
                <StickerButton label={t.open} icon="gift" size="sm" style={styles.flex} onPress={() => open(p.slug, 'token')} />
              ) : price && !paidBlocked ? (
                <StickerButton label={t.buy} icon="cart" size="sm" tone="outline" style={styles.flex} onPress={() => buy(p)} />
              ) : (
                <View style={styles.flex} />
              )}
              <StickerButton label={t.odds} size="sm" tone="ghost" onPress={() => setOddsFor(p)} />
            </View>
          </View>
        );
      })}

      <TradeFriendSheet visible={tradeOpen} onClose={() => setTradeOpen(false)} />
      <BottomSheet visible={!!oddsFor} onClose={() => setOddsFor(null)} title={oddsFor ? `${t.odds}: ${PACK_NAMES[oddsFor.slug]}` : ''}>
        {oddsFor ? <OddsTable pack={oddsFor} /> : null}
        <StickerButton label={strings.common.close} tone="ghost" fullWidth onPress={() => setOddsFor(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  packCard: { borderRadius: 24, borderWidth: 2, padding: space.md, overflow: 'hidden' },
  ownedPill: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: 999, marginTop: space.xs },
  errorCard: { gap: space.sm, alignItems: 'center' },
  price: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xxs },
  actions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  odds: { gap: space.sm },
  oddsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  swatch: { width: 18, height: 18, borderRadius: 6 },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs, marginTop: space.xxs },
  countChip: { paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 999, backgroundColor: colors.led },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});
