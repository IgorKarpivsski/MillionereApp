import { Ionicons } from '@expo/vector-icons';
import { WARDROBE_SLOTS, type WardrobeItem, type WardrobeSlot } from '@fm/shared';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Backdrop, BottomSheet, CoinIcon, Confetti, GemIcon, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { useMyState } from '@/features/profile/hooks';
import { useWardrobe, useWardrobeBuy, useWardrobeWear } from '@/features/wardrobe/api';
import { ItemThumb, SlothDoll } from '@/features/wardrobe/SlothDoll';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.wardrobe;
const name = (id: string) => t.names[id as keyof typeof t.names] ?? id;

/** "הארון של העצלן": dress the full-body sloth, one item per slot, bought with coins or gems. */
export default function WardrobeScreen() {
  const { data: st } = useWardrobe();
  const { data: me } = useMyState();
  const buy = useWardrobeBuy();
  const wear = useWardrobeWear();
  const toast = useToast();
  const { width, height } = useWindowDimensions();
  const [slot, setSlot] = useState<WardrobeSlot>('hat');
  const [pick, setPick] = useState<WardrobeItem | null>(null);
  const [party, setParty] = useState(0);

  const owned = st?.owned ?? [];
  const wallet = me?.wallet;
  const items = useMemo(() => (st?.items ?? []).filter((i) => i.cat === slot), [st?.items, slot]);
  // trying something on: shown on the sloth until bought or dismissed
  const outfit = { ...(st?.outfit ?? {}), ...(pick ? { [pick.cat]: pick.id } : {}) };
  const dollW = Math.min(width * 0.46, (height * 0.34) / 1.6, 220);

  const afford = (i: WardrobeItem) => (wallet ? (i.currency === 'coins' ? wallet.coins : wallet.gems) >= i.price : false);

  const tap = (i: WardrobeItem) => {
    haptic('tap');
    if (owned.includes(i.id)) {
      const worn = st?.outfit[i.cat] === i.id;
      wear.mutate({ slot: i.cat, item: worn ? null : i.id });
    } else setPick(i);
  };

  const doBuy = (i: WardrobeItem) => {
    buy.mutate(i.id, {
      onSuccess: () => {
        setPick(null);
        haptic('success');
        playSound('solved');
        setParty((p) => p + 1);
        toast(fmt(t.bought, { name: name(i.id) }), 'success');
      },
      onError: (e) =>
        toast((e as Error).message.includes('insufficient') ? (i.currency === 'coins' ? t.noCoins : t.noGems) : strings.errors.generic, 'error'),
    });
  };

  return (
    <SafeAreaView style={styles.root} edges={['top', 'bottom']}>
      <Backdrop />
      {party ? <Confetti key={party} /> : null}
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <Ionicons name="chevron-forward" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="heading" accessibilityRole="header" style={styles.flex}>
          {t.title}
        </AppText>
        {wallet ? (
          <View style={styles.wallet}>
            <CoinIcon size={16} />
            <AppText variant="label" style={styles.bold}>
              {formatNumber(wallet.coins)}
            </AppText>
            <GemIcon size={16} />
            <AppText variant="label" style={styles.bold}>
              {formatNumber(wallet.gems)}
            </AppText>
          </View>
        ) : null}
      </View>

      <View style={styles.stage}>
        <SlothDoll width={dollW} outfit={outfit} say={pick ? t.tryOn : undefined} />
        <AppText variant="caption" color={colors.textMuted}>
          {fmt(t.collection, { n: owned.length, total: st?.items.length ?? 0 })}
        </AppText>
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabs} style={styles.tabsWrap}>
        {WARDROBE_SLOTS.map((k) => (
          <Pressable
            key={k}
            onPress={() => setSlot(k)}
            accessibilityRole="tab"
            accessibilityState={{ selected: slot === k }}
            style={[styles.tab, slot === k && styles.tabOn]}
          >
            <AppText variant="label" color={slot === k ? colors.textOnBright : colors.text} style={styles.bold}>
              {t.tabs[k]}
            </AppText>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView contentContainerStyle={styles.grid}>
        {items.map((i) => {
          const mine = owned.includes(i.id);
          const worn = st?.outfit[i.cat] === i.id;
          return (
            <Pressable
              key={i.id}
              onPress={() => tap(i)}
              accessibilityRole="button"
              accessibilityState={{ selected: worn }}
              accessibilityLabel={`${name(i.id)}. ${mine ? (worn ? t.wearing : t.owned) : fmt(t.priceA11y, { n: i.price })}`}
              style={({ pressed }) => [styles.card, mine && styles.cardMine, worn && styles.cardWorn, pressed && styles.pressed]}
            >
              <View style={!mine && !afford(i) ? styles.dim : undefined}>
                <ItemThumb id={i.id} size={64} />
              </View>
              <AppText variant="caption" align="center" numberOfLines={1} style={styles.bold}>
                {name(i.id)}
              </AppText>
              {mine ? (
                <AppText variant="caption" color={worn ? colors.led : colors.correct} style={styles.bold}>
                  {worn ? t.wearing : t.tapToWear}
                </AppText>
              ) : (
                <View style={styles.price}>
                  {i.currency === 'coins' ? <CoinIcon size={14} /> : <GemIcon size={14} />}
                  <AppText variant="caption" color={afford(i) ? colors.text : colors.textDim} style={styles.bold}>
                    {formatNumber(i.price)}
                  </AppText>
                </View>
              )}
            </Pressable>
          );
        })}
      </ScrollView>

      <BottomSheet visible={!!pick} onClose={() => setPick(null)} title={pick ? name(pick.id) : ''}>
        {pick ? (
          <View style={styles.sheet}>
            <ItemThumb id={pick.id} size={120} />
            {afford(pick) ? (
              <StickerButton
                label={fmt(pick.currency === 'coins' ? t.buyCoins : t.buyGems, { n: formatNumber(pick.price) })}
                icon="cart"
                size="lg"
                tone="prize"
                fullWidth
                loading={buy.isPending}
                onPress={() => doBuy(pick)}
              />
            ) : (
              <>
                <AppText variant="label" color={colors.led} align="center" style={styles.bold}>
                  {fmt(pick.currency === 'coins' ? t.needCoins : t.needGems, {
                    n: formatNumber(pick.price - (pick.currency === 'coins' ? (wallet?.coins ?? 0) : (wallet?.gems ?? 0))),
                  })}
                </AppText>
                <StickerButton
                  label={t.goPlay}
                  icon="play"
                  size="lg"
                  fullWidth
                  onPress={() => {
                    setPick(null);
                    router.push({ pathname: '/session', params: { world: 'mix' } });
                  }}
                />
              </>
            )}
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingVertical: space.sm },
  wallet: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  stage: { alignItems: 'center', gap: space.xs, paddingBottom: space.sm },
  tabsWrap: { flexGrow: 0 },
  tabs: { gap: space.sm, paddingHorizontal: space.md, paddingBottom: space.sm },
  tab: { paddingHorizontal: space.md, paddingVertical: space.sm, borderRadius: radius.chip, backgroundColor: colors.surfaceRaised },
  tabOn: { backgroundColor: colors.led },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between', padding: space.md, paddingTop: 0 },
  card: {
    width: '31.5%',
    alignItems: 'center',
    gap: 2,
    padding: space.sm,
    borderRadius: radius.card,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  cardMine: { borderColor: 'rgba(61,220,132,0.45)' },
  cardWorn: { borderColor: colors.led },
  pressed: { transform: [{ scale: 0.97 }] },
  dim: { opacity: 0.45 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sheet: { gap: space.md, alignItems: 'center' },
});
