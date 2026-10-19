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
  /** the player's own photo (phone upload or Google picture); shown to everyone instead of the drawn avatar */
  photo_url: z.string().nullable().optional(),
  gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  fav_worlds: z.array(z.string()).optional(),
  onboarded_at: z.string().nullable().optional(),
  /** avatar ring unlocked by badges (bronze/silver/gold/fire/rainbow) */
  frame: z.string().nullable().optional(),
  /** a title unlocked by badges, shown under the name */
  title: z.string().nullable().optional(),
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
  /** streak freezes in stock: each covers one missed day */
  freezes: z.number().int().optional(),
  freeze_coins: z.number().int().optional(),
});
export type DailyStatus = z.infer<typeof DailyStatusSchema>;

export const LeaderboardSchema = z.object({
  week_start: z.string(),
  rows: z.array(
    z.object({
      rank: z.number().int(),
      username: z.string(),
      avatar_id: z.string(),
      photo: z.string().nullable().optional(),
      level: z.number().int(),
      points: z.number(),
      me: z.boolean(),
      frame: z.string().nullable().optional(),
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
      /** Extra hard levels after the world's last level. */
      champion_levels: z.number().int().default(0),
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
  /** the player who wrote this question (community questions) */
  question_author: z.string().nullable().optional(),
  champion: z.boolean().default(false),
  boosts: z.record(z.number().int()).default({}),
  run_boosts: z.array(z.string()).default([]),
  question_boosts: z.array(z.string()).default([]),
  frozen: z.boolean().default(false),
  shield: z.boolean().default(false),
  doubled: z.boolean().default(false),
  call_id: z.string().uuid().optional(),
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
  doubled: z.boolean().default(false),
  champion: z.boolean().default(false),
  champion_opened: z.boolean().default(false),
  can_continue: z.boolean().default(false),
  hearts: z.number().int().default(0),
  /** every question right: a champion's prize */
  perfect: z.object({ coins: z.number().int(), gems: z.number().int() }).optional(),
});
export type SessionSummary = z.infer<typeof SessionSummarySchema>;

export const SessionAnswerSchema = z.object({
  result: z.enum(['correct', 'wrong', 'timeout']),
  /** A shield turned this mistake into a counted answer. */
  shielded: z.boolean().default(false),
  correct_slot: SlotSchema,
  explanation: z.string(),
  points: z.number().int(),
  /** Part of `points` earned by answering fast (seconds left x points per second). */
  speed_bonus: z.number().int().default(0),
  /** correct answers in a row, and the extra points the streak earned */
  combo: z.number().int().default(0),
  combo_bonus: z.number().int().default(0),
  score: z.number().int(),
  correct_count: z.number().int(),
  summary: SessionSummarySchema.nullable(),
});
export type SessionAnswer = z.infer<typeof SessionAnswerSchema>;

export const BoostKindSchema = z.enum(['time', 'freeze', 'shield', 'skip', 'double', 'heart']);
export type BoostKind = z.infer<typeof BoostKindSchema>;
export const BoostsStateSchema = z.object({
  counts: z.record(z.number().int()),
  prices: z.record(z.number().int()),
  hint_coins: z.number().int(),
});
export type BoostsState = z.infer<typeof BoostsStateSchema>;

export const CallCandidateSchema = z.object({
  id: z.string().uuid(),
  username: z.string(),
  avatar_id: z.string().nullable(),
  photo: z.string().nullable().optional(),
  level: z.number().int(),
  online: z.boolean(),
});
export type CallCandidate = z.infer<typeof CallCandidateSchema>;
export const CallCandidatesSchema = z.array(CallCandidateSchema);

export const IncomingCallSchema = z.object({
  id: z.string().uuid(),
  from: z.string(),
  avatar_id: z.string().nullable(),
  photo: z.string().nullable().optional(),
  seconds_left: z.number().int(),
  question: z.object({
    text: z.string(),
    answers: z.array(z.object({ slot: z.number().int(), text: z.string() })),
    removed: z.array(z.number().int()).default([]),
  }),
});
export type IncomingCall = z.infer<typeof IncomingCallSchema>;
export const MatchInviteSchema = z.object({ id: z.number().int(), from: z.string(), avatar_id: z.string(), photo: z.string().nullable().optional() });
export type MatchInvite = z.infer<typeof MatchInviteSchema>;
export const FamilyInviteSchema = z.object({ id: z.number().int(), from: z.string(), avatar_id: z.string(), photo: z.string().nullable().optional(), world: z.string() });
export type FamilyInvite = z.infer<typeof FamilyInviteSchema>;
export const PresencePingSchema = z.object({
  calls: z.array(IncomingCallSchema),
  invites: z.array(MatchInviteSchema).default([]),
  family_invites: z.array(FamilyInviteSchema).default([]),
});

export const CallStateSchema = z.object({
  answer_slot: z.number().int().nullable(),
  expired: z.boolean(),
  seconds_left: z.number().int(),
  friend: z.string().nullable(),
});
export type CallState = z.infer<typeof CallStateSchema>;
export const BoostBuyResultSchema = z.object({ counts: z.record(z.number().int()) });

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
  albums: z.array(z.object({ slug: z.string(), title: z.string(), blurb: z.string(), kind: z.string().default('players'), total: z.number().int(), owned: z.number().int(), claimed: z.boolean() })),
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
const PlayerMiniSchema = z.object({
  username: z.string(),
  avatar_id: z.string(),
  photo: z.string().nullable().optional(),

  level: z.number().int(),
  frame: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
});
export const ModeQuestionSchema = z.object({
  id: z.string(),
  text: z.string(),
  image: QuestionImageSchema.nullable().optional(),
  category_name: z.string().nullable(),
  author: z.string().nullable().optional(),
  answers: z.array(z.object({ slot: z.number().int(), text: z.string() })),
});
export type ModeQuestion = z.infer<typeof ModeQuestionSchema>;

export const MatchStateSchema = z.object({
  room_id: z.string().uuid(),
  code: z.string(),
  kind: z.enum(['friend', 'random']).default('friend'),
  is_bot: z.boolean().default(false),
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
      author: z.string().nullable().optional(),
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
export const MatchFindSchema = MatchRoomSchema.extend({ matched: z.boolean().optional(), bot: z.boolean().optional() });

/* Against the clock — mirrors 20261017000001_game_modes.sql */
export const BlitzPayloadSchema = z.object({
  run_id: z.string().uuid(),
  status: z.enum(['active', 'done']),
  seconds_left: z.number(),
  total_seconds: z.number(),
  correct: z.number().int(),
  answered: z.number().int(),
  best: z.number().int(),
  coins: z.number().int().nullable(),
  question: ModeQuestionSchema.nullable(),
  countdown: z.number().optional(),
  was_correct: z.boolean().nullable().optional(),
  correct_slot: z.number().int().nullable().optional(),
  new_best: z.boolean().optional(),
  previous_best: z.number().int().optional(),
});
export type BlitzPayload = z.infer<typeof BlitzPayloadSchema>;
export const BlitzInfoSchema = z.object({ best: z.number().int(), seconds: z.number().int() });

/* Player statistics (profile) */
export const WorldStatSchema = z.object({
  world: z.string(),
  answered: z.number().int(),
  correct: z.number().int(),
  levels: z.number().int(),
  stars: z.number().int(),
  perfect: z.number().int(),
});
export type WorldStat = z.infer<typeof WorldStatSchema>;
export const StatsSchema = z.object({
  joined_at: z.string(),
  level: z.number().int(),
  xp: z.number(),
  answered: z.number().int(),
  correct: z.number().int(),
  levels: z.number().int(),
  stars: z.number().int(),
  perfect: z.number().int(),
  sessions: z.number().int(),
  dailies: z.number().int(),
  best_run: z.number().int(),
  days_played: z.number().int(),
  matches: z.number().int(),
  match_wins: z.number().int(),
  family: z.number().int(),
  family_wins: z.number().int(),
  blitz_games: z.number().int(),
  blitz_best: z.number().int(),
  streak: z.number().int(),
  best_streak: z.number().int(),
  stickers: z.number().int(),
  stickers_total: z.number().int(),
  puzzles: z.number().int(),
  worlds: z.array(WorldStatSchema),
});
export type Stats = z.infer<typeof StatsSchema>;

/* Family room */
export const FamilyPlayerSchema = z.object({
  seat: z.number().int(),
  username: z.string(),
  avatar_id: z.string(),
  photo: z.string().nullable().optional(),

  level: z.number().int(),
  me: z.boolean(),
  host: z.boolean(),
  online: z.boolean(),
  left: z.boolean(),
  score: z.number().int(),
  correct: z.number().int(),
  answered: z.boolean(),
  slot: z.number().int().nullable().optional(),
  points: z.number().int().nullable().optional(),
});
export type FamilyPlayer = z.infer<typeof FamilyPlayerSchema>;
export const FamilyStateSchema = z.object({
  room_id: z.string().uuid(),
  code: z.string(),
  status: z.enum(['waiting', 'playing', 'done', 'expired']),
  phase: z.enum(['lobby', 'countdown', 'question', 'reveal', 'done']),
  world: z.string(),
  world_name: z.string().nullable(),
  idx: z.number().int(),
  total: z.number().int(),
  seconds_left: z.number(),
  answer_seconds: z.number().int(),
  max_players: z.number().int(),
  is_host: z.boolean(),
  players: z.array(FamilyPlayerSchema),
  question: ModeQuestionSchema.nullable(),
  my_answer: z.number().int().nullable(),
  reveal: z.object({ correct_slot: z.number().int(), explanation: z.string().nullable() }).nullable(),
  /** the host started a rematch with the same people: its code */
  next_code: z.string().nullable().optional(),
  result: z.object({ coins: z.number().nullable() }).nullable(),
});
export type FamilyState = z.infer<typeof FamilyStateSchema>;

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
  kind: z.enum(['coins', 'gems', 'dust', 'pack', 'tickets', 'cosmetic', 'boost']),
  amount: z.number().int().default(1),
  pack: PackSlugSchema.optional(),
  boost: z.string().optional(),
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
  /** set during a new player's first week: tickets are free until then */
  newbie_until: z.string().nullable().optional(),
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
  photo: z.string().nullable().optional(),
  level: z.number().int(),
  status: z.enum(['pending', 'accepted']),
  online: z.boolean().optional(),
  last_active: z.string().nullable().optional(),
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
  give_items: z.array(z.string()).optional(),
  want_items: z.array(z.string()).optional(),
  created_at: z.string(),
});
export type Trade = z.infer<typeof TradeSchema>;
export const FriendsStateSchema = z.object({
  code: z.string(),
  gifts_left: z.number().int().optional(),
  friends: z.array(FriendSchema),
  trades: z.array(TradeSchema),
  blocked: z.array(z.object({ id: z.string().uuid(), username: z.string() })),
});
export type FriendsState = z.infer<typeof FriendsStateSchema>;
export const ChatMessageSchema = z.object({ id: z.number().int(), mine: z.boolean(), body: z.string(), at: z.string() });
export type ChatMessage = z.infer<typeof ChatMessageSchema>;
export const ChatHistorySchema = z.object({ messages: z.array(ChatMessageSchema), can_send: z.boolean() });
export type ChatHistory = z.infer<typeof ChatHistorySchema>;
export const FriendDupeSchema = z.object({ id: z.string(), count: z.number().int(), mine: z.number().int(), rarity: z.string().optional() });
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
      title: z.string().nullable().optional(),
      avatar_id: z.string(),
      photo: z.string().nullable().optional(),
      level: z.number().int(),
      points: z.number(),
      me: z.boolean(),
    }),
  ),
  last_result: LeagueResultSchema.nullable(),
});
export type LeagueState = z.infer<typeof LeagueStateSchema>;
export * from './objectArt';

