import { PACKS, type PackType, type Rarity } from '@fm/economy-config';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import {
  AppText,
  BottomSheet,
  Card,
  CoinIcon,
  GemIcon,
  Screen,
  StickerButton,
  useToast,
} from '@/design-system/components';
import { colors, palette, radius, rarityColors, space } from '@/design-system/tokens';
import { formatNumber } from '@/lib/format';
import { strings } from '@/lib/i18n';

const PACK_NAMES: Record<PackType['slug'], string> = {
  bronze: 'חבילת ארד',
  silver: 'חבילת כסף',
  gold: 'חבילת זהב',
  epic: 'חבילה אפית',
  legendary: 'חבילה אגדית',
};
const PACK_COLORS: Record<PackType['slug'], string> = {
  bronze: '#D98A4E',
  silver: '#C9CCE0',
  gold: colors.prize,
  epic: palette.violet,
  legendary: colors.danger,
};

function OddsTable({ pack }: { pack: PackType }) {
  return (
    <View style={styles.odds}>
      {(Object.entries(pack.odds) as [Rarity, number][]).map(([rarity, pct]) => (
        <View key={rarity} style={styles.oddsRow}>
          <View style={[styles.swatch, { backgroundColor: rarityColors[rarity].fill }]} />
          <AppText style={styles.flex}>{rarityColors[rarity].label}</AppText>
          <AppText variant="number">{pct}%</AppText>
        </View>
      ))}
      <AppText variant="caption" color={colors.textMuted}>
        {`${pack.items} פריטים בחבילה. הסיכוי הוא לכל פריט בנפרד.`}
      </AppText>
    </View>
  );
}

function PackCard({ pack, onOdds }: { pack: PackType; onOdds: () => void }) {
  const toast = useToast();
  return (
    <Card kind="sticker" padding={space.md}>
      <View style={styles.packRow}>
        <View style={[styles.packArt, { backgroundColor: PACK_COLORS[pack.slug] }]}>
          <Ionicons name="gift" size={34} color={palette.night950} />
        </View>
        <View style={styles.flex}>
          <AppText variant="heading">{PACK_NAMES[pack.slug]}</AppText>
          <View style={styles.price}>
            {pack.priceCoins ? <CoinIcon size={18} /> : pack.priceGems ? <GemIcon size={18} /> : null}
            <AppText variant="number" color={colors.textMuted}>
              {pack.priceCoins
                ? formatNumber(pack.priceCoins)
                : pack.priceGems
                  ? formatNumber(pack.priceGems)
                  : 'מאירועים בלבד'}
            </AppText>
          </View>
        </View>
      </View>
      <View style={styles.packActions}>
        <StickerButton
          label={strings.common.soon}
          size="sm"
          icon="lock-closed"
          style={styles.flex}
          onPress={() => toast('פתיחת חבילות תגיע בקרוב.', 'info')}
        />
        <StickerButton label={strings.packs.odds} size="sm" tone="ghost" onPress={onOdds} />
      </View>
    </Card>
  );
}

export default function PacksScreen() {
  const [oddsFor, setOddsFor] = useState<PackType | null>(null);
  return (
    <Screen header={<TopBar />}>
      <AppText variant="title">{strings.packs.title}</AppText>
      <AppText color={colors.textMuted}>{strings.packs.body}</AppText>
      {PACKS.map((p) => (
        <PackCard key={p.slug} pack={p} onOdds={() => setOddsFor(p)} />
      ))}
      <BottomSheet
        visible={!!oddsFor}
        onClose={() => setOddsFor(null)}
        title={oddsFor ? `${strings.packs.odds}: ${PACK_NAMES[oddsFor.slug]}` : ''}
      >
        {oddsFor ? <OddsTable pack={oddsFor} /> : null}
        <StickerButton label={strings.common.close} tone="ghost" fullWidth onPress={() => setOddsFor(null)} />
      </BottomSheet>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  packRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  packArt: {
    width: 64,
    height: 76,
    borderRadius: radius.sticker,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: colors.sticker,
  },
  price: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xxs },
  packActions: { flexDirection: 'row', gap: space.sm, marginTop: space.md },
  odds: { gap: space.sm },
  oddsRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  swatch: { width: 18, height: 18, borderRadius: 6, borderWidth: 2, borderColor: colors.sticker },
});
