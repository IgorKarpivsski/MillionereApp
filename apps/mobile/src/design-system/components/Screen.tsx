import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, space } from '../tokens';
import { Backdrop } from './Backdrop';

export function Screen({
  children,
  header,
  scroll = true,
  onRefresh,
  refreshing = false,
  accent,
}: {
  children: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
  /** Optional color wash at the top of the backdrop (e.g. a world's color). */
  accent?: string;
}) {
  // the tab bar floats over the bottom of the screen (its height + the system bar), so the
  // last card always ends well above it
  const insets = useSafeAreaInsets();
  const bottom = { paddingBottom: TAB_BAR + Math.max(insets.bottom, space.sm) + space.xl };
  return (
    <View style={styles.root}>
      <Backdrop accent={accent} />
      <SafeAreaView edges={['top']} style={styles.safe}>
        {header}
        {scroll ? (
          <ScrollView
            contentContainerStyle={[styles.content, bottom]}
            showsVerticalScrollIndicator={false}
            refreshControl={
              onRefresh ? (
                <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.prize} />
              ) : undefined
            }
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.content, styles.fill, bottom]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

/** The floating tab bar's own height (52 tab + padding + border). */
const TAB_BAR = 72;

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  safe: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 120, gap: space.md },
  fill: { flex: 1 },
});