/* -------------------------------------------------------------------------- */
/* Teen upgrades — mirrors 20261017000005_teen_upgrades.sql                   */
/* -------------------------------------------------------------------------- */
export const MissionSchema = z.object({
  key: z.string(),
  title: z.string(),
  target: z.number().int(),
  coins: z.number().int(),
  icon: z.string(),
  progress: z.number().int(),
  claimed: z.boolean(),
});
export type Mission = z.infer<typeof MissionSchema>;
export const MissionsStateSchema = z.object({
  day: z.string(),
  missions: z.array(MissionSchema),
  bonus_gems: z.number().int(),
  bonus_claimed: z.boolean(),
  seconds_to_reset: z.number().int(),
  coins: z.number().int().optional(),
  bonus: z.boolean().optional(),
});
export type MissionsState = z.infer<typeof MissionsStateSchema>;

export const MistakeSchema = z.object({
  id: z.string(),
  text: z.string(),
  image: QuestionImageSchema.nullable().optional(),
  explanation: z.string().nullable(),
  category_name: z.string().nullable(),
  answers: z.array(z.object({ text: z.string(), correct: z.boolean() })),
  at: z.string(),
});
export type Mistake = z.infer<typeof MistakeSchema>;

export const REACTION_EMOJIS = ['😂', '🔥', '😱', '👏', '😎', '🤯', '💪', '😴'] as const;
export const ReactionSchema = z.object({
  id: z.number().int(),
  emoji: z.string(),
  me: z.boolean(),
  username: z.string(),
  avatar_id: z.string(),
  seat: z.number().int().nullable().optional(),
});
export type Reaction = z.infer<typeof ReactionSchema>;

