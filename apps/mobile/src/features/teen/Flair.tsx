import { Ionicons } from '@expo/vector-icons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, AvatarBadge, BottomSheet, StickerButton, TitleTag, titleTier, useToast } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useMyState } from '@/features/profile/hooks';
import { fmt, strings } from '@/lib/i18n';
import { useFlair, useSetFlair } from './api';

const t = strings.teen;
const TIER_ORDER = { basic: 0, rare: 1, epic: 2, legendary: 3 } as const;
const FRAME_NAMES = t.frameNames as Record<string, string>;

function frameLock(key: string, need: number): string {
  if (key === 'fire') return t.flairLockedFire;
  if (key === 'rainbow') return t.flairLockedRainbow;
  if (key === 'ambassador') return t.flairLockedAmbassador;
  return fmt(t.flairLockedFrame, { n: need });
}

/** Pick an avatar frame and a title, both unlocked by badges. */
export function FlairSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { data } = useFlair();
  const { data: me } = useMyState();
  const save = useSetFlair();
  const toast = useToast();
  const [frame, setFrame] = useState<string | null>(null);
  const [title, setTitle] = useState<string | null>(null);
  useEffect(() => {
    if (visible && data) {
      setFrame(data.frame);
      setTitle(data.title);
    }
  }, [visible, data]);
  const avatar = me?.profile.avatar_id ?? 'avatar_01';
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.flairTitle}>
      {!data ? (
        <ActivityIndicator color={colors.led} />
      ) : (
        <ScrollView style={styles.scroll} contentContainerStyle={styles.body}>
          <View style={styles.preview}>
            <AvatarBadge avatarId={avatar} photo={me?.profile.photo_url} frame={frame} size={84} />
            <AppText variant="label">{me?.profile.username}</AppText>
            {title ? (
              <AppText variant="caption" color={colors.led}>
                {title}
              </AppText>
            ) : null}
          </View>
          <AppText variant="caption" color={colors.textMuted} align="center">
            {t.flairIntro}
          </AppText>
          <AppText variant="heading">{t.flairFrames}</AppText>
          <View style={styles.frames}>
            <Pressable
              onPress={() => setFrame(null)}
              accessibilityRole="radio"
              accessibilityState={{ selected: frame === null }}
              accessibilityLabel={t.flairNone}
              style={[styles.frame, frame === null && styles.sel]}
            >
              <AvatarBadge avatarId={avatar} size={52} />
              <AppText variant="caption">{t.flairNone}</AppText>
            </Pressable>
            {data.frames.map((f) => (
              <Pressable
                key={f.key}
                disabled={!f.unlocked}
                onPress={() => setFrame(f.key)}
                accessibilityRole="radio"
                accessibilityState={{ selected: frame === f.key, disabled: !f.unlocked }}
                accessibilityLabel={f.unlocked ? FRAME_NAMES[f.key] : `${FRAME_NAMES[f.key]}, ${frameLock(f.key, f.need)}`}
                style={[styles.frame, frame === f.key && styles.sel, !f.unlocked && styles.locked]}
              >
                <AvatarBadge avatarId={avatar} size={52} frame={f.key} />
                <AppText variant="caption">{FRAME_NAMES[f.key] ?? f.key}</AppText>
                {!f.unlocked ? (
                  <AppText variant="caption" color={colors.textDim} align="center" style={styles.lockText}>
                    {frameLock(f.key, f.need)}
                  </AppText>
                ) : null}
              </Pressable>
            ))}
          </View>
          <AppText variant="heading">{t.flairTitles}</AppText>
          <View style={styles.titles}>
            <Pressable
              onPress={() => setTitle(null)}
              accessibilityRole="radio"
              accessibilityState={{ selected: title === null }}
              style={[styles.title, title === null && styles.sel]}
            >
              <AppText variant="label">{t.flairNone}</AppText>
            </Pressable>
            {[...data.titles]
              .sort((a, b) => Number(b.unlocked) - Number(a.unlocked) || TIER_ORDER[titleTier(b.text)] - TIER_ORDER[titleTier(a.text)])
              .map((x) => (
                <Pressable
                  key={x.text}
                  disabled={!x.unlocked}
                  onPress={() => setTitle(x.text)}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: title === x.text, disabled: !x.unlocked }}
                  accessibilityLabel={x.unlocked ? x.text : `${x.text}, ${x.hint ?? (x.world ? t.flairLockedWorld : t.flairLockedTitle)}`}
                  style={[styles.title, title === x.text && styles.sel]}
                >
                  {x.unlocked ? (
                    <TitleTag title={x.text} size="md" />
                  ) : (
                    <View style={styles.lockedTitle}>
                      <View style={styles.lockRow}>
                        <Ionicons name="lock-closed" size={14} color={colors.textDim} />
                        <View style={styles.dim}>
                          <TitleTag title={x.text} size="sm" />
                        </View>
                      </View>
                      <AppText variant="caption" color={colors.textDim}>
                        {x.hint ?? (x.world ? t.flairLockedWorld : t.flairLockedTitle)}
                      </AppText>
                    </View>
                  )}
                </Pressable>
              ))}
          </View>
        </ScrollView>
      )}
      <StickerButton
        label={strings.common.save}
        fullWidth
        loading={save.isPending}
        disabled={!data}
        onPress={() =>
          save.mutate(
            { frame, title },
            {
              onSuccess: () => {
                toast(t.flairSaved, 'success');
                onClose();
              },
              onError: () => toast(strings.errors.generic, 'error'),
            },
          )
        }
      />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  scroll: { maxHeight: 460 },
  body: { gap: space.sm, paddingBottom: space.sm },
  preview: { alignItems: 'center', gap: 2 },
  frames: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  frame: {
    width: 96,
    alignItems: 'center',
    gap: 2,
    padding: space.xs,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  sel: { borderColor: colors.led, backgroundColor: 'rgba(255,214,140,0.16)' },
  locked: { opacity: 0.55 },
  lockText: { fontSize: 10, lineHeight: 13 },
  titles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  lockedTitle: { gap: 2 },
  dim: { opacity: 0.5 },
  lockRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  title: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
});
