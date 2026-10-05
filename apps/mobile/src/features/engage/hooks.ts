import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { queryKeys } from '@/lib/queryClient';
import { engageApi } from './api';

export function useEnergy() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.energy, queryFn: engageApi.energy, enabled: !!session, refetchInterval: 60_000 });
}
export function useWheel() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.wheel, queryFn: engageApi.wheel, enabled: !!session });
}
export function useDeals() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.deals, queryFn: engageApi.deals, enabled: !!session });
}
export function usePass() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.pass, queryFn: engageApi.pass, enabled: !!session });
}

/** Rewards can touch the wallet, packs, tickets and the pass — refresh them all. */
export function useRefreshEconomy() {
  const qc = useQueryClient();
  return () => {
    for (const k of [queryKeys.myState, queryKeys.collection, queryKeys.energy, queryKeys.wheel, queryKeys.deals, queryKeys.pass, queryKeys.store]) {
      void qc.invalidateQueries({ queryKey: k });
    }
  };
}

export function useRefill() {
  const qc = useQueryClient();
  const refresh = useRefreshEconomy();
  return useMutation({
    mutationFn: engageApi.refill,
    onSuccess: (s) => {
      qc.setQueryData(queryKeys.energy, s);
      refresh();
    },
  });
}

export function useBuyDeal() {
  const refresh = useRefreshEconomy();
  return useMutation({ mutationFn: (v: { deal: string; window: number }) => engageApi.buyDeal(v.deal, v.window), onSuccess: refresh });
}

export function useClaimTier() {
  const refresh = useRefreshEconomy();
  return useMutation({ mutationFn: (v: { tier: number; track: 'free' | 'premium' }) => engageApi.claimTier(v.tier, v.track), onSuccess: refresh });
}

export function useBuyPremium() {
  const refresh = useRefreshEconomy();
  return useMutation({ mutationFn: engageApi.buyPremium, onSuccess: refresh });
}

/** "12:34" until a timestamp, ticking every second; null once it passes. */
export function useCountdownTo(iso: string | null | undefined): string | null {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!iso) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [iso]);
  if (!iso) return null;
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const ss = s % 60;
  const two = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${two(m)}:${two(ss)}` : `${two(m)}:${two(ss)}`;
}
