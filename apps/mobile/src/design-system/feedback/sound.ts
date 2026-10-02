import { useSettingsStore } from '@/features/settings/store';

/**
 * Sound effects registry. Phase 1 ships no audio files: every cue below must be
 * an ORIGINAL sound (commissioned or CC0 with a recorded source in
 * LICENSES/ASSETS.md). No broadcast, stadium-chant or TV-show audio.
 * Playback (expo-audio) is wired in Phase 2 together with the quiz.
 */
export type SoundCue =
  | 'tap'
  | 'answer_lock'
  | 'answer_correct'
  | 'answer_wrong'
  | 'coins'
  | 'pack_open'
  | 'rare_reveal'
  | 'level_up';

export function playSound(cue: SoundCue): void {
  if (!useSettingsStore.getState().sound) return;
  if (__DEV__) console.log(`[sound] ${cue}`);
}
