import AsyncStorage from '@react-native-async-storage/async-storage';
import { usePathname } from 'expo-router';
import { useEffect, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { StickerButton } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, space } from '@/design-system/tokens';
import { strings } from '@/lib/i18n';
import { DealCard } from './DealCard';
import { useDeals } from './hooks';

const KEY = 'deal-popup-seen-window';

/**
 * Pops the new deal once per deal window, only on the home screen and a few
 * seconds after it settles — never in the middle of a game.
 */
export function DealPopup() {
  const { data } = useDeals();
  const path = usePathname();
  const reduced = useReducedMotion();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!data || data.bought || path !== '/') return;
    let cancelled = false;
    const id = setTimeout(async () => {
      try {
        const seen = await AsyncStorage.getItem(KEY);
        if (cancelled || seen === String(data.window)) return;
        await AsyncStorage.setItem(KEY, String(data.window));
        setOpen(true);
      } catch {
        // storage unavailable: skip the popup rather than nag every launch
      }
    }, 3500);
    return () => {
      cancelled = true;
      clearTimeout(id);
    };
  }, [data, path]);

  if (!data) return null;
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
      <Pressable style={styles.overlay} onPress={() => setOpen(false)} accessibilityRole="button" accessibilityLabel={strings.common.close} />
      <View style={styles.center} pointerEvents="box-none">
        <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(14)} style={styles.box} accessibilityViewIsModal>
          <DealCard state={data} onDone={() => setOpen(false)} />
          <StickerButton label={strings.engage.later} tone="ghost" fullWidth onPress={() => setOpen(false)} />
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: colors.overlay },
  center: { flex: 1, justifyContent: 'center', padding: space.lg },
  box: { gap: space.sm },
});
