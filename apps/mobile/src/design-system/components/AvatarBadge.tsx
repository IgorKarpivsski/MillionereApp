import { avatarSvg, specFromAvatarId } from '@fm/shared';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { colors, palette } from '../tokens';
import { AppText } from './AppText';

/**
 * Player avatar: the player's own drawn character (custom 'av1_' code) or,
 * for old accounts, a character derived from the legacy 'avatar_NN' id.
 * All art is original (packages/shared/src/avatar.ts).
 */
export const AvatarBadge = memo(function AvatarBadge({
  avatarId,
  level,
  size = 52,
  ring = colors.border,
}: {
  avatarId: string;
  level?: number;
  size?: number;
  ring?: string;
}) {
  const xml = useMemo(
    () => avatarSvg(specFromAvatarId(avatarId), { size, round: true, uid: avatarId.replace(/[^a-z0-9]/gi, '') + size }),
    [avatarId, size],
  );
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={level != null ? `דמות השחקן, שלב ${level}` : 'דמות השחקן'}
    >
      <View style={[styles.circle, { width: size, height: size, borderRadius: size / 2, borderColor: ring }]}>
        <SvgXml xml={xml} width={size - 4} height={size - 4} />
      </View>
      {level != null ? (
        <View style={[styles.level, { minWidth: Math.max(22, size * 0.42) }]}>
          <AppText variant="ledS" color={colors.textOnBright} style={styles.levelText}>
            {level}
          </AppText>
        </View>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  circle: {
    backgroundColor: palette.night950,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
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
