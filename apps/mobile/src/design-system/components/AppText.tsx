import { Text, type TextProps, type TextStyle } from 'react-native';
import { colors, textStyles, type TextVariant } from '../tokens';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

/**
 * The only text component. Scales with Dynamic Type up to the variant's cap,
 * and lays out right-to-left (the whole app runs in forced RTL).
 */
export function AppText({ variant = 'body', color = colors.text, align, style, ...rest }: AppTextProps) {
  const { maxScale, ...type } = textStyles[variant];
  return (
    <Text
      maxFontSizeMultiplier={maxScale}
      style={[type, { color, writingDirection: 'rtl' }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