export const FRAME_KEYS = ['bronze', 'silver', 'gold', 'fire', 'rainbow'] as const;
export const FlairSchema = z.object({
  frames: z.array(z.object({ key: z.string(), need: z.number().int(), unlocked: z.boolean() })),
  titles: z.array(
    z.object({ text: z.string(), unlocked: z.boolean(), badge: z.string().optional(), world: z.string().optional(), hint: z.string().optional() }),
  ),
  tiers: z.record(z.number().int()),
  frame: z.string().nullable(),
  title: z.string().nullable(),
});
export type Flair = z.infer<typeof FlairSchema>;

export const FriendProfileSchema = z.object({
  id: z.string().uuid(),
  profile: z.object({
    username: z.string(),
    avatar_id: z.string(),
    photo: z.string().nullable().optional(),
    level: z.number().int(),
    frame: z.string().nullable().optional(),
    title: z.string().nullable().optional(),
    gender: z.enum(['male', 'female', 'other']).nullable().optional(),
  }),
  stats: StatsSchema.omit({ xp: true }),
  tiers: z.record(z.number().int()),
});
export type FriendProfile = z.infer<typeof FriendProfileSchema>;

export const RankRowSchema = z.object({
  rank: z.number().int(),
  username: z.string(),
  avatar_id: z.string(),
  photo: z.string().nullable().optional(),

  level: z.number().int().optional(),
  frame: z.string().nullable().optional(),
  title: z.string().nullable().optional(),
  points: z.number(),
  me: z.boolean(),
});
export type RankRow = z.infer<typeof RankRowSchema>;
export const FriendsBoardSchema = z.object({ rows: z.array(RankRowSchema) });

