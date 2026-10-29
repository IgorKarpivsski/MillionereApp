import { useSettingsStore } from './store';

/**
 * Under 13, or no age given yet: the child-safe defaults (ready chat phrases only, no profile
 * photo). The server enforces the same rule from profiles.age_band.
 */
export function useIsKid(): boolean {
  const band = useSettingsStore((s) => s.ageBand);
  return band == null || band === 'under13';
}
