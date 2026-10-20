import { finishTransaction, getAvailablePurchases, initConnection, type Purchase } from 'expo-iap';
import { Linking, Platform } from 'react-native';
import { storeApi } from './api';

export const SUBS = new Set(['vip_monthly']);
export const CONSUMABLE = new Set(['coins_2000', 'coins_6000', 'coins_16000', 'gems_80', 'gems_300']);
const PACKAGE = 'com.haaluf.trivia';

/** Google Play's own "manage subscription" page (cancel, change payment method). */
export function openManageSubscription(sku?: string): void {
  const url = sku
    ? `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(sku)}&package=${PACKAGE}`
    : 'https://play.google.com/store/account/subscriptions';
  void Linking.openURL(url);
}

/** Verifies a purchase with our server, then tells Google it's handled (acknowledge / consume). */
export async function verifyAndFinish(purchase: Purchase): Promise<void> {
  const sku = purchase.productId;
  const token = purchase.purchaseToken;
  if (!token) throw new Error('no token');
  await storeApi.verify(sku, token, SUBS.has(sku) ? 'subs' : 'in-app');
  await finishTransaction({ purchase, isConsumable: CONSUMABLE.has(sku) });
}

/**
 * Purchases Google still holds for us: one that was paid but never verified (the app closed
 * mid-purchase), or an active subscription. Verifying again is safe — the server ignores repeats
 * and refreshes the subscription's renewal date. Returns how many were handled.
 */
export async function recoverPurchases(): Promise<number> {
  if (Platform.OS !== 'android') return 0;
  await initConnection();
  const list = await getAvailablePurchases();
  let n = 0;
  for (const p of list ?? []) {
    try {
      await verifyAndFinish(p);
      n++;
    } catch {
      // keep going: one bad purchase shouldn't block the rest
    }
  }
  return n;
}

/** ISO-8601 period ("P3D", "P1W", "P1M") in days. */
function periodDays(iso: string | undefined): number {
  const m = /^P(?:(\d+)Y)?(?:(\d+)M)?(?:(\d+)W)?(?:(\d+)D)?$/.exec(iso ?? '');
  if (!m) return 0;
  return Number(m[1] ?? 0) * 365 + Number(m[2] ?? 0) * 30 + Number(m[3] ?? 0) * 7 + Number(m[4] ?? 0);
}

/** A free-trial phase in any offer Google says this player can get. */
export function freeTrialDays(sub: unknown): number {
  const s = sub as Record<string, unknown> | undefined;
  const offers = (s?.subscriptionOfferDetailsAndroid ?? s?.subscriptionOffers ?? []) as Record<string, unknown>[];
  for (const o of offers) {
    const phases = ((o.pricingPhases as Record<string, unknown> | undefined)?.pricingPhaseList ?? o.pricingPhases ?? []) as Record<string, unknown>[];
    if (!Array.isArray(phases)) continue;
    for (const ph of phases) {
      if (String(ph.priceAmountMicros ?? ph.price ?? '') === '0') return periodDays(String(ph.billingPeriod ?? ph.period ?? ''));
    }
  }
  return 0;
}
