import * as Sentry from '@sentry/react-native';
import { env } from './env';

export function initMonitoring(): void {
  if (!env.sentryDsn) return;
  Sentry.init({
    dsn: env.sentryDsn,
    tracesSampleRate: __DEV__ ? 1 : 0.1,
    sendDefaultPii: false,
    enabled: !__DEV__,
  });
}

export function setMonitoringUser(id: string | null): void {
  Sentry.setUser(id ? { id } : null);
}

export const wrapRoot = Sentry.wrap;
