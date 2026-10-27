import { Ionicons } from '@expo/vector-icons';
import type { Collectible } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { memo } from 'react';
import { I18nManager, Image, Platform, Pressable, StyleSheet, View } from 'react-native';
import { AppText, ProgressBar } from '@/design-system/components';
import { colors, palette } from '@/design-system/tokens';
import { fmt, strings } from '@/lib/i18n';
import { albumColors, coverKey, type AlbumSummary } from './albumLook';
import { CARD_ART } from './cardArt';
import { LegendCard } from './LegendCard';

const t = strings.collection;
const SPINE = 14;

/**
 * One album on the shelf, drawn as a physical book: a coloured hard cover with
 * a stitched spine on the binding side (RTL books open from the right), the
 * album art in a window, the title on a paper label and a progress strip.
 */
export const AlbumBook = memo(function AlbumBook({
  album,
  coverItem,
  width,
  onPress,
}: {
  album: AlbumSummary;
  /** Fallback cover art when the album has no illustrated cover. */
  coverItem?: Collectible;
  width: number;
  onPress: () => void;
}) {
  const c = albumColors(album.slug);
  const full = album.total > 0 && album.owned >= album.total;
  const gift = full && !album.claimed;
  const art = CARD_ART[coverKey(album.slug)];
  const height = Math.round(width * 1.42);
  const artW = width - SPINE - 28;
  const label =
    fmt(t.bookLabel, { title: album.title, n: album.owned, total: album.total }) +
    (gift ? t.bookGift : full ? t.bookComplete : '');
  // Physical gradients: the spine is on the start side (right in RTL).
  const spineDir = I18nManager.isRTL ? { start: { x: 1, y: 0 }, end: { x: 0, y: 0 } } : { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityHint={t.bookHint}
      style={({ pressed }) => [{ width, transform: [{ scale: pressed ? 0.97 : 1 }] }]}
    >
      {/* pages peeking out under the cover */}
      <View style={[styles.pages, { height: height - 6 }]} />
      <View style={[styles.cover, { height, backgroundColor: c.base }]}>
        <LinearGradient colors={[c.light, c.base, c.dark]} locations={[0, 0.55, 1]} style={StyleSheet.absoluteFill} />
        {/* spine / binding */}
        <View style={[styles.spine, { width: SPINE }]}>
          <LinearGradient colors={[c.deep, c.dark, c.deep]} locations={[0, 0.6, 1]} {...spineDir} style={StyleSheet.absoluteFill} />
          <View style={[styles.stitch, { top: '18%' }]} />
          <View style={[styles.stitch, { top: '50%' }]} />
          <View style={[styles.stitch, { top: '82%' }]} />
        </View>
        <LinearGradient
          colors={['rgba(0,0,0,0.35)', 'rgba(0,0,0,0)']}
          {...spineDir}
          style={[styles.hinge, { start: SPINE }]}
          pointerEvents="none"
        />

        <View style={[styles.body, { paddingStart: SPINE + 8 }]}>
          <View style={[styles.window, { width: artW, height: artW, borderColor: c.light }]}>
            {art ? (
              <Image source={art} style={{ width: artW - 6, height: artW - 6, borderRadius: 10 }} resizeMode="cover" accessibilityIgnoresInvertColors />
            ) : coverItem ? (
              <View style={styles.fallbackArt}>
                <LegendCard item={coverItem} width={Math.round((artW - 10) * 0.72)} />
              </View>
            ) : (
              <Ionicons name="albums" size={artW * 0.5} color={c.light} />
            )}
          </View>
          <View style={styles.plate}>
            <AppText variant="label" color={colors.cardText} numberOfLines={2} align="center" style={styles.title}>
              {album.title}
            </AppText>
          </View>
          <View style={styles.progressRow}>
            <View style={styles.flex}>
              <ProgressBar
                value={album.owned / Math.max(1, album.total)}
                height={7}
                color={full ? palette.pitch : colors.led}
                accessibilityLabel={fmt(t.albumProgress, { n: album.owned, total: album.total })}
              />
            </View>
            <AppText variant="caption" color={palette.white} style={styles.count}>
              {`${album.owned}/${album.total}`}
            </AppText>
          </View>
        </View>

        {/* shine across the hard cover */}
        <LinearGradient
          colors={['rgba(255,255,255,0.22)', 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0 }}
          end={{ x: 0.6, y: 0.5 }}
          style={StyleSheet.absoluteFill}
          pointerEvents="none"
        />
      </View>

      {!full && album.total > 1 && album.owned === album.total - 1 ? (
        <View style={[styles.ribbon, { backgroundColor: colors.led }]}>
          <Ionicons name="extension-puzzle" size={14} color={colors.textOnBright} />
          <AppText variant="caption" color={colors.textOnBright} style={styles.title}>
            {t.lastOneTag}
          </AppText>
        </View>
      ) : null}
      {full ? (
        <View style={[styles.ribbon, { backgroundColor: gift ? colors.led : palette.pitch }]}>
          {gift ? <Ionicons name="gift" size={14} color={colors.textOnBright} /> : <Ionicons name="checkmark" size={14} color={colors.textOnBright} />}
          <AppText variant="caption" color={colors.textOnBright} style={styles.title}>
            {gift ? t.giftTag : t.completeTag}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  pages: {
    position: 'absolute',
    top: 4,
    end: -3,
    start: 6,
    borderRadius: 10,
    backgroundColor: '#F3E9CF',
    borderWidth: 1,
    borderColor: '#CDBF9C',
  },
  cover: {
    borderRadius: 10,
    borderTopStartRadius: 4,
    borderBottomStartRadius: 4,
    overflow: 'hidden',
    ...Platform.select({
      ios: { shadowColor: '#000', shadowOpacity: 0.45, shadowRadius: 8, shadowOffset: { width: 0, height: 5 } },
      default: { borderWidth: 1, borderColor: 'rgba(0,0,0,0.45)' },
    }),
  },
  spine: { position: 'absolute', top: 0, bottom: 0, start: 0, overflow: 'hidden' },
  stitch: { position: 'absolute', start: 3, end: 3, height: 3, marginTop: -1.5, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.28)' },
  hinge: { position: 'absolute', top: 0, bottom: 0, width: 10 },
  body: { flex: 1, paddingEnd: 8, paddingTop: 12, paddingBottom: 10, alignItems: 'center', gap: 8 },
  window: {
    borderRadius: 12,
    borderWidth: 3,
    backgroundColor: 'rgba(0,0,0,0.22)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  fallbackArt: { transform: [{ rotate: '-4deg' }] },
  plate: {
    alignSelf: 'stretch',
    minHeight: 44,
    paddingHorizontal: 6,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: '#FBF5E4',
    justifyContent: 'center',
  },
  title: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch', marginTop: 'auto' },
  flex: { flex: 1 },
  count: { fontFamily: 'IBMPlexSansHebrew_700Bold', minWidth: 34, textAlign: 'center' },
  ribbon: {
    position: 'absolute',
    top: -8,
    end: -6,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    paddingHorizontal: 8,
    height: 24,
    borderRadius: 12,
    transform: [{ rotate: '-6deg' }],
  },
});
