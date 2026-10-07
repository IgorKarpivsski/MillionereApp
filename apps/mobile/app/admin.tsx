import { Ionicons } from '@expo/vector-icons';
import type { PackSlug } from '@fm/shared';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Pressable, Share, StyleSheet, TextInput, View } from 'react-native';
import { AppText, AvatarBadge, Card, EmptyState, Screen, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { adminApi, useAdminStatus, type AdminPlayer, type GrantReward } from '@/features/admin/api';
import { inputStyle } from '@/features/admin/CodeSheets';
import { requestId } from '@/features/collection/api';
import { PACK_NAMES } from '@/features/collection/PackArt';
import { RewardIcon, rewardLabel } from '@/features/engage/rewards';
import { SegmentTabs } from '@/features/league/LeagueView';
import { useRefreshEconomy } from '@/features/engage/hooks';
import { useMyState } from '@/features/profile/hooks';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';

const t = strings.admin;
type Kind = GrantReward['kind'];
const PRESETS: Record<Kind, number[]> = { coins: [100, 500, 1000, 5000], gems: [10, 50, 100, 500], pack: [1, 3, 5], tickets: [3, 5, 10] };
const PACKS: PackSlug[] = ['bronze', 'silver', 'gold', 'epic', 'legendary'];

function Chip({ label, on, onPress }: { label: string; on: boolean; onPress: () => void }) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityState={{ selected: on }}
      style={[styles.chip, on && styles.chipOn]}
    >
      <AppText variant="label" color={on ? colors.textOnBright : colors.text}>
        {label}
      </AppText>
    </Pressable>
  );
}

/** Kind + amount (+ pack) picker shared by "give to a player" and "create a live code". */
function RewardPicker({ value, onChange }: { value: GrantReward; onChange: (r: GrantReward) => void }) {
  const [custom, setCustom] = useState('');
  const set = (kind: Kind, amount: number, pack?: PackSlug) =>
    onChange(kind === 'pack' ? { kind, amount, pack: pack ?? (value.kind === 'pack' ? value.pack : 'gold') } : { kind, amount });
  return (
    <View style={styles.gap}>
      <View style={styles.row}>
        {(Object.keys(PRESETS) as Kind[]).map((k) => (
          <Chip key={k} label={t.kinds[k]} on={value.kind === k} onPress={() => set(k, PRESETS[k][0]!)} />
        ))}
      </View>
      {value.kind === 'pack' ? (
        <View style={styles.row}>
          {PACKS.map((p) => (
            <Chip key={p} label={PACK_NAMES[p]} on={value.pack === p} onPress={() => set('pack', value.amount, p)} />
          ))}
        </View>
      ) : null}
      <View style={styles.row}>
        {PRESETS[value.kind].map((n) => (
          <Chip key={n} label={formatNumber(n)} on={value.amount === n && !custom} onPress={() => { setCustom(''); set(value.kind, n); }} />
        ))}
        <TextInput
          value={custom}
          onChangeText={(v) => {
            const d = v.replace(/[^0-9]/g, '').slice(0, 6);
            setCustom(d);
            if (d) set(value.kind, Number(d));
          }}
          placeholder={t.custom}
          placeholderTextColor={colors.textDim}
          keyboardType="number-pad"
          accessibilityLabel={t.custom}
          style={[inputStyle, styles.customInput]}
        />
      </View>
      <View style={styles.preview}>
        <RewardIcon r={value} size={30} />
        <AppText variant="bodyStrong">{rewardLabel(value)}</AppText>
      </View>
    </View>
  );
}

