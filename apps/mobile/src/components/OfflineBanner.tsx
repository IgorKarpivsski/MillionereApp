import { Ionicons } from '@expo/vector-icons';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { AppText } from '@/design-system/components';
import { colors, palette, space } from '@/design-system/tokens';
import { track } from '@/lib/analytics';
import { strings } from '@/lib/i18n';
import { useIsOnline } from '@/lib/network';

export function OfflineBanner() {
  const online = useIsOnline();
  const insets = useSafeAreaInsets();

  useEffect(() => {
    if (!online) track('offline_shown', {});
  }, [online]);

  if (online) return null;
  return (
    <View
      accessibilityRole="alert"
      accessibilityLiveRegion="assertive"
      style={[styles.banner, { paddingTop: insets.top + space.xs }]}
    >
      <Ionicons name="cloud-offline" size={18} color={colors.textOnBright} />
      <AppText variant="label" color={colors.textOnBright} style={styles.text}>
        {strings.offline.banner}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: {
    position: 'absolute',
    top: 0,
    start: 0,
    end: 0,
    zIndex: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    paddingHorizontal: space.lg,
    paddingBottom: space.sm,
    backgroundColor: colors.prize,
    borderBottomWidth: 3,
    borderBottomColor: palette.goldDeep,
  },
  text: { flexShrink: 1 },
});
