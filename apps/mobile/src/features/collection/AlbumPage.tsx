import { Ionicons } from '@expo/vector-icons';
import type { Collectible } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, type ReactNode } from 'react';
import { I18nManager, Pressable, StyleSheet, View } from 'react-native';
import { AppText } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors } from '@/design-system/tokens';
import { fmt, strings } from '@/lib/i18n';
import { stickerTilt } from './albumLook';
import { LegendCard } from './LegendCard';

const t = strings.collection;

export const PAPER = '#FBF3DF';
export const PAPER_EDGE = '#D9C9A3';
export const INK = '#5B4A2E';
export const INK_FAINT = 'rgba(91,74,46,0.35)';
export const INK_SOFT = 'rgba(91,74,46,0.75)';

/** Height of a LegendCard of the given width (art 5:4 + border, padding and name banner). */
export function stickerHeight(width: number): number {
  return Math.round((width - 8) * 1.25 + 33);
}

/** Padding between a slot's outline and the sticker inside it. */
export const SLOT_PAD = 6;
/** Room on a page for its header line, the page number and paddings. */
export const PAGE_CHROME = 78;
export const ROW_GAP = 8;

/**
 * The largest sticker that fits 2 per row and 3 rows on a page of this size,
 * so a whole page is visible without scrolling, even on small phones.
 */
export function stickerWidthFor(pageWidth: number, pageHeight: number): number {
  const inner = pageWidth - 2 - 14 - 36; // border + paper padding + the gutter
  const byWidth = (inner - 12) / 2 - 2 * SLOT_PAD;
  const rowH = (pageHeight - PAGE_CHROME - 2 * ROW_GAP) / 3 - 2 * SLOT_PAD;
  const byHeight = (rowH - 33) / 1.25 + 8;
  return Math.max(72, Math.floor(Math.min(byWidth, byHeight, 150)));
}

/**
 * A sheet of album paper: cream colour, faint ruled lines, a gutter shadow on
 * the binding side and the page number at the bottom.
 */
export function PaperPage({
  width,
  height,
  pageNumber,
  title,
  children,
}: {
  width: number;
  height: number;
  pageNumber?: number;
  title?: string;
  children: ReactNode;
}) {
  const lines = Math.floor(height / 26);
  // The gutter is on the binding side: the right edge in RTL.
  const gutter = I18nManager.isRTL
    ? { start: { x: 1, y: 0 }, end: { x: 0, y: 0 } }
    : { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
  return (
    <View style={[styles.paper, { width, height }]}>
      <View pointerEvents="none" style={StyleSheet.absoluteFill}>
        {Array.from({ length: lines }, (_, i) => (
          <View key={i} style={[styles.rule, { top: 20 + i * 26 }]} />
        ))}
      </View>
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(80,55,20,0.32)', 'rgba(80,55,20,0.08)', 'rgba(80,55,20,0)']}
        locations={[0, 0.4, 1]}
        {...gutter}
        style={styles.gutter}
      />
      {title ? (
        <AppText variant="caption" color={INK_SOFT} align="center" numberOfLines={1} style={styles.head}>
          {title}
        </AppText>
      ) : null}
      <View style={styles.content}>{children}</View>
      {pageNumber !== undefined ? (
        <AppText variant="label" color={INK} align="center" style={styles.pageNo} accessibilityLabel={fmt(t.pageName, { n: pageNumber })}>
          {`— ${pageNumber} —`}
        </AppText>
      ) : null}
    </View>
  );
}

/** One numbered slot on a page: a dashed outline when empty, a hand-stuck sticker when owned. */
export const StickerSlot = memo(function StickerSlot({
  item,
  stickerWidth,
  onPress,
}: {
  item: Collectible;
  stickerWidth: number;
  onPress: (item: Collectible) => void;
}) {
  const owned = item.count > 0;
  const slotW = stickerWidth + 2 * SLOT_PAD;
  const slotH = stickerHeight(stickerWidth) + 2 * SLOT_PAD;
  const label = owned
    ? fmt(t.slotOwned, { n: item.number, name: item.name }) + (item.count > 1 ? fmt(t.slotDupes, { n: item.count }) : '')
    : fmt(t.slotEmpty, { n: item.number, name: item.name });
  const isObject = item.kind === 'object' || item.position === 'OBJ';

  return (
    <Pressable
      onPress={() => {
        haptic('tap');
        onPress(item);
      }}
      accessibilityRole="button"
      accessibilityLabel={label}
      style={[styles.slot, { width: slotW, height: slotH }]}
    >
      <View style={styles.outline}>
        <AppText variant="ledL" color={INK_FAINT} style={styles.bigNo}>
          {String(item.number)}
        </AppText>
        <Ionicons name={isObject ? 'help-circle-outline' : 'person'} size={stickerWidth * 0.42} color="rgba(91,74,46,0.14)" />
        <AppText variant="caption" color={INK_SOFT} numberOfLines={2} align="center" style={styles.slotName}>
          {item.name}
        </AppText>
      </View>
      {owned ? (
        <View style={[styles.stuck, { transform: [{ rotate: `${stickerTilt(item.id)}deg` }] }]} importantForAccessibility="no-hide-descendants" accessibilityElementsHidden>
          <LegendCard item={item} width={stickerWidth} glow={item.glow > 0} />
          {item.count > 1 ? (
            <View style={styles.dupe}>
              <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
                {`x${item.count}`}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
    </Pressable>
  );
});

const styles = StyleSheet.create({
  paper: {
    backgroundColor: PAPER,
    borderRadius: 6,
    borderTopStartRadius: 2,
    borderBottomStartRadius: 2,
    borderWidth: 1,
    borderColor: PAPER_EDGE,
    overflow: 'hidden',
    paddingHorizontal: 14,
    paddingStart: 14 + 22,
    paddingTop: 8,
    paddingBottom: 6,
  },
  rule: { position: 'absolute', start: 0, end: 0, height: StyleSheet.hairlineWidth, backgroundColor: 'rgba(120,150,190,0.28)' },
  gutter: { position: 'absolute', top: 0, bottom: 0, start: 0, width: 26 },
  head: { fontFamily: 'IBMPlexSansHebrew_700Bold', marginBottom: 4 },
  content: { flex: 1, justifyContent: 'center' },
  pageNo: { marginTop: 4, fontFamily: 'IBMPlexSansHebrew_700Bold' },
  slot: { alignItems: 'center', justifyContent: 'center' },
  outline: {
    ...StyleSheet.absoluteFillObject,
    borderWidth: 2,
    borderStyle: 'dashed',
    borderColor: 'rgba(91,74,46,0.35)',
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.35)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 4,
  },
  bigNo: { position: 'absolute', top: 6, textShadowColor: 'transparent', textShadowRadius: 0 },
  slotName: { position: 'absolute', bottom: 6, start: 4, end: 4 },
  stuck: {
    shadowColor: '#3B2A10',
    shadowOpacity: 0.35,
    shadowRadius: 3,
    shadowOffset: { width: 1, height: 2 },
  },
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
});
