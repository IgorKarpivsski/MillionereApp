import { Text, type TextProps, type TextStyle } from 'react-native';
import { useSettingsStore } from '@/features/settings/store';
import { colors, textStyles, type TextVariant } from '../tokens';

export interface AppTextProps extends TextProps {
  variant?: TextVariant;
  color?: string;
  align?: TextStyle['textAlign'];
}

/** Big type gets a soft drop shadow so it reads cleanly over the lit backdrop. */
const LIFTED = new Set<TextVariant>(['hero', 'title', 'heading', 'ledM', 'ledL', 'ledXL']);
const SHADOW = { textShadowColor: 'rgba(8,4,24,0.65)', textShadowOffset: { width: 0, height: 2 }, textShadowRadius: 6 };

/**
 * The only text component. Scales with Dynamic Type up to the variant's cap,
 * and lays out right-to-left (the whole app runs in forced RTL).
 */
export function AppText({ variant = 'body', color = colors.text, align, style, ...rest }: AppTextProps) {
  const { maxScale, ...type } = textStyles[variant];
  const large = useSettingsStore((s) => s.largeText);
  const boost = large
    ? { fontSize: Math.round((type.fontSize ?? 16) * 1.2), lineHeight: type.lineHeight ? Math.round(type.lineHeight * 1.2) : undefined }
    : null;
  const lift = LIFTED.has(variant) && color !== colors.textOnBright && color !== colors.cardText ? SHADOW : null;
  return (
    <Text
      maxFontSizeMultiplier={maxScale}
      style={[type, boost, lift, { color, writingDirection: 'rtl' }, align ? { textAlign: align } : null, style]}
      {...rest}
    />
  );
}
