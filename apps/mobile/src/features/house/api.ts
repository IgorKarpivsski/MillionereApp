import { HomeStateSchema, type HomeItem, type HomeState } from '@fm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';

const parse = (x: unknown) => HomeStateSchema.parse(x);

/** The sloth's treehouse. The server checks ownership and charges the wallet. */
export const houseApi = {
  state: (): Promise<HomeState> => rpc('home_state', undefined, parse),
  buy: (item: string): Promise<HomeState> => rpc('home_buy', { p_item: item }, parse),
  wear: (hat: string | null): Promise<HomeState> => rpc('home_wear', { p_hat: hat }, parse),
};

export function useHouse() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.house, queryFn: houseApi.state, enabled: !!session, staleTime: 60_000 });
}

export function useHouseBuy() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (item: string) => houseApi.buy(item),
    onSuccess: (st) => {
      qc.setQueryData(queryKeys.house, st);
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
      if (st.just_completed) void qc.invalidateQueries({ queryKey: queryKeys.collection });
    },
  });
}

export function useHatWear() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (hat: string | null) => houseApi.wear(hat),
    onSuccess: (st) => qc.setQueryData(queryKeys.house, st),
  });
}

/** The next room item to aim for: the cheapest one not owned yet. */
export function nextHouseGoal(st: HomeState | undefined): HomeItem | null {
  if (!st) return null;
  const left = st.items.filter((i) => !st.owned.includes(i.id));
  if (left.length === 0) return null;
  return [...left].sort((a, b) => a.price - b.price)[0]!;
}
