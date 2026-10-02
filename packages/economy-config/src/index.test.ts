import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  LADDER,
  coinsForRun,
  levelFromXp,
  totalXpToReach,
  validateEconomy,
  xpForNextLevel,
} from './index.ts';

test('economy config is internally consistent', () => {
  assert.deepEqual(validateEconomy(), []);
});

test('ladder has 12 rungs with checkpoints at 4 and 8', () => {
  assert.equal(LADDER.length, 12);
  assert.deepEqual(
    LADDER.filter((r) => r.checkpoint).map((r) => r.rung),
    [4, 8],
  );
});

test('coinsForRun: walk away keeps the reached rung', () => {
  assert.equal(coinsForRun(0, 'walk_away'), 0);
  assert.equal(coinsForRun(5, 'walk_away'), 90);
  assert.equal(coinsForRun(12, 'completed'), 1000);
});

test('coinsForRun: wrong answer falls back to the last checkpoint', () => {
  assert.equal(coinsForRun(3, 'wrong'), 0);
  assert.equal(coinsForRun(4, 'wrong'), 60);
  assert.equal(coinsForRun(7, 'wrong'), 60);
  assert.equal(coinsForRun(8, 'wrong'), 250);
  assert.equal(coinsForRun(11, 'wrong'), 250);
});

test('xp curve is increasing and levelFromXp inverts totalXpToReach', () => {
  for (let l = 1; l < 60; l++) assert.ok(xpForNextLevel(l + 1) > xpForNextLevel(l));
  for (const lvl of [1, 2, 5, 10, 25, 50]) {
    const r = levelFromXp(totalXpToReach(lvl));
    assert.equal(r.level, lvl);
    assert.equal(r.intoLevel, 0);
  }
  assert.throws(() => levelFromXp(-1));
});
