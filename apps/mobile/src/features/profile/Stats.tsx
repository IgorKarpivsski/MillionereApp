import { StatsSchema, type Stats } from '@fm/shared';
import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { Image, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { AppText, Card, Icon, Led, type IconName } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, palette, space } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { useWorldsConfig } from '@/features/worlds/api';
import { WORLD_IMAGES } from '@/features/worlds/worldImages';
import { formatNumber } from '@/lib/format';
import { fmt, gx, strings } from '@/lib/i18n';
import { rpc } from './api';

const t = strings.stats;

export function useStats() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['my-stats'],
    queryFn: () => rpc('my_stats', undefined, (x) => StatsSchema.parse(x)),
    enabled: !!session,
    staleTime: 30_000,
  });
}

function Ring({ pct, size = 120 }: { pct: number; size?: number }) {
  const sw = 12;
  const r = (size - sw) / 2;
  const c = 2 * Math.PI * r;
  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size} style={StyleSheet.absoluteFill}>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke="rgba(255,255,255,0.12)" strokeWidth={sw} fill="none" />
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={r}
          stroke={pct >= 70 ? colors.correct : pct >= 40 ? colors.led : colors.danger}
          strokeWidth={sw}
          strokeLinecap="round"
          fill="none"
          strokeDasharray={`${(c * pct) / 100} ${c}`}
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </Svg>
      <Led size="ledL">{`${pct}%`}</Led>
    </View>
  );
}

