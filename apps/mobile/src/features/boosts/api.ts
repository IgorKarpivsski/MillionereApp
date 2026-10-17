import {
  BoostBuyResultSchema,
  BoostsStateSchema,
  CallCandidatesSchema,
  CallStateSchema,
  PresencePingSchema,
  SessionPayloadSchema,
  type BoostKind,
  type BoostsState,
  type CallCandidate,
  type CallState,
  type SessionPayload,
} from '@fm/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';

const parsePayload = (x: unknown) => SessionPayloadSchema.parse(x);

/** Boosts, hints, the heart continue and phone-a-friend. The server checks and charges everything. */
export const boostsApi = {
  state: (): Promise<BoostsState> => rpc('boosts_state', undefined, (x) => BoostsStateSchema.parse(x)),
  buy: (boost: BoostKind, request: string): Promise<{ counts: Record<string, number> }> =>
    rpc('boost_buy', { p_boost: boost, p_request: request }, (x) => BoostBuyResultSchema.parse(x)),
  use: (runId: string, boost: BoostKind): Promise<SessionPayload> => rpc('session_boost', { p_run: runId, p_boost: boost }, parsePayload),
  hint: (runId: string, pay: 'coins' | 'ad'): Promise<SessionPayload> => rpc('session_hint', { p_run: runId, p_pay: pay }, parsePayload),
  continueRun: (runId: string): Promise<SessionPayload> => rpc('session_continue', { p_run: runId }, parsePayload),
  candidates: (): Promise<CallCandidate[]> => rpc('call_candidates', undefined, (x) => CallCandidatesSchema.parse(x ?? [])),
  call: (runId: string, friend: string): Promise<SessionPayload> =>
    rpc('session_call_friend', { p_run: runId, p_friend: friend }, parsePayload),
  callState: (callId: string): Promise<CallState> => rpc('friend_call_state', { p_call: callId }, (x) => CallStateSchema.parse(x)),
  ping: () => rpc('presence_ping', undefined, (x) => PresencePingSchema.parse(x)),
  answerCall: (callId: string, slot: number): Promise<void> => rpc('friend_call_answer', { p_call: callId, p_slot: slot }, () => undefined),
};

export function useBoosts() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.boosts, queryFn: boostsApi.state, enabled: !!session, staleTime: 60_000 });
}
