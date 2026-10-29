import { Ionicons } from '@expo/vector-icons';
import type { Collectible, MarketListing } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appAlert, AppText, AvatarBadge, Backdrop, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { useCollection } from '@/features/collection/hooks';
import { LegendCard } from '@/features/collection/LegendCard';
import { SegmentTabs } from '@/features/league/LeagueView';
import { marketApi, useMarket, useSetMarket } from '@/features/market/api';
import { RpcError } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';
import { showName } from '@/lib/names';

const t = strings.market;
const CARD = 92;

function Strip({ items, selected, onPick, badge }: { items: Collectible[]; selected: string | null; onPick: (id: string) => void; badge?: (c: Collectible) => string | null }) {
  return (
    // a virtualized row: the "missing" list can run to hundreds of stickers
    <FlatList
      horizontal
      data={items}
      keyExtractor={(item) => item.id}
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.strip}
      initialNumToRender={6}
      windowSize={5}
      extraData={selected}
      renderItem={({ item }) => {
        const on = selected === item.id;
        const b = badge?.(item);
        return (
          <Pressable
            onPress={() => {
              haptic('select');
              onPick(item.id);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on }}
            accessibilityLabel={item.name}
            style={[styles.pick, on && styles.pickOn]}
          >
            <LegendCard item={item} width={CARD} />
            {b ? (
              <View style={styles.badge}>
                <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
                  {b}
                </AppText>
              </View>
            ) : null}
            {on ? (
              <View style={styles.check}>
                <Ionicons name="checkmark-circle" size={24} color={colors.correct} />
              </View>
            ) : null}
          </Pressable>
        );
      }}
    />
  );
}

function ListingCard({
  l,
  byId,
  onTake,
  onCancel,
  busy,
}: {
  l: MarketListing;
  byId: Map<string, Collectible>;
  onTake?: () => void;
  onCancel?: () => void;
  busy: boolean;
}) {
  const give = byId.get(l.give.id);
  const want = byId.get(l.want.id);
  return (
    <View style={[styles.listing, l.can_take && l.i_need && styles.listingHot]}>
      {!l.mine ? (
        <View style={styles.owner}>
          <AvatarBadge avatarId={l.owner.avatar_id} photo={l.owner.photo} size={30} />
          <AppText variant="label" numberOfLines={1} style={styles.flex}>
            {showName(l.owner.username)}
          </AppText>
          {l.i_need ? (
            <View style={styles.needTag}>
              <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
                {t.needTag}
              </AppText>
            </View>
          ) : null}
        </View>
      ) : null}
      <View style={styles.swapRow}>
        <View style={styles.side}>
          <AppText variant="caption" color={colors.textDim}>
            {t.gives}
          </AppText>
          {give ? <LegendCard item={give} width={CARD} /> : <AppText>{l.give.name}</AppText>}
        </View>
        <Ionicons name="swap-horizontal" size={30} color={colors.led} />
        <View style={styles.side}>
          <AppText variant="caption" color={colors.textDim}>
            {t.wants}
          </AppText>
          {want ? <LegendCard item={want} width={CARD} /> : <AppText>{l.want.name}</AppText>}
        </View>
      </View>
      {onTake ? (
        <StickerButton
          label={l.can_take ? t.take : t.cantTake}
          icon={l.can_take ? 'swap-horizontal' : undefined}
          tone={l.can_take ? 'prize' : 'ghost'}
          fullWidth
          disabled={!l.can_take}
          loading={busy}
          onPress={onTake}
        />
      ) : null}
      {l.mine ? (
        l.status === 'done' ? (
          <AppText variant="label" color={colors.correct} align="center">
            {fmt(t.done, { name: l.taker ?? '' })}
          </AppText>
        ) : (
          <View style={styles.mineRow}>
            <AppText variant="caption" color={colors.led}>
              {t.open}
            </AppText>
            {onCancel ? <StickerButton label={t.cancel} size="sm" tone="ghost" loading={busy} onPress={onCancel} /> : null}
          </View>
        )
      ) : null}
    </View>
  );
}