function Mini({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.mini}>
      <Led size="ledM">{value}</Led>
      <AppText variant="caption" color={colors.textMuted} align="center" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

function Tile({ icon, value, label, tint }: { icon: IconName; value: string; label: string; tint: [string, string] }) {
  return (
    <View style={styles.tile}>
      <LinearGradient colors={tint} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <Icon name={icon} size={34} />
      <Led size="ledM" color={colors.text}>
        {value}
      </Led>
      <AppText variant="caption" align="center" numberOfLines={2} style={styles.tileLabel}>
        {label}
      </AppText>
    </View>
  );
}

/** Milestone badges: bronze, silver, gold. */
const BADGES: { key: keyof typeof strings.stats.badges; icon: IconName; tiers: [number, number, number]; value: (s: Stats) => number }[] = [
  { key: 'correct', icon: 'play', tiers: [50, 500, 2000], value: (s) => s.correct },
  { key: 'levels', icon: 'podium', tiers: [5, 30, 100], value: (s) => s.levels },
  { key: 'wins', icon: 'trophy', tiers: [1, 10, 50], value: (s) => s.match_wins + s.family_wins },
  { key: 'streak', icon: 'fire', tiers: [3, 7, 30], value: (s) => s.best_streak },
  { key: 'blitz', icon: 'timer', tiers: [10, 20, 30], value: (s) => s.blitz_best },
  { key: 'stickers', icon: 'album', tiers: [25, 100, 300], value: (s) => s.stickers },
];
const MEDAL = ['#5A4A8A', '#CD7F32', '#C0C8D8', '#FFC93C'];

function Badge({ b, s }: { b: (typeof BADGES)[number]; s: Stats }) {
  const v = b.value(s);
  const tier = b.tiers.filter((x) => v >= x).length;
  const next = b.tiers[tier];
  const prev = tier > 0 ? b.tiers[tier - 1]! : 0;
  const frac = next ? Math.min(1, (v - prev) / (next - prev)) : 1;
  return (
    <View style={styles.badge} accessible accessibilityLabel={`${t.badges[b.key]}: ${v}`}>
      <View style={[styles.medal, { borderColor: MEDAL[tier], backgroundColor: tier ? `${MEDAL[tier]}33` : 'rgba(255,255,255,0.05)' }]}>
        <View style={tier ? null : styles.locked}>
          <Icon name={b.icon} size={34} mono={tier === 0} />
        </View>
        {tier ? (
          <View style={[styles.stars, { backgroundColor: MEDAL[tier] }]}>
            <AppText variant="caption" color={palette.night950} style={styles.tiny}>
              {'★'.repeat(tier)}
            </AppText>
          </View>
        ) : null}
      </View>
      <AppText variant="caption" align="center" numberOfLines={1} style={styles.bold}>
        {t.badges[b.key]}
      </AppText>
      <View style={styles.bar}>
        <View style={[styles.barFill, { width: `${frac * 100}%`, backgroundColor: MEDAL[Math.min(tier + 1, 3)] }]} />
      </View>
      <AppText variant="caption" color={colors.textDim} align="center" numberOfLines={1} style={styles.tiny}>
        {next ? fmt(t.badgeNext, { n: next - v }) : t.badgeMax}
      </AppText>
    </View>
  );
}

export function StatsSection({ gender }: { gender?: 'male' | 'female' | 'other' | null }) {
  const { data: s } = useStats();
  const worlds = useWorldsConfig();
  const reduced = useReducedMotion();
  if (!s) return null;
  const pct = s.answered ? Math.round((s.correct / s.answered) * 100) : 0;
  const since = new Date(s.joined_at).toLocaleDateString('he-IL', { day: 'numeric', month: 'long', year: 'numeric' });
  const fav = s.worlds.find((w) => w.answered > 0);
  const favCfg = fav ? worlds.find((w) => w.slug === fav.world) : undefined;
  const byWorld = new Map(s.worlds.map((w) => [w.world, w]));
  const enter = (i: number) => (reduced ? undefined : FadeInDown.delay(80 * i).springify().damping(18));

  return (
    <>
      <Animated.View entering={enter(0)}>
        <Card padding={space.md} style={styles.gap}>
          <AppText variant="heading">{t.title}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {`${fmt(gx(t.since, gender), { date: since })} · ${fmt(t.days, { n: s.days_played })}`}
          </AppText>
          {s.answered === 0 ? (
            <AppText color={colors.textMuted} align="center" style={styles.empty}>
              {t.empty}
            </AppText>
          ) : (
            <View style={styles.hero}>
              <View style={styles.center}>
                <Ring pct={pct} />
                <AppText variant="caption" color={colors.textMuted}>
                  {t.accuracy}
                </AppText>
              </View>
              <View style={styles.minis}>
                <Mini label={t.answered} value={formatNumber(s.answered)} />
                <Mini label={t.correct} value={formatNumber(s.correct)} />
                <Mini label={t.levels} value={formatNumber(s.levels)} />
                <Mini label={t.stars} value={formatNumber(s.stars)} />
              </View>
            </View>
          )}
        </Card>
      </Animated.View>

      <Animated.View entering={enter(1)} style={styles.tiles}>
        <Tile icon="fire" value={String(s.best_streak)} label={t.bestStreak} tint={['#FF8A3D', '#C2185B']} />
        <Tile icon="timer" value={String(s.blitz_best)} label={t.blitzBest} tint={['#FF6B6B', '#8E3BD0']} />
        <Tile icon="trophy" value={String(s.match_wins + s.family_wins)} label={t.wins} tint={['#FFB000', '#D97706']} />
        <Tile icon="album" value={`${s.stickers}/${s.stickers_total}`} label={t.stickers} tint={['#3DDC84', '#14A3B8']} />
        <Tile icon="podium" value={String(s.perfect)} label={t.perfect} tint={['#5C7CFF', '#3E2A9A']} />
        <Tile icon="bolt" value={`${s.best_run}/10`} label={t.bestRun} tint={['#14A3B8', '#2F5FD0']} />
      </Animated.View>

      {fav && favCfg ? (
        <Animated.View entering={enter(2)}>
          <View style={[styles.fav, { borderColor: favCfg.color }]}>
            <LinearGradient colors={[`${favCfg.color}66`, 'rgba(20,10,50,0.6)']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
            {WORLD_IMAGES[favCfg.icon] ? <Image source={WORLD_IMAGES[favCfg.icon]!} style={styles.favImg} /> : null}
            <View style={styles.flex}>
              <AppText variant="caption" color={colors.textMuted}>
                {t.favorite}
              </AppText>
              <AppText variant="heading">{favCfg.name}</AppText>
              <AppText variant="caption" color={colors.text}>
                {fmt(t.worldLine, { levels: fav.levels, total: favCfg.levels, pct: fav.answered ? Math.round((fav.correct / fav.answered) * 100) : 0 })}
              </AppText>
            </View>
            <AppText style={styles.bigEmoji}>❤️</AppText>
          </View>
        </Animated.View>
      ) : null}

      <Animated.View entering={enter(3)}>
        <Card padding={space.md} style={styles.gap}>
          <AppText variant="heading">{t.badgesTitle}</AppText>
          <View style={styles.badges}>
            {BADGES.map((b) => (
              <Badge key={b.key} b={b} s={s} />
            ))}
          </View>
        </Card>
      </Animated.View>

      <Animated.View entering={enter(4)}>
        <Card padding={space.md} style={styles.gap}>
          <AppText variant="heading">{t.worldsTitle}</AppText>
          {worlds.map((w) => {
            const st = byWorld.get(w.slug);
            const frac = st ? Math.min(1, st.levels / w.levels) : 0;
            const medal = frac >= 1 ? '🥇' : frac >= 0.66 ? '🥈' : frac >= 0.33 ? '🥉' : '';
            const acc = st && st.answered ? Math.round((st.correct / st.answered) * 100) : 0;
            const img = WORLD_IMAGES[w.icon];
            return (
              <View key={w.slug} style={styles.worldRow}>
                {img ? <Image source={img} style={[styles.worldImg, !st && styles.dim]} /> : null}
                <View style={styles.flex}>
                  <View style={styles.rowBetween}>
                    <AppText variant="label" numberOfLines={1}>
                      {w.name}
                    </AppText>
                    <AppText>{medal}</AppText>
                  </View>
                  <View style={styles.bar}>
                    <View style={[styles.barFill, { width: `${frac * 100}%`, backgroundColor: w.color }]} />
                  </View>
                  <AppText variant="caption" color={colors.textMuted} numberOfLines={1}>
                    {st ? fmt(t.worldLine, { levels: st.levels, total: w.levels, pct: acc }) : t.worldEmpty}
                  </AppText>
                </View>
              </View>
            );
          })}
        </Card>
      </Animated.View>
    </>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.sm },
  flex: { flex: 1, gap: 2 },
  center: { alignItems: 'center', gap: space.xs },
  empty: { paddingVertical: space.md },
  hero: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  minis: { flex: 1, flexDirection: 'row', flexWrap: 'wrap', rowGap: space.sm },
  mini: { width: '50%', alignItems: 'center', gap: 2 },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'space-between' },
  tile: {
    width: '31.5%',
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.sm,
    paddingHorizontal: space.xs,
    borderRadius: 18,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.3)',
  },
  tileLabel: { fontFamily: 'IBMPlexSansHebrew_700Bold', color: colors.text },
  fav: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.md,
    borderRadius: 20,
    borderWidth: 2,
    overflow: 'hidden',
  },
  favImg: { width: 64, height: 64, borderRadius: 14 },
  bigEmoji: { fontSize: 30, lineHeight: 38 },
  badges: { flexDirection: 'row', flexWrap: 'wrap', rowGap: space.md },
  badge: { width: '33.33%', alignItems: 'center', gap: 4, paddingHorizontal: 4 },
  medal: { width: 62, height: 62, borderRadius: 31, borderWidth: 3, alignItems: 'center', justifyContent: 'center' },
  locked: { opacity: 0.5 },
  stars: { position: 'absolute', bottom: -8, paddingHorizontal: 6, borderRadius: 8 },
  tiny: { fontSize: 10, lineHeight: 13 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  bar: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  barFill: { height: '100%', borderRadius: 3 },
  worldRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 4 },
  worldImg: { width: 44, height: 44, borderRadius: 10 },
  dim: { opacity: 0.4 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
});
