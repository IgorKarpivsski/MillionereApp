import type { AnalyticsEventName, AnalyticsEvents } from '@fm/analytics-events';
import PostHog from 'posthog-react-native';
import { env } from './env';

/**
 * Product analytics. Only declared events can be sent (see @fm/analytics-events).
 * No personal data in props: user id is the Supabase uuid, never email/name.
 * Economy facts are recorded server-side; these events are for funnels only.
 */
let client: PostHog | null = null;

export function initAnalytics(): void {
  if (!env.posthogKey || client) return;
  client = new PostHog(env.posthogKey, {
    host: env.posthogHost,
    captureAppLifecycleEvents: false,
    disableGeoip: false,
  });
}

export function identify(userId: string, props: { is_guest: boolean; level: number }): void {
  client?.identify(userId, props);
}

export function track<E extends AnalyticsEventName>(event: E, props: AnalyticsEvents[E]): void {
  if (__DEV__) console.log(`[analytics] ${event}`, props);
  client?.capture(event, props as Record<string, string | number | boolean>);
}

export function resetAnalytics(): void {
  client?.reset();
}
