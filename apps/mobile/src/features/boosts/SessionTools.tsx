import { Ionicons } from '@expo/vector-icons';
import type { BoostKind, CallCandidate, SessionPayload } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useRef, useState, type ComponentProps } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { AppText, AvatarBadge, BottomSheet, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, radius, space } from '@/design-system/tokens';
import { requestId } from '@/features/collection/api';
import { useMyState } from '@/features/profile/hooks';
import { showRewardedAd } from '@/features/store/ads';
import { useStore } from '@/features/store/hooks';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';
import { boostsApi, useBoosts } from './api';
import { BoostIcon, boostDesc, boostName } from './meta';

const IN_GAME: BoostKind[] = ['time', 'freeze', 'skip', 'shield', 'double'];

export interface FriendPick {
  name: string;
  slot: number | null;
  /** Waiting for the friend; seconds left on the call. */
  waiting: number | null;
}

/**
 * The tool tray under a question: lifelines (50:50, hint, phone a friend) and boosts.
 * Everything is charged and checked by the server; this only asks and shows.
 */
export function SessionTools({
  payload,
  answering,
  busyTool,
  busy5050,
  used5050,
  onFifty,
  onBoost,
  onHint,
  onCall,
  onFriendPick,
}: {
  payload: SessionPayload;
  answering: boolean;
  busyTool: string | null;
  busy5050: boolean;
  used5050: number;
  onFifty: () => void;
  onBoost: (b: BoostKind) => Promise<boolean>;
  onHint: (pay: 'coins' | 'ad') => void;
  onCall: (friendId: string) => Promise<string | null>;
  onFriendPick: (p: FriendPick | null) => void;
}) {
  const toast = useToast();
  const qc = useQueryClient();
  const { data: boostState } = useBoosts();
  const { data: me } = useMyState();
  const { data: store } = useStore();
  const [hintOpen, setHintOpen] = useState(false);
  const [buyFor, setBuyFor] = useState<BoostKind | null>(null);
  const [buying, setBuying] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  // boosts stay tucked behind "+" so the question screen isn't crowded
  const [boostsOpen, setBoostsOpen] = useState(false);
  const [friends, setFriends] = useState<CallCandidate[] | null>(null);
  const callTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  const q = payload.question;
  // The server's run payload wins once it has a count; the store state fills in the rest (e.g. welcome boosts).
  const counts: Record<string, number> = { ...(boostState?.counts ?? {}), ...(payload.boosts ?? {}) };
  const qBoosts = payload.question_boosts ?? [];
  const runBoosts = payload.run_boosts ?? [];
  const hintCoins = boostState?.hint_coins ?? 20;
  const hintUsed = qBoosts.includes('hint') || (q?.removed.length ?? 0) >= 2;
  const callUsed = runBoosts.includes('call');
  const skips = runBoosts.filter((b) => b === 'skip').length;

  useEffect(
    () => () => {
      if (callTimer.current) clearInterval(callTimer.current);
    },
    [],
  );
  // A new question ends any call display.
  useEffect(() => {
    onFriendPick(null);
    if (callTimer.current) clearInterval(callTimer.current);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q?.id]);

  const usedFor = (b: BoostKind): boolean => {
    if (b === 'shield' || b === 'double') return runBoosts.includes(b);
    if (b === 'skip') return skips >= 2 || qBoosts.includes('skip');
    return qBoosts.includes(b) || payload.frozen;
  };

  const tapBoost = async (b: BoostKind) => {
    if (busyTool) return;
    if (usedFor(b)) {
      toast(strings.boosts.used, 'info');
      return;
    }
    if ((counts[b] ?? 0) < 1) {
      setBuyFor(b);
      return;
    }
    const ok = await onBoost(b);
    if (ok && b === 'shield') toast(strings.boosts.shieldOn, 'success');
    if (ok && b === 'double') toast(strings.boosts.doubleOn, 'success');
  };

  const buyAndUse = async () => {
    if (!buyFor) return;
    const b = buyFor;
    setBuying(true);
    try {
      await boostsApi.buy(b, requestId());
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
      void qc.invalidateQueries({ queryKey: queryKeys.boosts });
      setBuyFor(null);
      await onBoost(b);
    } catch (e) {
      toast((e as Error).message.includes('insufficient') ? strings.boosts.noCoins : strings.errors.generic, 'error');
    } finally {
      setBuying(false);
    }
  };

  const openCall = async () => {
    if (callUsed) {
      toast(strings.call.used, 'info');
      return;
    }
    setFriends(null);
    setCallOpen(true);
    try {
      setFriends(await boostsApi.candidates());
    } catch {
      setFriends([]);
    }
  };

  const call = async (f: CallCandidate) => {
    setCallOpen(false);
    const callId = await onCall(f.id);
    if (!callId) {
      toast(strings.call.noneOnline, 'info');
      return;
    }
    haptic('heavy');
    onFriendPick({ name: f.username, slot: null, waiting: 45 });
    if (callTimer.current) clearInterval(callTimer.current);
    callTimer.current = setInterval(async () => {
      try {
        const st = await boostsApi.callState(callId);
        if (st.answer_slot != null) {
          if (callTimer.current) clearInterval(callTimer.current);
          haptic('success');
          onFriendPick({ name: f.username, slot: st.answer_slot, waiting: null });
        } else if (st.expired) {
          if (callTimer.current) clearInterval(callTimer.current);
          onFriendPick(null);
          toast(fmt(strings.call.noAnswer, { name: f.username }), 'info');
        } else {
          onFriendPick({ name: f.username, slot: null, waiting: st.seconds_left });
        }
      } catch {
        // keep trying until it expires
      }
    }, 2000);
  };

  const disabled = !answering || !!busyTool;
  const price = buyFor ? (boostState?.prices[buyFor] ?? 0) : 0;

  return (
    <>
      <View style={styles.lifelines}>
        <Tool
          label={strings.session.fifty}
          tag={used5050 ? fmt(strings.session.fiftyCost, { n: 30 }) : strings.session.fiftyFree}
          tagPaid={!!used5050}
          icon="contrast"
          busy={busy5050}
          off={disabled || (q?.removed.length ?? 0) > 0}
          onPress={onFifty}
        />
        <Tool
          label={strings.hint.label}
          tag={store?.ad_free ? strings.session.fiftyFree : '▶ / ' + hintCoins}
          icon="bulb"
          busy={busyTool === 'hint'}
          off={disabled || hintUsed}
          onPress={() => setHintOpen(true)}
        />
        <Tool
          label={strings.call.label}
          icon="call"
          busy={busyTool === 'call'}
          off={disabled || callUsed}
          onPress={() => void openCall()}
        />
        <Pressable
          onPress={() => setBoostsOpen((o) => !o)}
          accessibilityRole="button"
          accessibilityState={{ expanded: boostsOpen }}
          accessibilityLabel={strings.boosts.more}
          style={({ pressed }) => [styles.more, boostsOpen && styles.moreOn, pressed && styles.pressed]}
        >
          <Ionicons name={boostsOpen ? 'close' : 'add'} size={22} color={boostsOpen ? colors.textOnBright : colors.led} />
          {!boostsOpen && IN_GAME.some((b) => (counts[b] ?? 0) > 0) ? <View style={styles.moreDot} /> : null}
        </Pressable>
      </View>
      {boostsOpen ? (
      <View style={styles.boosts}>
        {IN_GAME.map((b) => (
          <Pressable
            key={b}
            onPress={() => void tapBoost(b)}
            disabled={disabled && b !== 'shield' && b !== 'double'}
            accessibilityRole="button"
            accessibilityLabel={`${boostName(b)}: ${boostDesc(b)}`}
            style={({ pressed }) => [styles.boost, pressed && styles.pressed]}
          >
            {busyTool === b ? (
              <View style={styles.boostBusy}>
                <ActivityIndicator color={colors.led} />
              </View>
            ) : (
              <BoostIcon boost={b} size={42} count={counts[b] ?? 0} dim={usedFor(b) || (disabled && b !== 'shield' && b !== 'double')} />
            )}
            <AppText variant="caption" color={colors.textMuted} numberOfLines={1} style={styles.boostLabel}>
              {boostName(b)}
            </AppText>
          </Pressable>
        ))}
      </View>
      ) : null}

      <BottomSheet visible={hintOpen} onClose={() => setHintOpen(false)} title={strings.hint.title}>
        <StickerButton
          label={store?.ad_free ? strings.hint.adFree : strings.hint.ad}
          icon={store?.ad_free ? 'gift' : 'play-circle'}
          tone="prize"
          fullWidth
          onPress={async () => {
            setHintOpen(false);
            if (!store?.ad_free && !(await showRewardedAd())) {
              toast(strings.store.adNotFinished, 'info');
              return;
            }
            onHint('ad');
          }}
        />
        <StickerButton
          label={fmt(strings.hint.coins, { n: hintCoins })}
          icon="cash"
          tone="ghost"
          fullWidth
          disabled={(me?.wallet.coins ?? 0) < hintCoins}
          disabledReason={strings.common.needCoins}
          onPress={() => {
            setHintOpen(false);
            onHint('coins');
          }}
        />
      </BottomSheet>

      <BottomSheet visible={!!buyFor} onClose={() => setBuyFor(null)} title={buyFor ? fmt(strings.boosts.buyTitle, { name: boostName(buyFor) }) : ''}>
        {buyFor ? (
          <View style={styles.buyRow}>
            <BoostIcon boost={buyFor} size={64} />
            <AppText style={styles.flex}>{fmt(strings.boosts.buyBody, { desc: boostDesc(buyFor), n: price })}</AppText>
          </View>
        ) : null}
        <StickerButton
          label={fmt(strings.boosts.buyFor, { n: price })}
          icon="cart"
          fullWidth
          loading={buying}
          disabled={(me?.wallet.coins ?? 0) < price}
          disabledReason={strings.common.needCoins}
          onPress={() => void buyAndUse()}
        />
        {(me?.wallet.coins ?? 0) < price ? (
          <AppText variant="caption" color={colors.danger} align="center">
            {strings.boosts.noCoins}
          </AppText>
        ) : null}
      </BottomSheet>

      <BottomSheet visible={callOpen} onClose={() => setCallOpen(false)} title={strings.call.title}>
        <AppText color={colors.textMuted}>{fmt(strings.call.body, { n: 45 })}</AppText>
        {friends === null ? <ActivityIndicator color={colors.led} /> : null}
        {friends && friends.length === 0 ? (
          <>
            <AppText align="center">{strings.call.none}</AppText>
            <StickerButton
              label={strings.call.toFriends}
              tone="ghost"
              fullWidth
              onPress={() => {
                setCallOpen(false);
                router.push('/friends');
              }}
            />
          </>
        ) : null}
        <ScrollView style={styles.friendList} contentContainerStyle={styles.friendListBody}>
          {(friends ?? []).map((f) => (
            <Pressable
              key={f.id}
              disabled={!f.online}
              onPress={() => void call(f)}
              accessibilityRole="button"
              accessibilityLabel={`${f.username}, ${f.online ? strings.call.online : strings.call.offline}`}
              style={({ pressed }) => [styles.friend, !f.online && styles.friendOff, pressed && styles.pressed]}
            >
              <AvatarBadge avatarId={f.avatar_id ?? 'avatar_01'} photo={f.photo} size={40} />
              <AppText variant="label" style={styles.flex} numberOfLines={1}>
                {f.username}
              </AppText>
              <View style={[styles.dot, { backgroundColor: f.online ? colors.correct : colors.textDim }]} />
              <AppText variant="caption" color={f.online ? colors.correct : colors.textDim}>
                {f.online ? strings.call.online : strings.call.offline}
              </AppText>
              {f.online ? <Ionicons name="call" size={20} color={colors.correct} /> : null}
            </Pressable>
          ))}
        </ScrollView>
      </BottomSheet>
    </>
  );
}

