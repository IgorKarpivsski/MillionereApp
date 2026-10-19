import { MarketStateSchema, type MarketState } from '@fm/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';

export const marketKey = ['market'] as const;
const parse = (x: unknown) => MarketStateSchema.parse(x);

export const marketApi = {
  state: (): Promise<MarketState> => rpc('market_state', undefined, parse),
  create: (give: string, want: string) => rpc('market_create', { p_give: give, p_want: want }, parse),
  cancel: (id: number) => rpc('market_cancel', { p_id: id }, parse),
  take: (id: number) => rpc('market_take', { p_id: id }, parse),
  seen: () => rpc('market_seen', undefined, () => undefined),
};

export function useMarket() {
  const { session } = useAuth();
  return useQuery({ queryKey: marketKey, queryFn: marketApi.state, enabled: !!session, staleTime: 20_000 });
}

export function useSetMarket() {
  const qc = useQueryClient();
  return (s: MarketState) => qc.setQueryData(marketKey, s);
}
