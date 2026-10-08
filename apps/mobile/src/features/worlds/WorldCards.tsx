import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown } from 'react-native-reanimated';
import { AppText } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { usePlaySession } from '@/features/engage/EnergySheet';
import { fmt, strings } from '@/lib/i18n';
import { MIX_WORLD, useWorldsConfig, useWorldsState } from './api';
import { shade } from './worldArt';
import { WorldBadge } from './WorldBadge';

const t = strings.worlds;

/** Big "quick play" banner: 10 mixed questions from every world. */
export function QuickPlayCard() {
  const play = usePlaySession();
  return (
    <Pressable onPress={() => play('mix')} accessibilityRole="button" accessibilityLabel={t.quickPlay} style={({ pressed }) => [styles.quick, pressed && styles.pressed]}>
      <LinearGradient colors={['#FFC53D', '#FF8A3D']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
      <WorldBadge icon={MIX_WORLD.icon} color="#FF6B2C" size={72} />
      <View style={styles.flex}>
        <AppText variant="title" color={colors.textOnBright}>
          {t.quickPlay}
        </AppText>
        <AppText variant="bodyStrong" color={colors.textOnBright}>
          {t.quickPlayBody}
        </AppText>
      </View>
      <Ionicons name="play-circle" size={48} color={colors.textOnBright} />
    </Pressable>
  );
}

/** The grid of knowledge worlds with each one's progress. */
export function WorldsGrid() {
  const worlds = useWorldsConfig();
  const { data } = useWorldsState();
  const reduced = useReducedMotion();
  return (
    <View style={styles.grid}>
      {worlds.map((w, i) => {
        const st = data?.worlds.find((x) => x.slug === w.slug);
        const passed = st ? Object.values(st.stars).filter((n) => n > 0).length : 0;
        return (
          <Animated.View key={w.slug} entering={reduced ? undefined : FadeInDown.delay(40 * i).springify().damping(16)} style={styles.cell}>
            <Pressable
              onPress={() => router.push({ pathname: '/world/[slug]', params: { slug: w.slug } })}
              accessibilityRole="button"
              accessibilityLabel={`${w.name}, ${fmt(t.progress, { n: passed })}`}
              style={({ pressed }) => [styles.world, { backgroundColor: shade(w.color, -0.55), borderColor: shade(w.color, -0.2) }, pressed && styles.pressed]}
            >
              <WorldBadge icon={w.icon} color={w.color} size={62} />
              <AppText variant="heading" align="center" numberOfLines={1}>
                {w.name}
              </AppText>
              <View style={styles.track}>
                <View style={[styles.fill, { width: `${(passed / Math.max(1, w.levels)) * 100}%`, backgroundColor: w.color }]} />
              </View>
              <View style={styles.meta}>
                <AppText variant="caption" color={colors.textMuted}>
                  {fmt(t.level, { n: st?.unlocked ?? 1 })}
                </AppText>
                <View style={styles.starCount}>
                  <Ionicons name="star" size={12} color={colors.led} />
                  <AppText variant="caption" color={colors.led}>
                    {st?.total_stars ?? 0}
                  </AppText>
                </View>
              </View>
            </Pressable>
          </Animated.View>
        );
      })}
    </View>
  );
}

/** A horizontal strip of world badges (home screen). */
export function WorldsStrip() {
  const worlds = useWorldsConfig();
  const { data } = useWorldsState();
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.strip}>
      {worlds.map((w) => {
        const st = data?.worlds.find((x) => x.slug === w.slug);
        return (
          <Pressable
            key={w.slug}
            onPress={() => router.push({ pathname: '/world/[slug]', params: { slug: w.slug } })}
            accessibilityRole="button"
            accessibilityLabel={w.name}
            style={({ pressed }) => [styles.stripItem, pressed && styles.pressed]}
          >
            <WorldBadge icon={w.icon} color={w.color} size={58} />
            <AppText variant="caption" align="center" numberOfLines={1} style={styles.stripName}>
              {w.name}
            </AppText>
            <View style={styles.starCount}>
              <Ionicons name="star" size={11} color={colors.led} />
              <AppText variant="caption" color={colors.led}>
                {st?.total_stars ?? 0}
              </AppText>
            </View>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  strip: { gap: space.md, paddingVertical: space.xs },
  stripItem: { width: 70, alignItems: 'center', gap: 2 },
  stripName: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  flex: { flex: 1 },
  pressed: { transform: [{ scale: 0.97 }] },
  quick: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    padding: space.lg,
    borderRadius: 24,
    overflow: 'hidden',
    borderBottomWidth: 6,
    borderBottomColor: '#C2571A',
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.md },
  cell: { width: '48%' },
  world: {
    alignItems: 'center',
    gap: 6,
    padding: space.md,
    borderRadius: 22,
    borderWidth: 2,
    borderBottomWidth: 6,
  },
  track: { alignSelf: 'stretch', height: 6, borderRadius: 3, backgroundColor: palette.night950, overflow: 'hidden' },
  fill: { height: 6, borderRadius: 3 },
  meta: { alignSelf: 'stretch', flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  starCount: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  row: { flexDirection: 'row', gap: space.md },
  mini: {
    flex: 1,
    alignItems: 'center',
    gap: space.xs,
    padding: space.md,
    borderRadius: radius.card,
    overflow: 'hidden',
    borderWidth: 3,
    borderColor: palette.night950,
  },
});
