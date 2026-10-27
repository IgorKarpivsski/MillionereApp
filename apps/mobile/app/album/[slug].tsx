import { Ionicons } from '@expo/vector-icons';
import type { Collectible } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useMemo, useRef, useState } from 'react';
import {
  AccessibilityInfo,
  I18nManager,
  Image,
  PanResponder,
  Pressable,
  StyleSheet,
  useWindowDimensions,
  View,
} from 'react-native';
import Animated, { SlideInLeft, SlideInRight } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppText,
  Backdrop,
  Card,
  DustIcon,
  Led,
  ProgressBar,
  Skeleton,
  StickerButton,
  useToast,
} from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { albumColors, coverKey, type AlbumSummary } from '@/features/collection/albumLook';
import { PaperPage, ROW_GAP, StickerSlot, stickerWidthFor } from '@/features/collection/AlbumPage';
import { CARD_ART } from '@/features/collection/cardArt';
import { useClaimAlbum, useCollection } from '@/features/collection/hooks';
import { LegendCard } from '@/features/collection/LegendCard';
import { StickerSheet } from '@/features/collection/StickerSheet';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.collection;
const PER_PAGE = 6;

type PageSpec = { key: string; kind: 'cover' } | { key: string; kind: 'stickers'; n: number; items: Collectible[] };

