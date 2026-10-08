import { memo, useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { worldBadgeSvg } from './worldArt';

/** The round, colored badge of a knowledge world. */
export const WorldBadge = memo(function WorldBadge({
  icon,
  color,
  size = 56,
  locked = false,
  style,
}: {
  icon: string;
  color: string;
  size?: number;
  locked?: boolean;
  style?: ViewStyle;
}) {
  const xml = useMemo(() => worldBadgeSvg(icon, color, { locked }), [icon, color, locked]);
  return (
    <View style={[{ width: size, height: size }, style]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
});
