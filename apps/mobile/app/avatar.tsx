import { Ionicons } from '@expo/vector-icons';
import {
  AVATAR_SLOTS,
  PREMIUM_ACCESSORIES,
  avatarSvg,
  encodeAvatar,
  randomAvatar,
  specFromAvatarId,
  type AvatarSlot,
  type AvatarSpec,
} from '@fm/shared';
import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { memo, useEffect, useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { SvgXml } from 'react-native-svg';
import { AppText, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { useMyState, useUpdateProfile } from '@/features/profile/hooks';
import { fmt, strings } from '@/lib/i18n';
import { supabase } from '@/lib/supabase';

const t = strings.avatar;

const TAB_ICON: Record<AvatarSlot, React.ComponentProps<typeof Ionicons>['name']> = {
  species: 'paw',
  skin: 'color-fill',
  face: 'happy',
  eyes: 'eye',
  brows: 'remove',
  mouth: 'chatbubble-ellipses',
  hair: 'cut',
  hairColor: 'color-palette',
  outfit: 'shirt',
  outfitColor: 'brush',
  bg: 'image',
  accessory: 'glasses',
};

function useOwnedCosmetics() {
  return useQuery({
    queryKey: ['my-cosmetics'],
    queryFn: async () => {
      const { data, error } = await supabase.from('user_cosmetics').select('item');
      if (error) throw error;
      return new Set((data ?? []).map((r: { item: string }) => r.item));
    },
  });
}

function optionLabel(slot: AvatarSlot, v: number): string {
  if (slot === 'species') return t.species[v] ?? fmt(t.option, { n: v + 1 });
  if (slot === 'accessory') return t.accessories[v] ?? fmt(t.option, { n: v + 1 });
  return fmt(t.option, { n: v + 1 });
}

const Thumb = memo(function Thumb({
  spec,
  size,
  selected,
  locked,
  label,
  onPress,
}: {
  spec: AvatarSpec;
  size: number;
  selected: boolean;
  locked: boolean;
  label: string;
  onPress: () => void;
}) {
  const xml = useMemo(() => avatarSvg(spec, { size, uid: 't' + encodeAvatar(spec).slice(4) }), [spec, size]);
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={locked ? `${label}, ${t.locked}` : label}
      accessibilityState={{ selected, disabled: locked }}
      style={({ pressed }) => [
        styles.thumb,
        { width: size + 8, height: size + 8 },
        selected ? styles.thumbOn : null,
        pressed ? { transform: [{ scale: 0.95 }] } : null,
      ]}
    >
      <View style={[styles.thumbArt, locked ? styles.dim : null]}>
        <SvgXml xml={xml} width={size} height={size} />
      </View>
      {locked ? (
        <View style={styles.lock}>
          <Ionicons name="lock-closed" size={16} color={colors.textOnBright} />
        </View>
      ) : null}
      {selected ? (
        <View style={styles.check}>
          <Ionicons name="checkmark" size={14} color={colors.textOnBright} />
        </View>
      ) : null}
    </Pressable>
  );
});

export default function AvatarScreen() {
  const { data } = useMyState();
  const owned = useOwnedCosmetics();
  const save = useUpdateProfile();
  const toast = useToast();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const [spec, setSpec] = useState<AvatarSpec | null>(null);
  const [tab, setTab] = useState<AvatarSlot>('species');

  useEffect(() => {
    if (data && !spec) setSpec(specFromAvatarId(data.profile.avatar_id));
  }, [data, spec]);

  const code = spec ? encodeAvatar(spec) : '';
  const bigXml = useMemo(() => (spec ? avatarSvg(spec, { size: 200, round: true, uid: 'big' }) : ''), [spec]);
  if (!spec || !data) return <SafeAreaView style={styles.root} />;

  const count = AVATAR_SLOTS.find((s) => s.key === tab)!.count;
  const cols = width >= 400 ? 4 : 3;
  const thumb = Math.floor((width - space.lg * 2 - space.sm * (cols - 1)) / cols) - 8;
  const isLocked = (slot: AvatarSlot, v: number) => {
    if (slot !== 'accessory') return false;
    const item = PREMIUM_ACCESSORIES[v];
    return !!item && !owned.data?.has(item);
  };
  const changed = code !== data.profile.avatar_id;

  const pick = (v: number) => {
    if (isLocked(tab, v)) {
      haptic('error');
      toast(t.locked, 'info');
      return;
    }
    haptic('select');
    playSound('tap');
    setSpec({ ...spec, [tab]: v });
  };

  const shuffle = () => {
    haptic('tap');
    playSound('tap');
    setSpec(randomAvatar());
  };

  const onSave = () => {
    save.mutate(
      { avatar_id: code },
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
      <View style={styles.header}>
        <Pressable
          onPress={() => router.back()}
          hitSlop={12}
          accessibilityRole="button"
          accessibilityLabel={strings.common.back}
          style={styles.iconBtn}
        >
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
        <View style={styles.spot} />
        <Animated.View key={code} entering={reduced ? undefined : ZoomIn.springify().damping(14)}>
          <View accessible accessibilityRole="image" accessibilityLabel={`${t.preview}: ${optionLabel('species', spec.species)}`}>
            <SvgXml xml={bigXml} width={170} height={170} />
          </View>
        </Animated.View>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabsBar}>
        {AVATAR_SLOTS.map(({ key }) => {
          const on = key === tab;
          return (
            <Pressable
              key={key}
              onPress={() => setTab(key)}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={t.tabs[key]}
              style={[styles.tab, on ? styles.tabOn : null]}
            >
              <Ionicons name={TAB_ICON[key]} size={18} color={on ? colors.textOnBright : colors.textMuted} />
              <AppText variant="caption" color={on ? colors.textOnBright : colors.textMuted} style={styles.tabText}>
                {t.tabs[key]}
              </AppText>
            </Pressable>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.grid}>
        {Array.from({ length: count }, (_, v) => (
          <Thumb
            key={`${tab}-${v}`}
            spec={{ ...spec, [tab]: v }}
            size={thumb}
            selected={spec[tab] === v}
            locked={isLocked(tab, v)}
            label={optionLabel(tab, v)}
            onPress={() => pick(v)}
          />
        ))}
      </ScrollView>

      <View style={styles.footer}>
        <StickerButton
          label={t.save}
          icon="checkmark-circle"
          size="lg"
          fullWidth
          disabled={!changed}
          loading={save.isPending}
          onPress={onSave}
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  stage: { alignItems: 'center', justifyContent: 'center', height: 190 },
  spot: {
    position: 'absolute',
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: palette.night700,
    borderWidth: 3,
    borderColor: colors.led,
    opacity: 0.6,
  },
  tabsBar: { flexGrow: 0 },
  tabs: { gap: space.sm, paddingHorizontal: space.lg, paddingVertical: space.sm },
  tab: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.chip,
    backgroundColor: palette.night950,
    borderWidth: 2,
    borderColor: colors.border,
  },
  tabOn: { backgroundColor: colors.led, borderColor: colors.led },
  tabText: { fontWeight: '700' },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, paddingHorizontal: space.lg, paddingBottom: space.xl },
  thumb: {
    borderRadius: radius.card,
    borderWidth: 3,
    borderColor: colors.border,
    backgroundColor: palette.night950,
    alignItems: 'center',
    justifyContent: 'center',
  },
  thumbOn: { borderColor: colors.led },
  thumbArt: { borderRadius: radius.control, overflow: 'hidden' },
  dim: { opacity: 0.4 },
  lock: {
    position: 'absolute',
    width: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: palette.violet,
    alignItems: 'center',
    justifyContent: 'center',
  },
  check: {
    position: 'absolute',
    top: -6,
    end: -6,
    width: 22,
    height: 22,
    borderRadius: 11,
    backgroundColor: colors.led,
    alignItems: 'center',
    justifyContent: 'center',
  },
  footer: { paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm, borderTopWidth: 1, borderTopColor: colors.border },
});
