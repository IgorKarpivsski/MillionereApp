import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
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
  return (
    <View style={styles.root}>
      <Backdrop accent={accent} />
      <SafeAreaView edges={['top']} style={styles.safe}>
        {header}
        {scroll ? (
          <ScrollView
            contentContainerStyle={styles.content}
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
          <View style={[styles.content, styles.fill]}>{children}</View>
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  safe: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 120, gap: space.md },
  fill: { flex: 1 },
});
