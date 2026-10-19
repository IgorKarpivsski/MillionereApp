import { Ionicons } from '@expo/vector-icons';
import type { Reward, ReferralReward } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, AvatarBadge, Backdrop, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { useRefreshEconomy } from '@/features/engage/hooks';
import { RewardIcon, rewardLabel } from '@/features/engage/rewards';
import { RpcError } from '@/features/profile/api';
import { inviteLink, referralApi, referralKey, useReferral } from '@/features/referral/api';
import { fmt, strings } from '@/lib/i18n';

const t = strings.referral;

function RewardChip({ r }: { r: ReferralReward }) {
  if (r.kind === 'vip_days') {
    return (
      <View style={styles.chip}>
        <Ionicons name="diamond" size={22} color={colors.led} />
        <AppText variant="label">{fmt(t.vip, { n: r.amount })}</AppText>
      </View>
    );
  }
  const rw = r as Reward;
  return (
    <View style={styles.chip}>
      <RewardIcon r={rw} size={24} />
      <AppText variant="label">{rewardLabel(rw)}</AppText>
    </View>
  );
}

/** Friend brings friend: my code, the prizes, the goals and the friends who joined. */
export default function InviteScreen() {
  const { data, isLoading, refetch, isRefetching } = useReferral();
  const qc = useQueryClient();
  const refresh = useRefreshEconomy();
  const toast = useToast();
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);

  const share = async () => {
    if (!data) return;
    haptic('tap');
    await Share.share({ message: fmt(t.shareMsg, { code: data.code, link: inviteLink(data.code) }) });
  };

  const redeem = async () => {
    setBusy(true);
    try {
      const s = await referralApi.redeem(code);
      qc.setQueryData(referralKey, s);
      refresh();
      playSound('coins');
      haptic('success');
      toast(t.redeemed, 'success');
      setCode('');
    } catch (e) {
      const m = e instanceof RpcError ? e.message : '';
      toast(
        m.includes('own code')
          ? t.ownCode
          : m.includes('too late')
            ? t.tooLate
            : m.includes('already used')
              ? t.usedAlready
              : m.includes('unknown code')
                ? t.badCode
                : strings.errors.generic,
        'error',
      );
    } finally {
      setBusy(false);
    }
  };

  const nextGoal = data?.goals.find((g) => !g.reached);

  return (
    <SafeAreaView style={styles.root}>
      <Backdrop accent="#FF6FB5" />
      <View style={styles.top}>
        <AppText variant="title" style={styles.flex}>
          {t.title}
        </AppText>
        <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
      </View>
      {isLoading || !data ? (
        <ActivityIndicator color={colors.led} style={styles.loading} />
      ) : (
        <ScrollView
          contentContainerStyle={styles.body}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={() => void refetch()} tintColor={colors.led} />}
        >
          <View style={styles.hero}>
            <AppText variant="heading" align="center">
              {fmt(t.hero, { n: data.qualify_games })}
            </AppText>
            <AppText variant="caption" color={colors.textDim}>
              {t.yourCode}
            </AppText>
            <View style={styles.codeBox}>
              <AppText variant="ledL" color={colors.led} selectable style={styles.ltr}>
                {data.code}
              </AppText>
            </View>
            <StickerButton label={t.share} icon="logo-whatsapp" tone="prize" size="lg" fullWidth onPress={() => void share()} />
          </View>

          <View style={styles.card}>
            <AppText variant="bodyStrong">{t.perFriend}</AppText>
            <View style={styles.chips}>
              {data.per_friend.map((r, i) => (
                <RewardChip key={i} r={r} />
              ))}
            </View>
            <AppText variant="bodyStrong">{t.friendGets}</AppText>
            <View style={styles.chips}>
              {data.welcome.map((r, i) => (
                <RewardChip key={i} r={r} />
              ))}
            </View>
          </View>

          <AppText variant="heading">{t.goals}</AppText>
          <AppText variant="label" color={colors.led}>
            {nextGoal ? fmt(t.next, { n: nextGoal.n - data.qualified, goal: fmt(t.goalN, { n: nextGoal.n }) }) : t.allDone}
          </AppText>
          {data.goals.map((g) => {
            const frac = Math.min(1, data.qualified / g.n);
            return (
              <View key={g.n} style={[styles.goal, g.reached && styles.goalDone, g.n >= 10 && styles.goalBig]}>
                <View style={styles.goalHead}>
                  <AppText variant="heading" style={styles.flex}>
                    {g.n >= 10 ? `👑 ${fmt(t.goalN, { n: g.n })}` : fmt(t.goalN, { n: g.n })}
                  </AppText>
                  <AppText variant="label" color={g.reached ? colors.correct : colors.textMuted}>
                    {g.reached ? t.reached : `${Math.min(data.qualified, g.n)}/${g.n}`}
                  </AppText>
                </View>
                <View style={styles.track}>
                  <View style={[styles.fill, { width: `${frac * 100}%` }]} />
                </View>
                <View style={styles.chips}>
                  {g.rewards.map((r, i) => (
                    <RewardChip key={i} r={r} />
                  ))}
                  {g.flair ? (
                    <View style={styles.chip}>
                      <AvatarBadge avatarId="avatar_01" frame="ambassador" size={26} />
                      <AppText variant="label">{t.flair}</AppText>
                    </View>
                  ) : null}
                </View>
              </View>
            );
          })}

          <AppText variant="heading">{t.friends}</AppText>
          {data.friends.length === 0 ? (
            <AppText color={colors.textDim}>{t.noFriends}</AppText>
          ) : (
            data.friends.map((f, i) => (
              <View key={`${f.username}-${i}`} style={styles.friend}>
                <AvatarBadge avatarId={f.avatar_id} photo={f.photo} size={36} />
                <AppText variant="label" numberOfLines={1} style={styles.flex}>
                  {f.username}
                </AppText>
                <AppText variant="caption" color={f.qualified ? colors.correct : colors.textMuted}>
                  {f.qualified ? t.qualified : fmt(t.progress, { g: f.games, n: data.qualify_games })}
                </AppText>
              </View>
            ))
          )}

          {data.invited_by ? (
            <AppText color={colors.textMuted} align="center">
              {fmt(t.invitedBy, { name: data.invited_by.username })}
            </AppText>
          ) : data.can_redeem ? (
            <View style={styles.card}>
              <AppText variant="bodyStrong">{t.haveCode}</AppText>
              <AppText variant="caption" color={colors.textDim}>
                {t.haveCodeBody}
              </AppText>
              <TextInput
                value={code}
                onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6))}
                placeholder={t.codePlaceholder}
                placeholderTextColor={colors.textDim}
                autoCapitalize="characters"
                autoCorrect={false}
                style={[styles.input, code ? styles.inputCode : null]}
                accessibilityLabel={t.codePlaceholder}
              />
              <StickerButton label={t.redeem} icon="gift" fullWidth disabled={code.length !== 6} loading={busy} onPress={() => void redeem()} />
            </View>
          ) : null}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingHorizontal: space.lg, paddingTop: space.sm },
  flex: { flex: 1 },
  ltr: { writingDirection: 'ltr', letterSpacing: 4 },
  loading: { marginTop: space.xxl },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxl },
  hero: { alignItems: 'center', gap: space.sm, padding: space.lg, borderRadius: radius.card, backgroundColor: colors.board, borderWidth: 2, borderColor: colors.led },
  codeBox: { paddingHorizontal: space.xl, paddingVertical: space.sm, borderRadius: radius.board, backgroundColor: 'rgba(0,0,0,0.45)' },
  card: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.board },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: radius.board,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  goal: { gap: space.sm, padding: space.md, borderRadius: radius.card, backgroundColor: colors.board, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)' },
  goalDone: { borderColor: colors.correct, borderWidth: 2 },
  goalBig: { borderColor: colors.led, borderWidth: 2 },
  goalHead: { flexDirection: 'row', alignItems: 'center' },
  track: { height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  fill: { height: '100%', borderRadius: 5, backgroundColor: colors.led },
  inputCode: { fontSize: 24, letterSpacing: 4 },
  friend: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.board, backgroundColor: colors.board },
  input: {
    height: 52,
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: 'rgba(0,0,0,0.3)',
    color: colors.text,
    fontSize: 20,
    textAlign: 'center',
    fontFamily: 'IBMPlexSansHebrew_700Bold',
  },
});
