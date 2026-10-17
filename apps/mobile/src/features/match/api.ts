import { MatchFindSchema, MatchRoomSchema, MatchStateSchema, type MatchState } from '@fm/shared';
import { rpc } from '@/features/profile/api';

export const matchApi = {
  create: () => rpc('match_create', undefined, (x) => MatchRoomSchema.parse(x)),
  join: (code: string) => rpc('match_join', { p_code: code }, (x) => MatchRoomSchema.parse(x)),
  state: (room: string): Promise<MatchState> => rpc('match_state', { p_room: room }, (x) => MatchStateSchema.parse(x)),
  answer: (room: string, idx: number, slot: number) =>
    rpc('match_answer', { p_room: room, p_idx: idx, p_slot: slot }, () => undefined),
  /** random opponent: someone searching right now, or start searching */
  find: () => rpc('match_find', undefined, (x) => MatchFindSchema.parse(x)),
  /** nobody came: play the sloth */
  bot: (room: string) => rpc('match_bot', { p_room: room }, (x) => MatchFindSchema.parse(x)),
  cancel: (room: string) => rpc('match_cancel', { p_room: room }, () => undefined),
};
