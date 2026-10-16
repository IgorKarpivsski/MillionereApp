import mobileAds, { AdEventType, InterstitialAd, MaxAdContentRating, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';
import Constants from 'expo-constants';
import { useSettingsStore } from '@/features/settings/store';

/**
 * Rewarded ads (the player taps "watch" and gets a reward) and, every few games,
 * one full-screen ad between games for players without "no ads" (see interstitial.ts). Uses Google's test unit until the
 * real AdMob unit id is configured (EXPO_PUBLIC_ADMOB_REWARDED_ANDROID).
 *
 * Google Play Families policy: the app's audience includes children, so every
 * ad request is non-personalised and family-safe. Players under 13 — and anyone
 * who hasn't answered the age screen yet — are tagged child-directed (G rating);
 * under 16 are tagged under the age of consent.
 */
// Real ads only in the store build: AdMob serves nothing to a test package, and
// clicking your own real ads can get the AdMob account suspended.
const IS_STORE_BUILD = !__DEV__ && Constants.expoConfig?.extra?.appEnv === 'production';
const UNIT = IS_STORE_BUILD
  ? process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID || 'ca-app-pub-4196315436564582/6070981024'
  : TestIds.REWARDED;
/** Between-games ad. In the store build it needs its own AdMob unit; without one, none is shown. */
const INTERSTITIAL_UNIT: string | null = IS_STORE_BUILD
  ? process.env.EXPO_PUBLIC_ADMOB_INTERSTITIAL_ANDROID || 'ca-app-pub-4196315436564582/9714782372'
  : TestIds.INTERSTITIAL;
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

/** Shows one full-screen ad between games. Resolves when it closes (or fails). */
export function showInterstitialAd(): Promise<boolean> {
  if (!INTERSTITIAL_UNIT) return Promise.resolve(false);
  initAds();
  return new Promise((resolve) => {
    let done = false;
    let shown = false;
    const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT, { requestNonPersonalizedAdsOnly: true });
    const finish = () => {
      if (done) return;
      done = true;
      unsubscribe();
      resolve(shown);
    };
    const unsubscribe = ad.addAdEventsListener(({ type }) => {
      if (type === AdEventType.LOADED) {
        shown = true;
        void ad.show();
      } else if (type === AdEventType.CLOSED || type === AdEventType.ERROR) finish();
    });
    ad.load();
    // Never hold the player: give up if the ad doesn't load quickly.
    setTimeout(() => {
      if (!shown) finish();
    }, 8000);
    setTimeout(finish, 90_000);
  });
}
