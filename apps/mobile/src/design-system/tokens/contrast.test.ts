import { test } from 'node:test';
import assert from 'node:assert/strict';
import { colors, palette, rarityColors } from './colors.ts';
import { contrastRatio } from './contrast.ts';

const AA_TEXT = 4.5;
const AA_LARGE = 3;

test('body text passes WCAG AA on every surface', () => {
  for (const bg of [colors.bg, colors.bgDeep, colors.surface, colors.surfaceRaised]) {
    assert.ok(contrastRatio(colors.text, bg) >= AA_TEXT, `text on ${bg}`);
    assert.ok(contrastRatio(colors.textMuted, bg) >= AA_TEXT, `muted text on ${bg}`);
  }
});

test('labels on bright buttons and chips pass AA', () => {
  for (const fill of [colors.primary, colors.prize, colors.gem, palette.violet]) {
    assert.ok(contrastRatio(colors.textOnBright, fill) >= AA_TEXT, `dark label on ${fill}`);
  }
  // Coral is used with large/bold text only (button labels are 18pt black).
  assert.ok(contrastRatio(colors.textOnBright, colors.danger) >= AA_LARGE, 'label on flare');
});

test('accent colors stand out from the background (non-text 3:1)', () => {
  for (const c of [colors.primary, colors.prize, colors.danger, colors.gem]) {
    assert.ok(contrastRatio(c, colors.bg) >= AA_LARGE, `${c} vs bg`);
  }
});

test('every rarity frame is distinguishable from the surface', () => {
  for (const [name, r] of Object.entries(rarityColors)) {
    assert.ok(contrastRatio(r.fill, colors.surface) >= AA_LARGE, `${name} frame vs surface`);
    assert.ok(r.label.length > 0, `${name} has a Hebrew label`);
  }
});
