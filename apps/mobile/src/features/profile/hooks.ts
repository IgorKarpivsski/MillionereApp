import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import type { MyState, UpdateProfileInput } from '@fm/shared';
import { identify, track } from '@/lib/analytics';
import { queryKeys } from '@/lib/queryClient';
import { useSettingsStore } from '@/features/settings/store';
import { useAuth } from '@/features/auth/AuthProvider';
import { claimWelcomeBonus, getMyState, updateProfile } from './api';

export function useMyState() {
  const { session } = useAuth();
  const hydrate = useSettingsStore((s) => s.hydrateFromServer);
  const query = useQuery({
    queryKey: queryKeys.myState,
    queryFn: getMyState,
    enabled: !!session,
  });

  useEffect(() => {
    const s = query.data;
    if (!s) return;
    hydrate(s.settings);
    identify(s.profile.id, { is_guest: s.profile.is_guest, level: s.profile.level });
  }, [query.data, hydrate]);

  return query;
}

export function useUpdateProfile() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (input: UpdateProfileInput) => updateProfile(input),
    onSuccess: (state: MyState) => qc.setQueryData(queryKeys.myState, state),
  });
}

export function useClaimWelcomeBonus() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: claimWelcomeBonus,
    onSuccess: ({ amount, balance }) => {
      // Show the server's balance, then refetch the full state.
      qc.setQueryData<MyState>(queryKeys.myState, (prev) =>
        prev ? { ...prev, wallet: { ...prev.wallet, coins: balance }, welcome_bonus_claimed: true } : prev,
      );
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
      track('welcome_bonus_claimed', { coins: amount });
    },
  });
}
