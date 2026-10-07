import type { DailyStatus, EnergyState, WheelState } from '@fm/shared';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useSettingsStore } from '@/features/settings/store';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { planReminders } from './plan';

const CHANNEL = 'reminders';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

async function ensureChannel() {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync(CHANNEL, {
      name: 'תזכורות משחק',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }
}

async function hasPermission(): Promise<boolean> {
  const p = await Notifications.getPermissionsAsync();
  return p.granted;
}

/** Replaces all scheduled reminders with a fresh plan from cached game state. */
export async function rescheduleReminders(): Promise<void> {
  try {
    await Notifications.cancelAllScheduledNotificationsAsync();
    if (!useSettingsStore.getState().reminders || !(await hasPermission())) return;
    await ensureChannel();
    const wheel = queryClient.getQueryData<WheelState>(queryKeys.wheel);
    const daily = queryClient.getQueryData<DailyStatus>(queryKeys.daily);
    const energy = queryClient.getQueryData<EnergyState>(queryKeys.energy);
    const plan = planReminders({
      now: new Date(),
      wheelFree: wheel?.free_available,
      wheelNextFreeAt: wheel?.next_free_at,
      dailyState: daily?.state,
      streak: daily?.streak ?? 0,
      secondsToReset: daily?.seconds_to_reset,
      energy,
    });
    for (const r of plan) {
      await Notifications.scheduleNotificationAsync({
        identifier: r.id,
        content: { title: r.title, body: r.body },
        trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: r.at, channelId: CHANNEL },
      });
    }
  } catch {
    // Reminders are best-effort; never break the app over them.
  }
}

/** Asks once for permission, after the player has finished a game (never on first launch). */
export async function askForRemindersOnce(): Promise<void> {
  const s = useSettingsStore.getState();
  if (s.remindersAsked || !s.reminders) return;
  s.set({ remindersAsked: true });
  try {
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain) {
      await ensureChannel();
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    // ignore
  }
}

/** Mount once at the root: re-plans reminders whenever the app goes to the background. */
export function useReminders(): void {
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') void rescheduleReminders();
    });
    return () => sub.remove();
  }, []);
}
