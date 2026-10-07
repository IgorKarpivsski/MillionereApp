import assert from 'node:assert/strict';
import { test } from 'node:test';
import {
  AVATAR_SLOTS,
  DEFAULT_AVATAR,
  PREMIUM_ACCESSORIES,
  avatarSvg,
  decodeAvatar,
  encodeAvatar,
  randomAvatar,
  specFromAvatarId,
} from '../../../../packages/shared/src/avatar';

test('encode/decode round-trips every option of every slot', () => {
  for (const { key, count } of AVATAR_SLOTS) {
    for (let v = 0; v < count; v++) {
      const s = { ...DEFAULT_AVATAR, [key]: v };
      const code = encodeAvatar(s);
      assert.match(code, /^av1_[0-9a-z]{12}$/);
      assert.deepEqual(decodeAvatar(code), s);
    }
  }
});

test('out-of-range codes are rejected (same rule as the server)', () => {
  assert.equal(decodeAvatar('av1_c00000000000'), null); // species 12
  assert.equal(decodeAvatar('av1_000000000000x'), null);
  assert.equal(decodeAvatar('avatar_01'), null);
});

test('legacy ids map to a valid avatar', () => {
  for (let n = 1; n <= 12; n++) {
    const s = specFromAvatarId(`avatar_${String(n).padStart(2, '0')}`);
    assert.ok(decodeAvatar(encodeAvatar(s)));
  }
});

test('random avatars never include earned accessories', () => {
  let seed = 1;
  const rand = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);
  for (let i = 0; i < 2000; i++) assert.equal(PREMIUM_ACCESSORIES[randomAvatar(rand).accessory], undefined);
});

test('every combination of species x hair x accessory renders well-formed SVG', () => {
  for (let sp = 0; sp < 12; sp++)
    for (let h = 0; h < 14; h++)
      for (let a = 0; a < 10; a++) {
        const svg = avatarSvg({ ...DEFAULT_AVATAR, species: sp, hair: h, accessory: a, outfit: (h + a) % 6 });
        assert.ok(svg.startsWith('<svg') && svg.endsWith('</svg>'));
        assert.ok(!svg.includes('NaN') && !svg.includes('undefined'), `bad svg ${sp}/${h}/${a}`);
      }
});
