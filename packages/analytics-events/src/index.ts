/**
 * Typed analytics event catalog. Every event the app sends must be declared
 * here so names and props stay consistent across mobile, admin and backend.
 *
 * Economy events (rewards, purchases, pack contents) are ALSO recorded
 * server-side in the database; client events are for product analytics only.
 */
export interface AnalyticsEvents {
  // Phase 1
  app_open: { cold_start: boolean };
  session_started: Record<string, never>;
  session_ended: { duration_s: number };
  auth_guest_created: Record<string, never>;
  auth_link_started: { provider: 'apple' | 'google' };
  auth_link_completed: { provider: 'apple' | 'google' };
  auth_link_failed: { provider: 'apple' | 'google'; reason: string };
  auth_signed_out: Record<string, never>;
  account_deleted: Record<string, never>;
  welcome_bonus_claimed: { coins: number };
  settings_changed: { key: string; value: boolean | string };
  offline_shown: Record<string, never>;

  // Phase 2+ (declared now so the catalog is the contract)
  quiz_started: { mode: 'classic' | 'daily' | 'event' | 'onboarding' | 'session'; category?: string };
  question_answered: { rung: number; correct: boolean; ms: number; difficulty: string };
  question_failed: { rung: number; difficulty: string };
  quiz_completed: { rung: number; ended_by: 'walk_away' | 'wrong' | 'completed' | 'timeout' };
  lifeline_used: { lifeline: 'fifty' | 'expert' | 'fans' | 'var'; rung: number };
  pack_opened: { pack: string; source: string };
  item_received: { rarity: string; duplicate: boolean };
  album_completed: { album: string };
  daily_challenge_started: Record<string, never>;
  purchase_started: { sku: string };
  purchase_completed: { sku: string };
  ad_watched: { placement: string };
  reward_claimed: { kind: string };
}

export type AnalyticsEventName = keyof AnalyticsEvents;