/** Public sticker market: post a duplicate for a sticker you miss; anyone can swap at once. */
export default function MarketScreen() {
  const { data, isLoading, refetch, isRefetching } = useMarket();
  const { data: coll } = useCollection();
  const setMarket = useSetMarket();
  const qc = useQueryClient();
  const toast = useToast();
  const [tab, setTab] = useState<'all' | 'mine'>('all');
  const [composing, setComposing] = useState(false);
  const [give, setGive] = useState<string | null>(null);
  const [want, setWant] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | 'new' | null>(null);

  const byId = useMemo(() => new Map(coll?.items.map((i) => [i.id, i]) ?? []), [coll]);
  const dupes = useMemo(() => (coll?.items ?? []).filter((i) => i.count >= 2 && i.rarity !== 'iconic'), [coll]);
  const giveItem = give ? byId.get(give) : undefined;
  const missing = useMemo(
    () => (giveItem ? (coll?.items ?? []).filter((i) => i.count === 0 && i.rarity === giveItem.rarity) : []),
    [coll, giveItem],
  );

  useEffect(() => {
    if (tab === 'mine' && data?.news) void marketApi.seen().then(() => refetch());
  }, [tab, data?.news, refetch]);

  const afterSwap = () => {
    void qc.invalidateQueries({ queryKey: queryKeys.collection });
  };

  const take = (l: MarketListing) =>
    appAlert(t.takeTitle, fmt(t.takeBody, { want: l.want.name, give: l.give.name }), [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: t.take,
        onPress: async () => {
          setBusyId(l.id);
          try {
            const s = await marketApi.take(l.id);
            setMarket(s);
            afterSwap();
            playSound('coins');
            haptic('success');
            toast(fmt(t.took, { name: l.give.name }), 'success');
          } catch (e) {
            toast(e instanceof RpcError && e.message.includes('gone') ? t.gone : strings.errors.generic, 'error');
            void refetch();
          } finally {
            setBusyId(null);
          }
        },
      },
    ]);

  const cancel = async (l: MarketListing) => {
    setBusyId(l.id);
    try {
      setMarket(await marketApi.cancel(l.id));
    } catch {
      toast(strings.errors.generic, 'error');
    } finally {
      setBusyId(null);
    }
  };

  const publish = async () => {
    if (!give || !want) return;
    setBusyId('new');
    try {
      setMarket(await marketApi.create(give, want));
      toast(t.published, 'success');
      haptic('success');
      setComposing(false);
      setGive(null);
      setWant(null);
    } catch (e) {
      const m = e instanceof RpcError ? e.message : '';
      toast(
        m.includes('too many') ? fmt(t.tooMany, { n: data?.max_open ?? 5 }) : m.includes('already listed') ? t.already : strings.errors.generic,
        'error',
      );
    } finally {
      setBusyId(null);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <View style={styles.top}>
        <AppText variant="title" style={styles.flex}>
          {t.title}
        </AppText>
        <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <View style={styles.tabs}>
        <SegmentTabs
          value={tab}
          onChange={setTab}
          options={[
            { key: 'all', label: t.tabAll },
            { key: 'mine', label: data?.news ? `${t.tabMine} (${data.news})` : t.tabMine },
          ]}
        />
      </View>
      <ScrollView
        contentContainerStyle={styles.body}
        refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.led} />}
      >
        {isLoading || !data ? (
          <ActivityIndicator color={colors.led} />
        ) : tab === 'all' ? (
          <>
            <AppText color={colors.textMuted}>{t.intro}</AppText>
            {data.listings.length === 0 ? (
              <AppText color={colors.textDim} align="center" style={styles.empty}>
                {t.empty}
              </AppText>
            ) : (
              data.listings.map((l) => <ListingCard key={l.id} l={l} byId={byId} busy={busyId === l.id} onTake={() => take(l)} />)
            )}
          </>
        ) : (
          <>
            {data.news ? (
              <AppText variant="label" color={colors.correct}>
                {fmt(t.news, { n: data.news })}
              </AppText>
            ) : null}
            {composing ? (
              <View style={styles.composer}>
                <AppText variant="heading">{t.pickGive}</AppText>
                {dupes.length ? (
                  <Strip
                    items={dupes}
                    selected={give}
                    onPick={(id) => {
                      setGive(id);
                      setWant(null);
                    }}
                    badge={(c) => `×${c.count}`}
                  />
                ) : (
                  <View style={styles.emptyBox}>
                    <AppText color={colors.textMuted}>{t.noDupes}</AppText>
                    <StickerButton label={t.toPacks} icon="gift" size="sm" tone="outline" onPress={() => router.push('/(tabs)/packs')} />
                  </View>
                )}
                {give ? (
                  <>
                    <AppText variant="heading">{t.pickWant}</AppText>
                    <AppText variant="caption" color={colors.textDim}>
                      {t.sameRarity}
                    </AppText>
                    {missing.length ? (
                      <Strip items={missing} selected={want} onPick={setWant} />
                    ) : (
                      <AppText color={colors.textDim}>{t.noMissing}</AppText>
                    )}
                  </>
                ) : null}
                <StickerButton
                  label={t.publish}
                  icon="megaphone"
                  tone="prize"
                  fullWidth
                  disabled={!give || !want}
                  loading={busyId === 'new'}
                  onPress={() => void publish()}
                />
                <StickerButton label={strings.common.cancel} tone="ghost" fullWidth onPress={() => setComposing(false)} />
              </View>
            ) : (
              <StickerButton label={t.newOffer} icon="add-circle" tone="prize" size="lg" fullWidth onPress={() => setComposing(true)} />
            )}
            <AppText variant="caption" color={colors.textDim} align="center">
              {t.expires}
            </AppText>
            {data.mine.length === 0 ? (
              <AppText color={colors.textDim} align="center" style={styles.empty}>
                {t.mineEmpty}
              </AppText>
            ) : (
              data.mine.map((l) => <ListingCard key={l.id} l={l} byId={byId} busy={busyId === l.id} onCancel={() => void cancel(l)} />)
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
  tabs: { paddingHorizontal: space.lg, paddingTop: space.sm },
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  empty: { marginTop: space.xl },
  emptyBox: { gap: space.sm, alignItems: 'flex-start' },
  listing: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.board, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  listingHot: { borderColor: colors.led, borderWidth: 2 },
  owner: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  needTag: { backgroundColor: colors.led, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2 },
  swapRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  side: { alignItems: 'center', gap: 4 },
  mineRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  composer: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.board, borderWidth: 2, borderColor: colors.led },
  strip: { gap: space.sm, paddingVertical: space.xs },
  pick: { borderRadius: radius.sticker + 2, borderWidth: 3, borderColor: 'transparent', padding: 2 },
  pickOn: { borderColor: colors.correct },
  badge: { position: 'absolute', bottom: 34, end: 6, backgroundColor: colors.led, borderRadius: 8, paddingHorizontal: 6 },
  check: { position: 'absolute', top: 4, start: 4, backgroundColor: colors.bgDeep, borderRadius: 12 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});
