import { useEffect, useState, type ReactNode } from 'react';
import { Keyboard, Modal, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useReducedMotion } from '../feedback/reducedMotion';
import { colors, radius, space } from '../tokens';
import { AppText } from './AppText';

export function BottomSheet({
  visible,
  onClose,
  title,
  children,
}: {
  visible: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}) {
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();
  // lift the sheet above the keyboard (works with Android edge-to-edge, where the window doesn't resize)
  const [kb, setKb] = useState(0);
  useEffect(() => {
    if (!visible) return;
    const show = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow', (e) => setKb(e.endCoordinates.height));
    const hide = Keyboard.addListener(Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide', () => setKb(0));
    return () => {
      show.remove();
      hide.remove();
      setKb(0);
    };
  }, [visible]);
  return (
    <Modal visible={visible} transparent animationType={reduced ? 'none' : 'slide'} onRequestClose={onClose} statusBarTranslucent>
      {/* the keyboard pushes the sheet up, so a text field in it stays visible while typing */}
      <View style={[styles.flex, { paddingBottom: kb }]}>
        <Pressable style={styles.overlay} onPress={onClose} accessibilityLabel="סגור" accessibilityRole="button" />
        <View style={[styles.sheet, { paddingBottom: (kb ? 0 : insets.bottom) + space.lg }]} accessibilityViewIsModal>
          <View style={styles.grabber} />
          <AppText variant="heading">{title}</AppText>
          {children}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  overlay: { flex: 1, backgroundColor: colors.overlay },
  sheet: {
    backgroundColor: '#1B1048',
    shadowColor: colors.led,
    shadowOpacity: 0.35,
    shadowRadius: 18,
    elevation: 16,
    borderTopStartRadius: radius.sheet,
    borderTopEndRadius: radius.sheet,
    borderTopWidth: 2,
    borderColor: colors.led,
    padding: space.xl,
    gap: space.lg,
  },
  grabber: { alignSelf: 'center', width: 44, height: 5, borderRadius: 3, backgroundColor: colors.border },
});