function Tool({
  label,
  tag,
  tagPaid,
  icon,
  busy,
  off,
  onPress,
}: {
  label: string;
  tag?: string;
  tagPaid?: boolean;
  icon: ComponentProps<typeof Ionicons>['name'];
  busy: boolean;
  off: boolean;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      disabled={off || busy}
      accessibilityRole="button"
      accessibilityLabel={tag ? `${label} ${tag}` : label}
      style={({ pressed }) => [styles.tool, off && styles.toolOff, pressed && styles.pressed]}
    >
      {busy ? <ActivityIndicator color={colors.led} /> : <Ionicons name={icon} size={18} color={colors.led} />}
      <AppText variant="label" numberOfLines={1}>
        {label}
      </AppText>
      {tag ? (
        <View style={[styles.tag, tagPaid ? styles.tagPaid : null]}>
          <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
            {tag}
          </AppText>
        </View>
      ) : null}
    </Pressable>
  );
}

/** Small "used / armed" chips for the top bar of a question. */
export function ArmedChips({ shield, doubled }: { shield: boolean; doubled: boolean }) {
  if (!shield && !doubled) return null;
  return (
    <View style={styles.armed}>
      {shield ? <BoostIcon boost="shield" size={22} /> : null}
      {doubled ? <BoostIcon boost="double" size={22} /> : null}
    </View>
  );
}


