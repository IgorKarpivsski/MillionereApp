import { Ionicons } from '@expo/vector-icons';
import type { LeagueState } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { useEffect, useMemo, useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { AppText, AvatarBadge, CoinIcon, GemIcon, Icon, Led, StickerButton } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { useSettingsStore } from '@/features/settings/store';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';
import { leagueReward } from './api';
import { LeagueBadge, TIER_COLORS } from './LeagueBadge';

const t = strings.league;

/** Live countdown to the end of the league week: days + hh:mm:ss, ticking every second. */
function LeagueCountdown({ seconds }: { seconds: number }) {
  const endAt = useMemo(() => Date.now() + seconds * 1000, [seconds]);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const left = Math.max(0, Math.floor((endAt - now) / 1000));
  const d = Math.floor(left / 86400);
  const two = (n: number) => String(n).padStart(2, '0');
  const clock = `${two(Math.floor((left % 86400) / 3600))}:${two(Math.floor((left % 3600) / 60))}:${two(left % 60)}`;
  return (
    <View style={styles.timer} accessibilityLabel={fmt(t.endsIn, { d, h: Math.floor((left % 86400) / 3600) })}>
      <Ionicons name="time-outline" size={18} color={colors.textOnBright} />
      <AppText variant="bodyStrong" color={colors.textOnBright}>
        {t.endsLabel}
      </AppText>
      <View style={styles.timerBox}>
        <Led size="number" color={colors.led}>
          {d > 1 ? `${d} ${t.days} ${clock}` : d === 1 ? `${t.oneDay} ${clock}` : clock}
        </Led>
      </View>
    </View>
  );
}

/** Once per settled week: "you moved up / stayed / dropped" with the prize. */
function ResultModal({ s }: { s: LeagueState }) {
  const seen = useSettingsStore((x) => x.leagueSeenWeek);
  const set = useSettingsStore((x) => x.set);
  const reduced = useReducedMotion();
  const r = s.last_result;
  const open = !!r && seen !== r.week;
  useEffect(() => {
    if (open && r) playSound(r.to_tier > r.from_tier ? 'rare_reveal' : 'coins');
  }, [open, r]);
  if (!r) return null;
  const name = s.tiers[r.to_tier] ?? '';
  const title = r.to_tier > r.from_tier ? t.resultUp : r.to_tier < r.from_tier ? t.resultDown : t.resultStay;
  const close = () => set({ leagueSeenWeek: r.week });
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.scrim}>
        <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(12)} style={styles.modal} accessibilityViewIsModal>
          <LeagueBadge tier={r.to_tier} size={120} label={name} />
          <AppText variant="title" align="center">
            {fmt(title, { name })}
          </AppText>
          <AppText color={colors.textMuted} align="center">
            {fmt(t.resultBody, { r: r.rank, n: r.members, p: formatNumber(r.points) })}
          </AppText>
          {r.coins > 0 ? (
            <View style={styles.prizeLine}>
              <Icon name="coin" size={28} />
              <AppText variant="bodyStrong" color={colors.led}>
                {r.gems > 0 ? fmt(t.resultPrizeGems, { c: formatNumber(r.coins), g: r.gems }) : fmt(t.resultPrize, { c: formatNumber(r.coins) })}
              </AppText>
            </View>
          ) : null}
          <StickerButton label={strings.common.close} fullWidth onPress={close} />
        </Animated.View>
      </View>
    </Modal>
  );
}

