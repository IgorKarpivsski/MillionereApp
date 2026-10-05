import { Ionicons } from '@expo/vector-icons';
import type { Friend, Trade } from '@fm/shared';
import { router } from 'expo-router';
import { useState } from 'react';
import { Alert, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, AvatarBadge, Card, EmptyState, Led, StickerButton, useToast } from '@/design-system/components';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { useCollection } from '@/features/collection/hooks';
import { LegendCard } from '@/features/collection/LegendCard';
import { RpcError } from '@/features/profile/api';
import { socialApi } from '@/features/social/api';
import { useFriends, useSocialAction } from '@/features/social/hooks';
import { fmt, strings } from '@/lib/i18n';

const t = strings.social;

function TradeRow({ trade }: { trade: Trade }) {
  const { data: coll } = useCollection();
  const respond = useSocialAction((v: { accept: boolean }) => socialApi.respondTrade(trade.id, v.accept));
  const toast = useToast();
  const give = coll?.items.find((i) => i.id === trade.give);
  const want = trade.want ? coll?.items.find((i) => i.id === trade.want) : null;
  // From MY point of view: incoming → I receive `give` and hand over `want`.
  const [left, right] = trade.incoming ? [give, want] : [want, give];
  return (
    <Card kind="soft" padding={space.md} style={styles.gap}>
      <AppText variant="label">{trade.incoming ? fmt(t.tradeIn, { name: trade.peer_name }) : fmt(t.tradeOut, { name: trade.peer_name })}</AppText>
      <View style={styles.tradeCards}>
        <View style={styles.center}>
          <AppText variant="caption" color={colors.correct}>
            {trade.incoming ? t.gives : t.wants}
          </AppText>
          {left ? <LegendCard item={left} width={84} /> : <AppText color={colors.textDim}>{t.gift}</AppText>}
        </View>
        <Ionicons name="swap-horizontal" size={28} color={colors.led} />
        <View style={styles.center}>
          <AppText variant="caption" color={colors.danger}>
            {trade.incoming ? t.wants : t.gives}
          </AppText>
          {right ? <LegendCard item={right} width={84} /> : <AppText color={colors.correct}>{t.gift}</AppText>}
        </View>
      </View>
      <View style={styles.row}>
        {trade.incoming ? (
          <>
            <StickerButton
              label={t.acceptTrade}
              size="sm"
              style={styles.flex}
              loading={!!(respond.isPending && respond.variables?.accept)}
              onPress={() =>
                respond.mutate(
                  { accept: true },
                  {
                    onSuccess: () => toast(t.traded, 'success'),
                    onError: () => toast(t.tradeGone, 'error'),
                  },
                )
              }
            />
            <StickerButton label={t.decline} tone="ghost" size="sm" onPress={() => respond.mutate({ accept: false })} />
          </>
        ) : (
          <StickerButton label={t.cancelTrade} tone="ghost" size="sm" onPress={() => respond.mutate({ accept: false })} />
        )}
      </View>
    </Card>
  );
}

function FriendRow({ f }: { f: Friend }) {
  const respond = useSocialAction((accept: boolean) => socialApi.respond(f.id, accept));
  const remove = useSocialAction(() => socialApi.remove(f.id));
  const block = useSocialAction(() => socialApi.block(f.id));

  const menu = () =>
    Alert.alert(f.username, undefined, [
      {
        text: t.remove,
        onPress: () =>
          Alert.alert(fmt(t.removeTitle, { name: f.username }), undefined, [
            { text: strings.common.cancel, style: 'cancel' },
            { text: t.remove, style: 'destructive', onPress: () => remove.mutate(undefined) },
          ]),
      },
      {
        text: t.block,
        style: 'destructive',
        onPress: () =>
          Alert.alert(fmt(t.blockTitle, { name: f.username }), t.blockBody, [
            { text: strings.common.cancel, style: 'cancel' },
            { text: t.block, style: 'destructive', onPress: () => block.mutate(undefined) },
          ]),
      },
      { text: strings.common.cancel, style: 'cancel' },
    ]);

  return (
    <View style={styles.friend}>
      <AvatarBadge avatarId={f.avatar_id} level={f.level} size={44} />
      <View style={styles.flex}>
        <AppText variant="label" numberOfLines={1}>
          {f.username}
        </AppText>
        <AppText variant="caption" color={f.unread > 0 ? colors.led : colors.textDim}>
          {f.status === 'pending' && !f.incoming ? t.waiting : f.unread > 0 ? fmt(t.unread, { n: f.unread }) : fmt(t.level, { n: f.level })}
        </AppText>
      </View>
      {f.status === 'pending' ? (
        f.incoming ? (
          <>
            <StickerButton label={t.accept} size="sm" loading={respond.isPending} onPress={() => respond.mutate(true)} />
            <StickerButton label={t.decline} tone="ghost" size="sm" onPress={() => respond.mutate(false)} />
          </>
        ) : null
      ) : (
        <>
          <Pressable
            onPress={() => router.push({ pathname: '/chat/[id]', params: { id: f.id, name: f.username } })}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={`${t.chat} ${f.username}`}
          >
            <Ionicons name="chatbubble-ellipses" size={22} color={colors.text} />
            {f.unread > 0 ? <View style={styles.dot} /> : null}
          </Pressable>
          <Pressable
            onPress={() => router.push({ pathname: '/trade/[id]', params: { id: f.id, name: f.username } })}
            style={styles.iconBtn}
            accessibilityRole="button"
            accessibilityLabel={`${t.trade} ${f.username}`}
          >
            <Ionicons name="swap-horizontal" size={22} color={colors.led} />
          </Pressable>
        </>
      )}
      <Pressable onPress={menu} style={styles.iconBtn} accessibilityRole="button" accessibilityLabel={`${t.more} ${f.username}`}>
        <Ionicons name="ellipsis-vertical" size={20} color={colors.textDim} />
      </Pressable>
    </View>
  );
}

