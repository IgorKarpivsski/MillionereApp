import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { AppText, BottomSheet } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, radius, space } from '@/design-system/tokens';
import { refreshAdAudience } from '@/features/store/ads';
import { strings } from '@/lib/i18n';
import { useSettingsStore } from './store';

const AGES = [6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17];
const t = strings.ageGate;

/**
 * Neutral age screen, asked once per device (Google Play Families policy for
 * mixed-audience apps). Every age is shown the same way, with no default and no
 * hint about what changes. Only the band is kept, on the device.
 */
export function AgeGate() {
  const ageBand = useSettingsStore((s) => s.ageBand);
  const set = useSettingsStore((s) => s.set);
  const [ready, setReady] = useState(useSettingsStore.persist.hasHydrated());

  useEffect(() => useSettingsStore.persist.onFinishHydration(() => setReady(true)), []);

  const pick = (age: number) => {
    haptic('select');
    set({ ageBand: age < 13 ? 'under13' : age < 16 ? '13to15' : '16plus' });
    refreshAdAudience();
  };

  return (
    <BottomSheet visible={ready && ageBand === null} onClose={() => undefined} title={t.title}>
      <AppText color={colors.textMuted} align="center">
        {t.body}
      </AppText>
      <View style={styles.grid}>
        {AGES.map((a) => (
          <Pressable key={a} onPress={() => pick(a)} accessibilityRole="button" accessibilityLabel={String(a)} style={styles.cell}>
            <AppText variant="heading">{a}</AppText>
          </Pressable>
        ))}
        <Pressable onPress={() => pick(18)} accessibilityRole="button" accessibilityLabel={t.adult} style={[styles.cell, styles.wide]}>
          <AppText variant="heading">{t.adult}</AppText>
        </Pressable>
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center', marginVertical: space.md },
  cell: {
    width: 64,
    height: 56,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  wide: { width: 64 * 2 + space.sm },
});
