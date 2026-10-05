import type { PassState, Reward } from '@fm/shared';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { useMemo } from 'react';
import { Alert, FlatList, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, ProgressBar, StickerButton, useToast } from '@/design-system/components';
import { playSound } from '@/design-system/feedback/sound';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { useBuyPremium, useClaimTier, usePass } from '@/features/engage/hooks';
import { RewardIcon, rewardLabel } from '@/features/engage/rewards';
import { RpcError } from '@/features/profile/api';
import { fmt, strings } from '@/lib/i18n';

const t = strings.engage;
type Active = Extract<PassState, { active: true }>;

function Slot({
  reward,
  state,
  premium,
  onClaim,
  busy,
}: {
  reward: Reward;
  state: 'locked' | 'ready' | 'claimed' | 'needs_premium';
  premium?: boolean;
  onClaim: () => void;
  busy: boolean;
}) {
  const label = rewardLabel(reward);
  const status = state === 'claimed' ? t.claimed : state === 'ready' ? t.claim : t.locked;
  return (
    <Pressable
      onPress={onClaim}
      disabled={state !== 'ready' || busy}
      accessibilityRole="button"
      accessibilityLabel={`${premium ? t.premium : t.free}: ${label}, ${status}`}
      accessibilityState={{ disabled: state !== 'ready' }}
      style={({ pressed }) => [
        styles.slot,
        premium ? styles.slotPremium : null,
        state === 'ready' ? styles.slotReady : null,
        state === 'claimed' || state === 'locked' || state === 'needs_premium' ? styles.slotDim : null,
        pressed ? styles.pressed : null,
      ]}
    >
      <RewardIcon r={reward} size={34} />
      <AppText variant="caption" align="center" numberOfLines={2} style={styles.slotText}>
        {label}
      </AppText>
      {state === 'claimed' ? (
        <Ionicons name="checkmark-circle" size={18} color={colors.correct} style={styles.badge} />
      ) : state === 'ready' ? (
        <View style={styles.claimPill}>
          <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
            {t.claim}
          </AppText>
        </View>
      ) : (
        <Ionicons name="lock-closed" size={14} color={colors.textDim} style={styles.badge} />
      )}
    </Pressable>
  );
}

