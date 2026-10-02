import { useReducedMotion as useOsReducedMotion } from 'react-native-reanimated';
import { useSettingsStore } from '@/features/settings/store';
import { duration } from '../tokens';

/** True if either the OS setting or the in-app toggle asks for less motion. */
export function useReducedMotion(): boolean {
  const os = useOsReducedMotion();
  const app = useSettingsStore((s) => s.reducedMotion);
  return os || app;
}

/** Duration helper: collapses to 0 under reduced motion. */
export function useDuration(key: keyof typeof duration): number {
  return useReducedMotion() ? duration.instant : duration[key];
}
