import type { ReactNode } from 'react';
import { RefreshControl, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Defs, Ellipse, RadialGradient, Rect, Stop } from 'react-native-svg';
import { colors, space } from '../tokens';

/**
 * The stadium at night: mown-grass stripes under one floodlight glow.
 * Static on purpose — nothing moves behind the content.
 */
function PitchBackdrop() {
  const { width, height } = useWindowDimensions();
  const stripe = 64;
  const stripes = Array.from({ length: Math.ceil(width / (stripe * 2)) + 1 }, (_, i) => i * stripe * 2);
  return (
    <Svg width={width} height={height} style={StyleSheet.absoluteFill} pointerEvents="none">
      <Defs>
        <RadialGradient id="flood" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#FFF0C8" stopOpacity={0.16} />
          <Stop offset="1" stopColor="#FFF0C8" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Rect x={0} y={0} width={width} height={height} fill={colors.bg} />
      {stripes.map((x) => (
        <Rect key={x} x={x} y={0} width={stripe} height={height} fill="#FFFFFF" fillOpacity={0.03} />
      ))}
      <Ellipse cx={width / 2} cy={0} rx={width * 0.9} ry={height * 0.42} fill="url(#flood)" />
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
  content: { paddingHorizontal: space.lg, paddingTop: space.md, paddingBottom: 120, gap: space.md },
  fill: { flex: 1 },
});
