/**
 * Matchstick equation puzzles ("move one match to fix the equation").
 *
 * A puzzle is a row of glyphs: digits drawn with 7 matchstick segments, "+"/"-"
 * signs (a horizontal stick plus an optional vertical one) and a fixed "=".
 * The player moves, adds or removes sticks; the puzzle is solved when every
 * glyph is a real digit/sign and the equation is true.
 */

/** Segment order: a (top), b (top right), c (bottom right), d (bottom), e (bottom left), f (top left), g (middle). */
export const SEGMENTS = ['a', 'b', 'c', 'd', 'e', 'f', 'g'] as const;

const DIGIT_SEGS: Record<number, string> = {
  0: 'abcdef', 1: 'bc', 2: 'abged', 3: 'abgcd', 4: 'fgbc', 5: 'afgcd', 6: 'afgedc', 7: 'abc', 8: 'abcdefg', 9: 'abcdfg',
};

export const DIGIT_MASK: number[] = Array.from({ length: 10 }, (_, d) =>
  [...DIGIT_SEGS[d]!].reduce((m, s) => m | (1 << SEGMENTS.indexOf(s as (typeof SEGMENTS)[number])), 0),
);
const MASK_TO_DIGIT = new Map(DIGIT_MASK.map((m, d) => [m, d]));

/** A glyph: digit (7 slots), sign (slot 0 = horizontal, slot 1 = vertical) or equals (fixed). */
export type Glyph = { kind: 'digit'; mask: number } | { kind: 'sign'; mask: number } | { kind: 'eq' };

export type MatchMode = 'move' | 'add' | 'remove';

export interface MatchPuzzle {
  id: number;
  /** Starting equation, e.g. "6+4=4". */
  start: string;
  mode: MatchMode;
  /** How many sticks to move / add / remove. */
  count: number;
  /** One correct answer, e.g. "0+4=4" (any true equation reached legally is accepted). */
  answer: string;
  /** 1 (easy) .. 5 (very hard). */
  level: number;
}

export function parseEquation(s: string): Glyph[] {
  return [...s].map((ch): Glyph => {
    if (ch === '=') return { kind: 'eq' };
    if (ch === '+') return { kind: 'sign', mask: 0b11 };
    if (ch === '-') return { kind: 'sign', mask: 0b01 };
    const d = Number(ch);
    if (!Number.isInteger(d)) throw new Error(`bad glyph ${ch}`);
    return { kind: 'digit', mask: DIGIT_MASK[d]! };
  });
}

export function slotCount(g: Glyph): number {
  return g.kind === 'digit' ? 7 : g.kind === 'sign' ? 2 : 0;
}

export function countSticks(glyphs: Glyph[]): number {
  let n = 0;
  for (const g of glyphs) if (g.kind !== 'eq') for (let i = 0; i < slotCount(g); i++) if (g.mask & (1 << i)) n++;
  return n;
}

/** The equation text if every glyph is valid ("7+1=8"), else null. */
export function readEquation(glyphs: Glyph[]): string | null {
  let out = '';
  for (const g of glyphs) {
    if (g.kind === 'eq') out += '=';
    else if (g.kind === 'sign') {
      if (g.mask === 0b11) out += '+';
      else if (g.mask === 0b01) out += '-';
      else return null;
    } else {
      const d = MASK_TO_DIGIT.get(g.mask);
      if (d === undefined) return null;
      out += String(d);
    }
  }
  return out;
}

/** True for a well-formed, correct equation like "12-3=9" or "9=12-3" (no leading zeros). */
export function isTrueEquation(eq: string | null): boolean {
  if (!eq) return false;
  const sides = eq.split('=');
  if (sides.length !== 2) return false;
  const value = (side: string): number | null => {
    const m = /^(\d+)(?:([+-])(\d+))?$/.exec(side);
    if (!m) return null;
    const nums = [m[1], m[3]].filter((x): x is string => x !== undefined);
    if (nums.some((n) => n.length > 1 && n.startsWith('0'))) return null;
    const a = Number(m[1]);
    return m[2] === undefined ? a : m[2] === '+' ? a + Number(m[3]) : a - Number(m[3]);
  };
  const l = value(sides[0]!), r = value(sides[1]!);
  return l !== null && r !== null && l === r && l >= 0;
}

function clone(g: Glyph[]): Glyph[] {
  return g.map((x) => ({ ...x }));
}

type Slot = [number, number];

function slots(glyphs: Glyph[], filled: boolean): Slot[] {
  const out: Slot[] = [];
  glyphs.forEach((g, gi) => {
    if (g.kind === 'eq') return;
    for (let i = 0; i < slotCount(g); i++) if (Boolean(g.mask & (1 << i)) === filled) out.push([gi, i]);
  });
  return out;
}

function toggle(glyphs: Glyph[], [gi, i]: Slot): void {
  const g = glyphs[gi]!;
  if (g.kind !== 'eq') g.mask ^= 1 << i;
}

/** Every true equation reachable from `start` with exactly `count` operations of `mode`. */
export function solve(start: string, mode: MatchMode, count: number): Set<string> {
  const results = new Set<string>();
  const seen = new Set<string>();
  const key = (g: Glyph[]) => g.map((x) => (x.kind === 'eq' ? '=' : x.mask)).join(',');
  const rec = (g: Glyph[], left: number) => {
    const k = key(g) + '|' + left;
    if (seen.has(k)) return;
    seen.add(k);
    if (left === 0) {
      const eq = readEquation(g);
      if (isTrueEquation(eq)) results.add(eq!);
      return;
    }
    if (mode === 'remove') {
      for (const s of slots(g, true)) { const n = clone(g); toggle(n, s); rec(n, left - 1); }
    } else if (mode === 'add') {
      for (const s of slots(g, false)) { const n = clone(g); toggle(n, s); rec(n, left - 1); }
    } else {
      for (const from of slots(g, true)) for (const to of slots(g, false)) {
        const n = clone(g); toggle(n, from); toggle(n, to); rec(n, left - 1);
      }
    }
  };
  rec(parseEquation(start), count);
  return results;
}

export const MODE_LABEL: Record<MatchMode, (n: number) => string> = {
  move: (n) => (n === 1 ? 'הזיזו גפרור אחד כדי שהתרגיל יהיה נכון' : `הזיזו ${n} גפרורים כדי שהתרגיל יהיה נכון`),
  add: (n) => (n === 1 ? 'הוסיפו גפרור אחד כדי שהתרגיל יהיה נכון' : `הוסיפו ${n} גפרורים כדי שהתרגיל יהיה נכון`),
  remove: (n) => (n === 1 ? 'הורידו גפרור אחד כדי שהתרגיל יהיה נכון' : `הורידו ${n} גפרורים כדי שהתרגיל יהיה נכון`),
};
