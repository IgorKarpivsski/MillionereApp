import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Rect } from 'react-native-svg';
import { colors, palette, space } from '../tokens';

/** Faint chalk pitch markings behind every screen — the stadium-at-night backdrop. */
function PitchBackdrop() {
  const { width, height } = useWindowDimensions();
  const cx = width / 2;
  const chalk = palette.night700;
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Rect x={0} y={0} width={width} height={height} fill={colors.bg} />
      <Line x1={0} y1={height * 0.46} x2={width} y2={height * 0.46} stroke={chalk} strokeWidth={2} />
      <Circle cx={cx} cy={height * 0.46} r={width * 0.32} stroke={chalk} strokeWidth={2} fill="none" />
      <Circle cx={cx} cy={height * 0.46} r={4} fill={chalk} />
      <Rect
        x={width * 0.2}
        y={height - width * 0.28}
        width={width * 0.6}
        height={width * 0.4}
        stroke={chalk}
        strokeWidth={2}
        fill="none"
      />
    </Svg>
  );
}

export function Screen({
  children,
  header,
  scroll = true,
  onRefresh,
  refreshing = false,
}: {
  children: ReactNode;
  header?: ReactNode;
  scroll?: boolean;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  return (
    <View style={styles.root}>
      <PitchBackdrop />
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
  root: { flex: 1, backgroundColor: colors.bg },
  safe: { flex: 1 },
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 120, gap: space.lg },
  fill: { flex: 1 },
});
