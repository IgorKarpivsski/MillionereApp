import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { MyState } from '@fm/shared';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/queryClient';
import { updateSettings } from '@/features/profile/api';
import { useSettingsStore } from './store';

type ToggleKey = 'sound' | 'music' | 'haptics' | 'reducedMotion' | 'extendedTime';
const serverKey: Record<ToggleKey, string> = {
  sound: 'sound',
  music: 'music',
  haptics: 'haptics',
  reducedMotion: 'reduced_motion',
  extendedTime: 'extended_time',
};

/** Optimistic toggle: flips locally at once, syncs to the server, rolls back on failure. */
export function useToggleSetting() {
  const qc = useQueryClient();
  const setLocal = useSettingsStore((s) => s.set);

  return useMutation({
    mutationFn: ({ key, value }: { key: ToggleKey; value: boolean }) =>
      updateSettings({ [serverKey[key]]: value }),
    onMutate: ({ key, value }) => {
      const previous = useSettingsStore.getState()[key];
      setLocal({ [key]: value });
      return { previous };
    },
    onError: (_e, { key }, ctx) => {
      if (ctx) setLocal({ [key]: ctx.previous });
    },
    onSuccess: (state: MyState, { key, value }) => {
      qc.setQueryData(queryKeys.myState, state);
      track('settings_changed', { key, value });
    },
  });
}
