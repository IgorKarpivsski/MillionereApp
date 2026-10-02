import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, palette } from '../tokens';
import { AppText } from './AppText';

/** Original flare-shaped streak marker. Grey when there's no streak. */
export function StreakFlame({ count, size = 56 }: { count: number; size?: number }) {
  const active = count > 0;
  const outer = active ? colors.danger : palette.night600;
  const inner = active ? colors.prize : palette.night300;
  return (
    <View style={{ width: size, height: size }} accessibilityElementsHidden importantForAccessibility="no">
      <Svg width={size} height={size} viewBox="0 0 48 48">
        <Path
          d="M24 3c3 7 12 11 12 23a12 12 0 0 1-24 0c0-6 3-9 5-12 1 4 3 6 5 6-1-7 0-12 2-17z"
          fill={outer}
        />
        <Path d="M24 22c2 4 7 6 7 12a7 7 0 0 1-14 0c0-3 2-5 3-6 1 2 2 3 3 3 0-4 0-6 1-9z" fill={inner} />
      </Svg>
      <View style={StyleSheet.absoluteFill}>
        <View style={styles.center}>
          <AppText variant="number" color={colors.textOnBright} style={styles.num}>
            {count}
          </AppText>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'flex-end', paddingBottom: 6 },
  num: { fontSize: 15, lineHeight: 18 },
});
