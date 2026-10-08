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
  extended_time: z.boolean().default(false),
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
  avatar_id: z.string().regex(/^(avatar_\d{2}|av1_[0-9a-z]{12})$/).optional(),
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

/** Picture questions: where to drop the pin on a bundled base map (see ./maps). */
export const QuestionMapImageSchema = z.object({
  kind: z.literal('map'),
  map: z.enum(['israel', 'europe']),
  lon: z.number(),
  lat: z.number(),
});
/** A Wikimedia Commons photo, always shown with its credit line. */
export const QuestionPhotoSchema = z.object({
  kind: z.literal('photo'),
  url: z.string().url(),
  credit: z.string(),
  license: z.string().optional(),
  page: z.string().optional(),
  fit: z.enum(['cover', 'contain']).optional(),
  w: z.number().optional(),
  h: z.number().optional(),
});
export const QuestionImageSchema = z.discriminatedUnion('kind', [QuestionMapImageSchema, QuestionPhotoSchema]);
export type QuestionImage = z.infer<typeof QuestionImageSchema>;

export const QuizQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  image: QuestionImageSchema.nullable().optional(),
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

/* -------------------------------------------------------------------------- */
/* Knowledge worlds + sessions — mirrors *_knowledge_worlds.sql               */
/* -------------------------------------------------------------------------- */
export const WorldConfigSchema = z.object({
  slug: z.string(),
  name: z.string(),
  icon: z.string(),
  color: z.string(),
  levels: z.number().int(),
  active: z.boolean().optional(),
});
export type WorldConfig = z.infer<typeof WorldConfigSchema>;
export const WorldsConfigSchema = z.array(WorldConfigSchema);

export const WorldsStateSchema = z.object({
  worlds: z.array(
    z.object({
      slug: z.string(),
      unlocked: z.number().int(),
      stars: z.record(z.number().int()),
      total_stars: z.number().int(),
    }),
  ),
  total_stars: z.number().int(),
  active_run: z.object({ run_id: z.string().uuid(), world: z.string(), level: z.number().int() }).nullable(),
});
export type WorldsState = z.infer<typeof WorldsStateSchema>;

export const SessionPayloadSchema = z.object({
  run_id: z.string().uuid(),
  status: QuizRunStatusSchema,
  rung: z.number().int().min(1).max(12),
  correct: z.number().int().min(0).max(12),
  lifelines_used: z.array(z.string()),
  question: QuizQuestionSchema.nullable(),
  mode: z.literal('session'),
  world: z.string(),
  level: z.number().int(),
  score: z.number().int(),
  total: z.number().int(),
  question_world: z.string().nullable(),
});
export type SessionPayload = z.infer<typeof SessionPayloadSchema>;