export default function PassScreen() {
  const { data } = usePass();
  const claim = useClaimTier();
  const buy = useBuyPremium();
  const toast = useToast();

  const onClaim = (tier: number, track: 'free' | 'premium', r: Reward) =>
    claim.mutate(
      { tier, track },
      {
        onSuccess: () => {
          playSound('coins');
          toast(fmt(t.got, { label: rewardLabel(r) }), 'success');
        },
        onError: () => toast(strings.errors.generic, 'error'),
      },
    );

  const ready = useMemo(() => {
    if (!data?.active) return 0;
    let n = 0;
    for (const tr of data.tiers) {
      if (tr.tier > data.tier) break;
      if (!data.claimed_free.includes(tr.tier)) n++;
      if (data.premium && !data.claimed_premium.includes(tr.tier)) n++;
    }
    return n;
  }, [data]);

  if (!data) return <SafeAreaView style={styles.root} />;
  if (!data.active) {
    return (
      <SafeAreaView style={styles.root}>
        <Header />
        <AppText align="center" color={colors.textMuted} style={styles.pad}>
          {t.noSeason}
        </AppText>
      </SafeAreaView>
    );
  }
  const s: Active = data;
  const into = s.xp - s.tier * s.xp_per_tier;
  const maxed = s.tier >= s.tiers.length;

  const buyPremium = () =>
    Alert.alert(t.buyPremiumTitle, fmt(t.buyPremiumBody, { n: s.premium_gems }), [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: fmt(t.buyPremium, { n: s.premium_gems }),
        onPress: () =>
          buy.mutate(undefined, {
            onSuccess: () => {
              playSound('level_up');
              toast(t.premiumOn, 'success');
            },
            onError: (e) => toast(e instanceof RpcError && e.code === 'insufficient_funds' ? t.notEnoughGems : strings.errors.generic, 'error'),
          }),
      },
    ]);

  const claimAll = async () => {
    for (const tr of s.tiers) {
      if (tr.tier > s.tier) break;
      if (!s.claimed_free.includes(tr.tier)) await claim.mutateAsync({ tier: tr.tier, track: 'free' }).catch(() => {});
      if (s.premium && !s.claimed_premium.includes(tr.tier)) await claim.mutateAsync({ tier: tr.tier, track: 'premium' }).catch(() => {});
    }
    playSound('coins');
  };

  return (
    <SafeAreaView style={styles.root}>
      <Header />
      <LinearGradient colors={[palette.violetDeep, palette.night900]} style={styles.hero}>
        <AppText variant="heading">{s.title}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {fmt(t.seasonEnds, { d: new Date(s.ends).toLocaleDateString('he-IL') })}
        </AppText>
        <View style={styles.tierRow}>
          <View style={styles.tierBadge}>
            <AppText variant="heading" color={colors.textOnBright}>
              {String(s.tier)}
            </AppText>
          </View>
          <View style={styles.flex}>
            <ProgressBar
              value={maxed ? 1 : into / s.xp_per_tier}
              color={palette.violet}
              height={12}
              accessibilityLabel={fmt(t.passXp, { xp: into, max: s.xp_per_tier })}
            />
            <AppText variant="caption" color={colors.textMuted}>
              {maxed ? t.passBody : fmt(t.passXp, { xp: into, max: s.xp_per_tier })}
            </AppText>
          </View>
        </View>
        {s.premium ? (
          <AppText variant="label" color={palette.violet}>
            {t.premiumOn}
          </AppText>
        ) : (
          <>
            <AppText variant="caption" color={colors.text}>
              {t.premiumPitch}
            </AppText>
            <StickerButton label={fmt(t.buyPremium, { n: s.premium_gems })} icon="diamond" tone="gem" fullWidth loading={buy.isPending} onPress={buyPremium} />
          </>
        )}
        {ready > 1 ? (
          <StickerButton label={fmt(t.claimAll, { n: ready })} icon="gift" tone="prize" fullWidth loading={claim.isPending} onPress={() => void claimAll()} />
        ) : null}
      </LinearGradient>

      <View style={styles.legend}>
        <AppText variant="label" style={styles.col}>
          {t.free}
        </AppText>
        <View style={styles.tierCol} />
        <AppText variant="label" color={palette.violet} style={styles.col}>
          {t.premium}
        </AppText>
      </View>
      <FlatList
        data={s.tiers}
        keyExtractor={(x) => String(x.tier)}
        contentContainerStyle={styles.list}
        initialScrollIndex={Math.max(0, Math.min(s.tier - 1, s.tiers.length - 1))}
        getItemLayout={(_, i) => ({ length: ROW, offset: ROW * i, index: i })}
        renderItem={({ item }) => {
          const reached = item.tier <= s.tier;
          const freeState = s.claimed_free.includes(item.tier) ? 'claimed' : reached ? 'ready' : 'locked';
          const premState = s.claimed_premium.includes(item.tier) ? 'claimed' : !s.premium ? 'needs_premium' : reached ? 'ready' : 'locked';
          return (
            <View style={styles.row}>
              <Slot reward={item.free} state={freeState} busy={claim.isPending} onClaim={() => onClaim(item.tier, 'free', item.free)} />
              <View style={[styles.tierCol, styles.tierNum, reached ? styles.tierReached : null]}>
                <AppText variant="label" color={reached ? colors.textOnBright : colors.textDim}>
                  {String(item.tier)}
                </AppText>
              </View>
              <Slot reward={item.premium} premium state={premState} busy={claim.isPending} onClaim={() => onClaim(item.tier, 'premium', item.premium)} />
            </View>
          );
        }}
      />
    </SafeAreaView>
  );
}

function Header() {
  return (
    <View style={styles.top}>
      <AppText variant="title">{t.passTitle}</AppText>
      <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
    </View>
  );
}

const ROW = 104;
const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  pad: { padding: space.xl },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  hero: { margin: space.md, padding: space.lg, borderRadius: radius.board, gap: space.sm, borderWidth: 2, borderColor: palette.violet },
  tierRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  tierBadge: { width: 48, height: 48, borderRadius: 24, backgroundColor: palette.violet, alignItems: 'center', justifyContent: 'center' },
  flex: { flex: 1, gap: space.xxs },
  legend: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: space.md, gap: space.sm },
  col: { flex: 1, textAlign: 'center' },
  list: { paddingHorizontal: space.md, paddingBottom: space.xxl },
  row: { height: ROW, flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tierCol: { width: 40 },
  tierNum: { height: 40, borderRadius: 20, backgroundColor: colors.board, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: colors.border },
  tierReached: { backgroundColor: palette.violet, borderColor: palette.violet },
  slot: {
    flex: 1,
    height: ROW - 12,
    borderRadius: radius.sticker,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.border,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xs,
    gap: 2,
  },
  slotPremium: { borderColor: palette.violetDeep, backgroundColor: '#1B1640' },
  slotReady: { borderColor: colors.led, borderWidth: 3 },
  slotDim: { opacity: 0.7 },
  slotText: { fontFamily: 'IBMPlexSansHebrew_600SemiBold' },
  badge: { position: 'absolute', top: 4, end: 4 },
  claimPill: { position: 'absolute', bottom: -8, backgroundColor: colors.led, borderRadius: 10, paddingHorizontal: space.sm },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  pressed: { transform: [{ scale: 0.97 }] },
});
