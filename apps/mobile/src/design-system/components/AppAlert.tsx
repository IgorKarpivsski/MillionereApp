import { usePathname } from 'expo-router';
import { useEffect } from 'react';
import { Modal, StyleSheet, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { create } from 'zustand';
import { useReducedMotion } from '../feedback/reducedMotion';
import { colors, radius, space } from '../tokens';
import { AppText } from './AppText';
import { Sloth } from './Sloth';
import { StickerButton } from './StickerButton';

export interface AppAlertButton {
  text: string;
  style?: 'default' | 'cancel' | 'destructive';
  onPress?: () => void;
}

interface AlertState {
  open: { title: string; message?: string; buttons: AppAlertButton[] } | null;
  show: (title: string, message?: string, buttons?: AppAlertButton[]) => void;
  close: () => void;
}

const useAppAlert = create<AlertState>((set) => ({
  open: null,
  show: (title, message, buttons) => set({ open: { title, message: message || undefined, buttons: buttons?.length ? buttons : [{ text: 'אישור' }] } }),
  close: () => set({ open: null }),
}));

/**
 * The app's own confirm dialog, in the app's look (replaces the white system Alert).
 * Same call shape as Alert.alert: appAlert(title, message?, buttons?).
 */
export function appAlert(title: string, message?: string, buttons?: AppAlertButton[]): void {
  useAppAlert.getState().show(title, message, buttons);
}

/**
 * Which button is the big one: with a "leave/delete" choice on offer, the safe choice
 * (keep playing, cancel) is the big yellow one; otherwise the last ordinary button.
 */
function order(buttons: AppAlertButton[]): { primary: AppAlertButton; rest: AppAlertButton[] } {
  const destructive = buttons.some((b) => b.style === 'destructive');
  const cancel = buttons.find((b) => b.style === 'cancel');
  const primary = destructive && cancel ? cancel : [...buttons].reverse().find((b) => b.style !== 'cancel') ?? buttons[0]!;
  return { primary, rest: buttons.filter((b) => b !== primary) };
}

/** Mount once at the root. */
export function AppAlertHost() {
  const open = useAppAlert((s) => s.open);
  const close = useAppAlert((s) => s.close);
  const reduced = useReducedMotion();
  // a dialog belongs to the screen that asked: leaving that screen closes it
  const path = usePathname();
  useEffect(() => close(), [path, close]);
  if (!open) return null;
  const { primary, rest } = order(open.buttons);
  const press = (b: AppAlertButton) => () => {
    close();
    b.onPress?.();
  };
  const cancel = open.buttons.find((b) => b.style === 'cancel');
  return (
    <Modal transparent visible animationType="none" onRequestClose={() => (cancel ? press(cancel)() : close())} statusBarTranslucent>
      <Animated.View entering={reduced ? undefined : FadeIn.duration(150)} style={styles.backdrop}>
        <Animated.View entering={reduced ? undefined : ZoomIn.duration(200)} style={styles.card} accessibilityViewIsModal>
          <Sloth head size={64} bob={false} />
          <AppText variant="heading" align="center">
            {open.title}
          </AppText>
          {open.message ? (
            <AppText color={colors.textMuted} align="center">
              {open.message}
            </AppText>
          ) : null}
          <View style={styles.buttons}>
            <StickerButton
              label={primary.text}
              tone={primary.style === 'destructive' ? 'danger' : 'prize'}
              size="lg"
              fullWidth
              onPress={press(primary)}
            />
            {rest.map((b) => (
              <StickerButton
                key={b.text}
                label={b.text}
                tone={b.style === 'destructive' ? 'danger' : 'outline'}
                fullWidth
                onPress={press(b)}
              />
            ))}
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(8,4,24,0.72)', alignItems: 'center', justifyContent: 'center', padding: space.lg },
  card: {
    width: '100%',
    maxWidth: 420,
    alignItems: 'center',
    gap: space.sm,
    padding: space.lg,
    borderRadius: radius.board,
    backgroundColor: '#2A1A63',
    borderWidth: 2,
    borderColor: 'rgba(255,214,140,0.55)',
  },
  buttons: { alignSelf: 'stretch', gap: space.sm, marginTop: space.sm },
});
