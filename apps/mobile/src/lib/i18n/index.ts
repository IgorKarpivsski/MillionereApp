import { he } from './he.ts';

export const strings = he;

/** Fills {placeholders}. Throws in dev if a placeholder is left unfilled. */
export function fmt(template: string, vars: Record<string, string | number> = {}): string {
  return template.replace(/\{(\w+)\}/g, (_, key: string) => {
    const v = vars[key];
    if (v === undefined) {
      if (process.env.NODE_ENV !== 'production') throw new Error(`missing i18n var "${key}"`);
      return '';
    }
    return String(v);
  });
}

/**
 * Hebrew is gendered: "{m|f}" picks the masculine or feminine form
 * ("מוכ{ן|נה}" → מוכן / מוכנה). Unknown or "other" gender uses the first form.
 */
export function gx(template: string, gender?: 'male' | 'female' | 'other' | null): string {
  return template.replace(/\{([^{}|]*)\|([^{}|]*)\}/g, (_, m: string, f: string) => (gender === 'female' ? f : m));
}
