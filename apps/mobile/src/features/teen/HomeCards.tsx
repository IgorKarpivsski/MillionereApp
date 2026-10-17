import { Ionicons } from '@expo/vector-icons';
import type { Mission } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { useCallback, useMemo } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View, type GestureResponderEvent } from 'react-native';
import { AppText, Card, CoinIcon, GemIcon, Icon, ProgressBar, Sheen, useToast, type IconName } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, space } from '@/design-system/tokens';
import { useCountdownTo, useEnergy } from '@/features/engage/hooks';
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
};

function MissionRow({ m, onClaim, busy }: { m: Mission; onClaim: (e: GestureResponderEvent) => void; busy: boolean }) {
  const done = m.progress >= m.target;
  return (
    <View style={styles.mission}>
      <Icon name={ICONS[m.icon] ?? 'trophy'} size={34} />
      <View style={styles.flex}>
        <AppText variant="label" numberOfLines={1}>
          {m.title}
        </AppText>
        <View style={styles.missionBar}>
          <View style={styles.flex}>
            <ProgressBar value={m.progress / m.target} color={done ? colors.correct : colors.led} height={8} accessibilityLabel={`${m.progress}/${m.target}`} />
          </View>
          <AppText variant="caption" color={colors.textMuted}>{`${m.progress}/${m.target}`}</AppText>
        </View>
      </View>
      {m.claimed ? (
        <AppText variant="caption" color={colors.correct} style={styles.bold}>
          {t.missionDone}
        </AppText>
      ) : (
        <Pressable
          disabled={!done || busy}
          onPress={onClaim}
          accessibilityRole="button"
          accessibilityLabel={`${t.missionClaim} ${m.coins}`}
          style={({ pressed }) => [styles.claim, !done && styles.claimOff, pressed && styles.pressed]}
        >
          {busy ? (
            <ActivityIndicator size="small" color={colors.textOnBright} />
          ) : (
            <>
              <CoinIcon size={18} />
              <AppText variant="caption" color={done ? colors.textOnBright : colors.text} style={styles.bold}>
                {done ? t.missionClaim : String(m.coins)}
              </AppText>
            </>
          )}
        </Pressable>
      )}
    </View>
  );
}

/** Three small goals a day, with coins for each and gems for all three. */
export function MissionsCard() {
  const { data, refetch } = useMissions();
  // progress moves while playing: refresh whenever home comes back into view
  useFocusEffect(
    useCallback(() => {
      void refetch();
    }, [refetch]),
  );
  const claim = useClaimMission();
  const launch = useFly((s) => s.launch);
  const toast = useToast();
  const ends = useMemo(
    () => (data ? new Date(Date.now() + data.seconds_to_reset * 1000).toISOString() : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data?.day],
  );
  const left = useCountdownTo(ends);
  if (!data || data.missions.length === 0) return null;
  const allClaimed = data.missions.every((m) => m.claimed);
  return (
    <Card padding={space.md}>
      <View style={styles.head}>
        <AppText variant="heading" style={styles.flex}>
          {t.missionsTitle}
        </AppText>
        {left ? (
          <AppText variant="caption" color={colors.textMuted}>
            {fmt(t.missionsReset, { t: left })}
          </AppText>
        ) : null}
      </View>
      <View style={styles.list}>
        {data.missions.map((m) => (
          <MissionRow
            key={m.key}
            m={m}
            busy={claim.isPending && claim.variables === m.key}
            onClaim={(e) => {
              const from = { x: e.nativeEvent.pageX, y: e.nativeEvent.pageY };
              claim.mutate(m.key, {
                onSuccess: (s) => {
                  haptic('success');
                  playSound('coins');
                  launch({ from, kind: 'coins', label: `+${m.coins}` });
                  if (s.bonus) {
                    setTimeout(() => launch({ from, kind: 'gems', label: `+${s.bonus_gems}` }), 600);
                    toast(fmt(t.missionBonusGot, { n: s.bonus_gems }), 'success');
                  }
                },
                onError: () => toast(strings.errors.generic, 'error'),
              });
            }}
          />
        ))}
      </View>
      <View style={styles.bonus}>
        <GemIcon size={18} />
        <AppText variant="caption" color={allClaimed || data.bonus_claimed ? colors.correct : colors.textMuted}>
          {data.bonus_claimed ? t.missionsBonusDone : fmt(t.missionsBonus, { n: data.bonus_gems })}
        </AppText>
      </View>
    </Card>
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
  list: { gap: space.sm, marginTop: space.sm },
  mission: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  missionBar: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: 2 },
  claim: {
    minWidth: 66,
    height: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingHorizontal: space.sm,
    borderRadius: 17,
    backgroundColor: colors.prize,
  },
  claimOff: { backgroundColor: 'rgba(255,255,255,0.12)' },
  bonus: { flexDirection: 'row', alignItems: 'center', gap: space.xs, marginTop: space.sm },
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