export const SessionSummarySchema = z.object({
  mode: z.literal('session'),
  status: z.enum(['won', 'lost']),
  world: z.string(),
  level: z.number().int(),
  stars: z.number().int(),
  prev_stars: z.number().int(),
  correct: z.number().int(),
  total: z.number().int(),
  coins: z.number().int(),
  prize_points: z.number().int(),
  xp: z.number().int(),
  player_level: z.number().int(),
  leveled_up: z.boolean(),
  balance: z.number(),
  chest: z.enum(['bronze', 'silver', 'gold', 'epic', 'legendary']).nullable(),
  first_clear: z.boolean(),
  unlocked: z.number().int().nullable(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SessionAnswerSchema = z.object({
  result: z.enum(['correct', 'wrong', 'timeout']),
  correct_slot: SlotSchema,
  explanation: z.string(),
  points: z.number().int(),
  score: z.number().int(),
  correct_count: z.number().int(),
  summary: SessionSummarySchema.nullable(),
});
export type SessionAnswer = z.infer<typeof SessionAnswerSchema>;

export * from './legendArt';
export * from './maps';

/* -------------------------------------------------------------------------- */
/* Album ("אגדות") — mirrors supabase/migrations/*_collection.sql             */
/* -------------------------------------------------------------------------- */
export const RaritySchema = z.enum(['common', 'uncommon', 'rare', 'epic', 'legendary', 'iconic']);
export const PackSlugSchema = z.enum(['bronze', 'silver', 'gold', 'epic', 'legendary']);
export type PackSlug = z.infer<typeof PackSlugSchema>;

export const CollectibleSchema = z.object({
  id: z.string(),
  album: z.string(),
  number: z.number().int(),
  rarity: RaritySchema,
  name: z.string(),
  position: z.enum(['GK', 'DEF', 'MID', 'FWD', 'OBJ']),
  era: z.enum(['70s', '80s', '90s', '00s', 'modern']),
  bio: z.string(),
  art_seed: z.number().int(),
  kind: z.enum(['player', 'object']).default('player'),
  count: z.number().int(),
  /** Glowing (animated) copies among `count`. */
  glow: z.number().int().default(0),
});
export type Collectible = z.infer<typeof CollectibleSchema>;

export const PackCatalogEntrySchema = z.object({
  slug: PackSlugSchema,
  items: z.number().int(),
  coins: z.number().int().nullable(),
  gems: z.number().int().nullable(),
  odds: z.record(z.number()),
  guaranteed: RaritySchema.nullable(),
});
export type PackCatalogEntry = z.infer<typeof PackCatalogEntrySchema>;

export const CollectionStateSchema = z.object({
  albums: z.array(z.object({ slug: z.string(), title: z.string(), blurb: z.string(), kind: z.enum(['players', 'objects']).default('players'), total: z.number().int(), owned: z.number().int(), claimed: z.boolean() })),
  items: z.array(CollectibleSchema),
  tokens: z.record(z.number().int()),
  dust: z.number(),
  pity_left: z.number().int(),
  catalog: z.array(PackCatalogEntrySchema),
  craft_cost: z.record(z.number().int()),
  paid_blocked_regions: z.array(z.string()),
});
export type CollectionState = z.infer<typeof CollectionStateSchema>;

export const OpenPackResultSchema = z.object({
  pack: PackSlugSchema,
  items: z.array(z.object({ id: z.string(), rarity: RaritySchema, new: z.boolean(), dust: z.number().int() })),
  dust_gained: z.number().int(),
  wallet: z.object({ coins: z.number(), gems: z.number(), dust: z.number() }),
});
export type OpenPackResult = z.infer<typeof OpenPackResultSchema>;

/* -------------------------------------------------------------------------- */
/* Friend match                                                               */
/* -------------------------------------------------------------------------- */
const PlayerMiniSchema = z.object({ username: z.string(), avatar_id: z.string(), level: z.number().int() });
export const MatchStateSchema = z.object({
  room_id: z.string().uuid(),
  code: z.string(),
  phase: z.enum(['waiting', 'countdown', 'question', 'reveal', 'done', 'expired']),
  idx: z.number().int().nullable(),
  total: z.number().int(),
  seconds_left: z.number(),
  server_now: z.number(),
  is_host: z.boolean(),
  me: PlayerMiniSchema,
  opponent: PlayerMiniSchema.nullable(),
  my_score: z.number().int(),
  opp_score: z.number().int(),
  my_answer: z.number().int().nullable(),
  opp_answered: z.boolean(),
  question: z
    .object({
      id: z.string(),
      text: z.string(),
      image: QuestionImageSchema.nullable().optional(),
      category_name: z.string().nullable(),
      answers: z.array(z.object({ slot: z.number().int(), text: z.string() })),
    })
    .nullable(),
  reveal: z
    .object({ correct_slot: z.number().int(), explanation: z.string(), opp_slot: z.number().int().nullable() })
    .nullable(),
  result: z.object({ coins: z.number().nullable() }).nullable(),
});
export type MatchState = z.infer<typeof MatchStateSchema>;
export const MatchRoomSchema = z.object({ room_id: z.string().uuid(), code: z.string() });

/* -------------------------------------------------------------------------- */
/* Store & ads                                                                */
/* -------------------------------------------------------------------------- */
export const StoreProductSchema = z.object({
  sku: z.string(),
  kind: z.enum(['coins', 'gems', 'no_ads', 'vip']),
  amount: z.number().int(),
  title: z.string(),
  badge: z.string().optional(),
});
export type StoreProduct = z.infer<typeof StoreProductSchema>;
export const StoreStateSchema = z.object({
  products: z.array(StoreProductSchema),
  no_ads: z.boolean(),
  vip_until: z.string().nullable(),
  free_pack_today: z.boolean(),
  vip_daily_today: z.boolean(),
  ad_free: z.boolean(),
});
export type StoreState = z.infer<typeof StoreStateSchema>;

/* -------------------------------------------------------------------------- */
/* Energy, wheel, deals, season pass — mirrors *_engagement.sql               */
/* -------------------------------------------------------------------------- */
export const RewardSchema = z.object({
  kind: z.enum(['coins', 'gems', 'dust', 'pack', 'tickets', 'cosmetic']),
  amount: z.number().int().default(1),
  pack: PackSlugSchema.optional(),
  item: z.string().optional(),
});
export type Reward = z.infer<typeof RewardSchema>;

export const EnergyStateSchema = z.object({
  tickets: z.number().int(),
  max: z.number().int(),
  refill_minutes: z.number().int(),
  next_at: z.string().nullable(),
  unlimited: z.boolean(),
  gem_refill: z.number().int(),
  ad_left: z.number().int(),
});
export type EnergyState = z.infer<typeof EnergyStateSchema>;

export const WheelSegmentSchema = RewardSchema.extend({ id: z.string(), pct: z.number().optional() });
export const WheelStateSchema = z.object({
  free_available: z.boolean(),
  next_free_at: z.string().nullable(),
  spin_gems: z.number().int(),
  paid_left: z.number().int(),
  blocked: z.boolean(),
  segments: z.array(WheelSegmentSchema),
});
export type WheelState = z.infer<typeof WheelStateSchema>;
export const WheelSpinSchema = z.object({ index: z.number().int(), segment: WheelSegmentSchema });
export type WheelSpin = z.infer<typeof WheelSpinSchema>;

export const DealSchema = z.object({
  id: z.string(),
  title: z.string(),
  body: z.string(),
  price: z.object({ currency: z.enum(['coins', 'gems']), amount: z.number().int() }),
  was: z.number().int(),
  rewards: z.array(RewardSchema),
});
export type Deal = z.infer<typeof DealSchema>;
export const DealsStateSchema = z.object({ window: z.number().int(), ends_at: z.string(), deal: DealSchema, bought: z.boolean() });
export type DealsState = z.infer<typeof DealsStateSchema>;

export const PassStateSchema = z.union([
  z.object({ active: z.literal(false) }),
  z.object({
    active: z.literal(true),
    id: z.string(),
    title: z.string(),
    ends: z.string(),
    xp_per_tier: z.number().int(),
    premium_gems: z.number().int(),
    xp: z.number().int(),
    premium: z.boolean(),
    tier: z.number().int(),
    claimed_free: z.array(z.number().int()),
    claimed_premium: z.array(z.number().int()),
    tiers: z.array(z.object({ tier: z.number().int(), free: RewardSchema, premium: RewardSchema })),
  }),
]);
export type PassState = z.infer<typeof PassStateSchema>;

/* -------------------------------------------------------------------------- */
/* Friends, chat, trading — mirrors *_social.sql                              */
/* -------------------------------------------------------------------------- */
export const FriendSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  avatar_id: z.string(),
  level: z.number().int(),
  status: z.enum(['pending', 'accepted']),
  incoming: z.boolean(),
  unread: z.number().int(),
  last_at: z.string().nullable(),
});
export type Friend = z.infer<typeof FriendSchema>;
export const TradeSchema = z.object({
  id: z.string().uuid(),
  incoming: z.boolean(),
  peer: z.string().uuid(),
  peer_name: z.string(),
  give: z.string(),
  want: z.string().nullable(),
  created_at: z.string(),
});
export type Trade = z.infer<typeof TradeSchema>;
export const FriendsStateSchema = z.object({
  code: z.string(),
  friends: z.array(FriendSchema),
  trades: z.array(TradeSchema),
  blocked: z.array(z.object({ id: z.string().uuid(), username: z.string() })),
});
export type FriendsState = z.infer<typeof FriendsStateSchema>;
export const ChatMessageSchema = z.object({ id: z.number().int(), mine: z.boolean(), body: z.string(), at: z.string() });
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export const ChatHistorySchema = z.object({ messages: z.array(ChatMessageSchema), can_send: z.boolean() });
export type ChatHistory = z.infer<typeof ChatHistorySchema>;
export const FriendDupeSchema = z.object({ id: z.string(), count: z.number().int(), mine: z.number().int() });
export type FriendDupe = z.infer<typeof FriendDupeSchema>;
export const ChatReportReasonSchema = z.enum(['rude', 'bullying', 'personal_info', 'spam', 'other']);
export type ChatReportReason = z.infer<typeof ChatReportReasonSchema>;
export const FriendDupesSchema = z.array(FriendDupeSchema);
export * from './avatar';

/* -------------------------------------------------------------------------- */
/* Weekly leagues — mirrors supabase/migrations/*_leagues.sql                 */
/* -------------------------------------------------------------------------- */
export const LeagueResultSchema = z.object({
  week: z.string(),
  from_tier: z.number().int(),
  to_tier: z.number().int(),
  rank: z.number().int(),
  members: z.number().int(),
  points: z.number(),
  coins: z.number().int(),
  gems: z.number().int(),
});
export type LeagueResult = z.infer<typeof LeagueResultSchema>;

export const LeagueStateSchema = z.object({
  week_start: z.string(),
  seconds_left: z.number().int(),
  tier: z.number().int().min(0).max(4),
  tier_name: z.string(),
  tiers: z.array(z.string()),
  promote: z.number().int(),
  demote: z.number().int(),
  rewards: z.array(z.object({ upto: z.number().int(), coins: z.number().int(), gems: z.number().int() })),
  tier_bonus: z.number(),
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
  last_result: LeagueResultSchema.nullable(),
});
export type LeagueState = z.infer<typeof LeagueStateSchema>;
export * from './objectArt';
