import { strings } from './i18n';

/** Hebrew rank title for a level ("קפטן", "אגדה"...). Display only. */
export function rankTitle(level: number): string {
  let title: string = strings.ranks[0]!.title;
  for (const r of strings.ranks) if (level >= r.from) title = r.title;
  return title;
}
