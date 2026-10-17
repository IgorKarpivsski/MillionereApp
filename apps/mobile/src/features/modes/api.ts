import {
  BlitzInfoSchema,
  BlitzPayloadSchema,
  FamilyStateSchema,
  MatchRoomSchema,
  type BlitzPayload,
  type FamilyState,
} from '@fm/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';

export const blitzApi = {
  info: () => rpc('blitz_info', undefined, (x) => BlitzInfoSchema.parse(x)),
  start: (): Promise<BlitzPayload> => rpc('blitz_start', undefined, (x) => BlitzPayloadSchema.parse(x)),
  answer: (run: string, slot: number): Promise<BlitzPayload> =>
    rpc('blitz_answer', { p_run: run, p_slot: slot }, (x) => BlitzPayloadSchema.parse(x)),
  finish: (run: string): Promise<BlitzPayload> => rpc('blitz_finish', { p_run: run }, (x) => BlitzPayloadSchema.parse(x)),
};

export function useBlitzInfo() {
  const { session } = useAuth();
  return useQuery({ queryKey: ['blitz-info'], queryFn: blitzApi.info, enabled: !!session, staleTime: 60_000 });
}

export const familyApi = {
  create: (world: string, total: number) => rpc('family_create', { p_world: world, p_total: total }, (x) => MatchRoomSchema.parse(x)),
  join: (code: string) => rpc('family_join', { p_code: code }, (x) => MatchRoomSchema.parse(x)),
  configure: (room: string, world: string, total: number) =>
    rpc('family_configure', { p_room: room, p_world: world, p_total: total }, () => undefined),
  start: (room: string) => rpc('family_start', { p_room: room }, () => undefined),
  state: (room: string): Promise<FamilyState> => rpc('family_state', { p_room: room }, (x) => FamilyStateSchema.parse(x)),
  answer: (room: string, idx: number, slot: number) =>
    rpc('family_answer', { p_room: room, p_idx: idx, p_slot: slot }, () => undefined),
  leave: (room: string) => rpc('family_leave', { p_room: room }, () => undefined),
};
