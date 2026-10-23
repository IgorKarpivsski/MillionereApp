import { StyleSheet, type TextStyle } from 'react-native';
import { colors } from '../tokens';
import { AppText } from './AppText';

/** Special name colours, won in the monthly table and the leagues. */
export const NAME_COLORS: Record<string, { color: string; glow: string }> = {
  gold: { color: '#FFD23F', glow: 'rgba(255,190,40,0.85)' },
  silver: { color: '#EEF4FF', glow: 'rgba(170,200,255,0.9)' },
  purple: { color: '#D49BFF', glow: 'rgba(177,76,255,0.9)' },
};

/** A player's name, in their special colour (with a soft glow) when they have one. */
export function PlayerName({
  name,
  color,
  variant = 'label',
  style,
}: {
  name: string;
  color?: string | null;
  variant?: 'label' | 'bodyStrong' | 'heading' | 'title';
  style?: TextStyle;
}) {
  const c = color ? NAME_COLORS[color] : undefined;
  return (
    <AppText
      variant={variant}
      numberOfLines={1}
      color={c ? c.color : colors.text}
      style={[c ? { textShadowColor: c.glow, textShadowRadius: 8, textShadowOffset: { width: 0, height: 0 } } : null, styles.name, style]}
    >
      {name}
    </AppText>
  );
}

const styles = StyleSheet.create({ name: { flexShrink: 1 } });
