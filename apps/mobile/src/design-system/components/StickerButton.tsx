import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withSpring, withTiming } from 'react-native-reanimated';
import { haptic } from '../feedback/haptics';
import { useReducedMotion } from '../feedback/reducedMotion';
import { colors, hitTarget, lip as lipDepth, palette, radius, space, spring } from '../tokens';
import { AppText } from './AppText';

type Tone = 'primary' | 'prize' | 'danger' | 'gem' | 'ghost' | 'outline';
type Size = 'lg' | 'md' | 'sm';

const tones: Record<Tone, { face: string; lip: string; label: string; border?: string }> = {
  primary: { face: colors.primary, lip: colors.primaryLip, label: colors.textOnBright },
  prize: { face: colors.prize, lip: colors.prizeLip, label: colors.textOnBright },
  danger: { face: colors.danger, lip: colors.dangerLip, label: colors.textOnBright },
  gem: { face: colors.gem, lip: colors.gemLip, label: colors.textOnBright },
  ghost: { face: colors.board, lip: palette.night950, label: colors.text, border: colors.border },
  outline: { face: colors.board, lip: palette.night950, label: colors.led, border: colors.led },
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
  style,
}: StickerButtonProps) {
  const t = tones[tone];
  const h = heights[size];
  const depth = size === 'sm' ? lipDepth.small : lipDepth.button;
  const reduced = useReducedMotion();
  const pressed = useSharedValue(0);
  const inactive = disabled || loading;

  const faceStyle = useAnimatedStyle(() => ({ transform: [{ translateY: pressed.value * depth }] }));

  const animateTo = (v: number) => {
    pressed.value = reduced ? withTiming(v, { duration: 0 }) : withSpring(v, spring.press);
  };

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={accessibilityHint}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPressIn={() => {
        animateTo(1);
        haptic('tap');
      }}
      onPressOut={() => animateTo(0)}
      onPress={onPress}
      hitSlop={size === 'sm' ? 6 : 0}
      style={[{ height: h + depth, opacity: inactive && !loading ? 0.45 : 1 }, fullWidth && styles.full, style]}
    >
      <View style={[styles.lip, { top: depth, height: h, backgroundColor: t.lip }]} />
      <Animated.View
        style={[
          styles.face,
          { height: h, backgroundColor: t.face, paddingHorizontal: size === 'sm' ? space.lg : space.xl },
          t.border ? { borderWidth: 2, borderColor: t.border } : null,
          faceStyle,
        ]}
      >
        {loading ? (
          <ActivityIndicator color={t.label} />
        ) : (
          <>
            {icon ? <Ionicons name={icon} size={size === 'lg' ? 24 : 20} color={t.label} /> : null}
            <AppText variant={size === 'sm' ? 'label' : 'button'} color={t.label} numberOfLines={1}>
              {label}
            </AppText>
          </>
        )}
      </Animated.View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  full: { alignSelf: 'stretch' },
  lip: { position: 'absolute', start: 0, end: 0, borderRadius: radius.control },
  face: {
    borderRadius: radius.control,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: space.sm,
  },
});
