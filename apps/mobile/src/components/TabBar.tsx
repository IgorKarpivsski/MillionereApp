import { Ionicons } from '@expo/vector-icons';
import type { BottomTabBarProps } from '@react-navigation/bottom-tabs';
import type { ComponentProps } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import Animated, { useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, palette, radius, space, spring } from '@/design-system/tokens';

type IconName = ComponentProps<typeof Ionicons>['name'];
const ICONS: Record<string, { on: IconName; off: IconName; accent: string }> = {
  index: { on: 'home', off: 'home-outline', accent: colors.primary },
  play: { on: 'football', off: 'football-outline', accent: colors.primary },
  packs: { on: 'gift', off: 'gift-outline', accent: colors.prize },
  collection: { on: 'albums', off: 'albums-outline', accent: colors.gem },
  profile: { on: 'person-circle', off: 'person-circle-outline', accent: palette.violet },
};

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
  const lift = useAnimatedStyle(() => ({
    transform: [{ translateY: reduced ? 0 : withSpring(focused ? -4 : 0, spring.pop) }],
  }));
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
      <Animated.View style={[styles.iconWrap, focused && { backgroundColor: icon.accent }, lift]}>
        <Ionicons name={focused ? icon.on : icon.off} size={24} color={focused ? colors.textOnBright : colors.textMuted} />
      </Animated.View>
      <AppText variant="caption" color={focused ? colors.text : colors.textMuted} numberOfLines={1}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Chunky sticker-style tab bar. Order follows the route order (rightmost first in RTL). */
export function TabBar({ state, descriptors, navigation }: BottomTabBarProps) {
  const insets = useSafeAreaInsets();
  return (
    <View style={[styles.outer, { paddingBottom: Math.max(insets.bottom, space.sm) }]}>
      <View style={styles.bar} accessibilityRole="tablist">
        {state.routes.map((route, i) => {
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
    borderWidth: 3,
    borderColor: colors.border,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
  },
  tab: { flex: 1, alignItems: 'center', gap: 2, minHeight: 56 },
  iconWrap: { width: 52, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center' },
});
