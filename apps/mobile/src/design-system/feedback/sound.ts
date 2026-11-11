import { createAudioPlayer, type AudioPlayer } from 'expo-audio';
import { useSettingsStore } from '@/features/settings/store';

/**
 * Sound effects. Every file in assets/sounds is ORIGINAL: synthesized by
 * tools/scripts/gen-sounds.py from plain waveforms and filtered noise.
 * No broadcast, stadium-chant or TV-show audio (see LICENSES/ASSETS.md).
 */
export type SoundCue =
  | 'tap'
  | 'tick'
  | 'whistle'
  | 'answer_lock'
  | 'answer_correct'
  | 'answer_wrong'
  | 'var'
  | 'coins'
  | 'pack_open'
  | 'rare_reveal'
  | 'level_up'
  | 'pick'
  | 'place'
  | 'solved'
  | 'combo_2'
  | 'combo_3'
  | 'combo_4'
  | 'combo_5'
  | 'chest_open';

const SOURCES: Record<SoundCue, number> = {
  tap: require('../../../assets/sounds/tap.wav'),
  tick: require('../../../assets/sounds/tick.wav'),
  whistle: require('../../../assets/sounds/whistle.wav'),
  answer_lock: require('../../../assets/sounds/answer_lock.wav'),
  answer_correct: require('../../../assets/sounds/answer_correct.wav'),
  answer_wrong: require('../../../assets/sounds/answer_wrong.wav'),
  var: require('../../../assets/sounds/var.wav'),
  coins: require('../../../assets/sounds/coins.wav'),
  pack_open: require('../../../assets/sounds/pack_open.wav'),
  rare_reveal: require('../../../assets/sounds/rare_reveal.wav'),
  level_up: require('../../../assets/sounds/level_up.wav'),
  pick: require('../../../assets/sounds/pick.wav'),
  place: require('../../../assets/sounds/place.wav'),
  solved: require('../../../assets/sounds/solved.wav'),
  combo_2: require('../../../assets/sounds/combo_2.wav'),
  combo_3: require('../../../assets/sounds/combo_3.wav'),
  combo_4: require('../../../assets/sounds/combo_4.wav'),
  combo_5: require('../../../assets/sounds/combo_5.wav'),
  chest_open: require('../../../assets/sounds/chest_open.wav'),
};

const players: Partial<Record<SoundCue, AudioPlayer>> = {};

function player(cue: SoundCue): AudioPlayer | null {
  try {
    players[cue] ??= createAudioPlayer(SOURCES[cue]);
    return players[cue] ?? null;
  } catch {
    return null; // audio is a nice-to-have; never crash the game over it
  }
}

/** Loads the quiz cues ahead of time so the first answer isn't silent. */
export function preloadSounds(cues: SoundCue[]): void {
  for (const c of cues) player(c);
}

export function playSound(cue: SoundCue): void {
  if (!useSettingsStore.getState().sound) return;
  const p = player(cue);
  if (!p) return;
  try {
    void p.seekTo(0);
    p.play();
  } catch {
    /* ignore */
  }
}
