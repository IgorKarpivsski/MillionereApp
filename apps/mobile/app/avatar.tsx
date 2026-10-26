import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Backdrop, Glow, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, space } from '@/design-system/tokens';
import { useMyState, useUpdateProfile } from '@/features/profile/hooks';
import { AVATAR_3D_IDS, AVATARS_3D, avatar3dFor } from '@/lib/avatars3d';
import { strings } from '@/lib/i18n';

const t = strings.avatar;

/** Pick a profile character: one gallery of 3D characters, all in the same art style. */
export default function AvatarScreen() {
  const { data } = useMyState();
  const save = useUpdateProfile();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [pick, setPick] = useState<string | null>(null);

  useEffect(() => {
    if (data && !pick) setPick(avatar3dFor(data.profile.avatar_id));
  }, [data, pick]);

  if (!data || !pick) return <SafeAreaView style={styles.root} />;

  const cols = width >= 400 ? 4 : 3;
  const thumb = Math.floor((width - space.lg * 2 - space.sm * (cols - 1)) / cols);
  const changed = pick !== data.profile.avatar_id;

  const choose = (id: string) => {
    haptic('select');
    playSound('tap');
    setPick(id);
  };
  const shuffle = () => {
    const others = AVATAR_3D_IDS.filter((id) => id !== pick);
    choose(others[Math.floor(Math.random() * others.length)]!);
  };
  const onSave = () => {
    save.mutate(
      { avatar_id: pick },
      {
        onSuccess: () => {
          haptic('success');
          playSound('coins');
          toast(t.saved, 'success');
          router.back();
        },
        onError: () => toast(strings.errors.generic, 'error'),
      },
    );
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Backdrop />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back} style={styles.iconBtn}>
          <Ionicons name="chevron-forward" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="heading" accessibilityRole="header">
          {t.title}
        </AppText>
        <Pressable onPress={shuffle} hitSlop={12} accessibilityRole="button" accessibilityLabel={t.random} style={styles.iconBtn}>
          <Ionicons name="dice" size={26} color={colors.led} />
        </Pressable>
      </View>

      <View style={styles.stage}>
        <Glow size={300} strength={0.45} />
        <View style={styles.spot} />
        <Image source={AVATARS_3D[pick]!} style={styles.big} accessibilityLabel={t.preview} />
      </View>
      <AppText variant="label" color={colors.led} align="center" style={styles.hint}>
        {t.pickHint}
      </AppText>

      <ScrollView contentContainerStyle={styles.grid}>
        {AVATAR_3D_IDS.map((id, i) => {
          const on = id === pick;
          return (
            <Pressable
              key={id}
              onPress={() => choose(id)}
              accessibilityRole="button"
              accessibilityState={{ selected: on }}
              accessibilityLabel={`${t.preview} ${i + 1}`}
              style={({ pressed }) => [styles.thumb, { width: thumb, height: thumb, borderRadius: thumb / 2 }, on && styles.thumbOn, pressed && styles.pressed]}
            >
              <Image source={AVATARS_3D[id]!} style={styles.thumbImg} />
              {on ? (
                <View style={styles.check}>
                  <Ionicons name="checkmark" size={16} color={colors.textOnBright} />
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <StickerButton label={t.save} icon="checkmark-circle" size="lg" fullWidth disabled={!changed} loading={save.isPending} onPress={onSave} />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.md, paddingVertical: space.sm },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center', height: 210 },
  big: { width: 170, height: 170, borderRadius: 85, borderWidth: 4, borderColor: '#FFFFFF' },
  spot: {
    position: 'absolute',
    width: 196,
    height: 196,
    borderRadius: 98,
    backgroundColor: 'rgba(255,176,0,0.10)',
    borderWidth: 1.5,
    borderColor: 'rgba(255,176,0,0.55)',
  },
  hint: { marginBottom: space.sm, paddingHorizontal: space.lg },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xl },
  thumb: { overflow: 'hidden', borderWidth: 3, borderColor: 'transparent' },
  thumbOn: { borderColor: colors.led },
  thumbImg: { width: '100%', height: '100%' },
  pressed: { transform: [{ scale: 0.95 }] },
  check: {
    position: 'absolute',
    top: 4,
    end: 4,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.led,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
