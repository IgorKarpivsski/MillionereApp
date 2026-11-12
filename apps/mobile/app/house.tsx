import { Ionicons } from '@expo/vector-icons';
import type { HomeItem } from '@fm/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Image, Pressable, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import {
  AppText,
  Backdrop,
  BottomSheet,
  CoinIcon,
  Confetti,
  GemIcon,
  ProgressBar,
  StickerButton,
  useToast,
} from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { RewardIcon, rewardLabel } from '@/features/engage/rewards';
import { useHatWear, useHouse, useHouseBuy } from '@/features/house/api';
import { HATS, SPOTS } from '@/features/house/art';
import { Room } from '@/features/house/Room';
import { useMyState } from '@/features/profile/hooks';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.house;

type Tab = 'room' | 'hats';

/** "הבית של העצלן": furnish the treehouse with coins, dress the sloth with gems. */
export default function HouseScreen() {
  const { data: st } = useHouse();
  const { data: me } = useMyState();
  const buy = useHouseBuy();
  const wear = useHatWear();
  const toast = useToast();
  const { width } = useWindowDimensions();
  const [tab, setTab] = useState<Tab>('room');
  const [pick, setPick] = useState<HomeItem | null>(null);
  const [fresh, setFresh] = useState<string | null>(null);
  const [party, setParty] = useState(0);

  const roomW = Math.min(width - space.md * 2, 460);
  const owned = st?.owned ?? [];
  const items = st?.items ?? [];
  const hats = st?.hats ?? [];
  const have = items.filter((i) => owned.includes(i.id)).length;
  const prices = Object.fromEntries(items.map((i) => [i.id, i.price]));
  const wallet = me?.wallet;

  const afford = (i: HomeItem) => (wallet ? (i.currency === 'coins' ? wallet.coins : wallet.gems) >= i.price : false);

  const doBuy = (i: HomeItem) => {
    buy.mutate(i.id, {
      onSuccess: (res) => {
        setPick(null);
        setFresh(i.id);
        haptic('success');
        playSound(res.just_completed ? 'level_up' : 'solved');
        if (res.just_completed) setParty((p) => p + 1);
        else toast(fmt(t.bought, { name: t.names[i.id as keyof typeof t.names] ?? '' }), 'success');
      },
      onError: (e) => toast((e as Error).message.includes('insufficient') ? (i.currency === 'coins' ? t.noCoins : t.noGems) : strings.errors.generic, 'error'),
    });
  };

  const name = (id: string) => t.names[id as keyof typeof t.names] ?? id;

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

      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.center}>
          <Room
            width={roomW}
            owned={owned}
            hat={st?.hat ?? null}
            prices={prices}
            justBought={fresh}
            onPickSpot={(id) => {
              const it = items.find((x) => x.id === id);
              if (it) setPick(it);
            }}
          />
        </View>

        <View style={styles.progress}>
          <AppText variant="label" style={styles.bold}>
            {st?.completed ? t.done : fmt(t.progress, { n: have, total: items.length })}
          </AppText>
          <ProgressBar value={items.length ? have / items.length : 0} accessibilityLabel={fmt(t.progress, { n: have, total: items.length })} />
          {!st?.completed && st?.complete_prize.length ? (
            <View style={styles.prizeRow}>
              <AppText variant="caption" color={colors.textMuted}>
                {t.prizeLine}
              </AppText>
              {st.complete_prize.map((r, i) => (
                <RewardIcon key={i} r={r} size={22} />
              ))}
            </View>
          ) : null}
        </View>

        <View style={styles.tabs}>
          {(['room', 'hats'] as Tab[]).map((k) => (
            <Pressable
              key={k}
              onPress={() => setTab(k)}
              accessibilityRole="tab"
              accessibilityState={{ selected: tab === k }}
              style={[styles.tab, tab === k && styles.tabOn]}
            >
              <AppText variant="label" color={tab === k ? colors.textOnBright : colors.text} style={styles.bold}>
                {k === 'room' ? t.tabRoom : t.tabHats}
              </AppText>
            </Pressable>
          ))}
        </View>

        <View style={styles.grid}>
          {(tab === 'room' ? items : hats).map((i) => {
            const mine = owned.includes(i.id);
            const worn = st?.hat === i.id;
            const art = tab === 'room' ? SPOTS[i.id]?.src : HATS[i.id]?.src;
            return (
              <Pressable
                key={i.id}
                onPress={() => {
                  if (!mine) setPick(i);
                  else if (tab === 'hats') wear.mutate(worn ? null : i.id);
                }}
                accessibilityRole="button"
                accessibilityLabel={`${name(i.id)} ${mine ? t.owned : fmt(t.priceA11y, { n: i.price })}`}
                style={({ pressed }) => [styles.card, mine && styles.cardMine, worn && styles.cardWorn, pressed && styles.pressed]}
              >
                {art ? <Image source={art} style={[styles.thumb, !mine && !afford(i) && styles.dim]} resizeMode="contain" /> : null}
                <AppText variant="caption" align="center" numberOfLines={1} style={styles.bold}>
                  {name(i.id)}
                </AppText>
                {mine ? (
                  <AppText variant="caption" color={worn ? colors.led : colors.correct} style={styles.bold}>
                    {tab === 'hats' ? (worn ? t.wearing : t.tapToWear) : `✓ ${t.owned}`}
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
        </View>
      </ScrollView>

      <BottomSheet visible={!!pick} onClose={() => setPick(null)} title={pick ? name(pick.id) : ''}>
        {pick ? (
          <View style={styles.sheet}>
            <Animated.View entering={ZoomIn.springify()}>
              <Image source={(SPOTS[pick.id]?.src ?? HATS[pick.id]?.src)!} style={styles.sheetArt} resizeMode="contain" />
            </Animated.View>
            <AppText color={colors.textMuted} align="center">
              {t.blurbs[pick.id as keyof typeof t.blurbs] ?? ''}
            </AppText>
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

      <BottomSheet visible={party > 0 && !!st?.completed && !pick} onClose={() => setParty(0)} title={t.doneTitle}>
        <View style={styles.sheet}>
          <AppText align="center">{t.doneBody}</AppText>
          <View style={styles.prizeRow}>
            {(st?.complete_prize ?? []).map((r, i) => (
              <View key={i} style={styles.prizeItem}>
                <RewardIcon r={r} size={48} />
                <AppText variant="caption">{rewardLabel(r)}</AppText>
              </View>
            ))}
          </View>
          <StickerButton label={t.yay} tone="prize" fullWidth onPress={() => setParty(0)} />
        </View>
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
  body: { padding: space.md, gap: space.md, paddingBottom: space.xl },
  center: { alignItems: 'center' },
  progress: { gap: space.xs },
  prizeRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, flexWrap: 'wrap' },
  prizeItem: { alignItems: 'center', gap: 2 },
  tabs: { flexDirection: 'row', gap: space.sm },
  tab: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: radius.chip,
    backgroundColor: colors.surfaceRaised,
  },
  tabOn: { backgroundColor: colors.led },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
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
  thumb: { width: 64, height: 64 },
  dim: { opacity: 0.45 },
  price: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  sheet: { gap: space.md, alignItems: 'center' },
  sheetArt: { width: 150, height: 150 },
});