export function LeagueView({ s }: { s: LeagueState }) {
  const [hi, mid] = TIER_COLORS[s.tier]!;
  const n = s.rows.length;
  const rules =
    s.promote === 0 ? fmt(t.rulesTop, { down: s.demote }) : s.demote === 0 ? fmt(t.rulesBottom, { up: s.promote }) : fmt(t.rules, { up: s.promote, down: s.demote });
  const prizes = [1, 2, 3, 10].map((rank) => ({ rank, r: leagueReward(s, rank) }));

  return (
    <View style={styles.wrap}>
      <ResultModal s={s} />
      <View style={styles.hero}>
        <LinearGradient colors={[hi, mid]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <LeagueBadge tier={s.tier} size={84} label={s.tier_name} />
        <View style={styles.flex}>
          <AppText variant="title" color={colors.textOnBright}>
            {fmt(t.title, { name: s.tier_name })}
          </AppText>
          <LeagueCountdown seconds={s.seconds_left} />
        </View>
      </View>
      <View style={styles.explain}>
        <AppText variant="bodyStrong" color={colors.led}>
          {`🏆 ${t.prizesTitle}`}
        </AppText>
        <AppText color={colors.text}>{t.prizesBody}</AppText>
        <AppText variant="caption" color={colors.textMuted}>
          {rules}
        </AppText>
      </View>

      <View style={styles.prizes} accessibilityLabel={t.prizes}>
        {prizes.map(({ rank, r }) =>
          r ? (
            <View key={rank} style={styles.prize}>
              <AppText variant="caption" color={colors.textDim} align="center">
                {rank === 10 ? fmt(t.prizeRange, { r: rank }) : fmt(t.prizeRank, { r: rank })}
              </AppText>
              <View style={styles.prizeAmt}>
                <CoinIcon size={18} />
                <Led size="number" color={colors.led}>
                  {formatNumber(r.coins)}
                </Led>
              </View>
              {r.gems > 0 ? (
                <View style={styles.prizeAmt}>
                  <GemIcon size={15} />
                  <AppText variant="caption" color={colors.gem}>
                    {`+${r.gems}`}
                  </AppText>
                </View>
              ) : null}
            </View>
          ) : null,
        )}
      </View>

      {n <= 1 ? (
        <AppText color={colors.textMuted} align="center">
          {t.alone}
        </AppText>
      ) : null}

      <View style={styles.list}>
        {s.rows.map((r) => {
          const up = s.promote > 0 && r.rank <= s.promote && r.points > 0;
          const down = s.demote > 0 && n > s.promote + s.demote && r.rank > n - s.demote;
          return (
            <View
              key={`${r.rank}-${r.username}`}
              style={[styles.row, up && styles.rowUp, down && styles.rowDown, r.me && styles.rowMe]}
              accessible
              accessibilityLabel={`${r.rank}. ${r.username}, ${formatNumber(r.points)} ${strings.leaderboard.points}${up ? `, ${t.upZone}` : down ? `, ${t.downZone}` : ''}`}
            >
              <Led size="number" color={r.rank === 1 ? colors.led : colors.text} style={styles.rank}>
                {r.rank}
              </Led>
              <AvatarBadge avatarId={r.avatar_id} photo={r.photo} size={38} />
              <AppText variant="label" numberOfLines={1} style={styles.flex}>
                {r.username}
              </AppText>
              {up ? <Ionicons name="arrow-up-circle" size={20} color={colors.correct} /> : null}
              {down ? <Ionicons name="arrow-down-circle" size={20} color={colors.danger} /> : null}
              <Led size="number" color={r.me ? colors.led : colors.text}>
                {formatNumber(r.points)}
              </Led>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export function SegmentTabs<T extends string>({ value, options, onChange }: { value: T; options: { key: T; label: string }[]; onChange: (k: T) => void }) {
  return (
    <View style={styles.seg} accessibilityRole="tablist">
      {options.map((o) => {
        const on = o.key === value;
        return (
          <Pressable
            key={o.key}
            onPress={() => onChange(o.key)}
            accessibilityRole="tab"
            accessibilityState={{ selected: on }}
            style={[styles.segBtn, on && styles.segOn]}
          >
            <AppText variant="label" color={on ? colors.textOnBright : colors.textMuted}>
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.md },
  flex: { flex: 1 },
  hero: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  prizes: { flexDirection: 'row', gap: space.sm },
  prizeAmt: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.xs, flexWrap: 'wrap' },
  timerBox: { backgroundColor: 'rgba(0,0,0,0.55)', borderRadius: 10, paddingHorizontal: space.sm, paddingVertical: 2 },
  explain: { gap: 4, padding: space.md, borderRadius: radius.board, backgroundColor: colors.board, borderWidth: 1, borderColor: colors.led },
  prize: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: space.sm, borderRadius: radius.board, backgroundColor: colors.board },
  list: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 1,
    borderColor: 'transparent',
  },
  rowUp: { backgroundColor: 'rgba(30,158,90,0.22)', borderColor: 'rgba(61,220,132,0.45)' },
  rowDown: { backgroundColor: 'rgba(184,50,42,0.22)', borderColor: 'rgba(255,90,78,0.4)' },
  rowMe: { borderWidth: 2, borderColor: colors.led, backgroundColor: 'rgba(255,176,0,0.14)' },
  rank: { minWidth: 28, textAlign: 'center' },
  scrim: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', alignItems: 'center', justifyContent: 'center', padding: space.xl },
  modal: {
    width: '100%',
    maxWidth: 380,
    alignItems: 'center',
    gap: space.md,
    padding: space.xl,
    borderRadius: radius.sheet,
    backgroundColor: '#1D1150',
    borderWidth: 2,
    borderColor: colors.led,
    shadowColor: colors.led,
    shadowOpacity: 0.6,
    shadowRadius: 20,
    elevation: 14,
  },
  prizeLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  seg: { flexDirection: 'row', padding: 4, borderRadius: radius.chip, backgroundColor: colors.board, borderWidth: 1, borderColor: colors.border },
  segBtn: { flex: 1, minHeight: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.chip },
  segOn: { backgroundColor: colors.led, shadowColor: colors.led, shadowOpacity: 0.6, shadowRadius: 10, elevation: 6 },
});
