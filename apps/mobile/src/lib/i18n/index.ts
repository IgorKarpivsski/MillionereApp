import { he } from './he.ts';

export const strings = he;

/** Fills {placeholders}. Throws in dev if a placeholder is left unfilled. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  // "+{n}", "-{n}" and "{n}%" are wrapped in a left-to-right isolate, so in Hebrew text the
  // sign stays next to its number ("+350", not "350+")
  return template.replace(/([+\-−]?)\{(\w+)\}(%?)/g, (_m, sign: string, key: string, pct: string, at: number) => {
    const v = vars[key];
    if (v === undefined) {
      if (process.env.NODE_ENV !== 'production') throw new Error(`missing i18n var "${key}"`);
      return sign + pct;
    }
    // a hyphen right after a Hebrew letter is a prefix dash ("ל-{n}"), not a minus sign
    const dash = sign !== '' && at > 0 && /[\u0590-\u05FF]/.test(template[at - 1] ?? '');
    if (dash) return sign + (pct ? `\u2066${String(v)}${pct}\u2069` : String(v));
    return sign || pct ? `\u2066${sign}${String(v)}${pct}\u2069` : String(v);
  });
}

/**
 * Hebrew is gendered: "{m|f}" picks the masculine or feminine form
 * ("מוכ{ן|נה}" → מוכן / מוכנה). Unknown or "other" gender uses the first form.
 */
export function gx(template: string, gender?: 'male' | 'female' | 'other' | null): string {
  return template.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m: string, f: string) => (gender === 'female' ? f : m));
}