const styles = StyleSheet.create({
  lifelines: { flexDirection: 'row', gap: space.xs },
  tool: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    minHeight: 44,
    paddingHorizontal: space.xs,
    borderRadius: radius.control,
    backgroundColor: 'rgba(44,28,108,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,140,0.3)',
  },
  toolOff: { opacity: 0.4 },
  more: {
    width: 44,
    minHeight: 44,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: radius.control,
    backgroundColor: 'rgba(44,28,108,0.9)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,140,0.3)',
  },
  moreOn: { backgroundColor: colors.led },
  moreDot: { position: 'absolute', top: 6, right: 6, width: 8, height: 8, borderRadius: 4, backgroundColor: colors.correct },
  tag: { paddingHorizontal: 5, borderRadius: radius.chip, backgroundColor: colors.correct },
  tagPaid: { backgroundColor: colors.led },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  boosts: { flexDirection: 'row', justifyContent: 'space-between', marginTop: space.sm, paddingHorizontal: space.xs },
  boost: { alignItems: 'center', width: 62, gap: 2 },
  boostBusy: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  boostLabel: { fontSize: 12, lineHeight: 15 },
  pressed: { transform: [{ scale: 0.94 }] },
  buyRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  friendList: { maxHeight: 320 },
  friendListBody: { gap: space.sm },
  friend: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: radius.control,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,140,0.2)',
  },
  friendOff: { opacity: 0.5 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  armed: { flexDirection: 'row', gap: 4 },
});
