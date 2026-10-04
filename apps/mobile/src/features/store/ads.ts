import mobileAds, { AdEventType, RewardedAd, RewardedAdEventType, TestIds } from 'react-native-google-mobile-ads';

/**
 * Opt-in rewarded ads only — the player taps "watch" and gets a reward.
 * No banners, no forced interstitials. Uses Google's test unit until the
 * real AdMob unit id is configured (EXPO_PUBLIC_ADMOB_REWARDED_ANDROID).
 */
const UNIT = process.env.EXPO_PUBLIC_ADMOB_REWARDED_ANDROID || TestIds.REWARDED;
let started = false;

export function initAds(): void {
  if (started) return;
  started = true;
  mobileAds()
    .initialize()
    .catch(() => {
      started = false;
    });
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
