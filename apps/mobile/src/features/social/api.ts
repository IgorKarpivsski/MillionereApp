import {
  ChatHistorySchema,
  FriendDupesSchema,
  FriendsStateSchema,
  type ChatHistory,
  type ChatReportReason,
  type FriendDupe,
  type FriendsState,
} from '@fm/shared';
import { rpc } from '@/features/profile/api';

export const socialApi = {
  state: (): Promise<FriendsState> => rpc('friends_state', undefined, (x) => FriendsStateSchema.parse(x)),
  request: (code: string) => rpc('friend_request', { p_code: code }, (x) => x as { status: 'pending' | 'accepted' }),
  respond: (user: string, accept: boolean) => rpc('friend_respond', { p_user: user, p_accept: accept }, () => null),
  remove: (user: string) => rpc('friend_remove', { p_user: user }, () => null),
  block: (user: string) => rpc('block_user', { p_user: user }, () => null),
  unblock: (user: string) => rpc('unblock_user', { p_user: user }, () => null),
  history: (peer: string): Promise<ChatHistory> => rpc('chat_history', { p_with: peer }, (x) => ChatHistorySchema.parse(x)),
  send: (peer: string, body: string) =>
    rpc('chat_send', { p_to: peer, p_body: body }, (x) => x as { id: number; body: string; masked: boolean }),
  report: (message: number, reason: ChatReportReason) => rpc('chat_report', { p_message: message, p_reason: reason }, () => null),
  dupes: (peer: string): Promise<FriendDupe[]> => rpc('friend_dupes', { p_user: peer }, (x) => FriendDupesSchema.parse(x)),
  offer: (peer: string, give: string, want: string | null) =>
    rpc('trade_offer', { p_to: peer, p_give: give, p_want: want }, (x) => x as { id: string }),
  respondTrade: (offer: string, accept: boolean) =>
    rpc('trade_respond', { p_offer: offer, p_accept: accept }, (x) => x as { status: string }),
};
