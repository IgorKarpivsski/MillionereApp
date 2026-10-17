import { MyStateSchema } from '@fm/shared';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Pressable, StyleSheet, View } from 'react-native';
import { create } from 'zustand';
import { AppText, BottomSheet } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, palette, space } from '@/design-system/tokens';
import { strings } from '@/lib/i18n';
import { queryKeys } from '@/lib/queryClient';
import { rpc } from './api';
import { useMyState } from './hooks';

export type Gender = 'male' | 'female' | 'other';

const t = strings.gender;
const EMOJI: Record<Gender, string> = { male: '👦', female: '👧', other: '🙂' };

/** Saves the player's gender (drives Hebrew wording: מוכן / מוכנה). */
export function useSaveGender() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (g: Gender) =>
      rpc('save_preferences', { p_gender: g, p_worlds: null }, (x) => MyStateSchema.parse(x)),
    onSuccess: (st) => qc.setQueryData(queryKeys.myState, st),
  });
}

/** Three big choice buttons: בן / בת / אחר. */
export function GenderChoice({ value, onPick, disabled }: { value: Gender | null | undefined; onPick: (g: Gender) => void; disabled?: boolean }) {
  return (
    <View style={styles.row} accessibilityRole="radiogroup">
      {(['male', 'female', 'other'] as const).map((g) => {
        const on = value === g;
        return (
          <Pressable
            key={g}
            disabled={disabled}
            onPress={() => {
              haptic('select');
              onPick(g);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            accessibilityLabel={t[g]}
            style={({ pressed }) => [styles.choice, on && styles.choiceOn, pressed && styles.pressed]}
          >
            <AppText style={styles.emoji}>{EMOJI[g]}</AppText>
            <AppText variant="label" color={on ? palette.night950 : colors.text}>
              {t[g]}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

/** Closed for this app session, so a skip doesn't nag again until the next launch. */
export const useGenderPromptStore = create<{ dismissed: boolean; dismiss: () => void }>((set) => ({
  dismissed: false,
  dismiss: () => set({ dismissed: true }),
}));

/**
 * Players who joined before the "about you" step never told us whether they're
 * a boy or a girl, so the sloth spoke to everyone in the masculine. Ask once.
 */
export function GenderPrompt({ enabled }: { enabled: boolean }) {
  const { data } = useMyState();
  const dismissed = useGenderPromptStore((s) => s.dismissed);
  const dismiss = useGenderPromptStore((s) => s.dismiss);
  const save = useSaveGender();
  const visible = enabled && !!data && data.profile.gender == null && !dismissed;
  return (
    <BottomSheet visible={visible} onClose={dismiss} title={t.promptTitle}>
      <AppText color={colors.textMuted}>{t.promptBody}</AppText>
      <GenderChoice
        value={save.variables}
        disabled={save.isPending}
        onPick={(g) =>
          save.mutate(g, {
            onSettled: dismiss,
          })
        }
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.sm },
  choice: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.sm,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  choiceOn: { backgroundColor: colors.led, borderColor: '#FFF3C4' },
  pressed: { opacity: 0.75 },
  emoji: { fontSize: 30, lineHeight: 38 },
});
