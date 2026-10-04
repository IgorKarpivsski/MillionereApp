import type { Collectible } from '@fm/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import {
  AppText,
  BottomSheet,
  Card,
  DustIcon,
  Led,
  ProgressBar,
  Screen,
  Skeleton,
  StickerButton,
  useToast,
} from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, radius, rarityColors, space } from '@/design-system/tokens';
import { LegendCard } from '@/features/collection/LegendCard';
import { useClaimAlbum, useCollection, useCraft } from '@/features/collection/hooks';
import { RpcError } from '@/features/profile/api';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.collection;

export default function CollectionScreen() {
  const { data, isLoading, refetch, isRefetching } = useCollection();
  const [albumSlug, setAlbumSlug] = useState<string | null>(null);
  const [open, setOpen] = useState<Collectible | null>(null);
  const craft = useCraft();
  const claim = useClaimAlbum();
  const toast = useToast();

  const album = data?.albums.find((a) => a.slug === albumSlug) ?? data?.albums[0];
  const items = useMemo(() => data?.items.filter((i) => i.album === album?.slug) ?? [], [data, album?.slug]);
  const totalOwned = data ? data.items.filter((i) => i.count > 0).length : 0;
  const cost = open ? data?.craft_cost[open.rarity] : undefined;

  return (
    <Screen header={<TopBar />} onRefresh={() => void refetch()} refreshing={isRefetching}>
      <View style={styles.head}>
        <AppText variant="title">{t.title}</AppText>
        <View style={styles.dust}>
          <DustIcon size={18} />
          <Led size="number" color={colors.text}>
            {formatNumber(data?.dust ?? 0)}
          </Led>
        </View>
      </View>
      <AppText color={colors.textMuted}>{fmt(t.progress, { n: totalOwned, total: data?.items.length ?? 96 })}</AppText>

      {isLoading ? <Skeleton height={420} rounded={18} /> : null}

      {data ? (
        <>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
            {data.albums.map((a) => {
              const on = a.slug === album?.slug;
              return (
                <Pressable
                  key={a.slug}
                  onPress={() => {
                    haptic('select');
                    setAlbumSlug(a.slug);
                  }}
                  style={[styles.chip, on && styles.chipOn]}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: on }}
                >
                  <AppText variant="label" color={on ? colors.textOnBright : colors.text} numberOfLines={1}>
                    {a.title}
                  </AppText>
                  <AppText variant="caption" color={on ? colors.textOnBright : colors.textDim}>
                    {`${a.owned}/${a.total}`}
                  </AppText>
                </Pressable>
              );
            })}
          </ScrollView>

          {album ? (
            <Card padding={space.md} style={styles.albumCard}>
              <AppText variant="heading">{album.title}</AppText>
              <AppText variant="caption" color={colors.textDim}>
                {album.blurb}
              </AppText>
              <ProgressBar
                value={album.owned / Math.max(1, album.total)}
                accessibilityLabel={fmt(t.albumProgress, { n: album.owned, total: album.total })}
              />
              {album.owned === album.total && !album.claimed ? (
                <StickerButton
                  label={album.slug === 'hall' ? t.claimHall : t.claim}
                  icon="trophy"
                  fullWidth
                  loading={claim.isPending}
                  onPress={() =>
                    claim.mutate(album.slug, {
                      onSuccess: () => {
                        playSound('level_up');
                        toast(t.claimed, 'success');
                      },
                      onError: () => toast(strings.errors.generic, 'error'),
                    })
                  }
                />
              ) : null}
              {album.claimed ? (
                <AppText variant="label" color={colors.correct}>
                  {t.done}
                </AppText>
              ) : null}
            </Card>
          ) : null}

          <View style={styles.grid}>
            {items.map((it) => (
              <Pressable
                key={it.id}
                onPress={() => {
                  haptic('tap');
                  setOpen(it);
                }}
                accessibilityRole="button"
              >
                <LegendCard item={it} width={104} locked={it.count === 0} />
                {it.count > 1 ? (
                  <View style={styles.dupe}>
                    <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
                      {`x${it.count}`}
                    </AppText>
                  </View>
                ) : null}
              </Pressable>
            ))}
          </View>

          <Card kind="soft" padding={space.md} style={styles.albumCard}>
            <AppText variant="label">{t.howTitle}</AppText>
            <AppText variant="caption" color={colors.textMuted}>
              {t.howBody}
            </AppText>
            <StickerButton label={t.toPacks} tone="outline" size="sm" onPress={() => router.push('/(tabs)/packs')} />
          </Card>
          <AppText variant="caption" color={colors.textDim} align="center">
            {t.fiction}
          </AppText>
        </>
      ) : null}

      <BottomSheet
        visible={!!open}
        onClose={() => setOpen(null)}
        title={open && open.count > 0 ? open.name : fmt(t.slot, { n: open?.number ?? 0 })}
      >
        {open ? (
          <View style={styles.sheet}>
            <LegendCard item={open} width={200} locked={open.count === 0} />
            {open.count > 0 ? (
              <AppText color={colors.textMuted} align="center">
                {open.bio}
              </AppText>
            ) : (
              <>
                <AppText color={colors.textMuted} align="center">
                  {fmt(t.missing, { rarity: rarityColors[open.rarity].label })}
                </AppText>
                {cost ? (
                  <StickerButton
                    label={fmt(t.craft, { n: formatNumber(cost) })}
                    tone={(data?.dust ?? 0) >= cost ? 'primary' : 'ghost'}
                    disabled={(data?.dust ?? 0) < cost}
                    loading={craft.isPending}
                    fullWidth
                    onPress={() =>
                      craft.mutate(open.id, {
                        onSuccess: () => {
                          playSound('rare_reveal');
                          toast(t.crafted, 'success');
                          setOpen(null);
                        },
                        onError: (e) =>
                          toast(e instanceof RpcError && e.code === 'insufficient_funds' ? t.noDust : strings.errors.generic, 'error'),
                      })
                    }
                  />
                ) : (
                  <AppText variant="caption" color={colors.textDim} align="center">
                    {t.notCraftable}
                  </AppText>
                )}
              </>
            )}
          </View>
        ) : null}
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  dust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.chip,
    backgroundColor: colors.board,
  },
  chips: { gap: space.sm, paddingVertical: space.xs },
  chip: {
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
  },
  chipOn: { backgroundColor: colors.led, borderColor: colors.led },
  albumCard: { gap: space.sm },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  dupe: {
    position: 'absolute',
    top: -6,
    end: -6,
    paddingHorizontal: 6,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.led,
    justifyContent: 'center',
  },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  sheet: { alignItems: 'center', gap: space.md },
});
