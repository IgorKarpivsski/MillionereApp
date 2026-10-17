import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Settings } from '@fm/shared';
import { create } from 'zustand';
import { createJSONStorage, persist } from 'zustand/middleware';

/**
 * Local mirror of the user's settings so haptics/sound/motion react instantly
 * and work offline. The server copy (user_settings) is the source of truth
 * across devices; `hydrateFromServer` runs whenever get_my_state returns.
 */
interface SettingsState {
  sound: boolean;
  music: boolean;
  haptics: boolean;
  reducedMotion: boolean;
  /** Accessibility: ~20% bigger text everywhere (on top of the system font size). Device-only. */
  largeText: boolean;
  /** Accessibility: 1.5x answer time (stored on the server, which enforces it). */
  extendedTime: boolean;
  /** Local reminder notifications (wheel, streak, tickets). Device-only. */
  reminders: boolean;
  remindersAsked: boolean;
  /** Last league week whose result popup was shown. */
  leagueSeenWeek: string | null;
  reviewAsked: boolean;
  /** Age band from the neutral age screen (null = not asked yet → treated as a child). Device-only. */
  ageBand: 'under13' | '13to15' | '16plus' | null;
  /** The first-run screens (notifications, age, about you, nickname) are done. Device-only. */
  onboarded: boolean;
  /** The sloth's guided tour of the home screen has been shown (or skipped). Device-only. */
  tourDone: boolean;
  set: (patch: Partial<Omit<SettingsState, 'set' | 'hydrateFromServer'>>) => void;
  hydrateFromServer: (s: Settings) => void;
}

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set) => ({
      sound: true,
      music: true,
      haptics: true,
      reducedMotion: false,
      largeText: false,
      extendedTime: false,
      reminders: true,
      remindersAsked: false,
      leagueSeenWeek: null,
      reviewAsked: false,
      ageBand: null,
      onboarded: false,
      tourDone: false,
      set: (patch) => set(patch),
      hydrateFromServer: (s) =>
        set({ sound: s.sound, music: s.music, haptics: s.haptics, reducedMotion: s.reduced_motion, extendedTime: s.extended_time }),
    }),
    {
      name: 'fm.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      // v1: players who already answered the age question are past the first run
      version: 1,
      migrate: (persisted, version) => {
        const p = (persisted ?? {}) as Record<string, unknown>;
        if (version < 1) {
          const old = p.ageBand != null;
          return { ...p, onboarded: old, tourDone: old } as unknown as SettingsState;
        }
        return p as unknown as SettingsState;
      },
      partialize: ({ sound, music, haptics, reducedMotion, largeText, extendedTime, reminders, remindersAsked, leagueSeenWeek, reviewAsked, ageBand, onboarded, tourDone }) => ({
        sound,
        music,
        haptics,
        reducedMotion,
        largeText,
        extendedTime,
        reminders,
        remindersAsked,
        leagueSeenWeek,
        reviewAsked,
        ageBand,
        onboarded,
        tourDone,
      }),
    },
  ),
);
