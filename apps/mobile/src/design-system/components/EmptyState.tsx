import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors, palette, space } from '../tokens';
import { AppText } from './AppText';
import { StickerButton } from './StickerButton';

/** An empty screen is an invitation to act: say what goes here and how to get it. */
export function EmptyState({
  icon,
  title,
  body,
  actionLabel,
  onAction,
}: {
  icon: ComponentProps<typeof Ionicons>['name'];
  title: string;
  body: string;
  actionLabel?: string;
  onAction?: () => void;
}) {
  return (
    <View style={styles.wrap}>
      <View style={styles.iconRing}>
        <Ionicons name={icon} size={40} color={colors.prize} />
      </View>
      <AppText variant="heading" align="center">
        {title}
      </AppText>
      <AppText color={colors.textMuted} align="center" style={styles.body}>
        {body}
      </AppText>
      {actionLabel && onAction ? <StickerButton label={actionLabel} onPress={onAction} /> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { alignItems: 'center', gap: space.md, paddingVertical: space.xxl, paddingHorizontal: space.xl },
  iconRing: {
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 3,
    borderColor: colors.border,
    borderStyle: 'dashed',
    backgroundColor: palette.night950,
    alignItems: 'center',
    justifyContent: 'center',
  },
  body: { maxWidth: 320, marginBottom: space.sm },
});
