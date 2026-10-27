import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Platform, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '../feedback/haptics';
import { useReducedMotion } from '../feedback/reducedMotion';
import { colors, hitTarget, lip as lipDepth, palette, radius, space, spring } from '../tokens';
import { AppText } from './AppText';
import { useToast } from './Toast';

type Tone = 'primary' | 'prize' | 'danger' | 'gem' | 'ghost' | 'outline';
type Size = 'lg' | 'md' | 'sm';

const tones: Record<Tone | 'locked', { face: string; lip: string; label: string; border?: string }> = {
  primary: { face: colors.primary, lip: colors.primaryLip, label: colors.textOnBright },
  prize: { face: colors.prize, lip: colors.prizeLip, label: colors.textOnBright },
  danger: { face: colors.danger, lip: colors.dangerLip, label: colors.textOnBright },
  gem: { face: colors.gem, lip: colors.gemLip, label: colors.textOnBright },
  locked: { face: '#4B4766', lip: '#26233A', label: '#B9B5CC' },
  ghost: { face: '#2A1C66', lip: '#0E0826', label: colors.text, border: 'rgba(255,214,140,0.28)' },
  outline: { face: '#211552', lip: '#0E0826', label: colors.led, border: colors.led },
};

const heights: Record<Size, number> = { lg: 58, md: 50, sm: hitTarget };

export interface StickerButtonProps {
  label: string;
  onPress: () => void;
  tone?: Tone;
  size?: Size;
  icon?: ComponentProps<typeof Ionicons>['name'];
  disabled?: boolean;
  loading?: boolean;
  fullWidth?: boolean;
  accessibilityHint?: string;
  /** Why the button is off (no coins, no tickets): tapping the grey button says so. */
  disabledReason?: string;
  style?: ViewStyle;
}

/**
 * The main control: a lit scoreboard key with a short solid "lip" underneath.
 * Pressing pushes the face down onto the lip — a physical click, no shadows.
 */
export function StickerButton({
  label,
  onPress,
  tone = 'primary',
  size = 'md',
  icon,
  disabled = false,
  loading = false,
  fullWidth = false,
  accessibilityHint,
  disabledReason,
  style,
}: StickerButtonProps) {
  // a disabled button is grey with a lock, so it never looks like it can be pressed
  const locked = disabled && !loading;
  const t = tones[locked ? 'locked' : tone];
  const toast = useToast();
  const h = heights[size];
  const depth = size === 'sm' ? lipDepth.small : lipDepth.button;
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const inactive = disabled || loading;
  const bright = !locked && tone !== 'ghost' && tone !== 'outline';
  // Glow only where it's a pure shadow (iOS). Android elevation lifts the lip into its own
  // layer, and on some phones the face's label then disappears behind it.
  const glow = bright && !inactive && Platform.OS === 'ios';

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * depth }] }));

  const animateTo = (v: number) => {
    pressed.value = reduced ? withTiming(v, { duration: 0 }) : withSpring(v, spring.press);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={locked && disabledReason ? disabledReason : accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={loading || (locked && !disabledReason)}
      onPressIn={() => {
        if (locked) return;
        animateTo(1);
        haptic('tap');
      }}
      onPressOut={() => animateTo(0)}
      onPress={() => {
        if (locked) {
          haptic('error');
          if (disabledReason) toast(disabledReason, 'info');
          return;
        }
        onPress();
      }}
      hitSlop={size === 'sm' ? 6 : 0}
      style={[{ height: h + depth, opacity: locked ? 0.85 : 1 }, fullWidth && styles.full, style]}
    >
      <View
        style={[
          styles.lip,
          { top: depth, height: h, backgroundColor: t.lip },
          glow ? { shadowColor: t.face, shadowOpacity: 0.7, shadowRadius: 12 } : null,
        ]}
      />
      {/* The face. Its colour and shine sit in their own clipped layer and the label in a plain row
          above it: some Android phones (Samsung) drop the children of a borderless view that clips
          with rounded corners, which left bright buttons blank. */}
      <Animated.View style={[styles.face, { height: h }, faceStyle]}>
        <View
          pointerEvents="none"
          style={[styles.faceFill, { backgroundColor: t.face }, t.border ? { borderWidth: 2, borderColor: t.border } : null]}
        >
          <LinearGradient
            colors={bright ? ['rgba(255,255,255,0.45)', 'rgba(255,255,255,0.05)', 'rgba(0,0,0,0.08)'] : ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)']}
            locations={bright ? [0, 0.5, 1] : [0, 0.6]}
            style={StyleSheet.absoluteFill}
          />
        </View>
        <View style={[styles.content, { paddingHorizontal: size === 'sm' ? space.lg : space.xl }]}>
          {loading ? (
            <ActivityIndicator color={t.label} />
          ) : (
            <>
              {locked ? (
                <Ionicons name="lock-closed" size={size === 'lg' ? 22 : 18} color={t.label} />
              ) : icon ? (
                <Ionicons name={icon} size={size === 'lg' ? 24 : 20} color={t.label} />
              ) : null}
              <AppText variant={size === 'sm' ? 'label' : 'button'} color={t.label} numberOfLines={1} style={styles.label}>
                {label}
              </AppText>
            </>
          )}
        </View>
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  label: { flexShrink: 1, zIndex: 1 },
  lip: { position: 'absolute', start: 0, end: 0, borderRadius: radius.control },
  face: { borderRadius: radius.control },
  faceFill: { ...StyleSheet.absoluteFillObject, borderRadius: radius.control, overflow: 'hidden' },
  content: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
});
