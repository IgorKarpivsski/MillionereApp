import { Ionicons } from '@expo/vector-icons';
import type { Mission } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import Animated, { FadeIn, FadeOut, LinearTransition } from 'react-native-reanimated';
import { AppText, Card, CoinIcon, GemIcon, Icon, ProgressBar, Sheen, useToast, type IconName } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, space } from '@/design-system/tokens';
import { useEnergySheet, usePlaySession } from '@/features/engage/EnergySheet';
import { useCountdownTo, useEnergy } from '@/features/engage/hooks';
import { PACK_NAMES } from '@/features/collection/PackArt';
import { useFly } from '@/features/home/RewardFly';
import { useMyState } from '@/features/profile/hooks';
import { useWorldsConfig, useWorldsState, worldBySlug } from '@/features/worlds/api';
import { WORLD_IMAGES } from '@/features/worlds/worldImages';
import { fmt, strings } from '@/lib/i18n';
import { useClaimMission, useEvent, useMissions } from './api';

const t = strings.teen;
const ICONS: Record<string, IconName> = {
  play: 'play',
  trophy: 'trophy',
  podium: 'podium',
  timer: 'timer',
  dice: 'dice',
  globe: 'globe',
  daily: 'daily',
  gift: 'gift',
  family: 'family',
};

/** What a mission counts, from its key ("w_correct", "correct30" → "correct"). */
function missionMetric(key: string): string {
  return key.replace(/^w_/, '').replace(/\d+$/, '');
}

/** Takes the player straight to where a mission is done. */
function useMissionGo() {
  const play = usePlaySession();
  const { data: energy } = useEnergy();
  const showEnergy = useEnergySheet((s) => s.show);
  const ticket = (go: () => void) => {
    if (energy && !energy.unlimited && energy.tickets < 1) showEnergy();
    else go();
  };
  return (key: string) => {
    switch (missionMetric(key)) {
      case 'stars':
      case 'perfect':
      case 'worlds':
        return router.push('/worlds');
      case 'blitz':
        return ticket(() => router.push('/blitz'));
      case 'survival':
      case 'survival_best':
        return ticket(() => router.push('/survival'));
      case 'tf':
        return ticket(() => router.push('/truefalse'));
      case 'duel':
        return router.push({ pathname: '/match', params: { mode: 'random' } });
      case 'daily':
        return router.push({ pathname: '/quiz', params: { mode: 'daily' } });
      case 'packs':
        return router.push('/(tabs)/packs');
      case 'family':
        return router.push('/family');
      case 'correct':
      case 'games':
        return play('mix');
      default:
        return router.push('/(tabs)/play');
    }
  };
}

