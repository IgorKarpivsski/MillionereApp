import { legendParams, legendSvg, type Collectible } from '@fm/shared';
import { memo, useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { SvgXml } from 'react-native-svg';
import { AppText, Led } from '@/design-system/components';
import { colors, radius, rarityColors } from '@/design-system/tokens';

const POS_HE: Record<Collectible['position'], string> = { GK: 'שוער', DEF: 'הגנה', MID: 'קישור', FWD: 'התקפה' };
const ERA_HE: Record<Collectible['era'], string> = { '70s': "שנות ה-70", '80s': "שנות ה-80", '90s': "שנות ה-90", '00s': "שנות ה-2000", modern: 'הדור החדש' };

/** Retro sticker: caricature art, number badge, name banner, rarity frame. */
export const LegendCard = memo(function LegendCard({
  item,
  width = 104,
  locked = false,
}: {
  item: Pick<Collectible, 'number' | 'rarity' | 'name' | 'art_seed' | 'era' | 'position'>;
  width?: number;
  locked?: boolean;
}) {
  const r = rarityColors[item.rarity];
  const artW = width - 8;
  const xml = useMemo(
    () => (locked ? null : legendSvg(legendParams(item.art_seed, item.era), r.fill, artW)),
    [locked, item.art_seed, item.era, r.fill, artW],
  );
  const big = width >= 180;
  return (
    <View
      accessible
      accessibilityLabel={locked ? `משבצת ${item.number}, עוד לא באוסף` : `${item.name}, ${r.label}`}
      style={[styles.card, { width, borderColor: locked ? colors.border : r.fill, borderStyle: locked ? 'dashed' : 'solid' }]}
    >
      <View style={[styles.art, { height: artW * 1.25, backgroundColor: locked ? colors.bgDeep : r.lip }]}>
        {xml ? <SvgXml xml={xml} width={artW} height={artW * 1.25} /> : <Led size={big ? 'ledXL' : 'ledL'} color={colors.border}>{item.number}</Led>}
      </View>
      {!locked ? (
        <View style={[styles.num, { backgroundColor: r.fill }]}>
          <AppText variant="caption" color={colors.textOnBright} style={styles.numText}>
            {item.number}
          </AppText>
        </View>
      ) : null}
      <View style={[styles.banner, { backgroundColor: locked ? colors.board : colors.card }]}>
        <AppText
          variant={big ? 'heading' : 'caption'}
          color={locked ? colors.textDim : colors.cardText}
          numberOfLines={1}
          align="center"
          style={styles.name}
        >
          {locked ? '?' : item.name}
        </AppText>
        {big && !locked ? (
          <AppText variant="caption" color={colors.cardMuted} align="center">
            {`${POS_HE[item.position]} · ${ERA_HE[item.era]} · ${r.label}`}
          </AppText>
        ) : null}
      </View>
    </View>
  );
});

const styles = StyleSheet.create({
  card: { borderWidth: 3, borderRadius: radius.sticker, overflow: 'hidden', backgroundColor: colors.board, padding: 2 },
  art: { borderRadius: radius.sticker - 4, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  num: { position: 'absolute', top: 6, start: 6, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  numText: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  banner: { paddingVertical: 4, paddingHorizontal: 4, borderBottomLeftRadius: radius.sticker - 4, borderBottomRightRadius: radius.sticker - 4, marginTop: 2 },
  name: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});
