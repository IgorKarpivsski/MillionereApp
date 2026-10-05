import { Ionicons } from '@expo/vector-icons';
import type { Collectible } from '@fm/shared';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, StickerButton, useToast } from '@/design-system/components';
import { colors, radius, space } from '@/design-system/tokens';
import { useCollection } from '@/features/collection/hooks';
import { LegendCard } from '@/features/collection/LegendCard';
import { RpcError } from '@/features/profile/api';
import { socialApi } from '@/features/social/api';
import { useDupes, useSocialAction } from '@/features/social/hooks';
import { fmt, strings } from '@/lib/i18n';

const t = strings.social;

function Pick({
  items,
  selected,
  onSelect,
  badge,
}: {
  items: { item: Collectible; note?: string }[];
  selected: string | null;
  onSelect: (id: string | null) => void;
  badge?: (c: Collectible) => string | null;
}) {
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {items.map(({ item }) => {
        const on = selected === item.id;
        const b = badge?.(item);
        return (
          <Pressable
            key={item.id}
            onPress={() => onSelect(on ? null : item.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: on }}
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
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

export default function TradeScreen() {
  const { id, name } = useLocalSearchParams<{ id: string; name?: string }>();
  const peer = name ?? '';
  const { data: coll } = useCollection();
  const { data: theirs } = useDupes(id);
  const [give, setGive] = useState<string | null>(null);
  const [want, setWant] = useState<string | null>(null);
  const toast = useToast();
  const offer = useSocialAction(() => socialApi.offer(id, give!, want));

  const byId = useMemo(() => new Map(coll?.items.map((i) => [i.id, i]) ?? []), [coll]);
  const mine = useMemo(
    () => (coll?.items ?? []).filter((i) => i.count >= 2 && i.rarity !== 'iconic').map((item) => ({ item })),
    [coll],
  );
  const theirItems = useMemo(
    () =>
      (theirs ?? [])
        .map((d) => byId.get(d.id))
        .filter((x): x is Collectible => !!x)
        // missing ones first: those are the ones worth asking for
        .sort((a, b) => (a.count === 0 ? 0 : 1) - (b.count === 0 ? 0 : 1))
        .map((item) => ({ item })),
    [theirs, byId],
  );

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

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <AppText variant="title" numberOfLines={1} style={styles.flex}>
          {fmt(t.tradeTitle, { name: peer })}
        </AppText>
        <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <AppText variant="heading">{t.youGive}</AppText>
        {mine.length === 0 ? (
          <AppText color={colors.textDim}>{t.noDupes}</AppText>
        ) : (
          <Pick items={mine} selected={give} onSelect={setGive} badge={(c) => `×${c.count}`} />
        )}

        <View style={styles.swap}>
          <Ionicons name="swap-vertical" size={30} color={colors.led} />
        </View>

        <AppText variant="heading">{fmt(t.youWant, { name: peer })}</AppText>
        {theirItems.length === 0 ? (
          <AppText color={colors.textDim}>{t.theirNone}</AppText>
        ) : (
          <Pick items={theirItems} selected={want} onSelect={setWant} badge={(c) => (c.count === 0 ? t.missing : null)} />
        )}

        <AppText variant="caption" color={colors.textDim} align="center">
          {t.mythicNote}
        </AppText>
        <StickerButton
          label={want ? t.sendOffer : t.sendGift}
          icon={want ? 'swap-horizontal' : 'gift'}
          size="lg"
          fullWidth
          disabled={!give}
          loading={offer.isPending}
          onPress={submit}
        />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md },
  strip: { gap: space.sm, paddingVertical: space.xs },
  pick: { borderRadius: radius.sticker + 2, borderWidth: 3, borderColor: 'transparent', padding: 2 },
  pickOn: { borderColor: colors.led },
  badge: { position: 'absolute', bottom: 34, end: 6, backgroundColor: colors.led, borderRadius: 8, paddingHorizontal: 6 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  swap: { alignItems: 'center' },
});
