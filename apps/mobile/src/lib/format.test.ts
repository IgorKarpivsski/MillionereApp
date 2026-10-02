import { test } from 'node:test';
import assert from 'node:assert/strict';
import { formatCompact, formatNumber } from './format.ts';
import { fmt, strings } from './i18n/index.ts';

test('formatNumber groups thousands', () => {
  assert.equal(formatNumber(1234), '1,234');
});

test('formatCompact keeps small numbers exact and shortens big ones', () => {
  assert.equal(formatCompact(999), '999');
  assert.equal(formatCompact(9_999), '9,999');
  assert.equal(formatCompact(12_500), '12.5K');
  assert.equal(formatCompact(250_000), '250K');
  assert.equal(formatCompact(2_000_000), '2M');
  assert.equal(formatCompact(-1_500_000), '-1.5M');
});

test('fmt fills placeholders and refuses missing ones', () => {
  assert.equal(fmt(strings.home.streakDays, { n: 3 }), '3 ימים ברצף');
  assert.throws(() => fmt(strings.home.streakDays));
});

test('every Hebrew string is non-empty and has no stray Latin-only text', () => {
  const walk = (o: object, path: string[] = []): void => {
    for (const [k, v] of Object.entries(o)) {
      if (typeof v === 'object') walk(v as object, [...path, k]);
      else {
        assert.ok(typeof v === 'string' && v.trim().length > 0, `empty: ${[...path, k].join('.')}`);
        const allowedLatin = /Apple|Google|K|M/;
        if (!/[֐-׿]/.test(v)) assert.ok(allowedLatin.test(v), `not Hebrew: ${[...path, k].join('.')}`);
      }
    }
  };
  walk(strings);
});
