import { z } from 'zod';

/**
 * Shapes returned by the Phase 1 RPCs. Kept in sync with
 * supabase/migrations/*_identity_and_ledger.sql. Once the Supabase CLI is set
 * up, `pnpm --filter @fm/shared gen:types` produces database.generated.ts and
 * these remain as runtime validators for RPC responses.
 */

export const CurrencySchema = z.enum(['coins', 'gems', 'dust']);
export type Currency = z.infer<typeof CurrencySchema>;

/** Same rule as the SQL CHECK: 3–20 chars, Hebrew/Latin letters, digits, _ . */
export const USERNAME_REGEX = /^[A-Za-z0-9_֐-׿]{3,20}$/;

export const ProfileSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  avatar_id: z.string(),
  country: z.string().length(2).nullable(),
  level: z.number().int().min(1),
  xp: z.number().int().min(0),
  fav_leagues: z.array(z.string()),
  fav_teams: z.array(z.string()),
  is_guest: z.boolean(),
  created_at: z.string(),
});
export type Profile = z.infer<typeof ProfileSchema>;

export const WalletSchema = z.object({
  coins: z.number().int().min(0),
  gems: z.number().int().min(0),
  dust: z.number().int().min(0),
});
export type Wallet = z.infer<typeof WalletSchema>;

export const SettingsSchema = z.object({
  locale: z.string(),
  sound: z.boolean(),
  music: z.boolean(),
  haptics: z.boolean(),
  reduced_motion: z.boolean(),
  notif_prefs: z.record(z.string(), z.boolean()),
});
export type Settings = z.infer<typeof SettingsSchema>;

export const MyStateSchema = z.object({
  profile: ProfileSchema,
  wallet: WalletSchema,
  settings: SettingsSchema,
  welcome_bonus_claimed: z.boolean(),
});
export type MyState = z.infer<typeof MyStateSchema>;

export const UpdateProfileInputSchema = z.object({
  username: z.string().regex(USERNAME_REGEX).optional(),
  avatar_id: z.string().regex(/^avatar_\d{2}$/).optional(),
  fav_leagues: z.array(z.string().max(40)).max(10).optional(),
  fav_teams: z.array(z.string().max(60)).max(10).optional(),
});
export type UpdateProfileInput = z.infer<typeof UpdateProfileInputSchema>;

export const UpdateSettingsInputSchema = SettingsSchema.partial();
export type UpdateSettingsInput = z.infer<typeof UpdateSettingsInputSchema>;

/** Error codes raised by SQL functions (RAISE ... USING ERRCODE / message). */
export const RPC_ERRORS = {
  insufficient_funds: 'insufficient_funds',
  idempotency_conflict: 'idempotency_conflict',
  rate_limited: 'rate_limited',
  username_taken: 'username_taken',
  invalid_input: 'invalid_input',
  not_authenticated: 'not_authenticated',
} as const;
export type RpcErrorCode = keyof typeof RPC_ERRORS;

export function parseRpcError(message: string | undefined): RpcErrorCode | 'unknown' {
  if (!message) return 'unknown';
  const code = Object.keys(RPC_ERRORS).find((k) => message.includes(k));
  return (code as RpcErrorCode | undefined) ?? 'unknown';
}
