import { memo, useMemo } from 'react';
import { View, type ViewStyle } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { iconSvg, type IconName } from './art';

export type { IconName } from './art';

/**
 * Illustrated sticker icon from the האלוף set. Decorative by default
 * (hidden from screen readers); pass `label` when the icon carries meaning alone.
 */
export const Icon = memo(function Icon({
  name,
  size = 32,
  mono = false,
  label,
  style,
}: {
  name: IconName;
  size?: number;
  mono?: boolean;
  label?: string;
  style?: ViewStyle;
}) {
  const xml = useMemo(() => iconSvg(name, { size, mono }), [name, size, mono]);
  return (
    <View
      style={[{ width: size, height: size }, style]}
      accessible={!!label}
      accessibilityRole={label ? 'image' : undefined}
      accessibilityLabel={label}
      importantForAccessibility={label ? 'yes' : 'no-hide-descendants'}
      accessibilityElementsHidden={!label}
    >
      <SvgXml xml={xml} width={size} height={size} />
    </View>
  );
});