export const EventStateSchema = z.union([
  z.object({ active: z.literal(false) }),
  z.object({
    active: z.literal(true),
    world: z.string(),
    coins_mult: z.number(),
    ends_at: z.string(),
    rows: z.array(RankRowSchema),
    me: z.object({ rank: z.number().int(), points: z.number() }).nullable(),
  }),
]);
export type EventState = z.infer<typeof EventStateSchema>;

export const SubmissionSchema = z.object({
  id: z.number().int(),
  world: z.string(),
  text: z.string(),
  status: z.enum(['pending', 'approved', 'rejected']),
  created_at: z.string(),
});
export type Submission = z.infer<typeof SubmissionSchema>;
export const AdminSubmissionSchema = z.object({
  id: z.number().int(),
  world: z.string(),
  text: z.string(),
  correct: z.string(),
  wrongs: z.array(z.string()),
  author: z.string(),
  created_at: z.string(),
});
export type AdminSubmission = z.infer<typeof AdminSubmissionSchema>;
export const MistakesSchema = z.array(MistakeSchema);
export const ReactionsSchema = z.array(ReactionSchema);
export const SubmissionsSchema = z.array(SubmissionSchema);
export const AdminSubmissionsSchema = z.array(AdminSubmissionSchema);

/* All-time and monthly tables — mirrors 20261018000001_social_and_rewards.sql */
export const BoardSchema = z.object({
  kind: z.enum(['month', 'all']),
  rows: z.array(RankRowSchema),
  me: z.object({ rank: z.number().int(), points: z.number() }).nullable(),
  ends_at: z.string().nullable().optional(),
  prizes: z.array(z.object({ coins: z.number().int(), gems: z.number().int() })).nullable().optional(),
  last_winners: z.array(RankRowSchema.partial({ level: true })).default([]),
});
export type Board = z.infer<typeof BoardSchema>;