export default function FriendsScreen() {
  const { data } = useFriends(true);
  const [code, setCode] = useState('');
  const toast = useToast();
  const add = useSocialAction(socialApi.request);
  const unblock = useSocialAction(socialApi.unblock);

  const submit = () =>
    add.mutate(code, {
      onSuccess: (r) => {
        setCode('');
        toast(r.status === 'accepted' ? t.nowFriends : t.sent, 'success');
      },
      onError: (e) => {
        const m = e instanceof RpcError ? e.message : '';
        toast(m.includes('self') ? t.selfCode : m.includes('blocked') ? t.blockedCode : m.includes('code') ? t.badCode : strings.errors.generic, 'error');
      },
    });

  const requests = data?.friends.filter((f) => f.incoming) ?? [];
  const list = data?.friends.filter((f) => !f.incoming) ?? [];

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <AppText variant="title">{t.title}</AppText>
        <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
        <Card kind="sticker" padding={space.lg} style={styles.gap}>
          <AppText variant="label">{t.myCode}</AppText>
          <View style={styles.codeRow} accessible accessibilityLabel={`${t.myCode}: ${data?.code.split('').join(' ') ?? ''}`}>
            <Led size="ledXL" color={colors.led}>
              {data?.code ?? '······'}
            </Led>
          </View>
          <StickerButton
            label={t.share}
            icon="share-social"
            fullWidth
            disabled={!data}
            onPress={() => data && void Share.share({ message: fmt(t.shareText, { code: data.code }) })}
          />
        </Card>

        <Card kind="panel" padding={space.md} style={styles.gap}>
          <AppText variant="label">{t.addTitle}</AppText>
          <View style={styles.row}>
            <TextInput
              value={code}
              onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
              autoCapitalize="characters"
              autoCorrect={false}
              placeholder={t.addPlaceholder}
              placeholderTextColor={colors.textDim}
              style={styles.input}
              maxLength={6}
              accessibilityLabel={t.addTitle}
              onSubmitEditing={submit}
            />
            <StickerButton label={t.add} disabled={code.length !== 6} loading={add.isPending} onPress={submit} />
          </View>
        </Card>

        {requests.length > 0 ? (
          <>
            <AppText variant="heading">{t.requests}</AppText>
            {requests.map((f) => (
              <FriendRow key={f.id} f={f} />
            ))}
          </>
        ) : null}

        {data && data.trades.length > 0 ? (
          <>
            <AppText variant="heading">{t.trades}</AppText>
            {data.trades.map((tr) => (
              <TradeRow key={tr.id} trade={tr} />
            ))}
          </>
        ) : null}

        <AppText variant="heading">{t.friends}</AppText>
        {list.length === 0 ? (
          <EmptyState icon="people-outline" title={t.none} body={t.addTitle} />
        ) : (
          list.map((f) => <FriendRow key={f.id} f={f} />)
        )}

        <View style={styles.safety}>
          <Ionicons name="shield-checkmark" size={20} color={colors.correct} />
          <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
            {t.safety}
          </AppText>
        </View>

        {data && data.blocked.length > 0 ? (
          <>
            <AppText variant="label" color={colors.textDim}>
              {t.blocked}
            </AppText>
            {data.blocked.map((b) => (
              <View key={b.id} style={styles.friend}>
                <AppText style={styles.flex}>{b.username}</AppText>
                <StickerButton label={t.unblock} tone="ghost" size="sm" onPress={() => unblock.mutate(b.id)} />
              </View>
            ))}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  gap: { gap: space.sm },
  row: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
  center: { alignItems: 'center', gap: space.xs },
  codeRow: { alignItems: 'center', paddingVertical: space.sm },
  input: {
    flex: 1,
    height: 48,
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.board,
    color: colors.text,
    paddingHorizontal: space.md,
    fontSize: 20,
    letterSpacing: 4,
    textAlign: 'center',
    fontFamily: 'IBMPlexSansHebrew_700Bold',
  },
  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 1,
    borderColor: colors.border,
  },
  iconBtn: { width: 44, height: 44, alignItems: 'center', justifyContent: 'center' },
  dot: { position: 'absolute', top: 8, end: 8, width: 10, height: 10, borderRadius: 5, backgroundColor: colors.danger },
  tradeCards: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-around' },
  safety: { flexDirection: 'row', gap: space.sm, padding: space.md, borderRadius: radius.board, backgroundColor: palette.night800 },
});
