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
  invalid_state: 'invalid_state',
} as const;
export type RpcErrorCode = keyof typeof RPC_ERRORS;

export function parseRpcError(message: string | undefined): RpcErrorCode | 'unknown' {
  if (!message) return 'unknown';
  const code = Object.keys(RPC_ERRORS).find((k) => message.includes(k));
  return (code as RpcErrorCode | undefined) ?? 'unknown';
}

/* -------------------------------------------------------------------------- */
/* Quiz (classic run). Mirrors supabase/migrations/*_quiz_runs.sql.            */
/* -------------------------------------------------------------------------- */

export const LifelineKindSchema = z.enum(['fifty', 'expert', 'fans', 'var']);
export type LifelineKind = z.infer<typeof LifelineKindSchema>;

export const QuizRunStatusSchema = z.enum(['active', 'won', 'lost', 'cashed_out', 'timed_out', 'abandoned']);
export type QuizRunStatus = z.infer<typeof QuizRunStatusSchema>;

const SlotSchema = z.number().int().min(0).max(3);

export const QuizHintsSchema = z
  .object({
    fifty: z.object({ removed: z.array(SlotSchema) }).optional(),
    expert: z.object({ slot: SlotSchema, confidence: z.enum(['sure', 'think', 'guess']) }).optional(),
    fans: z.object({ percents: z.array(z.number().int()).length(4) }).optional(),
    var: z.object({ armed: z.boolean() }).optional(),
  })
  .passthrough();
export type QuizHints = z.infer<typeof QuizHintsSchema>;

export const QuizQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  category: z.string(),
  category_name: z.string().nullable(),
  difficulty: z.enum(['easy', 'medium', 'hard', 'expert', 'legendary']),
  answers: z.array(z.object({ slot: SlotSchema, text: z.string() })).length(4),
  removed: z.array(SlotSchema),
  wrong_slots: z.array(SlotSchema),
  var_armed: z.boolean(),
  hints: QuizHintsSchema,
  answered: z.boolean(),
  seconds_left: z.number().int().min(0),
});
export type QuizQuestion = z.infer<typeof QuizQuestionSchema>;

export const QuizPayloadSchema = z.object({
  run_id: z.string().uuid(),
  status: QuizRunStatusSchema,
  rung: z.number().int().min(1).max(12),
  correct: z.number().int().min(0).max(12),
  lifelines_used: z.array(LifelineKindSchema),
  question: QuizQuestionSchema.nullable(),
  mode: z.enum(['classic', 'daily']).optional(),
  total: z.number().int().optional(),
});
export type QuizPayload = z.infer<typeof QuizPayloadSchema>;

export const QuizSummarySchema = z.object({
  status: QuizRunStatusSchema,
  correct: z.number().int(),
  coins: z.number().int(),
  prize_points: z.number().int(),
  xp: z.number().int(),
  level: z.number().int(),
  leveled_up: z.boolean(),
  balance: z.number(),
  mode: z.enum(['classic', 'daily']).optional(),
  streak: z.number().int().optional(),
  streak_best: z.number().int().optional(),
});
export type QuizSummary = z.infer<typeof QuizSummarySchema>;

export const QuizAnswerResultSchema = z.discriminatedUnion('result', [
  z.object({
    result: z.literal('correct'),
    correct_slot: SlotSchema,
    explanation: z.string(),
    summary: QuizSummarySchema.nullable(),
  }),
  z.object({
    result: z.enum(['wrong', 'timeout']),
    correct_slot: SlotSchema,
    explanation: z.string(),
    // null in the daily challenge, where a miss doesn't end the run
    summary: QuizSummarySchema.nullable(),
  }),
  z.object({
    result: z.literal('var_overturned'),
    wrong_slot: SlotSchema,
    payload: QuizPayloadSchema,
  }),
]);
export type QuizAnswerResult = z.infer<typeof QuizAnswerResultSchema>;

export const QuizLifelineResultSchema = z.object({
  kind: LifelineKindSchema,
  result: z.record(z.unknown()),
});

export const ReportReasonSchema = z.enum(['wrong_answer', 'typo', 'unclear', 'other']);
export type ReportReason = z.infer<typeof ReportReasonSchema>;

export const QuizCashOutResultSchema = z.object({ summary: QuizSummarySchema });

export const DailyStatusSchema = z.object({
  day: z.string(),
  state: z.enum(['open', 'in_progress', 'done']),
  correct: z.number().int().nullable(),
  coins: z.number().int().nullable(),
  streak: z.number().int(),
  streak_best: z.number().int(),
  seconds_to_reset: z.number().int(),
});
export type DailyStatus = z.infer<typeof DailyStatusSchema>;

export const LeaderboardSchema = z.object({
  week_start: z.string(),
  rows: z.array(
    z.object({
      rank: z.number().int(),
      username: z.string(),
      avatar_id: z.string(),
      level: z.number().int(),
      points: z.number(),
      me: z.boolean(),
    }),
  ),
  me: z.object({ rank: z.number().int().nullable(), points: z.number(), games: z.number().int() }),
});
export type Leaderboard = z.infer<typeof LeaderboardSchema>;