export default function AlbumScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const { data, isLoading, isError, refetch } = useCollection();
  const claim = useClaimAlbum();
  const toast = useToast();
  const reduced = useReducedMotion();
  const { width } = useWindowDimensions();
  const [listH, setListH] = useState(0);
  const [page, setPage] = useState(0);
  const [openId, setOpenId] = useState<string | null>(null);

  const album = data?.albums.find((a) => a.slug === slug);
  const items = useMemo(
    () => (data?.items.filter((i) => i.album === slug) ?? []).slice().sort((a, b) => a.number - b.number),
    [data, slug],
  );
  const pages = useMemo<PageSpec[]>(() => {
    const out: PageSpec[] = [{ key: 'cover', kind: 'cover' }];
    for (let i = 0; i < items.length; i += PER_PAGE) {
      const n = i / PER_PAGE + 1;
      out.push({ key: `p${n}`, kind: 'stickers', n, items: items.slice(i, i + PER_PAGE) });
    }
    return out;
  }, [items]);
  const open = openId ? (items.find((i) => i.id === openId) ?? null) : null;
  // one sticker short of a full album: offer to craft it at half the dust
  const lastMissing = album && album.total > 1 && album.owned === album.total - 1 ? (items.find((i) => i.count === 0) ?? null) : null;

  const pageW = width - 2 * space.lg;
  const pageH = Math.max(0, listH - space.sm);
  const stickerW = stickerWidthFor(pageW, pageH);

  const pageName = useCallback((i: number) => (i === 0 ? t.coverPage : fmt(t.pageName, { n: i })), []);
  const total = pages.length;

  const pagesCount = useRef(total);
  pagesCount.current = total;
  const pageRef = useRef(0);

  const dir = useRef(1);
  const goTo = (i: number) => {
    if (i < 0 || i >= total || i === pageRef.current) return;
    dir.current = i > pageRef.current ? 1 : -1;
    pageRef.current = i;
    setPage(i);
    haptic('select');
    AccessibilityInfo.announceForAccessibility(`${pageName(i)}, ${fmt(t.pageOf, { n: i + 1, total })}`);
  };
  const goToRef = useRef(goTo);
  goToRef.current = goTo;
  // swipe toward the left for the next page (as the hint on the cover says), right to go back
  const swipe = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, g) => Math.abs(g.dx) > 18 && Math.abs(g.dx) > Math.abs(g.dy) * 1.5,
      onPanResponderRelease: (_, g) => {
        if (Math.abs(g.dx) < 50) return;
        const forward = g.dx < 0;
        goToRef.current(pageRef.current + (forward ? 1 : -1));
      },
    }),
  ).current;

  const claimReward = (a: AlbumSummary) =>
    claim.mutate(a.slug, {
      onSuccess: () => {
        playSound('level_up');
        toast(t.claimed, 'success');
      },
      onError: () => toast(strings.errors.generic, 'error'),
    });

  const renderPage = ({ item: p }: { item: PageSpec }) => (
    <View style={[styles.pageWrap, { width }]}>
      {p.kind === 'cover' ? (
        album ? (
          <AlbumCover album={album} coverItem={items[items.length - 1]} width={pageW} height={pageH} claiming={claim.isPending} onClaim={() => claimReward(album)} />
        ) : null
      ) : (
        <PaperPage width={pageW} height={pageH} pageNumber={p.n} title={album?.title}>
          <View style={[styles.slots, { rowGap: ROW_GAP }]}>
            {p.items.map((it) => (
              <StickerSlot key={it.id} item={it} stickerWidth={stickerW} onPress={(x) => setOpenId(x.id)} />
            ))}
          </View>
        </PaperPage>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Backdrop accent={album ? albumColors(album.slug).base : undefined} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <Ionicons name={I18nManager.isRTL ? 'arrow-forward' : 'arrow-back'} size={26} color={colors.text} />
        </Pressable>
        <View style={styles.flex}>
          <AppText variant="heading" numberOfLines={1} accessibilityRole="header">
            {album?.title ?? t.title}
          </AppText>
          {album ? (
            <AppText variant="caption" color={colors.textMuted}>
              {fmt(t.albumProgress, { n: album.owned, total: album.total })}
            </AppText>
          ) : null}
        </View>
        <View style={styles.dust}>
          <DustIcon size={16} />
          <Led size="number" color={colors.text}>
            {formatNumber(data?.dust ?? 0)}
          </Led>
        </View>
      </View>

      {lastMissing ? (
        <Pressable
          onPress={() => setOpenId(lastMissing.id)}
          accessibilityRole="button"
          accessibilityLabel={`${t.lastOneTitle} ${t.lastOneBody}`}
          style={({ pressed }) => [styles.lastOne, pressed && { opacity: 0.85 }]}
        >
          <AppText style={styles.lastOneIcon}>🧩</AppText>
          <View style={styles.flex}>
            <AppText variant="label" color={colors.textOnBright}>
              {t.lastOneTitle}
            </AppText>
            <AppText variant="caption" color={colors.textOnBright}>
              {t.lastOneBody}
            </AppText>
          </View>
          <Ionicons name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'} size={20} color={colors.textOnBright} />
        </Pressable>
      ) : null}

      {isLoading ? (
        <View style={styles.pad}>
          <Skeleton height={480} rounded={12} />
        </View>
      ) : null}
      {isError && !data ? (
        <View style={styles.pad}>
          <Card padding={space.lg} style={styles.gap}>
            <AppText variant="heading" align="center">
              {strings.packs.loadError}
            </AppText>
            <StickerButton label={strings.packs.retry} icon="refresh" onPress={() => void refetch()} />
          </Card>
        </View>
      ) : null}
      {data && !album ? (
        <View style={styles.pad}>
          <Card padding={space.lg} style={styles.gap}>
            <AppText variant="heading" align="center">
              {t.notFound}
            </AppText>
            <StickerButton label={strings.common.back} onPress={() => router.back()} />
          </Card>
        </View>
      ) : null}

      {data && album ? (
        <>
          {/* One page at a time, turned by a swipe or the arrows. (A horizontal paged list
              jumps to the wrong page on Android in right-to-left mode.) */}
          <View
            style={styles.flex}
            onLayout={(e) => setListH(Math.floor(e.nativeEvent.layout.height))}
            {...swipe.panHandlers}
            accessibilityLabel={fmt(t.pageOf, { n: page + 1, total })}
          >
            {listH > 0 && pages[page] ? (
              <Animated.View
                key={pages[page]!.key}
                entering={reduced ? undefined : dir.current > 0 ? SlideInRight.duration(260) : SlideInLeft.duration(260)}
              >
                {renderPage({ item: pages[page]! })}
              </Animated.View>
            ) : null}
          </View>

          <View style={styles.nav}>
            <Pressable
              onPress={() => goTo(page - 1)}
              disabled={page === 0}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.prevPage}
              accessibilityState={{ disabled: page === 0 }}
              style={[styles.arrow, page === 0 && styles.off]}
            >
              <Ionicons name={I18nManager.isRTL ? 'chevron-forward' : 'chevron-back'} size={22} color={colors.text} />
            </Pressable>
            <View style={styles.dots}>
              {pages.map((p, i) => (
                <Pressable
                  key={p.key}
                  onPress={() => goTo(i)}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={fmt(t.goToPage, { n: pageName(i) })}
                  accessibilityState={{ selected: i === page }}
                  style={[styles.dot, i === page && styles.dotOn]}
                />
              ))}
            </View>
            <Pressable
              onPress={() => goTo(page + 1)}
              disabled={page >= total - 1}
              hitSlop={8}
              accessibilityRole="button"
              accessibilityLabel={t.nextPage}
              accessibilityState={{ disabled: page >= total - 1 }}
              style={[styles.arrow, page >= total - 1 && styles.off]}
            >
              <Ionicons name={I18nManager.isRTL ? 'chevron-back' : 'chevron-forward'} size={22} color={colors.text} />
            </Pressable>
          </View>
        </>
      ) : null}

      <StickerSheet
        item={open}
        dust={data?.dust ?? 0}
        craftCost={data?.craft_cost}
        lastOne={!!open && open.id === lastMissing?.id}
        onClose={() => setOpenId(null)}
      />
    </SafeAreaView>
  );
}

