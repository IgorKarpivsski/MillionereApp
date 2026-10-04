import { strings } from './i18n';

/** First level of each rank band, aligned with strings.ranks. */
const RANK_FROM = [1, 5, 10, 15, 20, 30, 45] as const;

/** Hebrew rank title for a level ("קפטן", "אגדה"...). Display only. */
export function rankTitle(level: number): string {
  let idx = 0;
  RANK_FROM.forEach((from, i) => {
    if (level >= from) idx = i;
  });
  return strings.ranks[idx] ?? strings.ranks[0];
}