/* King of the hill — mirrors 20261019000001_survival_truefalse_market_referral.sql */
export const SurvivalPayloadSchema = z.object({
  run_id: z.string().uuid(),
  status: z.enum(['active', 'down', 'done']),
  correct: z.number().int(),
  seconds_left: z.number(),
  question_seconds: z.number().int(),
  best: z.number().int(),
  week_best: z.number().int(),
  can_revive: z.boolean(),
  revive_gems: z.number().int(),
  coins: z.number().int().nullable(),
  question: ModeQuestionSchema.nullable(),
  countdown: z.number().optional(),
  was_correct: z.boolean().nullable().optional(),
  correct_slot: z.number().int().nullable().optional(),
  new_best: z.boolean().optional(),
  previous_best: z.number().int().optional(),
  new_week_best: z.boolean().optional(),
});
export type SurvivalPayload = z.infer<typeof SurvivalPayloadSchema>;
export const PrizeSchema = z.object({ coins: z.number().int(), gems: z.number().int() });
export const SurvivalInfoSchema = z.object({
  best: z.number().int(),
  week_best: z.number().int(),
  question_seconds: z.number().int(),
  revive_gems: z.number().int(),
  rows: z.array(RankRowSchema),
  me: z.object({ rank: z.number().int(), points: z.number() }).nullable(),
  ends_at: z.string(),
  prizes: z.array(PrizeSchema),
  last_winners: z.array(RankRowSchema.omit({ level: true, frame: true })),
});
export type SurvivalInfo = z.infer<typeof SurvivalInfoSchema>;

/* True or false */
export const TfPayloadSchema = z.object({
  run_id: z.string().uuid(),
  status: z.enum(['active', 'done']),
  seconds_left: z.number(),
  total_seconds: z.number().int(),
  correct: z.number().int(),
  answered: z.number().int(),
  best: z.number().int(),
  coins: z.number().int().nullable(),
  question: z
    .object({
      id: z.string(),
      text: z.string(),
      claim: z.string(),
      image: QuestionImageSchema.nullable().optional(),
      category_name: z.string().nullable(),
    })
    .nullable(),
  countdown: z.number().optional(),
  was_correct: z.boolean().nullable().optional(),
  was_true: z.boolean().optional(),
  right_answer: z.string().nullable().optional(),
  new_best: z.boolean().optional(),
  previous_best: z.number().int().optional(),
});
export type TfPayload = z.infer<typeof TfPayloadSchema>;
export const TfInfoSchema = z.object({ best: z.number().int(), seconds: z.number().int(), penalty_seconds: z.number().int() });

/* Sticker market */
const MarketItemSchema = z.object({ id: z.string(), name: z.string(), rarity: z.string() });
export const MarketListingSchema = z.object({
  id: z.number().int(),
  status: z.enum(['open', 'done', 'cancelled']),
  created_at: z.string(),
  done_at: z.string().nullable(),
  give: MarketItemSchema,
  want: MarketItemSchema,
  mine: z.boolean(),
  owner: z.object({ username: z.string(), avatar_id: z.string(), photo: z.string().nullable().optional(), level: z.number().int() }),
  taker: z.string().nullable(),
  can_take: z.boolean(),
  i_need: z.boolean(),
});
export type MarketListing = z.infer<typeof MarketListingSchema>;
export const MarketStateSchema = z.object({
  listings: z.array(MarketListingSchema),
  mine: z.array(MarketListingSchema),
  news: z.number().int(),
  max_open: z.number().int(),
  got: z.string().optional(),
});
export type MarketState = z.infer<typeof MarketStateSchema>;

/* Friend brings friend */
export const ReferralRewardSchema = z.object({
  kind: z.string(),
  amount: z.number().int(),
  pack: z.string().optional(),
});
export type ReferralReward = z.infer<typeof ReferralRewardSchema>;
export const ReferralStateSchema = z.object({
  code: z.string(),
  qualified: z.number().int(),
  qualify_games: z.number().int(),
  friends: z.array(
    z.object({
      username: z.string(),
      avatar_id: z.string(),
      photo: z.string().nullable().optional(),
      games: z.number().int(),
      qualified: z.boolean(),
    }),
  ),
  per_friend: z.array(ReferralRewardSchema),
  welcome: z.array(ReferralRewardSchema),
  goals: z.array(z.object({ n: z.number().int(), rewards: z.array(ReferralRewardSchema), flair: z.boolean().optional(), reached: z.boolean() })),
  invited_by: z.object({ username: z.string(), avatar_id: z.string(), photo: z.string().nullable().optional() }).nullable(),
  can_redeem: z.boolean(),
});
export type ReferralState = z.infer<typeof ReferralStateSchema>;