/** The album's hard front cover: art, title, blurb, progress and the completion reward. */
function AlbumCover({
  album,
  coverItem,
  width,
  height,
  claiming,
  onClaim,
}: {
  album: AlbumSummary;
  coverItem?: Collectible;
  width: number;
  height: number;
  claiming: boolean;
  onClaim: () => void;
}) {
  const c = albumColors(album.slug);
  const art = CARD_ART[coverKey(album.slug)];
  const full = album.total > 0 && album.owned >= album.total;
  const artSide = Math.min(width * 0.55, height * 0.32);
  const spineDir = I18nManager.isRTL ? { start: { x: 1, y: 0 }, end: { x: 0, y: 0 } } : { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };

  return (
    <View style={[styles.cover, { width, height, backgroundColor: c.base }]}>
      <LinearGradient colors={[c.light, c.base, c.dark]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
      <LinearGradient colors={[c.deep, c.dark]} {...spineDir} style={styles.coverSpine} />
      <LinearGradient colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']} {...spineDir} style={styles.coverHinge} />
      <View style={styles.coverBody}>
        <View style={[styles.coverArt, { width: artSide, height: artSide, borderColor: c.light }]}>
          {art ? (
            <Image source={art} style={{ width: artSide - 8, height: artSide - 8, borderRadius: 12 }} resizeMode="cover" accessibilityIgnoresInvertColors />
          ) : coverItem ? (
            <LegendCard item={coverItem} width={Math.round(artSide * 0.62)} />
          ) : (
            <Ionicons name="albums" size={artSide * 0.5} color={c.light} />
          )}
        </View>
        <View style={styles.coverLabel}>
          <AppText variant="heading" color={colors.cardText} align="center" numberOfLines={2}>
            {album.title}
          </AppText>
          <AppText variant="caption" color={colors.cardMuted} align="center" numberOfLines={2}>
            {album.blurb}
          </AppText>
          <ProgressBar
            value={album.owned / Math.max(1, album.total)}
            color={full ? palette.pitch : colors.led}
            accessibilityLabel={fmt(t.albumProgress, { n: album.owned, total: album.total })}
          />
          <AppText variant="label" color={colors.cardText} align="center">
            {fmt(t.albumProgress, { n: album.owned, total: album.total })}
          </AppText>
        </View>
        {full && !album.claimed ? (
          <StickerButton label={album.slug === 'hall' ? t.claimHall : t.claim} icon="trophy" fullWidth loading={claiming} onPress={onClaim} />
        ) : album.claimed ? (
          <View style={styles.doneTag}>
            <AppText variant="label" color={colors.textOnBright} align="center">
              {t.done}
            </AppText>
          </View>
        ) : (
          <AppText variant="caption" color={palette.white} align="center" style={styles.bold}>
            🎁 {t.rewardHint}
          </AppText>
        )}
        <View style={styles.swipe}>
          <AppText variant="caption" color={palette.white}>
            {t.swipeHint}
          </AppText>
          <Ionicons name={I18nManager.isRTL ? 'arrow-back' : 'arrow-forward'} size={16} color={palette.white} />
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  lastOne: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    marginHorizontal: space.lg,
    marginBottom: space.xs,
    padding: space.sm + 2,
    borderRadius: 18,
    backgroundColor: colors.led,
  },
  lastOneIcon: { fontSize: 26 },
  root: { flex: 1, backgroundColor: colors.bgDeep },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm, paddingBottom: space.sm },
  flex: { flex: 1 },
  pad: { paddingHorizontal: space.lg, paddingTop: space.md },
  gap: { gap: space.md },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  dust: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.md,
    paddingVertical: space.xs,
    borderRadius: radius.chip,
    backgroundColor: colors.board,
  },
  pageWrap: { alignItems: 'center', paddingTop: space.xs },
  slots: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' },
  nav: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.lg, paddingVertical: space.sm },
  arrow: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.board,
    borderWidth: 1,
    borderColor: colors.border,
  },
  off: { opacity: 0.35 },
  dots: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.3)' },
  dotOn: { width: 22, backgroundColor: colors.led },
  cover: {
    borderRadius: 12,
    borderTopStartRadius: 4,
    borderBottomStartRadius: 4,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.45)',
  },
  coverSpine: { position: 'absolute', top: 0, bottom: 0, start: 0, width: 20 },
  coverHinge: { position: 'absolute', top: 0, bottom: 0, start: 20, width: 14 },
  coverBody: { flex: 1, paddingStart: 20 + space.lg, paddingEnd: space.lg, paddingVertical: space.lg, alignItems: 'center', justifyContent: 'space-evenly', gap: space.sm },
  coverArt: {
    borderRadius: 16,
    borderWidth: 4,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  coverLabel: { alignSelf: 'stretch', gap: space.xs, padding: space.md, borderRadius: 10, backgroundColor: '#FBF5E4' },
  doneTag: { alignSelf: 'center', paddingHorizontal: space.lg, paddingVertical: space.xs, borderRadius: radius.chip, backgroundColor: palette.pitch },
  swipe: { flexDirection: 'row', alignItems: 'center', gap: space.xs, opacity: 0.85 },
});
