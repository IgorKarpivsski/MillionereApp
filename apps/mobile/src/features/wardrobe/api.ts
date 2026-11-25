import { WardrobeStateSchema, type WardrobeState } from '@fm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';

const parse = (x: unknown) => WardrobeStateSchema.parse(x);

/** The sloth's wardrobe. The server checks ownership and charges the wallet. */
export const wardrobeApi = {
  state: (): Promise<WardrobeState> => rpc('wardrobe_state', undefined, parse),
  buy: (item: string): Promise<WardrobeState> => rpc('wardrobe_buy', { p_item: item }, parse),
  wear: (slot: string, item: string | null): Promise<WardrobeState> => rpc('wardrobe_wear', { p_slot: slot, p_item: item }, parse),
};

export function useWardrobe() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.wardrobe, queryFn: wardrobeApi.state, enabled: !!session, staleTime: 60_000 });
}

export function useWardrobeBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: string) => wardrobeApi.buy(item),
    onSuccess: (st) => {
      qc.setQueryData(queryKeys.wardrobe, st);
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
    },
  });
}

export function useWardrobeWear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ slot, item }: { slot: string; item: string | null }) => wardrobeApi.wear(slot, item),
    onMutate: async ({ slot, item }) => {
      // dress up instantly; the server answer replaces it
      const prev = qc.getQueryData<WardrobeState>(queryKeys.wardrobe);
      if (prev) {
        const outfit = { ...prev.outfit };
        if (item) outfit[slot] = item;
        else delete outfit[slot];
        qc.setQueryData(queryKeys.wardrobe, { ...prev, outfit });
      }
      return { prev };
    },
    onError: (_e, _v, ctx) => ctx?.prev && qc.setQueryData(queryKeys.wardrobe, ctx.prev),
    onSuccess: (st) => qc.setQueryData(queryKeys.wardrobe, st),
  });
}
