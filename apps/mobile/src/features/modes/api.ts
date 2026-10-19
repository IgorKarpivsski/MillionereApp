import {
  BlitzInfoSchema,
  BlitzPayloadSchema,
  FamilyStateSchema,
  MatchRoomSchema,
  SurvivalInfoSchema,
  SurvivalPayloadSchema,
  TfInfoSchema,
  TfPayloadSchema,
  type BlitzPayload,
  type SurvivalPayload,
  type TfPayload,
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
  invite: (room: string, friend: string) => rpc('family_invite', { p_room: room, p_friend: friend }, () => undefined),
  again: (room: string) => rpc('family_again', { p_room: room }, (x) => MatchRoomSchema.parse(x)),
  answerInvite: (id: number, accept: boolean) =>
    rpc('family_invite_answer', { p_invite: id, p_accept: accept }, (x) => MatchRoomSchema.safeParse(x).data ?? null),
};

export const survivalApi = {
  info: () => rpc('survival_info', undefined, (x) => SurvivalInfoSchema.parse(x)),
  start: (): Promise<SurvivalPayload> => rpc('survival_start', undefined, (x) => SurvivalPayloadSchema.parse(x)),
  answer: (run: string, slot: number): Promise<SurvivalPayload> =>
    rpc('survival_answer', { p_run: run, p_slot: slot }, (x) => SurvivalPayloadSchema.parse(x)),
  revive: (run: string): Promise<SurvivalPayload> => rpc('survival_revive', { p_run: run }, (x) => SurvivalPayloadSchema.parse(x)),
  finish: (run: string): Promise<SurvivalPayload> => rpc('survival_finish', { p_run: run }, (x) => SurvivalPayloadSchema.parse(x)),
};

export function useSurvivalInfo() {
  const { session } = useAuth();
  return useQuery({ queryKey: ['survival-info'], queryFn: survivalApi.info, enabled: !!session, staleTime: 60_000 });
}

export const tfApi = {
  info: () => rpc('tf_info', undefined, (x) => TfInfoSchema.parse(x)),
  start: (): Promise<TfPayload> => rpc('tf_start', undefined, (x) => TfPayloadSchema.parse(x)),
  answer: (run: string, isTrue: boolean): Promise<TfPayload> =>
    rpc('tf_answer', { p_run: run, p_true: isTrue }, (x) => TfPayloadSchema.parse(x)),
  finish: (run: string): Promise<TfPayload> => rpc('tf_finish', { p_run: run }, (x) => TfPayloadSchema.parse(x)),
};

export function useTfInfo() {
  const { session } = useAuth();
  return useQuery({ queryKey: ['tf-info'], queryFn: tfApi.info, enabled: !!session, staleTime: 60_000 });
}
