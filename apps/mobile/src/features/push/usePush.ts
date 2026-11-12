import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';
import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';

/**
 * Push notifications from friends (invites, trades, friend requests, calls for help).
 * The app only registers its token when the player already allowed notifications (the
 * reminders question asks once); nothing here asks again. Tapping a push opens its screen.
 */
export function usePush() {
  const { session } = useAuth();
  const uid = session?.user.id;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    void (async () => {
      try {
        const perm = await Notifications.getPermissionsAsync();
        if (!perm.granted) return;
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('friends', {
            name: 'חברים ומשחקים',
            importance: Notifications.AndroidImportance.HIGH,
          });
        }
        // the native FCM token (needs the Firebase config in the build; without it this throws and push stays off)
        const t = await Notifications.getDevicePushTokenAsync();
        if (cancelled || typeof t.data !== 'string') return;
        await rpc('device_register', { p_token: t.data, p_platform: Platform.OS === 'ios' ? 'ios' : 'android' }, () => undefined);
      } catch {
        /* push is optional */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [uid]);

  useEffect(() => {
    const open = (data: Record<string, unknown> | undefined) => {
      const route = typeof data?.route === 'string' ? data.route : null;
      if (!route || !route.startsWith('/')) return;
      try {
        router.push(route as never);
      } catch {
        /* unknown route: stay */
      }
    };
    const sub = Notifications.addNotificationResponseReceivedListener((r) => open(r.notification.request.content.data));
    // opened from a push while the app was closed
    // (after a moment, so the screens are mounted)
    void Notifications.getLastNotificationResponseAsync().then((r) => {
      if (r) setTimeout(() => open(r.notification.request.content.data), 1500);
    });
    return () => sub.remove();
  }, []);
}
