import { createAudioPlayer, setAudioModeAsync, type AudioPlayer } from 'expo-audio';
import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { AppState } from 'react-native';
import { useSettingsStore } from '@/features/settings/store';

/**
 * Background music: one ORIGINAL looping tune (tools/scripts/gen-music.py).
 * Plays only while the app is in the foreground and the "מוזיקה" setting is on;
 * it ducks during games so the timer and answer sounds stay clear.
 */
let theme: AudioPlayer | null = null;
function get(): AudioPlayer | null {
  try {
    if (!theme) {
      theme = createAudioPlayer(require('../../../assets/music/theme.m4a'));
      theme.loop = true;
    }
    return theme;
  } catch {
    return null;
  }
}

const QUIET = ['/quiz', '/match', '/session'];

export function useBackgroundMusic(): void {
  const on = useSettingsStore((s) => s.music);
  const path = usePathname();
  const quiet = QUIET.some((p) => path.startsWith(p));

  useEffect(() => {
    void setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
  }, []);

  useEffect(() => {
    const p = get();
    if (!p) return;
    const apply = (state: string) => {
      try {
        if (on && state === 'active') {
          p.volume = quiet ? 0.08 : 0.3;
          p.play();
        } else {
          p.pause();
        }
      } catch {
        /* audio is optional */
      }
    };
    apply(AppState.currentState);
    const sub = AppState.addEventListener('change', apply);
    return () => sub.remove();
  }, [on, quiet]);
}
