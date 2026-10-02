/**
 * Default economy configuration.
 *
 * These are STARTING values from the architecture doc (section 7). The server
 * is the source of truth: values are seeded into `app_config` / config tables
 * and read by SQL functions. The client only uses them for display.
 * Never import these into reward logic on the client.
 */

export const RARITIES = ['common', 'uncommon', 'rare', 'epic', 'legendary', 'iconic'] as const;
export type Rarity = (typeof RARITIES)[number];

export const DIFFICULTIES = ['easy', 'medium', 'hard', 'expert', 'legendary'] as const;
export type Difficulty = (typeof DIFFICULTIES)[number];

export interface LadderRung {
  rung: number;
  difficulty: Difficulty;
  /** Display + leaderboard score. NOT a currency. */
  prizePoints: number;
  /** Coins actually paid when the run ends on this rung. */
  coins: number;
  checkpoint: boolean;
}

export const LADDER: readonly LadderRung[] = [
  { rung: 1, difficulty: 'easy', prizePoints: 100, coins: 10, checkpoint: false },
  { rung: 2, difficulty: 'easy', prizePoints: 250, coins: 20, checkpoint: false },
  { rung: 3, difficulty: 'easy', prizePoints: 500, coins: 35, checkpoint: false },
  { rung: 4, difficulty: 'medium', prizePoints: 1_000, coins: 60, checkpoint: true },
  { rung: 5, difficulty: 'medium', prizePoints: 2_500, coins: 90, checkpoint: false },
  { rung: 6, difficulty: 'medium', prizePoints: 5_000, coins: 130, checkpoint: false },
  { rung: 7, difficulty: 'hard', prizePoints: 10_000, coins: 180, checkpoint: false },
  { rung: 8, difficulty: 'hard', prizePoints: 25_000, coins: 250, checkpoint: true },
  { rung: 9, difficulty: 'hard', prizePoints: 50_000, coins: 350, checkpoint: false },
  { rung: 10, difficulty: 'expert', prizePoints: 100_000, coins: 500, checkpoint: false },
  { rung: 11, difficulty: 'expert', prizePoints: 250_000, coins: 700, checkpoint: false },
  { rung: 12, difficulty: 'legendary', prizePoints: 500_000, coins: 1_000, checkpoint: false },
];

export interface PackType {
  slug: 'bronze' | 'silver' | 'gold' | 'epic' | 'legendary';
  items: number;
  priceCoins: number | null;
  priceGems: number | null;
  /** Per-slot weights in percent; must sum to 100. */
  odds: Partial<Record<Rarity, number>>;
  /** Minimum rarity guaranteed in one slot, if any. */
  guaranteed: Rarity | null;
}

export const PACKS: readonly PackType[] = [
  { slug: 'bronze', items: 3, priceCoins: 500, priceGems: null, odds: { common: 70, uncommon: 25, rare: 5 }, guaranteed: null },
  { slug: 'silver', items: 4, priceCoins: 1_500, priceGems: null, odds: { common: 45, uncommon: 38, rare: 14, epic: 3 }, guaranteed: null },
  { slug: 'gold', items: 5, priceCoins: 4_000, priceGems: null, odds: { uncommon: 40, rare: 40, epic: 17, legendary: 3 }, guaranteed: 'rare' },
  { slug: 'epic', items: 5, priceCoins: null, priceGems: 60, odds: { rare: 55, epic: 38, legendary: 6, iconic: 1 }, guaranteed: 'epic' },
  { slug: 'legendary', items: 5, priceCoins: null, priceGems: null, odds: { epic: 60, legendary: 35, iconic: 5 }, guaranteed: 'legendary' },
];

export const DUST_FROM_DUPLICATE: Record<Rarity, number> = {
  common: 5,
  uncommon: 15,
  rare: 50,
  epic: 200,
  legendary: 1_000,
  iconic: 2_500,
};

/** null = cannot be crafted. */
export const CRAFT_COST: Record<Rarity, number | null> = {
  common: 50,
  uncommon: 150,
  rare: 600,
  epic: 2_400,
  legendary: 8_000,
  iconic: null,
};

export const RANDOM_RARE_CRAFT_COST = 300;
export const LEGENDARY_PITY_OPENS = 30;
export const WELCOME_BONUS_COINS = 500;

/** XP needed to go from level n to n+1. Smooth curve, cheap early levels. */
export function xpForNextLevel(level: number): number {
  if (!Number.isInteger(level) || level < 1) throw new RangeError('level must be an integer >= 1');
  return Math.round(100 * Math.pow(level, 1.5) + 50 * level);
}

/** Total XP required to reach `level` from level 1. */
export function totalXpToReach(level: number): number {
  let total = 0;
  for (let l = 1; l < level; l++) total += xpForNextLevel(l);
  return total;
}

export function levelFromXp(xp: number): { level: number; intoLevel: number; needed: number } {
  if (xp < 0) throw new RangeError('xp must be >= 0');
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForNextLevel(level)) {
    remaining -= xpForNextLevel(level);
    level++;
  }
  return { level, intoLevel: remaining, needed: xpForNextLevel(level) };
}

/** Coins paid when a run ends after `correct` correct answers, per ladder rules. */
export function coinsForRun(correct: number, endedBy: 'walk_away' | 'wrong' | 'completed'): number {
  if (correct <= 0) return 0;
  const reached = LADDER[Math.min(correct, LADDER.length) - 1];
  if (!reached) return 0;
  if (endedBy !== 'wrong') return reached.coins;
  // Wrong answer on rung correct+1: fall back to the last checkpoint at or below `correct`.
  const checkpoint = [...LADDER].reverse().find((r) => r.checkpoint && r.rung <= correct);
  return checkpoint ? checkpoint.coins : 0;
}

export interface ValidationIssue {
  path: string;
  message: string;
}

/** Validates internal consistency. Run in CI and by the content importer. */
export function validateEconomy(): ValidationIssue[] {
  const issues: ValidationIssue[] = [];
  LADDER.forEach((r, i) => {
    if (r.rung !== i + 1) issues.push({ path: `ladder[${i}]`, message: 'rungs must be 1..n in order' });
    const prev = LADDER[i - 1];
    if (prev && (r.coins <= prev.coins || r.prizePoints <= prev.prizePoints)) {
      issues.push({ path: `ladder[${i}]`, message: 'payouts must strictly increase' });
    }
  });
  for (const p of PACKS) {
    const sum = Object.values(p.odds).reduce((a, b) => a + (b ?? 0), 0);
    if (Math.abs(sum - 100) > 1e-9) issues.push({ path: `packs.${p.slug}`, message: `odds sum to ${sum}, expected 100` });
    if (p.items < 1) issues.push({ path: `packs.${p.slug}`, message: 'items must be >= 1' });
    if (p.guaranteed && !(RARITIES.indexOf(p.guaranteed) >= 0)) {
      issues.push({ path: `packs.${p.slug}`, message: 'unknown guaranteed rarity' });
    }
  }
  for (const r of RARITIES) {
    const cost = CRAFT_COST[r];
    if (cost !== null && cost <= DUST_FROM_DUPLICATE[r]) {
      issues.push({ path: `craft.${r}`, message: 'crafting must cost more than one duplicate yields' });
    }
  }
  return issues;
}
