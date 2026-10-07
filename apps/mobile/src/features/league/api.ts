import { LeagueStateSchema, type LeagueState } from '@fm/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';

export const leagueApi = {
  state: (): Promise<LeagueState> => rpc('league_state', undefined, (x) => LeagueStateSchema.parse(x)),
};

export function useLeague() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.league, queryFn: leagueApi.state, enabled: !!session, staleTime: 60_000 });
}

/** Coins/gems for a final rank in a tier (display only; the server pays). */
export function leagueReward(s: Pick<LeagueState, 'rewards' | 'tier_bonus' | 'tier'>, rank: number) {
  const r = [...s.rewards].sort((a, b) => a.upto - b.upto).find((x) => x.upto >= rank);
  if (!r) return null;
  return { coins: Math.round(r.coins * (1 + s.tier * s.tier_bonus)), gems: r.gems };
}
