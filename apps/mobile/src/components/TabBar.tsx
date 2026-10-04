import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withTiming } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, palette, radius, space } from '@/design-system/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];
const ICONS: Record<string, { on: IconName; off: IconName }> = {
  index: { on: 'home', off: 'home-outline' },
  play: { on: 'football', off: 'football-outline' },
  packs: { on: 'gift', off: 'gift-outline' },
  collection: { on: 'albums', off: 'albums-outline' },
  profile: { on: 'person-circle', off: 'person-circle-outline' },
  leaderboard: { on: 'podium', off: 'podium-outline' },
};
/** Routes reachable from elsewhere (e.g. the profile from the top bar) but not shown as tabs. */
const HIDDEN = new Set(['profile']);

function Tab({
  label,
  name,
  focused,
  onPress,
}: {
  label: string;
  name: string;
  focused: boolean;
  onPress: () => void;
}) {
  const icon = ICONS[name] ?? ICONS.index!;
  const reduced = useReducedMotion();
  const glow = useAnimatedStyle(() => ({
    opacity: reduced ? (focused ? 1 : 0) : withTiming(focused ? 1 : 0, { duration: 180 }),
  }));
  const tint = focused ? colors.led : colors.textDim;
  return (
    <Pressable
      onPress={() => {
        haptic('select');
        onPress();
      }}
      accessibilityRole="tab"
      accessibilityState={{ selected: focused }}
      accessibilityLabel={label}
      style={styles.tab}
    >
      <Animated.View style={[styles.lamp, glow]} />
      <Ionicons name={focused ? icon.on : icon.off} size={23} color={tint} />
      <AppText variant="caption" color={tint} numberOfLines={1} style={focused ? styles.on : null}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Scoreboard tab bar: the active tab lights up in LED amber. Order follows the route order (rightmost first in RTL). */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
          if (HIDDEN.has(route.name)) return null;
          const options = descriptors[route.key]?.options;
          const label = typeof options?.title === 'string' ? options.title : route.name;
          const focused = state.index === i;
          return (
            <Tab
              key={route.key}
              name={route.name}
              label={label}
              focused={focused}
              onPress={() => {
                const event = navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
                if (!focused && !event.defaultPrevented) navigation.navigate(route.name);
              }}
            />
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  outer: { position: 'absolute', start: 0, end: 0, bottom: 0, paddingHorizontal: space.md },
  bar: {
    flexDirection: 'row',
    backgroundColor: palette.night950,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
  },
  tab: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 2, minHeight: 52 },
  lamp: {
    position: 'absolute',
    top: -space.sm - 1,
    width: 28,
    height: 3,
    borderRadius: 2,
    backgroundColor: colors.led,
  },
  on: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});
