import { DevSettings, I18nManager, Platform } from 'react-native';

/**
 * The app is Hebrew-only. `extra.forcesRTL` in app.config.ts makes native
 * builds start in RTL, so in release builds this is a no-op. It's a safety net
 * for dev builds where the native flag wasn't applied yet: force RTL and reload once.
 */
export function ensureRTL(): void {
  if (Platform.OS === 'web' || I18nManager.isRTL) return;
  I18nManager.allowRTL(true);
  I18nManager.forceRTL(true);
  if (__DEV__) DevSettings.reload();
}

/**
 * Absolute horizontal position measured from the PHYSICAL left edge.
 * In RTL, Android swaps `left`/`right` (swapLeftAndRightInRTL) while iOS does not,
 * so pixel-exact overlays (wheel labels, map pins) use `start` computed from the
 * right edge instead, which behaves the same on both platforms.
 */
export function physicalLeft(x: number, width: number, containerWidth: number): { left: number } | { start: number } {
  return I18nManager.isRTL ? { start: containerWidth - x - width } : { left: x };
}
