import { memo, useMemo } from 'react';
import { Image, View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { worldBadgeSvg } from './worldArt';
import { WORLD_IMAGES } from './worldImages';

/** The round badge of a knowledge world: its illustration in a colored ring. */
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
  const img = WORLD_IMAGES[icon];
  const xml = useMemo(() => (img ? '' : worldBadgeSvg(icon, color, { locked })), [img, icon, color, locked]);
  const ring = Math.max(2, Math.round(size / 22));
  return (
    <View style={[{ width: size, height: size }, style]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
      {img ? (
        <View
          style={{
            width: size,
            height: size,
            borderRadius: size / 2,
            borderWidth: ring,
            borderColor: color,
            overflow: 'hidden',
            backgroundColor: color,
            opacity: locked ? 0.45 : 1,
          }}
        >
          <Image source={img} style={{ width: '100%', height: '100%' }} resizeMode="cover" />
        </View>
      ) : (
        <SvgXml xml={xml} width={size} height={size} />
      )}
    </View>
  );
});
