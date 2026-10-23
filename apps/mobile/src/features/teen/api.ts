import {
  AdminSubmissionsSchema,
  BoardSchema,
  EventStateSchema,
  FlairSchema,
  FriendProfileSchema,
  FriendsBoardSchema,
  MatchRoomSchema,
  MissionsStateSchema,
  MistakesSchema,
  ReactionsSchema,
  SubmissionsSchema,
  type MissionsState,
} from '@fm/shared';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { useRefreshEconomy } from '@/features/engage/hooks';
import { rpc } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';

export const teenKeys = {
  missions: ['missions'] as const,
  mistakes: ['mistakes'] as const,
  flair: ['flair'] as const,
  friendsBoard: ['friends-board'] as const,
  event: ['event'] as const,
  submissions: ['my-submissions'] as const,
  adminSubmissions: ['admin-submissions'] as const,
  friend: (id: string) => ['friend-profile', id] as const,
};

export const teenApi = {
  missions: (): Promise<MissionsState> => rpc('missions_state', undefined, (x) => MissionsStateSchema.parse(x)),
  claimMission: (key: string): Promise<MissionsState> =>
    rpc('mission_claim', { p_key: key }, (x) => MissionsStateSchema.parse(x)),
  buyFreeze: () => rpc('streak_freeze_buy', undefined, (x) => x as { freezes: number }),
  mistakes: () => rpc('my_mistakes', { p_limit: 40 }, (x) => MistakesSchema.parse(x)),
  react: (kind: 'match' | 'family', room: string, emoji: string) =>
    rpc('send_reaction', { p_kind: kind, p_room: room, p_emoji: emoji }, () => undefined),
  reactions: (kind: 'match' | 'family', room: string, after: number) =>
    rpc('room_reactions', { p_kind: kind, p_room: room, p_after: after }, (x) => ReactionsSchema.parse(x)),
  flair: () => rpc('my_flair', undefined, (x) => FlairSchema.parse(x)),
  setFlair: (frame: string | null, title: string | null) => rpc('set_flair', { p_frame: frame, p_title: title }, () => undefined),
  setNameColor: (color: string | null) => rpc('set_name_color', { p_color: color }, () => undefined),
  friend: (id: string) => rpc('friend_profile', { p_user: id }, (x) => FriendProfileSchema.parse(x)),
  friendsBoard: () => rpc('leaderboard_friends', undefined, (x) => FriendsBoardSchema.parse(x)),
  challenge: (user: string) => rpc('match_challenge', { p_user: user }, (x) => MatchRoomSchema.parse(x)),
  rematch: (room: string) => rpc('match_rematch', { p_room: room }, (x) => MatchRoomSchema.parse(x)),
  answerInvite: (id: number, accept: boolean) =>
    rpc('match_invite_answer', { p_invite: id, p_accept: accept }, (x) => MatchRoomSchema.safeParse(x).data ?? null),
  event: () => rpc('event_state', undefined, (x) => EventStateSchema.parse(x)),
  board: (kind: 'month' | 'all') => rpc('leaderboard_board', { p_kind: kind }, (x) => BoardSchema.parse(x)),
  submit: (world: string, text: string, correct: string, wrongs: string[]) =>
    rpc('submit_question', { p_world: world, p_text: text, p_correct: correct, p_wrongs: wrongs }, () => undefined),
  mySubmissions: () => rpc('my_submissions', undefined, (x) => SubmissionsSchema.parse(x)),
  adminSubmissions: () => rpc('admin_submissions', undefined, (x) => AdminSubmissionsSchema.parse(x)),
  review: (id: number, approve: boolean) => rpc('admin_review_submission', { p_id: id, p_approve: approve }, () => undefined),
};

function useAuthedQuery<T>(key: readonly unknown[], fn: () => Promise<T>, staleTime = 30_000) {
  const { session } = useAuth();
  return useQuery({ queryKey: key, queryFn: fn, enabled: !!session, staleTime });
}

export const useMissions = () => useAuthedQuery(teenKeys.missions, teenApi.missions, 20_000);
export const useMistakes = () => useAuthedQuery(teenKeys.mistakes, teenApi.mistakes);
export const useFlair = () => useAuthedQuery(teenKeys.flair, teenApi.flair);
export const useFriendsBoard = () => useAuthedQuery(teenKeys.friendsBoard, teenApi.friendsBoard);
export const useBoard = (kind: 'month' | 'all') => useAuthedQuery(['board', kind], () => teenApi.board(kind), 60_000);
export const useEvent = () => useAuthedQuery(teenKeys.event, teenApi.event, 60_000);
export const useMySubmissions = () => useAuthedQuery(teenKeys.submissions, teenApi.mySubmissions);
export const useFriendProfile = (id: string) => useAuthedQuery(teenKeys.friend(id), () => teenApi.friend(id));

export function useClaimMission() {
  const qc = useQueryClient();
  const refresh = useRefreshEconomy();
  return useMutation({
    mutationFn: teenApi.claimMission,
    onSuccess: (s) => {
      qc.setQueryData(teenKeys.missions, s);
      refresh();
    },
  });
}

export function useBuyFreeze() {
  const qc = useQueryClient();
  const refresh = useRefreshEconomy();
  return useMutation({
    mutationFn: teenApi.buyFreeze,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.daily });
      refresh();
    },
  });
}

export function useSetNameColor() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (color: string | null) => teenApi.setNameColor(color),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teenKeys.flair });
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
    },
  });
}

export function useSetFlair() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (v: { frame: string | null; title: string | null }) => teenApi.setFlair(v.frame, v.title),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: teenKeys.flair });
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
    },
  });
}
