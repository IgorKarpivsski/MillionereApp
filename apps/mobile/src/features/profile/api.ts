import {
  MyStateSchema,
  UpdateProfileInputSchema,
  UpdateSettingsInputSchema,
  parseRpcError,
  type MyState,
  type RpcErrorCode,
  type UpdateProfileInput,
  type UpdateSettingsInput,
} from '@fm/shared';
import { supabase } from '@/lib/supabase';

export class RpcError extends Error {
  constructor(
    public readonly code: RpcErrorCode | 'unknown' | 'network',
    message: string,
  ) {
    super(message);
  }
}

export async function rpc<T>(fn: string, args: Record<string, unknown> | undefined, parse: (x: unknown) => T): Promise<T> {
  const { data, error } = await supabase.rpc(fn, args);
  if (error) {
    const network = /fetch|network/i.test(error.message);
    throw new RpcError(network ? 'network' : parseRpcError(error.message), error.message);
  }
  return parse(data);
}

/** Server responses are validated: a schema drift fails loudly instead of rendering garbage. */
const parseState = (x: unknown): MyState => MyStateSchema.parse(x);

export function getMyState(): Promise<MyState> {
  return rpc('get_my_state', undefined, parseState);
}

export function updateProfile(input: UpdateProfileInput): Promise<MyState> {
  const v = UpdateProfileInputSchema.parse(input);
  return rpc(
    'update_my_profile',
    {
      p_username: v.username ?? null,
      p_avatar_id: v.avatar_id ?? null,
      p_fav_leagues: v.fav_leagues ?? null,
      p_fav_teams: v.fav_teams ?? null,
    },
    parseState,
  );
}

export function updateSettings(patch: UpdateSettingsInput): Promise<MyState> {
  return rpc('update_my_settings', { p_patch: UpdateSettingsInputSchema.parse(patch) }, parseState);
}

/** The amount is decided by the server (app_config), never sent by the client. */
export function claimWelcomeBonus(): Promise<{ amount: number; balance: number }> {
  return rpc('claim_welcome_bonus', undefined, (x) => {
    const o = x as { amount?: unknown; balance?: unknown };
    if (typeof o?.amount !== 'number' || typeof o?.balance !== 'number') {
      throw new RpcError('unknown', 'bad claim_welcome_bonus response');
    }
    return { amount: o.amount, balance: o.balance };
  });
}
