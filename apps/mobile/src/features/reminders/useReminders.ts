import { appAlert } from '@/design-system/components';
import type { DailyStatus, EnergyState, Reward, WheelState } from '@fm/shared';
import * as Notifications from 'expo-notifications';
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { useSettingsStore } from '@/features/settings/store';
import { strings } from '@/lib/i18n';
import { queryClient, queryKeys } from '@/lib/queryClient';
import { rewardLabel } from '@/features/engage/rewards';
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
    const login = queryClient.getQueryData<{ days: Reward[]; day: number }>(['login-calendar']);
    const next = login?.days?.length ? login.days[(login.day + 1) % login.days.length] : undefined;
    const plan = planReminders({
      now: new Date(),
      wheelFree: wheel?.free_available,
      wheelNextFreeAt: wheel?.next_free_at,
      dailyState: daily?.state,
      streak: daily?.streak ?? 0,
      secondsToReset: daily?.seconds_to_reset,
      energy,
      tomorrowGift: next ? rewardLabel(next) : undefined,
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

/** The first-run notifications screen: the player already chose "allow", so go straight to the system dialog. */
export async function requestReminderPermission(): Promise<boolean> {
  useSettingsStore.getState().set({ remindersAsked: true, reminders: true });
  try {
    await ensureChannel();
    const p = await Notifications.requestPermissionsAsync();
    return p.granted;
  } catch {
    return false;
  }
}

/** Asks once for permission (on launch, right after the age question; again from settings). */
export async function askForRemindersOnce(): Promise<void> {
  const s = useSettingsStore.getState();
  if (s.remindersAsked || !s.reminders) return;
  s.set({ remindersAsked: true });
  try {
    const p = await Notifications.getPermissionsAsync();
    if (!p.granted && p.canAskAgain) {
      // Explain why before the system dialog, so the first answer is an informed one.
      const yes = await new Promise<boolean>((resolve) =>
        appAlert(strings.reminders.askTitle, strings.reminders.askBody, [
          { text: strings.reminders.askNo, style: 'cancel', onPress: () => resolve(false) },
          { text: strings.reminders.askYes, onPress: () => resolve(true) },
        ]),
      );
      if (!yes) return;
      await ensureChannel();
      await Notifications.requestPermissionsAsync();
    }
  } catch {
    // ignore
  }
}

/** Mount once at the root: re-plans reminders whenever the app goes to the background. */
export function useReminders(): void {
  // The permission question itself comes after the player's first win (see the session result screen).
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') void rescheduleReminders();
    });
    return () => sub.remove();
  }, []);
}
