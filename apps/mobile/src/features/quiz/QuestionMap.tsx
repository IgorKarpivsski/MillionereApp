import { BASE_MAPS, projectOnMap, type QuestionImage } from '@fm/shared';
import { memo, useEffect } from 'react';
import { View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming } from 'react-native-reanimated';
import Svg, { Circle, G, Path, Rect } from 'react-native-svg';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';

const SEA = '#2D7FB8';
const LAND = '#F2E6C9';
const INK = '#10241D';

/**
 * Picture question: a neutral land/sea map (Natural Earth, no borders or names)
 * with a pulsing pin. The pin bobs gently unless Reduced Motion is on.
 */
export const QuestionMap = memo(function QuestionMap({ image, height = 190 }: { image: QuestionImage; height?: number }) {
  const map = BASE_MAPS[image.map]!;
  const { x, y } = projectOnMap(map, image.lon, image.lat);
  const reduced = useReducedMotion();
  const scale = height / map.height;
  const width = map.width * scale;
  const bob = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    bob.value = withRepeat(withSequence(withTiming(-5, { duration: 500, easing: Easing.out(Easing.quad) }), withTiming(0, { duration: 500, easing: Easing.in(Easing.quad) })), -1);
  }, [reduced, bob]);
  const pinStyle = useAnimatedStyle(() => ({ transform: [{ translateY: bob.value }] }));
  const pinSize = 30;

  return (
    <View
      style={{ alignSelf: 'center', width, height, borderRadius: 14, overflow: 'hidden', borderWidth: 3, borderColor: INK }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={image.map === 'israel' ? 'מפת ישראל עם סימון של מקום' : 'מפת אירופה עם סימון של מקום'}
    >
      <Svg width={width} height={height} viewBox={`0 0 ${map.width} ${map.height}`}>
        <Rect width={map.width} height={map.height} fill={SEA} />
        <Path d={map.land} fill={LAND} stroke={INK} strokeWidth={0.9 / scale} fillRule="evenodd" />
        {map.lakes ? <Path d={map.lakes} fill={SEA} stroke={INK} strokeWidth={0.6 / scale} /> : null}
        <G>
          <Circle cx={x} cy={y} r={9 / scale} fill="#FF5A4E" opacity={0.25} />
          <Circle cx={x} cy={y} r={3 / scale} fill={INK} />
        </G>
      </Svg>
      <Animated.View
        pointerEvents="none"
        style={[{ position: 'absolute', left: x * scale - pinSize / 2, top: y * scale - pinSize }, pinStyle]}
      >
        <Svg width={pinSize} height={pinSize} viewBox="0 0 24 24">
          <Path d="M12 23 C12 23 4 14.5 4 9 A8 8 0 0 1 20 9 C20 14.5 12 23 12 23 Z" fill="#FF5A4E" stroke="#FFF8EA" strokeWidth={2} />
          <Circle cx={12} cy={9} r={3.2} fill="#FFF8EA" />
        </Svg>
      </Animated.View>
    </View>
  );
});
