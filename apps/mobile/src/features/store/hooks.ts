import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useToast } from '@/design-system/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { queryKeys } from '@/lib/queryClient';
import { strings } from '@/lib/i18n';
import { showRewardedAd } from './ads';
import { storeApi } from './api';
import { afterAdVerified } from '@/features/profile/api';
import { useSettingsStore } from '@/features/settings/store';

/**
 * Google Play Families: only players who said 16+ on the age screen ever see an ad. For everyone
 * else (and before the age screen) the game behaves as ad-free: every "watch an ad" reward is a plain
 * reward, and the server (ad_ssv_consume) grants it without an ad for the same players.
 */
export function useStore() {
  const { session } = useAuth();
  const ageBand = useSettingsStore((s) => s.ageBand);
  const kidsNoAds = ageBand !== '16plus';
  return useQuery({
    queryKey: queryKeys.store,
    queryFn: storeApi.state,
    enabled: !!session,
    select: (d) => (kidsNoAds && d && !d.ad_free ? { ...d, ad_free: true } : d),
  });
}

/**
 * "Watch and get a reward". Players with no-ads / VIP get the reward straight away.
 * Returns the server's reward payload, or null if nothing was granted.
 */
export function useAdReward() {
  const { session } = useAuth();
  const { data: store } = useStore();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (kind: 'double_run' | 'free_pack' | 'vip_daily' | 'double_points', ref?: string) => {
      if (busy) return null;
      setBusy(true);
      try {
        if (kind !== 'vip_daily' && !store?.ad_free) {
          const ok = await showRewardedAd(session?.user.id);
          if (!ok) {
            toast(strings.store.adNotFinished, 'info');
            return null;
          }
        }
        const r = await afterAdVerified(() => storeApi.claimAd(kind, ref));
        void qc.invalidateQueries({ queryKey: queryKeys.store });
        void qc.invalidateQueries({ queryKey: queryKeys.myState });
        void qc.invalidateQueries({ queryKey: queryKeys.collection });
        return r;
      } catch {
        toast(strings.errors.generic, 'error');
        return null;
      } finally {
        setBusy(false);
      }
    },
    [busy, store?.ad_free, qc, toast, session?.user.id],
  );
  return { run, busy, adFree: !!store?.ad_free };
}
