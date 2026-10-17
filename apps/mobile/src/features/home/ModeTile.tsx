import { LinearGradient } from 'expo-linear-gradient';
import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText, Icon, Sheen, type IconName } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, palette, space } from '@/design-system/tokens';

/** One game mode on the home screen: a glossy colored card with a sticker icon. */
export function ModeTile({
  title,
  body,
  icon,
  art,
  colors: grad,
  chip,
  chipTone = 'dark',
  wide = false,
  index = 0,
  onPress,
  style,
  children,
}: {
  title: string;
  body?: string;
  icon?: IconName;
  art?: ReactNode;
  colors: [string, string, ...string[]];
  chip?: string | null;
  chipTone?: 'dark' | 'gold' | 'red' | 'green';
  wide?: boolean;
  index?: number;
  onPress: () => void;
  style?: ViewStyle;
  children?: ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <Animated.View entering={reduced ? undefined : FadeInDown.delay(80 + index * 60).springify().damping(16)} style={[wide ? styles.wideWrap : styles.wrap, style]}>
      <Pressable
        onPress={() => {
          haptic('tap');
          onPress();
        }}
        accessibilityRole="button"
        accessibilityLabel={body ? `${title}. ${body}${chip ? `. ${chip}` : ''}` : title}
        style={({ pressed }) => [styles.tile, wide && styles.wide, pressed && styles.pressed]}
      >
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <Sheen strength={0.5} />
        <View style={styles.blob} />
        <View style={wide ? styles.wideArt : styles.art}>{art ?? (icon ? <Icon name={icon} size={wide ? 64 : 52} /> : null)}</View>
        <View style={wide ? styles.wideText : styles.text}>
          <AppText variant="heading" numberOfLines={1} style={styles.title}>
            {title}
          </AppText>
          {body ? (
            <AppText variant="caption" numberOfLines={wide ? 3 : 2} style={styles.body}>
              {body}
            </AppText>
          ) : null}
          {children}
        </View>
        {chip ? (
          <View style={[styles.chip, chipTone === 'gold' && styles.chipGold, chipTone === 'red' && styles.chipRed, chipTone === 'green' && styles.chipGreen]}>
            <AppText variant="caption" color={chipTone === 'gold' ? palette.night950 : colors.text} style={styles.chipText} numberOfLines={1}>
              {chip}
            </AppText>
          </View>
        ) : null}
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1 },
  wideWrap: { alignSelf: 'stretch' },
  tile: {
    minHeight: 148,
    padding: space.md,
    borderRadius: 22,
    overflow: 'hidden',
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
    gap: space.xs,
    shadowColor: '#000',
    shadowOpacity: 0.35,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 8,
  },
  wide: { minHeight: 0, flexDirection: 'row', alignItems: 'center', gap: space.md },
  pressed: { transform: [{ scale: 0.96 }] },
  blob: {
    position: 'absolute',
    width: 130,
    height: 130,
    borderRadius: 65,
    backgroundColor: 'rgba(255,255,255,0.12)',
    bottom: -50,
    end: -40,
  },
  art: { alignItems: 'flex-start' },
  wideArt: { width: 72, alignItems: 'center' },
  text: { gap: 2 },
  wideText: { flex: 1, gap: 2 },
  title: { textShadowColor: 'rgba(0,0,0,0.35)', textShadowRadius: 4, textShadowOffset: { width: 0, height: 1 } },
  body: { color: 'rgba(255,255,255,0.92)', fontFamily: 'IBMPlexSansHebrew_600SemiBold' },
  chip: {
    position: 'absolute',
    top: space.sm,
    end: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 2,
    borderRadius: 999,
    backgroundColor: 'rgba(14,8,40,0.55)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  chipGold: { backgroundColor: colors.led, borderColor: '#FFF3C4' },
  chipRed: { backgroundColor: colors.danger, borderColor: '#FFB4AE' },
  chipGreen: { backgroundColor: '#1E9E5A' },
  chipText: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});
