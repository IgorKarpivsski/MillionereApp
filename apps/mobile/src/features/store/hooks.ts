import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { useToast } from '@/design-system/components';
import { useAuth } from '@/features/auth/AuthProvider';
import { queryKeys } from '@/lib/queryClient';
import { strings } from '@/lib/i18n';
import { showRewardedAd } from './ads';
import { storeApi } from './api';

export function useStore() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.store, queryFn: storeApi.state, enabled: !!session });
}

/**
 * "Watch and get a reward". Players with no-ads / VIP get the reward straight away.
 * Returns the server's reward payload, or null if nothing was granted.
 */
export function useAdReward() {
  const { data: store } = useStore();
  const qc = useQueryClient();
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const run = useCallback(
    async (kind: 'double_run' | 'free_pack' | 'vip_daily', ref?: string) => {
      if (busy) return null;
      setBusy(true);
      try {
        if (kind !== 'vip_daily' && !store?.ad_free) {
          const ok = await showRewardedAd();
          if (!ok) {
            toast(strings.store.adNotFinished, 'info');
            return null;
          }
        }
        const r = await storeApi.claimAd(kind, ref);
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
    [busy, store?.ad_free, qc, toast],
  );
  return { run, busy, adFree: !!store?.ad_free };
}
