const full = new Intl.NumberFormat('he-IL');

/** 1234 → "1,234". */
export function formatNumber(n: number): string {
  return full.format(n);
}

/**
 * Compact amounts for pills: 999 → "999", 12_500 → "12.5K", 2_000_000 → "2M".
 * Uses Latin K/M on purpose: Hebrew "אלף"/"מ׳" don't fit the pill and read
 * inconsistently across iOS versions.
 */
export function formatCompact(n: number): string {
  const abs = Math.abs(n);
  const sign = n < 0 ? '-' : '';
  const trim = (x: number) => (Math.round(x * 10) / 10).toString().replace(/\.0$/, '');
  if (abs < 10_000) return sign + full.format(abs);
  if (abs < 1_000_000) return `${sign}${trim(abs / 1_000)}K`;
  return `${sign}${trim(abs / 1_000_000)}M`;
}

/** Wraps a run of Latin/digits so it keeps its order inside RTL text. */
export function ltr(text: string): string {
  return `⁦${text}⁩`;
}
