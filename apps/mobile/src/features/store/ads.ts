import mobileAds, { AdEventType, MaxAdContentRating, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useSettingsStore } from '@/features/settings/store';

/**
 * Opt-in rewarded ads only — the player taps "watch" and gets a reward.
 * No banners, no forced interstitials. Uses Google's test unit until the
 * real AdMob unit id is configured (EXPO_PUBLIC_ADMOB_REWARDED_ANDROID).
 *
 * Google Play Families policy: the app's audience includes children, so every
 * ad request is non-personalised and family-safe. Players under 13 — and anyone
 * who hasn't answered the age screen yet — are tagged child-directed (G rating);
 * under 16 are tagged under the age of consent.
 */
const UNIT = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID || TestIds.REWARDED;
let started = false;

async function applyAudience(): Promise<void> {
  const band = useSettingsStore.getState().ageBand;
  const child = band === null || band === 'under13';
  await mobileAds().setRequestConfiguration({
    tagForChildDirectedTreatment: child,
    tagForUnderAgeOfConsent: band !== '16plus',
    maxAdContentRating: child ? MaxAdContentRating.G : MaxAdContentRating.PG,
  });
}

export function initAds(): void {
  if (started) return;
  started = true;
  // The saved age band loads from storage a moment after launch; re-tag once it's there.
  useSettingsStore.persist.onFinishHydration(() => refreshAdAudience());
  applyAudience()
    .then(() => mobileAds().initialize())
    .catch(() => {
      started = false;
    });
}

/** Re-applies the audience tags after the player answers the age screen. */
export function refreshAdAudience(): void {
  void applyAudience().catch(() => undefined);
}

/** Shows one rewarded ad. Resolves true only if the player earned the reward. */
export function showRewardedAd(): Promise<boolean> {
  initAds();
  return new Promise((resolve) => {
    let earned = false;
    let done = false;
    const ad = RewardedAd.createForAdRequest(UNIT, { requestNonPersonalizedAdsOnly: true });
    const finish = (v: boolean) => {
      if (done) return;
      done = true;
      unsubscribe();
      resolve(v);
    };
    const unsubscribe = ad.addAdEventsListener(({ type }) => {
      if (type === RewardedAdEventType.LOADED) void ad.show();
      else if (type === RewardedAdEventType.EARNED_REWARD) earned = true;
      else if (type === AdEventType.CLOSED) finish(earned);
      else if (type === AdEventType.ERROR) finish(false);
    });
    ad.load();
    setTimeout(() => finish(earned), 60_000);
  });
}
