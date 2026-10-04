import { CollectionStateSchema, OpenPackResultSchema, type CollectionState, type OpenPackResult, type PackSlug } from '@fm/shared';
import { rpc } from '@/features/profile/api';

/** RFC4122-ish v4 id for idempotent pack opens (retries return the same result). */
export function requestId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = (Math.random() * 16) | 0;
    return (c === 'x' ? r : (r & 0x3) | 0x8).toString(16);
  });
}

export const collectionApi = {
  state: (): Promise<CollectionState> => rpc('collection_state', undefined, (x) => CollectionStateSchema.parse(x)),
  open: (pack: PackSlug, pay: 'token' | 'coins' | 'gems', id: string): Promise<OpenPackResult> =>
    rpc('open_pack', { p_pack: pack, p_pay: pay, p_request: id }, (x) => OpenPackResultSchema.parse(x)),
  craft: (item: string) => rpc('craft_item', { p_item: item }, (x) => x),
  claim: (album: string) => rpc('claim_album', { p_album: album }, (x) => x),
};
