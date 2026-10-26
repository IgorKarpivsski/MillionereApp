import { avatarSvg, specFromAvatarId } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useMemo } from 'react';
import { Image, StyleSheet, View } from 'react-native';
import { AVATARS_3D, avatar3dFor } from '@/lib/avatars3d';
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
  // month champion frames (top 3 of the monthly table), one design per month
  m1: ['#E8F7FF', '#5AA9E6', '#BFE9FF'],
  m2: ['#FFD1E3', '#E0457B', '#FF9AC6'],
  m3: ['#FFC2E2', '#B05CFF', '#7CE0A3'],
  m4: ['#FFE066', '#00C9A7', '#9BE15D'],
  m5: ['#FFF3B0', '#FF9F1C', '#FFE14D'],
  m6: ['#A0F0FF', '#1E7BE6', '#4FD1FF'],
  m7: ['#FFB3C1', '#2ECC71', '#FF5E7E'],
  m8: ['#FFE29A', '#FF4E2E', '#FFB347'],
  m9: ['#FFE8A3', '#E63946', '#F4A261'],
  m10: ['#FFD27D', '#B5451B', '#FF8C1A'],
  m11: ['#C9D6FF', '#5A4FCF', '#9AA9C9'],
  m12: ['#FFD23F', '#3E8EF7', '#FFFFFF'],
};

/** The little emblem on a month frame. */
export const MONTH_EMBLEMS: Record<string, string> = {
  m1: '❄️', m2: '💖', m3: '🌸', m4: '🌷', m5: '☀️', m6: '🌊', m7: '🍉', m8: '🔥', m9: '🍎', m10: '🍂', m11: '🌧️', m12: '✨',
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
  const img = AVATARS_3D[avatar3dFor(avatarId)];
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
      {frame && MONTH_EMBLEMS[frame] && size >= 30 ? (
        <View style={[styles.emblem, { width: Math.round(size * 0.42), height: Math.round(size * 0.42), borderRadius: size }]}>
          <AppText style={{ fontSize: Math.round(size * 0.24), lineHeight: Math.round(size * 0.3) }}>{MONTH_EMBLEMS[frame]}</AppText>
        </View>
      ) : null}
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
  emblem: {
    position: 'absolute',
    bottom: -3,
    start: -3,
    backgroundColor: palette.night950,
    borderWidth: 2,
    borderColor: '#FFD23F',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
