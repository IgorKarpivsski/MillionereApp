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
      set: (patch) => set(patch),
      hydrateFromServer: (s) =>
        set({ sound: s.sound, music: s.music, haptics: s.haptics, reducedMotion: s.reduced_motion }),
    }),
    {
      name: 'fm.settings.v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: ({ sound, music, haptics, reducedMotion, largeText }) => ({ sound, music, haptics, reducedMotion, largeText }),
    },
  ),
);
