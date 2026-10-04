import { StoreStateSchema, type StoreState } from '@fm/shared';
import { rpc } from '@/features/profile/api';
import { supabase } from '@/lib/supabase';

export const storeApi = {
  state: (): Promise<StoreState> => rpc('store_state', undefined, (x) => StoreStateSchema.parse(x)),
  claimAd: (kind: 'double_run' | 'free_pack' | 'vip_daily', ref?: string) =>
    rpc('claim_ad_reward', { p_kind: kind, p_ref: ref ?? null }, (x) => x as Record<string, unknown>),
  /** Server-side verification with Google Play; grants only if Google confirms. */
  verify: async (sku: string, purchaseToken: string, type: 'in-app' | 'subs') => {
    const { data, error } = await supabase.functions.invoke('iap-verify', { body: { sku, purchaseToken, type } });
    if (error) throw error;
    return data as { granted?: boolean; duplicate?: boolean };
  },
};
