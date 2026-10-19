import { avatarSvg, specFromAvatarId } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AVATARS_3D } from '@/lib/avatars3d';
import { SvgXml } from 'react-native-svg';
import { colors, palette } from '../tokens';
import { AppText } from './AppText';

/** Avatar rings unlocked from badges. */
export const FRAME_COLORS: Record<string, [string, string, ...string[]]> = {
  bronze: ['#E39A5B', '#8A4B1F'],
  silver: ['#F4F8FC', '#8E9AAB'],
  gold: ['#FFE98A', '#E0A400', '#FFD23F'],
  fire: ['#FFE14D', '#FF7A1A', '#E8203A'],
  rainbow: ['#FF4D6D', '#FFB13D', '#3DDC84', '#3E8EF7', '#B14CFF'],
  ambassador: ['#7DF9FF', '#FFD23F', '#FF6FB5', '#7DF9FF'],
};

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
  photo,
  frame,
}: {
  avatarId: string;
  level?: number;
  size?: number;
  ring?: string;
  /** the player's own photo; shown instead of the drawn avatar */
  photo?: string | null;
  /** a badge frame key (bronze/silver/gold/fire/rainbow) */
  frame?: string | null;
}) {
  const ringColors = frame ? FRAME_COLORS[frame] : undefined;
  const inner = ringColors ? size - Math.max(6, Math.round(size * 0.1)) : size;
  const img = AVATARS_3D[avatarId];
  const xml = useMemo(
    () => img || photo ? '' : avatarSvg(specFromAvatarId(avatarId), { size, round: true, uid: avatarId.replace(/[^a-z0-9]/gi, '') + size }),
    [img, photo, avatarId, size],
  );
  return (
    <View
      style={{ width: size, height: size }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={level != null ? `דמות השחקן, שלב ${level}` : 'דמות השחקן'}
    >
      {ringColors ? (
        <LinearGradient
          colors={ringColors}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { borderRadius: size / 2 }]}
        />
      ) : null}
      <View
        style={[
          styles.circle,
          { width: inner, height: inner, borderRadius: inner / 2, borderColor: ringColors ? palette.night950 : ring },
          ringColors ? { position: 'absolute', top: (size - inner) / 2, left: (size - inner) / 2 } : null,
        ]}
      >
        {photo ? (
          <Image source={{ uri: photo }} style={{ width: inner, height: inner }} resizeMode="cover" />
        ) : img ? (
          <Image source={img} style={{ width: inner, height: inner }} resizeMode="cover" />
        ) : (
          <SvgXml xml={xml} width={inner - 4} height={inner - 4} />
        )}
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