function GiveTab() {
  const [q, setQ] = useState('');
  const [debounced, setDebounced] = useState('');
  const [player, setPlayer] = useState<AdminPlayer | null>(null);
  const [reward, setReward] = useState<GrantReward>({ kind: 'gems', amount: 100 });
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();
  const refresh = useRefreshEconomy();
  useEffect(() => {
    const id = setTimeout(() => setDebounced(q.trim()), 350);
    return () => clearTimeout(id);
  }, [q]);
  const found = useQuery({ queryKey: ['admin-find', debounced], queryFn: () => adminApi.find(debounced), enabled: debounced.length >= 2 });
  const { data: mine } = useMyState();
  const meAsPlayer: AdminPlayer | null = mine
    ? {
        id: mine.profile.id,
        username: mine.profile.username,
        avatar_id: mine.profile.avatar_id,
        level: mine.profile.level,
        friend_code: null,
        coins: mine.wallet.coins,
        gems: mine.wallet.gems,
      }
    : null;

  const give = () => {
    if (!player) return;
    const label = rewardLabel(reward);
    Alert.alert(t.confirmTitle, fmt(t.confirmBody, { label, name: player.username }), [
      { text: strings.common.cancel, style: 'cancel' },
      {
        text: fmt(t.give, { label }),
        onPress: async () => {
          setBusy(true);
          try {
            await adminApi.grant(player.id, reward, note, requestId());
            if (player.id === mine?.profile.id) refresh();
            haptic('success');
            toast(fmt(t.given, { label, name: player.username }), 'success');
            setNote('');
            void qc.invalidateQueries({ queryKey: ['admin-find'] });
            void qc.invalidateQueries({ queryKey: ['admin-recent'] });
          } catch (e) {
            toast((e as Error).message.includes('invalid_input: amount') ? t.limit : strings.errors.generic, 'error');
          } finally {
            setBusy(false);
          }
        },
      },
    ]);
  };

  return (
    <View style={styles.gap}>
      {meAsPlayer ? (
        <StickerButton
          label={fmt(t.toMe, { name: meAsPlayer.username })}
          icon="person-circle"
          tone={player?.id === meAsPlayer.id ? 'prize' : 'outline'}
          fullWidth
          onPress={() => setPlayer(meAsPlayer)}
        />
      ) : null}
      <TextInput
        value={q}
        onChangeText={setQ}
        placeholder={t.search}
        placeholderTextColor={colors.textDim}
        autoCorrect={false}
        accessibilityLabel={t.search}
        style={inputStyle}
      />
      {debounced.length >= 2 && found.data?.length === 0 ? <AppText color={colors.textMuted}>{t.noResults}</AppText> : null}
      {found.data?.map((p) => (
        <Pressable
          key={p.id}
          onPress={() => setPlayer(p)}
          accessibilityRole="button"
          accessibilityState={{ selected: player?.id === p.id }}
          style={[styles.player, player?.id === p.id && styles.playerOn]}
        >
          <AvatarBadge avatarId={p.avatar_id} level={p.level} size={40} />
          <View style={styles.flex}>
            <AppText variant="label">{p.id === mine?.profile.id ? `${p.username} (${t.thisIsYou})` : p.username}</AppText>
            <AppText variant="caption" color={colors.textDim}>
              {`${p.friend_code ?? '------'}   ${formatNumber(p.coins)} ${strings.common.coins}   ${formatNumber(p.gems)} ${strings.common.gems}`}
            </AppText>
          </View>
          {player?.id === p.id ? <Ionicons name="checkmark-circle" size={24} color={colors.led} /> : null}
        </Pressable>
      ))}
      <Card kind="sticker" padding={space.md}>
        <View style={styles.gap}>
          <AppText variant="heading">{player ? player.username : t.pickPlayer}</AppText>
          <RewardPicker value={reward} onChange={setReward} />
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder={t.note}
            placeholderTextColor={colors.textDim}
            maxLength={200}
            accessibilityLabel={t.note}
            style={inputStyle}
          />
          <StickerButton label={fmt(t.give, { label: rewardLabel(reward) })} icon="gift" tone="prize" size="lg" fullWidth disabled={!player} loading={busy} onPress={give} />
        </View>
      </Card>
    </View>
  );
}

