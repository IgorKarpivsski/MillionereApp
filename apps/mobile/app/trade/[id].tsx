import { Ionicons } from '@expo/vector-icons';
import type { Collectible } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, StickerButton, useToast, Backdrop } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, radius, space } from '@/design-system/tokens';
import { useCollection } from '@/features/collection/hooks';
import { LegendCard } from '@/features/collection/LegendCard';
import { SegmentTabs } from '@/features/league/LeagueView';
import { RpcError } from '@/features/profile/api';
import { socialApi } from '@/features/social/api';
import { useDupes, useFriends, useSocialAction } from '@/features/social/hooks';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';

const t = strings.social;
const MAX = 5;
const GIFTABLE = new Set(['common', 'uncommon', 'rare']);

function Pick({
  items,
  selected,
  onToggle,
  badge,
}: {
  items: Collectible[];
  selected: string[];
  onToggle: (id: string) => void;
  badge?: (c: Collectible) => string | null;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {items.map((item) => {
        const on = selected.includes(item.id);
        const b = badge?.(item);
        return (
          <Pressable
            key={item.id}
            onPress={() => onToggle(item.id)}
            accessibilityRole="checkbox"
            accessibilityState={{ checked: on }}
            accessibilityLabel={`${item.name}${b ? `, ${b}` : ''}`}
            style={[styles.pick, on && styles.pickOn]}
          >
            <LegendCard item={item} width={96} />
            {b ? (
              <View style={styles.badge}>
                <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
                  {b}
                </AppText>
              </View>
            ) : null}
            {on ? (
              <View style={styles.check}>
                <Ionicons name="checkmark-circle" size={26} color={colors.correct} />
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Trade several duplicates at once with a friend, or send one as a free gift. */
export default function TradeScreen() {
  const { id, name, mode: start } = useLocalSearchParams<{ id: string; name?: string; mode?: string }>();
  const peer = name ?? '';
  const { data: coll } = useCollection();
  const { data: theirs } = useDupes(id);
  const { data: friends } = useFriends();
  const [mode, setMode] = useState<'trade' | 'gift'>(start === 'gift' ? 'gift' : 'trade');
  const [give, setGive] = useState<string[]>([]);
  const [want, setWant] = useState<string[]>([]);
  const [gift, setGift] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();
  const offer = useSocialAction(() => socialApi.offerMulti(id, give, want));
  const giftsLeft = friends?.gifts_left ?? 3;

  const byId = useMemo(() => new Map(coll?.items.map((i) => [i.id, i]) ?? []), [coll]);
  const mine = useMemo(() => (coll?.items ?? []).filter((i) => i.count >= 2 && i.rarity !== 'iconic'), [coll]);
  const giftable = useMemo(() => mine.filter((i) => GIFTABLE.has(i.rarity)), [mine]);
  const theirItems = useMemo(
    () =>
      (theirs ?? [])
        .map((d) => byId.get(d.id))
        .filter((x): x is Collectible => !!x)
        // missing ones first: those are the ones worth asking for
        .sort((a, b) => (a.count === 0 ? 0 : 1) - (b.count === 0 ? 0 : 1)),
    [theirs, byId],
  );

  const toggle = (list: string[], set: (v: string[]) => void) => (itemId: string) => {
    if (list.includes(itemId)) set(list.filter((x) => x !== itemId));
    else if (list.length >= MAX) toast(fmt(t.upTo, { n: MAX }), 'info');
    else {
      haptic('select');
      set([...list, itemId]);
    }
  };

  const submit = () =>
    offer.mutate(undefined, {
      onSuccess: () => {
        toast(t.offerSent, 'success');
        router.back();
      },
      onError: (e) =>
        toast(
          e instanceof RpcError && e.message.includes('too many') ? t.tooMany : e instanceof RpcError && e.code === 'rate_limited' ? strings.errors.rateLimited : strings.errors.generic,
          'error',
        ),
    });

  const sendGift = async () => {
    if (!gift) return;
    setSending(true);
    try {
      await socialApi.gift(id, gift);
      haptic('success');
      toast(fmt(t.giftSent, { name: peer }), 'success');
      for (const k of [queryKeys.friends, queryKeys.collection]) void qc.invalidateQueries({ queryKey: k });
      router.back();
    } catch (e) {
      toast(e instanceof RpcError && e.code === 'rate_limited' ? t.giftLimit : strings.errors.generic, 'error');
    } finally {
      setSending(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <View style={styles.top}>
        <AppText variant="title" numberOfLines={1} style={styles.flex}>
          {fmt(t.tradeTitle, { name: peer })}
        </AppText>
        <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <View style={styles.tabs}>
        <SegmentTabs
          value={mode}
          onChange={setMode}
          options={[
            { key: 'trade', label: t.tabTrade },
            { key: 'gift', label: t.tabGift },
          ]}
        />
      </View>
      {mode === 'trade' ? (
        <ScrollView contentContainerStyle={styles.body}>
          <AppText variant="heading">{`${t.youGive} (${give.length}/${MAX})`}</AppText>
          {mine.length === 0 ? (
            <AppText color={colors.textDim}>{t.noDupes}</AppText>
          ) : (
            <Pick items={mine} selected={give} onToggle={toggle(give, setGive)} badge={(c) => `×${c.count}`} />
          )}

          <View style={styles.swap}>
            <Ionicons name="swap-vertical" size={30} color={colors.led} />
          </View>

          <AppText variant="heading">{`${fmt(t.youWant, { name: peer })} (${want.length}/${MAX})`}</AppText>
          {theirItems.length === 0 ? (
            <AppText color={colors.textDim}>{t.theirNone}</AppText>
          ) : (
            <Pick items={theirItems} selected={want} onToggle={toggle(want, setWant)} badge={(c) => (c.count === 0 ? t.missing : null)} />
          )}

          <AppText variant="caption" color={colors.textDim} align="center">
            {t.mythicNote}
          </AppText>
          <StickerButton
            label={give.length && want.length ? fmt(t.sendOfferN, { g: give.length, w: want.length }) : t.sendOffer}
            icon="swap-horizontal"
            size="lg"
            fullWidth
            disabled={!give.length || !want.length}
            loading={offer.isPending}
            onPress={submit}
          />
        </ScrollView>
      ) : (
        <ScrollView contentContainerStyle={styles.body}>
          <AppText color={colors.textMuted}>{t.giftBody}</AppText>
          <View style={styles.giftLeft}>
            <Ionicons name="gift" size={20} color={colors.led} />
            <AppText variant="label" color={giftsLeft > 0 ? colors.led : colors.danger}>
              {giftsLeft > 0 ? fmt(t.giftLeft, { n: giftsLeft }) : t.giftLimit}
            </AppText>
          </View>
          {giftable.length === 0 ? (
            <AppText color={colors.textDim}>{t.giftNone}</AppText>
          ) : (
            <Pick
              items={giftable}
              selected={gift ? [gift] : []}
              onToggle={(itemId) => setGift(gift === itemId ? null : itemId)}
              badge={(c) => `×${c.count}`}
            />
          )}
          <StickerButton
            label={t.giftSend}
            icon="gift"
            tone="prize"
            size="lg"
            fullWidth
            disabled={!gift || giftsLeft < 1}
            loading={sending}
            onPress={() => void sendGift()}
          />
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
  tabs: { paddingHorizontal: space.lg, paddingTop: space.sm },
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md },
  strip: { gap: space.sm, paddingVertical: space.xs },
  pick: { borderRadius: radius.sticker + 2, borderWidth: 3, borderColor: 'transparent', padding: 2 },
  pickOn: { borderColor: colors.correct },
  badge: { position: 'absolute', bottom: 34, end: 6, backgroundColor: colors.led, borderRadius: 8, paddingHorizontal: 6 },
  check: { position: 'absolute', top: 4, start: 4, backgroundColor: colors.bgDeep, borderRadius: 13 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  swap: { alignItems: 'center' },
  giftLeft: { flexDirection: 'row', alignItems: 'center', gap: space.xs },
});