function MissionRow({ m, onClaim, onGo, busy }: { m: Mission; onClaim: (e: GestureResponderEvent) => void; onGo: () => void; busy: boolean }) {
  const done = m.progress >= m.target;
  const reduced = useReducedMotion();
  return (
    <Animated.View
      entering={reduced ? undefined : FadeIn.duration(220)}
      exiting={reduced ? undefined : FadeOut.duration(260)}
      layout={reduced ? undefined : LinearTransition.duration(240)}
      style={[styles.mission, done && styles.missionDone]}
    >
      <View style={[styles.missionIcon, done && styles.missionIconDone]}>
        <Icon name={ICONS[m.icon] ?? 'trophy'} size={30} />
      </View>
      <View style={styles.flex}>
        <AppText variant="label" numberOfLines={2}>
          {m.title}
        </AppText>
        <View style={styles.missionBar}>
          <View style={styles.flex}>
            <ProgressBar value={m.progress / m.target} color={done ? colors.correct : colors.led} height={8} accessibilityLabel={`${m.progress}/${m.target}`} />
          </View>
          <AppText variant="caption" color={colors.textMuted}>{`${m.progress}/${m.target}`}</AppText>
        </View>
        <View style={styles.prizeRow}>
          <CoinIcon size={14} />
          <AppText variant="caption" style={styles.bold}>
            {String(m.coins)}
          </AppText>
          {m.gems > 0 ? (
            <>
              <GemIcon size={13} />
              <AppText variant="caption" style={styles.bold}>
                {String(m.gems)}
              </AppText>
            </>
          ) : null}
        </View>
      </View>
      <Pressable
        disabled={busy}
        onPress={done ? onClaim : onGo}
        accessibilityRole="button"
        accessibilityState={{ disabled: busy }}
        accessibilityLabel={done ? `${t.missionClaim} ${m.title}` : `${t.missionGo}: ${m.title}, ${m.progress}/${m.target}`}
        style={({ pressed }) => [styles.claim, !done && styles.go, pressed && styles.pressed]}
      >
        {busy ? (
          <ActivityIndicator size="small" color={colors.textOnBright} />
        ) : done ? (
          <AppText variant="label" color={colors.textOnBright} style={styles.bold}>
            {t.missionClaim}
          </AppText>
        ) : (
          <>
            <AppText variant="label" color={colors.textOnBright} style={styles.bold}>
              {t.missionGo}
            </AppText>
            <Ionicons name="chevron-back" size={16} color={colors.textOnBright} />
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/** Daily and weekly missions, front and centre on home. Claimed missions drop off the list. */
export function MissionsCard() {
  const { data, refetch } = useMissions();
  // progress moves while playing: refresh whenever home comes back into view
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const claim = useClaimMission();
  const go = useMissionGo();
  const launch = useFly((s) => s.launch);
  const toast = useToast();
  const [tab, setTab] = useState<'day' | 'week'>('day');
  const week = data?.week;
  const list = tab === 'day' ? data?.missions ?? [] : week?.missions ?? [];
  const resetSecs = tab === 'day' ? data?.seconds_to_reset : week?.seconds_to_reset;
  const ends = useMemo(
    () => (resetSecs != null ? new Date(Date.now() + resetSecs * 1000).toISOString() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.day, tab],
  );
  const left = useCountdownTo(ends);
  if (!data) return null;
  const ready = (ms: Mission[]) => ms.filter((m) => !m.claimed && m.progress >= m.target).length;
  const open = list
    .filter((m) => !m.claimed)
    .sort((a, b) => Number(b.progress >= b.target) - Number(a.progress >= a.target) || b.progress / b.target - a.progress / a.target);
  const claimedN = list.length - open.length;
  const bonusDone = tab === 'day' ? data.bonus_claimed : !!week?.bonus_claimed;
  const bonusText =
    tab === 'day'
      ? fmt(t.missionsBonus, { n: data.bonus_gems })
      : week?.bonus_pack
        ? fmt(t.weekBonusPack, { n: week.bonus_gems, pack: PACK_NAMES[week.bonus_pack] })
        : fmt(t.missionsBonus, { n: week?.bonus_gems ?? 0 });

  const tabs: { key: 'day' | 'week'; label: string; n: number }[] = [
    { key: 'day', label: t.tabDaily, n: ready(data.missions) },
    ...(week ? [{ key: 'week' as const, label: t.tabWeekly, n: ready(week.missions) }] : []),
  ];

  return (
    <View style={styles.missionsCard}>
      <LinearGradient colors={['#3B2A8F', '#22155E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <View style={styles.head}>
        <AppText variant="title" style={styles.flex}>
          {`🎯 ${t.missionsTitle}`}
        </AppText>
        {left ? (
          <View style={styles.resetChip}>
            <Ionicons name="time-outline" size={14} color={colors.text} />
            <AppText variant="caption">{left}</AppText>
          </View>
        ) : null}
      </View>
      <View style={styles.tabs} accessibilityRole="tablist">
        {tabs.map((x) => {
          const on = x.key === tab;
          return (
            <Pressable
              key={x.key}
              onPress={() => {
                haptic('select');
                setTab(x.key);
              }}
              accessibilityRole="tab"
              accessibilityState={{ selected: on }}
              accessibilityLabel={x.n > 0 ? `${x.label}, ${x.n}` : x.label}
              style={[styles.tab, on && styles.tabOn]}
            >
              <AppText variant="label" color={on ? colors.textOnBright : colors.text}>
                {x.label}
              </AppText>
              {x.n > 0 ? (
                <View style={styles.tabBadge}>
                  <AppText variant="caption" color={colors.text} style={styles.bold}>
                    {String(x.n)}
                  </AppText>
                </View>
              ) : null}
            </Pressable>
          );
        })}
      </View>
      <View style={styles.list}>
        {open.length === 0 ? (
          <View style={styles.allDone}>
            <AppText style={styles.allDoneIcon}>🏆</AppText>
            <AppText variant="bodyStrong" align="center">
              {tab === 'day' ? t.missionsAllDone : t.weekAllDone}
            </AppText>
            {left ? (
              <AppText variant="caption" color={colors.textMuted} align="center">
                {fmt(t.missionsNew, { t: left })}
              </AppText>
            ) : null}
          </View>
        ) : (
          open.map((m) => (
            <MissionRow
              key={m.key}
              m={m}
              busy={claim.isPending && claim.variables === m.key}
              onGo={() => {
                haptic('tap');
                go(m.key);
              }}
              onClaim={(e) => {
                const from = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
                claim.mutate(m.key, {
                  onSuccess: (s) => {
                    haptic('success');
                    playSound('coins');
                    launch({ from, kind: 'coins', label: `+${m.coins}` });
                    if (m.gems > 0) setTimeout(() => launch({ from, kind: 'gems', label: `+${m.gems}` }), 350);
                    if (s.bonus) {
                      const g = s.weekly ? s.week?.bonus_gems ?? 0 : s.bonus_gems;
                      setTimeout(() => launch({ from, kind: 'gems', label: `+${g}` }), 700);
                      toast(s.weekly ? t.weekBonusGot : fmt(t.missionBonusGot, { n: g }), 'success');
                    }
                  },
                  onError: () => toast(strings.errors.generic, 'error'),
                });
              }}
            />
          ))
        )}
      </View>
      <View style={styles.bonus}>
        <GemIcon size={18} />
        <AppText variant="caption" color={bonusDone ? colors.correct : colors.text} style={styles.flex}>
          {bonusDone ? t.missionsBonusDone : bonusText}
        </AppText>
        <AppText variant="caption" color={colors.textMuted} style={styles.bold}>
          {`${claimedN}/${list.length}`}
        </AppText>
      </View>
    </View>
  );
}

/** "Level 7 in Space is waiting": the clearest next step on the map. */
export function NextGoal() {
  const { data } = useWorldsState();
  const worlds = useWorldsConfig();
  const { data: me } = useMyState();
  const pick = useMemo(() => {
    if (!data) return null;
    const active = worlds.filter((w) => w.active !== false && w.levels > 0);
    const favs = me?.profile.fav_worlds ?? [];
    const rows = active
      .map((w) => ({ w, st: data.worlds.find((x) => x.slug === w.slug) }))
      .map(({ w, st }) => ({ w, unlocked: st?.unlocked ?? 1, stars: st?.total_stars ?? 0 }))
      .filter((r) => r.unlocked <= r.w.levels);
    if (rows.length === 0) return null;
    // the world they're furthest along in (favourites win ties), so the goal feels close
    rows.sort((a, b) => b.unlocked - a.unlocked || Number(favs.includes(b.w.slug)) - Number(favs.includes(a.w.slug)));
    return rows[0]!;
  }, [data, worlds, me?.profile.fav_worlds]);
  if (!pick) return null;
  const w = worldBySlug(worlds, pick.w.slug);
  return (
    <Pressable
      onPress={() => router.push({ pathname: '/world/[slug]', params: { slug: w.slug } })}
      accessibilityRole="button"
      accessibilityLabel={fmt(t.nextGoalPlay, { level: pick.unlocked, world: w.name })}
      style={({ pressed }) => [styles.goal, pressed && styles.pressed]}
    >
      <LinearGradient colors={[w.color, '#2A1A6E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <Sheen />
      {WORLD_IMAGES[w.icon] ? <Image source={WORLD_IMAGES[w.icon]!} style={styles.goalArt} /> : <Icon name="globe" size={44} />}
      <View style={styles.flex}>
        <AppText variant="caption" color={colors.text} style={styles.bold}>
          {`🎯 ${t.nextGoalTitle}`}
        </AppText>
        <AppText variant="label" numberOfLines={1}>
          {fmt(t.nextGoalPlay, { level: pick.unlocked, world: w.name })}
        </AppText>
        <View style={styles.goalBar}>
          <ProgressBar value={(pick.unlocked - 1) / Math.max(1, w.levels)} height={6} accessibilityLabel={`${pick.unlocked - 1}/${w.levels}`} />
        </View>
      </View>
      <Ionicons name="chevron-back" size={20} color={colors.text} />
    </Pressable>
  );
}

/** First week: tickets are free, say so loudly. */
export function NewbieBanner() {
  const { data } = useEnergy();
  if (!data?.newbie_until) return null;
  const days = Math.max(1, Math.ceil((new Date(data.newbie_until).getTime() - Date.now()) / 86_400_000));
  return (
    <View style={styles.newbie} accessible accessibilityLabel={`${t.freeWeek} ${fmt(t.freeWeekLeft, { n: days })}`}>
      <LinearGradient colors={['#3DDC84', '#119E8C']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
      <AppText style={styles.newbieIcon}>🎟️</AppText>
      <View style={styles.flex}>
        <AppText variant="label">{t.freeWeek}</AppText>
        <AppText variant="caption">{fmt(t.freeWeekLeft, { n: days })}</AppText>
      </View>
    </View>
  );
}

/** This week's themed world: double coins and its own table. */
export function EventCard() {
  const { data } = useEvent();
  const worlds = useWorldsConfig();
  const left = useCountdownTo(data?.active ? data.ends_at : null);
  if (!data?.active) return null;
  const w = worldBySlug(worlds, data.world);
  const days = data.ends_at ? Math.floor((new Date(data.ends_at).getTime() - Date.now()) / 86_400_000) : 0;
  return (
    <Pressable
      onPress={() => router.push('/event')}
      accessibilityRole="button"
      accessibilityLabel={fmt(t.eventTitle, { world: w.name })}
      style={({ pressed }) => [styles.event, pressed && styles.pressed]}
    >
      <LinearGradient colors={['#FFB000', w.color, '#4B2A8A']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Sheen />
      {WORLD_IMAGES[w.icon] ? <Image source={WORLD_IMAGES[w.icon]!} style={styles.eventArt} /> : null}
      <View style={styles.flex}>
        <AppText variant="heading" numberOfLines={1}>
          {fmt(t.eventTitle, { world: w.name })}
        </AppText>
        <AppText variant="caption" numberOfLines={2}>
          {fmt(t.eventBody, { world: w.name, mult: data.coins_mult })}
        </AppText>
        <View style={styles.eventMeta}>
          <View style={styles.chip}>
            <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
              {`⏳ ${fmt(t.eventEnds, { t: days >= 1 ? fmt(t.eventDays, { n: days }) : (left ?? '') })}`}
            </AppText>
          </View>
          {data.me ? (
            <AppText variant="caption" style={styles.bold}>
              {fmt(t.eventRank, { n: data.me.rank })}
            </AppText>
          ) : null}
        </View>
      </View>
      <Ionicons name="chevron-back" size={20} color={colors.text} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  pressed: { transform: [{ scale: 0.97 }] },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  missionsCard: {
    padding: space.md,
    borderRadius: 24,
    borderWidth: 2,
    borderColor: colors.led,
    overflow: 'hidden',
    gap: space.sm,
  },
  resetChip: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: space.sm, paddingVertical: 3, borderRadius: 999, backgroundColor: 'rgba(0,0,0,0.3)' },
  tabs: { flexDirection: 'row', gap: space.xs, padding: 4, borderRadius: 16, backgroundColor: 'rgba(0,0,0,0.28)' },
  tab: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, height: 40, borderRadius: 12 },
  tabOn: { backgroundColor: colors.led },
  tabBadge: { minWidth: 20, height: 20, borderRadius: 10, paddingHorizontal: 5, backgroundColor: colors.danger, alignItems: 'center', justifyContent: 'center' },
  list: { gap: space.sm },
  mission: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm,
    borderRadius: 16,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  missionDone: { borderColor: colors.correct, backgroundColor: 'rgba(61,220,132,0.12)' },
  missionIcon: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.25)' },
  missionIconDone: { backgroundColor: 'rgba(61,220,132,0.25)' },
  missionBar: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 4 },
  prizeRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 },
  allDone: { alignItems: 'center', gap: 4, paddingVertical: space.md },
  allDoneIcon: { fontSize: 40, lineHeight: 48 },
  claim: {
    minWidth: 70,
    height: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    borderRadius: 20,
    backgroundColor: colors.prize,
    borderWidth: 2,
    borderColor: '#FFF3C4',
  },
  go: { backgroundColor: '#3E8EF7', borderColor: 'rgba(255,255,255,0.45)' },
  bonus: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.xs,
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: 12,
    backgroundColor: 'rgba(0,0,0,0.25)',
  },
  goal: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm + 2,
    borderRadius: 18,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.28)',
    overflow: 'hidden',
  },
  goalArt: { width: 44, height: 44, borderRadius: 12 },
  goalBar: { marginTop: 4 },
  event: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.md,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: 'rgba(255,226,122,0.8)',
    overflow: 'hidden',
  },
  eventArt: { width: 64, height: 64, borderRadius: 16 },
  eventMeta: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginTop: 4 },
  newbie: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    padding: space.sm + 2,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  newbieIcon: { fontSize: 28 },
  chip: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 10, backgroundColor: colors.led },
});
