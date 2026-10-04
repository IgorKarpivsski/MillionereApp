import { StyleSheet, View } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import { colors, palette } from '../tokens';
import { AppText } from './AppText';

/**
 * Player avatar: a plain, generic shirt silhouette in one of 12 color pairs.
 * Deliberately NOT based on any club or national-team kit.
 */
const AVATAR_COLORS: ReadonlyArray<[string, string]> = [
  [palette.pitch, palette.pitchDeep],
  [palette.gold, palette.goldDeep],
  [palette.flare, palette.flareDeep],
  [palette.sky, palette.skyDeep],
  [palette.violet, palette.violetDeep],
  ['#FF8A3D', '#B9531A'],
  ['#F2F2F2', '#9C93D9'],
  ['#FF6FB5', '#B83A7C'],
  ['#7BE0C3', '#2E9C80'],
  ['#C6E05A', '#7E9324'],
  ['#5C7CFF', '#2F45B0'],
  ['#FFB4A2', '#C66B55'],
];

export function avatarColors(avatarId: string): [string, string] {
  const n = Number(avatarId.replace('avatar_', '')) || 1;
  return AVATAR_COLORS[(n - 1) % AVATAR_COLORS.length] ?? AVATAR_COLORS[0]!;
}

export function AvatarBadge({ avatarId, level, size = 52 }: { avatarId: string; level: number; size?: number }) {
  const [body, trim] = avatarColors(avatarId);
  return (
    <View style={{ width: size, height: size }} accessible accessibilityLabel={`שלב ${level}`}>
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2 }]}>
        <Svg width={size * 0.72} height={size * 0.72} viewBox="0 0 48 48">
          <Path d="M17 6l-11 6 4 9 5-2v23h18V19l5 2 4-9-11-6c-1 3-4 5-7 5s-6-2-7-5z" fill={body} />
          <Path d="M17 6c1 3 4 5 7 5s6-2 7-5" stroke={trim} strokeWidth={3} fill="none" />
        </Svg>
      </View>
      <View style={[styles.level, { minWidth: size * 0.46 }]}>
        <AppText variant="ledS" color={colors.textOnBright} style={styles.levelText}>
          {level}
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  circle: {
    backgroundColor: palette.night950,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  level: {
    position: 'absolute',
    bottom: -4,
    end: -4,
    paddingHorizontal: 5,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.prize,
    borderWidth: 2,
    borderColor: palette.night950,
    alignItems: 'center',
    justifyContent: 'center',
  },
  levelText: { lineHeight: 15 },
});
