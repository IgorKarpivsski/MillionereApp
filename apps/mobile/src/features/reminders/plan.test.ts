import assert from 'node:assert/strict';
import { test } from 'node:test';
import { ilOffsetMin, outOfQuietHours, planReminders, type ReminderInput } from './plan';

// 2026-10-07 12:00 Israel (09:00 UTC)
const now = new Date('2026-10-07T09:00:00Z');
const base: ReminderInput = { now, wheelNextFreeAt: null, wheelFree: true, dailyState: 'done', streak: 0, secondsToReset: 12 * 3600, energy: undefined };

test('quiet hours move to 09:00 Israel', () => {
  assert.equal(outOfQuietHours(new Date('2026-10-07T20:30:00Z')).toISOString(), '2026-10-08T06:00:00.000Z'); // 23:30 → 09:00 next day
  assert.equal(outOfQuietHours(new Date('2026-10-08T02:00:00Z')).toISOString(), '2026-10-08T06:00:00.000Z'); // 05:00 → 09:00
  assert.equal(outOfQuietHours(new Date('2026-10-07T15:00:00Z')).toISOString(), '2026-10-07T15:00:00.000Z'); // 18:00 stays
});

test('streak in danger when daily not played', () => {
  const r = planReminders({ ...base, dailyState: 'open', streak: 4 });
  const s = r.find((x) => x.id === 'streak');
  assert.ok(s && s.title.includes('4'));
  assert.ok(s.at.getTime() > now.getTime());
});

test('wheel reminder only when the free spin is used', () => {
  assert.equal(planReminders({ ...base, wheelFree: true, wheelNextFreeAt: '2026-10-07T12:00:00Z' }).some((x) => x.id === 'wheel'), false);
  assert.equal(planReminders({ ...base, wheelFree: false, wheelNextFreeAt: '2026-10-07T12:00:00Z' }).some((x) => x.id === 'wheel'), true);
});

test('energy full time adds the remaining refills', () => {
  const r = planReminders({ ...base, energy: { tickets: 2, max: 5, next_at: '2026-10-07T09:10:00Z', refill_minutes: 20, unlimited: false } });
  assert.equal(r.find((x) => x.id === 'energy')?.at.toISOString(), '2026-10-07T09:50:00.000Z');
  assert.equal(planReminders({ ...base, energy: { tickets: 5, max: 5, next_at: null, refill_minutes: 20, unlimited: false } }).some((x) => x.id === 'energy'), false);
});

test('nothing scheduled in the past or the next 5 minutes', () => {
  const r = planReminders({ ...base, wheelFree: false, wheelNextFreeAt: '2026-10-07T09:02:00Z' });
  assert.equal(r.some((x) => x.id === 'wheel'), false);
});

test('Israel time: summer until the last Sunday of October, then winter', () => {
  assert.equal(ilOffsetMin(new Date('2026-10-07T09:00:00Z')), 180);
  assert.equal(ilOffsetMin(new Date('2026-10-26T09:00:00Z')), 120);
  assert.equal(ilOffsetMin(new Date('2026-01-15T09:00:00Z')), 120);
  assert.equal(ilOffsetMin(new Date('2026-04-01T09:00:00Z')), 180);
});

test('quiet hours in winter time', () => {
  assert.equal(outOfQuietHours(new Date('2026-11-10T21:30:00Z')).toISOString(), '2026-11-11T07:00:00.000Z'); // 23:30 → 09:00
});

test('a daily-gift reminder tomorrow at 16:30 Israel, naming the gift', () => {
  const r = planReminders({ ...base, now: new Date('2026-11-10T18:00:00Z'), secondsToReset: undefined, tomorrowGift: 'חבילת כסף' });
  const g = r.find((x) => x.id === 'gift');
  assert.equal(g?.at.toISOString(), '2026-11-11T14:30:00.000Z');
  assert.ok(g?.body.includes('חבילת כסף'));
  // the old next-morning "new daily challenge" reminder is folded into it
  assert.equal(planReminders({ ...base, dailyState: 'done' }).filter((x) => x.id === 'daily').length, 0);
});
