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