function CodesTab() {
  const [code, setCode] = useState('');
  const [reward, setReward] = useState<GrantReward>({ kind: 'gems', amount: 50 });
  const [maxUses, setMaxUses] = useState(50);
  const [hours, setHours] = useState(3);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const recent = useQuery({ queryKey: ['admin-recent'], queryFn: adminApi.recent });

  const share = (c: string, label: string) => void Share.share({ message: fmt(t.shareText, { code: c, label }) });
  const create = async () => {
    setBusy(true);
    try {
      const r = await adminApi.createPromo(code, reward, maxUses, hours);
      haptic('success');
      toast(fmt(t.codeCreated, { code: r.code }), 'success');
      share(r.code, rewardLabel(reward));
      setCode('');
      void recent.refetch();
    } catch (e) {
      toast((e as Error).message.includes('code_taken') ? t.codeTaken : strings.errors.generic, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <View style={styles.gap}>
      <Card kind="sticker" padding={space.md}>
        <View style={styles.gap}>
          <AppText variant="label">{t.codeLabel}</AppText>
          <TextInput
            value={code}
            onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 16))}
            placeholder="LIVE100"
            placeholderTextColor={colors.textDim}
            autoCapitalize="characters"
            autoCorrect={false}
            accessibilityLabel={t.codeLabel}
            style={[inputStyle, styles.codeInput]}
          />
          <RewardPicker value={reward} onChange={setReward} />
          <AppText variant="label">{t.maxUses}</AppText>
          <View style={styles.row}>
            {[10, 50, 100, 1000].map((n) => (
              <Chip key={n} label={formatNumber(n)} on={maxUses === n} onPress={() => setMaxUses(n)} />
            ))}
          </View>
          <AppText variant="label">{t.hours}</AppText>
          <View style={styles.row}>
            {[1, 3, 24, 72].map((n) => (
              <Chip key={n} label={String(n)} on={hours === n} onPress={() => setHours(n)} />
            ))}
          </View>
          <StickerButton label={t.createCode} icon="add-circle" tone="prize" size="lg" fullWidth disabled={code.length < 4} loading={busy} onPress={() => void create()} />
        </View>
      </Card>

      {recent.data?.promos.map((p) => (
        <View key={p.code} style={styles.promo}>
          <RewardIcon r={p.reward} size={28} />
          <View style={styles.flex}>
            <AppText variant="label">{p.code}</AppText>
            <AppText variant="caption" color={colors.textDim}>
              {`${rewardLabel(p.reward)}   ${fmt(t.uses, { n: p.uses, max: p.max_uses })}`}
            </AppText>
          </View>
          <AppText variant="caption" color={p.active ? colors.correct : colors.textDim}>
            {p.active ? t.active : t.ended}
          </AppText>
          {p.active ? (
            <>
              <StickerButton label={t.share} size="sm" tone="ghost" onPress={() => share(p.code, rewardLabel(p.reward))} />
              <StickerButton
                label={t.stop}
                size="sm"
                tone="danger"
                onPress={async () => {
                  await adminApi.stopPromo(p.code);
                  void recent.refetch();
                }}
              />
            </>
          ) : null}
        </View>
      ))}
    </View>
  );
}

function HistoryTab() {
  const recent = useQuery({ queryKey: ['admin-recent'], queryFn: adminApi.recent });
  if (!recent.data) return null;
  return (
    <View style={styles.gap}>
      <AppText color={colors.textMuted}>{fmt(t.players, { n: formatNumber(recent.data.players) })}</AppText>
      {recent.data.grants.map((g, i) => (
        <View key={`${g.at}-${i}`} style={styles.promo}>
          <RewardIcon r={g.reward} size={26} />
          <View style={styles.flex}>
            <AppText variant="label">{`${g.username}: ${rewardLabel(g.reward)}`}</AppText>
            <AppText variant="caption" color={colors.textDim}>
              {`${new Date(g.at).toLocaleString('he-IL')}${g.note ? `   ${g.note}` : ''}`}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

export default function AdminScreen() {
  const status = useAdminStatus();
  const [tab, setTab] = useState<'give' | 'codes' | 'history'>('give');
  return (
    <Screen
      header={
        <View style={styles.header}>
          <AppText variant="title">{t.title}</AppText>
          <StickerButton label={strings.common.close} size="sm" tone="ghost" onPress={() => router.back()} />
        </View>
      }
    >
      {status.data?.admin ? (
        <>
          <SegmentTabs
            value={tab}
            onChange={setTab}
            options={[
              { key: 'give', label: t.tabPlayers },
              { key: 'codes', label: t.tabCodes },
              { key: 'history', label: t.tabHistory },
            ]}
          />
          {tab === 'give' ? <GiveTab /> : tab === 'codes' ? <CodesTab /> : <HistoryTab />}
        </>
      ) : status.isLoading ? null : (
        <EmptyState icon="lock-closed" title={t.title} body={t.unlockBad} />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: space.lg, paddingTop: space.md },
  gap: { gap: space.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, alignItems: 'center' },
  flex: { flex: 1 },
  chip: {
    minHeight: 40,
    paddingHorizontal: space.md,
    borderRadius: radius.chip,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: palette.night950,
    alignItems: 'center',
    justifyContent: 'center',
  },
  chipOn: { backgroundColor: colors.led, borderColor: colors.led },
  customInput: { width: 110, height: 40, fontSize: 16 },
  codeInput: { textAlign: 'center', letterSpacing: 3 },
  preview: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  player: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  playerOn: { borderColor: colors.led },
  promo: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.sm, borderRadius: radius.board, backgroundColor: colors.board },
});
