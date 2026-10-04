import { MatchRoomSchema, MatchStateSchema, type MatchState } from '@fm/shared';
import { rpc } from '@/features/profile/api';

export const matchApi = {
  create: () => rpc('match_create', undefined, (x) => MatchRoomSchema.parse(x)),
  join: (code: string) => rpc('match_join', { p_code: code }, (x) => MatchRoomSchema.parse(x)),
  state: (room: string): Promise<MatchState> => rpc('match_state', { p_room: room }, (x) => MatchStateSchema.parse(x)),
  answer: (room: string, idx: number, slot: number) =>
    rpc('match_answer', { p_room: room, p_idx: idx, p_slot: slot }, () => undefined),
};
