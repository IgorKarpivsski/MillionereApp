import type { StoreProduct } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useIAP, type Purchase } from 'expo-iap';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { ParentalGate } from '@/components/ParentalGate';
import { AppText, Card, CoinIcon, GemIcon, Led, StickerButton, TrophyLogo, useToast, Backdrop } from '@/design-system/components';
import { playSound } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { storeApi } from '@/features/store/api';
import { useAdReward, useStore } from '@/features/store/hooks';
import { SUBS, freeTrialDays, openManageSubscription, recoverPurchases, verifyAndFinish } from '@/features/store/purchases';
import { BoostShop } from '@/features/boosts/BoostShop';
import { DealCard } from '@/features/engage/DealCard';
import { CurrencyHelpButton } from '@/features/teen/CurrencyHelp';
import { useDeals } from '@/features/engage/hooks';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';

const t = strings.store;
const dateHe = (iso: string) => new Date(iso).toLocaleDateString('he-IL', { day: 'numeric', month: 'long' });

export default function ShopScreen() {
  const { data: store } = useStore();
  const { data: deals } = useDeals();
  const { session } = useAuth();
  const toast = useToast();
  const qc = useQueryClient();
  const ad = useAdReward();
  const [buying, setBuying] = useState<string | null>(null);
  const [gateFor, setGateFor] = useState<StoreProduct | null>(null);

  const { connected, products, subscriptions, fetchProducts, requestPurchase } = useIAP({
    onPurchaseSuccess: async (purchase: Purchase) => {
      try {
        await verifyAndFinish(purchase);
        playSound('coins');
        toast(t.thanks, 'success');
        for (const k of [queryKeys.store, queryKeys.myState]) void qc.invalidateQueries({ queryKey: k });
      } catch {
        // Not finishing lets Google refund automatically if we couldn't verify within 3 days.
        toast(t.verifyFailed, 'error');
      } finally {
        setBuying(null);
      }
    },
    onPurchaseError: () => {
      setBuying(null);
    },
  });

  const skus = useMemo(() => store?.products.map((p) => p.sku) ?? [], [store]);
  useEffect(() => {
    if (!connected || skus.length === 0) return;
    void fetchProducts({ skus: skus.filter((s) => !SUBS.has(s)), type: 'in-app' }).catch(() => {});
    void fetchProducts({ skus: skus.filter((s) => SUBS.has(s)), type: 'subs' }).catch(() => {});
  }, [connected, skus, fetchProducts]);

  const priceOf = (sku: string) =>
    products.find((p) => p.id === sku)?.displayPrice ?? subscriptions.find((p) => p.id === sku)?.displayPrice ?? null;

  const buy = async (p: StoreProduct) => {
    if (!session) return;
    setBuying(p.sku);
    try {
      if (SUBS.has(p.sku)) {
        const sub = subscriptions.find((s) => s.id === p.sku);
        const offer = sub?.subscriptionOffers?.find((o) => o.offerTokenAndroid)?.offerTokenAndroid;
        await requestPurchase({
          type: 'subs',
          request: {
            google: {
              skus: [p.sku],
              obfuscatedAccountId: session.user.id,
              subscriptionOffers: offer ? [{ sku: p.sku, offerToken: offer }] : [],
            },
          },
        });
      } else {
        await requestPurchase({ type: 'in-app', request: { google: { skus: [p.sku], obfuscatedAccountId: session.user.id } } });
      }
    } catch {
      setBuying(null);
    }
  };

  const vipActive = !!store?.vip_until && new Date(store.vip_until) > new Date();
  const sub = store?.sub ?? null;
  const vipSku = store?.products.find((p) => p.kind === 'vip')?.sku;
  const vipPrice = vipSku ? priceOf(vipSku) : null;
  const trialDays = vipSku ? freeTrialDays(subscriptions.find((x) => x.id === vipSku)) : 0;
  const [restoring, setRestoring] = useState(false);
  const restore = async () => {
    setRestoring(true);
    try {
      const n = await recoverPurchases();
      for (const k of [queryKeys.store, queryKeys.myState]) void qc.invalidateQueries({ queryKey: k });
      toast(n > 0 ? t.restored : t.nothingToRestore, n > 0 ? 'success' : 'info');
    } catch {
      toast(strings.errors.generic, 'error');
    } finally {
      setRestoring(false);
    }
  };
  const storeReady = connected && (products.length > 0 || subscriptions.length > 0);

  const Item = ({ p }: { p: StoreProduct }) => {
    const owned = (p.kind === 'no_ads' && store?.no_ads) || (p.kind === 'vip' && vipActive);
    const price = priceOf(p.sku);
    return (
      <Card kind={p.badge ? 'sticker' : 'panel'} padding={space.md} style={styles.item}>
        {p.badge ? (
          <View style={styles.badge}>
            <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
              {p.badge}
            </AppText>
          </View>
        ) : null}
        <View style={styles.row}>
          <View style={styles.iconWell}>{p.kind === 'coins' ? <CoinIcon size={38} /> : p.kind === 'gems' ? <GemIcon size={38} /> : <TrophyLogo size={38} />}</View>
          <View style={styles.flex}>
            <AppText variant="label">{p.title}</AppText>
            <AppText variant="caption" color={colors.textDim}>
              {p.kind === 'coins'
                ? fmt(t.coinsLine, { n: formatNumber(p.amount) })
                : p.kind === 'gems'
                  ? fmt(t.gemsLine, { n: formatNumber(p.amount) })
                  : p.kind === 'no_ads'
                    ? t.noAdsLine
                    : price
                      ? trialDays
                        ? fmt(t.subTrial, { days: trialDays, price })
                        : fmt(t.subPerMonth, { price })
                      : t.vipLine}
            </AppText>
          </View>
          <StickerButton
            label={owned ? t.owned : price ?? t.soon}
            size="sm"
            tone={owned ? 'ghost' : 'primary'}
            disabled={owned || !price || !!buying}
            loading={buying === p.sku}
            onPress={() => setGateFor(p)}
          />
        </View>
      </Card>
    );
  };

  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <View style={styles.top}>
        <AppText variant="title" style={styles.flex}>{t.title}</AppText>
        <CurrencyHelpButton auto />
        <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {store?.free_pack_today ? (
          <Card kind="sticker" frame={colors.correct} padding={space.md}>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="label">{t.freePack}</AppText>
                <AppText variant="caption" color={colors.textDim}>
                  {ad.adFree ? t.freePackNoAd : t.freePackBody}
                </AppText>
              </View>
              <StickerButton
                label={ad.adFree ? t.take : t.watch}
                icon={ad.adFree ? 'gift' : 'play-circle'}
                size="sm"
                loading={ad.busy}
                onPress={async () => {
                  const r = await ad.run('free_pack');
                  if (r) toast(t.packAdded, 'success');
                }}
              />
            </View>
          </Card>
        ) : null}
        {vipActive && store?.vip_daily_today ? (
          <StickerButton
            label={t.vipDaily}
            icon="star"
            fullWidth
            onPress={async () => {
              const r = await ad.run('vip_daily');
              if (r) toast(t.packAdded, 'success');
            }}
          />
        ) : null}

        {deals ? <DealCard state={deals} /> : null}

        <BoostShop />

        <AppText variant="heading">{t.vipTitle}</AppText>
        {sub && (sub.state === 'grace' || sub.state === 'on_hold' || sub.state === 'paused') ? (
          <Card kind="sticker" frame={colors.danger} padding={space.md} style={styles.item}>
            <AppText variant="label" color={colors.text}>
              {sub.state === 'grace' ? t.subGrace : sub.state === 'on_hold' ? t.subOnHold : t.subPaused}
            </AppText>
            <StickerButton label={t.fixPayment} icon="card" tone="danger" size="sm" onPress={() => openManageSubscription(sub.sku)} />
          </Card>
        ) : null}
        {store?.products.filter((p) => p.kind === 'vip').map((p) => <Item key={p.sku} p={p} />)}
        <View style={styles.perks}>
          {t.vipPerks.map((perk) => (
            <AppText key={perk} variant="caption" color={colors.textMuted}>
              {`✓ ${perk}`}
            </AppText>
          ))}
        </View>
        {sub && (sub.state === 'active' || sub.state === 'canceled') && sub.expires_at ? (
          <AppText variant="label" color={colors.led}>
            {fmt(sub.state === 'active' && sub.auto_renew ? t.subActive : t.subCanceled, { date: dateHe(sub.expires_at) })}
          </AppText>
        ) : vipActive && store?.vip_until && !sub ? (
          <AppText variant="label" color={colors.led}>
            {fmt(t.vipBonusNote, { date: dateHe(store.vip_until) })}
          </AppText>
        ) : null}
        {vipPrice && !vipActive ? (
          <AppText variant="caption" color={colors.textDim}>
            {`${trialDays ? fmt(t.subTrialTerms, { price: vipPrice }) + ' ' : ''}${fmt(t.subTerms, { price: vipPrice })}`}
          </AppText>
        ) : null}
        {sub ? <StickerButton label={t.manage} icon="settings" tone="ghost" size="sm" onPress={() => openManageSubscription(sub.sku)} /> : null}

        <AppText variant="heading">{t.coinsTitle}</AppText>
        {store?.products.filter((p) => p.kind === 'coins').map((p) => <Item key={p.sku} p={p} />)}
        <AppText variant="heading">{t.gemsTitle}</AppText>
        {store?.products.filter((p) => p.kind === 'gems').map((p) => <Item key={p.sku} p={p} />)}
        {store?.products.filter((p) => p.kind === 'no_ads').map((p) => <Item key={p.sku} p={p} />)}

        {!storeReady ? (
          <AppText variant="caption" color={colors.textDim} align="center">
            {t.notReady}
          </AppText>
        ) : null}
        <StickerButton label={t.restore} icon="refresh" tone="ghost" size="sm" loading={restoring} onPress={() => void restore()} />
        <AppText variant="caption" color={colors.textDim} align="center">
          {t.legal}
        </AppText>
        <Led size="ledS" color={colors.textDim}>
          {vipActive ? 'VIP' : ''}
        </Led>
      </ScrollView>
      <ParentalGate
        visible={!!gateFor}
        onClose={() => setGateFor(null)}
        onPass={() => {
          const p = gateFor;
          setGateFor(null);
          if (p) void buy(p);
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  body: { padding: space.lg, gap: space.md },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  item: { gap: space.xs },
  iconWell: { width: 54, height: 54, borderRadius: 27, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(255,214,140,0.10)', borderWidth: 1, borderColor: 'rgba(255,214,140,0.25)' },
  badge: {
    position: 'absolute',
    top: 0,
    end: 0,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderBottomStartRadius: radius.sticker,
    backgroundColor: colors.led,
  },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  perks: { gap: 2, paddingHorizontal: space.sm },
});
