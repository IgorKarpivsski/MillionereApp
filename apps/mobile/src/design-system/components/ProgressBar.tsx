import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withTiming, Easing } from 'react-native-reanimated';
import { useDuration } from '../feedback/reducedMotion';
import { colors, palette } from '../tokens';

export interface ProgressBarProps {
  /** 0..1 */
  value: number;
  color?: string;
  height?: number;
  accessibilityLabel: string;
}

export function ProgressBar({ value, color = colors.primary, height = 12, accessibilityLabel }: ProgressBarProps) {
  const clamped = Math.max(0, Math.min(1, value));
  const width = useSharedValue(0);
  const d = useDuration('reveal');

  useEffect(() => {
    width.value = withTiming(clamped, { duration: d, easing: Easing.out(Easing.cubic) });
  }, [clamped, d, width]);

  const fill = useAnimatedStyle(() => ({ width: `${width.value * 100}%` }));

  return (
    <View
      accessible
      accessibilityRole="progressbar"
      accessibilityLabel={accessibilityLabel}
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={[styles.track, { height, borderRadius: height / 2 }]}
    >
      <Animated.View style={[styles.fill, { backgroundColor: color, borderRadius: height / 2 }, fill]}>
        <View style={[styles.shine, { borderRadius: height / 2 }]} />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: { backgroundColor: palette.night950, overflow: 'hidden', borderWidth: 2, borderColor: colors.border },
  fill: { height: '100%' },
  shine: { position: 'absolute', top: 2, start: 4, end: 4, height: 3, backgroundColor: 'rgba(255,255,255,0.35)' },
});
