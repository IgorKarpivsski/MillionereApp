import type { Collectible } from '@fm/shared';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { StyleSheet, useWindowDimensions, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { AppText, Card, DustIcon, Led, ProgressBar, Screen, Skeleton, StickerButton } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, radius, space } from '@/design-system/tokens';
import { AlbumBook } from '@/features/collection/AlbumBook';
import { sortAlbums } from '@/features/collection/albumLook';
import { useCollection } from '@/features/collection/hooks';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.collection;
const GAP = space.md;

/**
 * The album shelf: every album as a physical sticker book. Tapping a book
 * opens it (album/[slug]) to flip through its pages of stickers.
 */
export default function CollectionScreen() {
  const { data, isLoading, isError, refetch, isRefetching } = useCollection();
  const { width } = useWindowDimensions();
  const bookW = Math.floor((width - 2 * space.lg - GAP) / 2);

  const albums = useMemo(() => (data ? sortAlbums(data.albums) : []), [data]);
  // Fallback cover for albums without illustrated art: their last sticker.
  const covers = useMemo(() => {
    const m = new Map<string, Collectible>();
    for (const it of data?.items ?? []) {
      const prev = m.get(it.album);
      if (!prev || it.number > prev.number) m.set(it.album, it);
    }
    return m;
  }, [data]);
  const totalOwned = data ? data.items.filter((i) => i.count > 0).length : 0;
  const totalItems = data?.items.length ?? 0;
  const albumsDone = data ? data.albums.filter((a) => a.total > 0 && a.owned >= a.total).length : 0;

  return (
    <Screen header={<TopBar />} onRefresh={() => void refetch()} refreshing={isRefetching}>
      <View style={styles.head}>
        <AppText variant="title" accessibilityRole="header">
          {t.title}
        </AppText>
        <View style={styles.dust}>
          <DustIcon size={18} />
          <Led size="number" color={colors.text}>
            {formatNumber(data?.dust ?? 0)}
          </Led>
        </View>
      </View>
      <AppText color={colors.textMuted}>{fmt(t.progress, { n: totalOwned, total: totalItems })}</AppText>
      {data ? (
        <>
          <ProgressBar value={totalOwned / Math.max(1, totalItems)} accessibilityLabel={fmt(t.progress, { n: totalOwned, total: totalItems })} />
          <AppText variant="caption" color={colors.textDim}>
            {fmt(t.albumsDone, { n: albumsDone, total: data.albums.length })}
          </AppText>
        </>
      ) : null}

      {isLoading ? (
        <View style={styles.shelf}>
          {[0, 1, 2, 3].map((i) => (
            <Skeleton key={i} width={bookW} height={Math.round(bookW * 1.42)} rounded={10} />
          ))}
        </View>
      ) : null}
      {isError && !data ? (
        <Card padding={space.lg} style={styles.gap}>
          <AppText variant="heading" align="center">
            {strings.packs.loadError}
          </AppText>
          <StickerButton label={strings.packs.retry} icon="refresh" onPress={() => void refetch()} />
        </Card>
      ) : null}

      {data ? (
        <>
          <AppText variant="heading">{t.shelfTitle}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {t.shelfHint}
          </AppText>
          <View style={styles.shelf}>
            {albums.map((a) => (
              <AlbumBook
                key={a.slug}
                album={a}
                coverItem={covers.get(a.slug)}
                width={bookW}
                onPress={() => {
                  haptic('tap');
                  router.push({ pathname: '/album/[slug]', params: { slug: a.slug } });
                }}
              />
            ))}
          </View>

          <Card kind="soft" padding={space.md} style={styles.gap}>
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
  gap: { gap: space.sm },
  shelf: { flexDirection: 'row', flexWrap: 'wrap', columnGap: GAP, rowGap: space.xl, paddingTop: space.sm },
});
