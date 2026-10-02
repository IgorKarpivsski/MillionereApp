import Svg, { Circle, Path } from 'react-native-svg';
import { colors, palette } from '../tokens';

/** Original currency icons, drawn in code (no third-party artwork). */
export function CoinIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Circle cx={12} cy={13} r={10} fill={colors.prizeLip} />
      <Circle cx={12} cy={11} r={10} fill={colors.prize} />
      <Circle cx={12} cy={11} r={6.5} fill="none" stroke={colors.prizeLip} strokeWidth={2} />
      <Path d="M12 7.5l1.1 2.3 2.5.3-1.8 1.7.5 2.5-2.3-1.2-2.3 1.2.5-2.5-1.8-1.7 2.5-.3z" fill={colors.prizeLip} />
    </Svg>
  );
}

export function GemIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path d="M6 4h12l4 6-10 12L2 10z" fill={colors.gemLip} />
      <Path d="M6 3h12l4 6-10 12L2 9z" fill={colors.gem} />
      <Path d="M2 9h20M8 3l4 18M16 3l-4 18M8 3L6 9M16 3l2 6" stroke={colors.gemLip} strokeWidth={1.3} fill="none" />
    </Svg>
  );
}

export function DustIcon({ size = 22 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" accessibilityElementsHidden>
      <Path d="M12 2l2 6 6 2-6 2-2 6-2-6-6-2 6-2z" fill={palette.violet} />
      <Circle cx={19} cy={18} r={2.2} fill={palette.violet} />
      <Circle cx={5} cy={19} r={1.6} fill={palette.violet} />
    </Svg>
  );
}
