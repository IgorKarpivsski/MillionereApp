import { createContext, useCallback, useContext, useRef, useState, type ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { FadeInUp, FadeOutUp } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { haptic } from '../feedback/haptics';
import { useReducedMotion } from '../feedback/reducedMotion';
import { colors, palette, radius, space } from '../tokens';
import { AppText } from './AppText';

type Tone = 'success' | 'error' | 'info';
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
}

const ToastContext = createContext<(message: string, tone?: Tone) => void>(() => {});

const toneColor: Record<Tone, string> = {
  success: colors.success,
  error: colors.error,
  info: colors.gem,
};

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toast, setToast] = useState<ToastItem | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const insets = useSafeAreaInsets();
  const reduced = useReducedMotion();

  const show = useCallback((message: string, tone: Tone = 'info') => {
    if (timer.current) clearTimeout(timer.current);
    setToast({ id: Date.now(), message, tone });
    haptic(tone === 'error' ? 'error' : tone === 'success' ? 'success' : 'select');
    timer.current = setTimeout(() => setToast(null), 3200);
  }, []);

  return (
    <ToastContext.Provider value={show}>
      {children}
      <View pointerEvents="none" style={[styles.host, { top: insets.top + space.sm }]}>
        {toast ? (
          <Animated.View
            key={toast.id}
            entering={reduced ? undefined : FadeInUp.springify().damping(16)}
            exiting={reduced ? undefined : FadeOutUp}
            accessibilityLiveRegion="polite"
            accessibilityRole="alert"
            style={[styles.toast, { borderColor: toneColor[toast.tone] }]}
          >
            <View style={[styles.dot, { backgroundColor: toneColor[toast.tone] }]} />
            <AppText variant="bodyStrong" style={styles.text}>
              {toast.message}
            </AppText>
          </Animated.View>
        ) : null}
      </View>
    </ToastContext.Provider>
  );
}

export function useToast() {
  return useContext(ToastContext);
}

const styles = StyleSheet.create({
  host: { position: 'absolute', start: space.lg, end: space.lg, alignItems: 'center' },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingVertical: space.md,
    paddingHorizontal: space.lg,
    borderRadius: radius.control,
    backgroundColor: palette.night950,
    borderWidth: 2,
    maxWidth: 480,
  },
  dot: { width: 10, height: 10, borderRadius: 5 },
  text: { flexShrink: 1 },
});
