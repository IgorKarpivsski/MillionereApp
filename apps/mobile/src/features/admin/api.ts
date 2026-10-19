import type { PackSlug, Reward } from '@fm/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { RpcError, rpc } from '@/features/profile/api';

export interface AdminPlayer {
  id: string;
  username: string;
  avatar_id: string;
  level: number;
  friend_code: string | null;
  coins: number;
  gems: number;
}
export interface AdminPromo {
  code: string;
  reward: Reward;
  max_uses: number;
  uses: number;
  expires_at: string;
  active: boolean;
}
export interface AdminRecent {
  grants: { at: string; username: string; reward: Reward; note: string | null }[];
  promos: AdminPromo[];
  players: number;
}
export type GrantReward = { kind: 'coins' | 'gems' | 'tickets'; amount: number } | { kind: 'pack'; pack: PackSlug; amount: number };

const id = <T,>(x: unknown) => x as T;

/** A wrong code comes back as {error} (so the server can count the attempt); surface it as an error. */
function orError<T>(x: unknown): T {
  const e = (x as { error?: string } | null)?.error;
  if (e) throw new RpcError(e === 'rate_limited' ? 'rate_limited' : 'invalid_input', e);
  return x as T;
}

export const adminApi = {
  status: () => rpc('admin_status', undefined, id<{ admin: boolean }>),
  claim: (code: string) => rpc('admin_claim', { p_code: code }, (x) => orError<{ admin: boolean }>(x)),
  find: (q: string) => rpc('admin_find_players', { p_query: q }, id<AdminPlayer[]>),
  grant: (user: string, reward: GrantReward, note: string, request: string) =>
    rpc('admin_grant', { p_user: user, p_reward: reward, p_note: note, p_request: request }, id<{ ok: boolean }>),
  recent: () => rpc('admin_recent', undefined, id<AdminRecent>),
  createPromo: (code: string, reward: GrantReward, maxUses: number, hours: number) =>
    rpc('admin_create_promo', { p_code: code, p_reward: reward, p_max_uses: maxUses, p_hours: hours }, id<{ code: string }>),
  stopPromo: (code: string) => rpc('admin_stop_promo', { p_code: code }, id<{ ok: boolean }>),
  redeem: (code: string) => rpc('redeem_code', { p_code: code }, (x) => orError<{ reward: Reward }>(x)),
};

export function useAdminStatus() {
  const { session } = useAuth();
  return useQuery({ queryKey: ['admin-status'], queryFn: adminApi.status, enabled: !!session, staleTime: 5 * 60_000 });
}
