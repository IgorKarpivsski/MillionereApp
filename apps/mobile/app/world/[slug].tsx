import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useMemo, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import Animated, { useAnimatedStyle, useSharedValue, withRepeat, withSequence, withTiming, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Path } from 'react-native-svg';
import { AppText, BottomSheet, StickerButton } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { usePlaySession } from '@/features/engage/EnergySheet';
import { useWorldsConfig, useWorldsState, worldBySlug } from '@/features/worlds/api';
import { shade } from '@/features/worlds/worldArt';
import { WorldBadge } from '@/features/worlds/WorldBadge';
import { fmt, strings } from '@/lib/i18n';
import { physicalLeft } from '@/lib/rtl';

const t = strings.worlds;
const STEP = 104; // vertical distance between level nodes
const NODE = 70;

function Stars({ n, size = 14 }: { n: number; size?: number }) {
  return (
    <View style={styles.stars}>
      {[1, 2, 3].map((i) => (
        <Ionicons key={i} name="star" size={size} color={i <= n ? colors.led : palette.night600} />
      ))}
    </View>
  );
}

function Pulse({ color }: { color: string }) {
  const reduced = useReducedMotion();
  const v = useSharedValue(1);
  useEffect(() => {
    if (reduced) return;
    v.value = withRepeat(withSequence(withTiming(1.18, { duration: 700 }), withTiming(1, { duration: 700 })), -1);
  }, [reduced, v]);
  const st = useAnimatedStyle(() => ({ transform: [{ scale: v.value }], opacity: 2 - v.value * 1.2 }));
  return <Animated.View style={[styles.pulse, { borderColor: color }, st]} />;
}

export default function WorldScreen() {
  const { slug } = useLocalSearchParams<{ slug: string }>();
  const worlds = useWorldsConfig();
  const w = worldBySlug(worlds, slug);
  const { data } = useWorldsState();
  const play = usePlaySession();
  const { width } = useWindowDimensions();
  const scroll = useRef<ScrollView>(null);
  const [sheet, setSheet] = useState<number | null>(null);
  const st = data?.worlds.find((x) => x.slug === slug);
  const unlocked = st?.unlocked ?? 1;
  const stars = st?.stars ?? {};
  const levels = w.levels;
  const passed = Object.values(stars).filter((n) => n > 0).length;

  const pos = useMemo(() => {
    const amp = Math.min(110, width / 2 - NODE);
    return Array.from({ length: levels }, (_, i) => ({ x: width / 2 + Math.sin(i * 0.95) * amp - NODE / 2, y: 40 + i * STEP }));
  }, [levels, width]);

  // Dotted road through the node centres (physical coordinates; nodes are placed with physicalLeft).
  const road = useMemo(() => {
    if (!pos.length) return '';
    const pts = pos.map((p) => ({ x: p.x + NODE / 2, y: p.y + NODE / 2 }));
    let d = `M${pts[0]!.x} ${pts[0]!.y}`;
    for (let i = 1; i < pts.length; i++) {
      const a = pts[i - 1]!, b = pts[i]!;
      const my = (a.y + b.y) / 2;
      d += ` C${a.x} ${my} ${b.x} ${my} ${b.x} ${b.y}`;
    }
    return d;
  }, [pos, width]);

  useEffect(() => {
    if (!data) return;
    const y = Math.max(0, 40 + (unlocked - 1) * STEP - 220);
    const id = setTimeout(() => scroll.current?.scrollTo({ y, animated: true }), 350);
    return () => clearTimeout(id);
  }, [data, unlocked]);

  const total = 40 + levels * STEP + 40;
  const sheetStars = sheet ? (stars[String(sheet)] ?? 0) : 0;

  return (
    <SafeAreaView style={styles.root} edges={['top']}>
      <LinearGradient colors={[shade(w.color, -0.35), colors.bg]} style={styles.glow} />
      <View style={styles.header}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <Ionicons name="arrow-forward" size={26} color={colors.text} />
        </Pressable>
        <WorldBadge icon={w.icon} color={w.color} size={52} />
        <View style={styles.flex}>
          <AppText variant="heading">{w.name}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {fmt(t.progress, { n: passed })} · {fmt(t.starsOf, { n: st?.total_stars ?? 0, total: levels * 3 })}
          </AppText>
        </View>
      </View>
      <View style={styles.barTrack}>
        <View style={[styles.barFill, { width: `${(passed / Math.max(1, levels)) * 100}%`, backgroundColor: w.color }]} />
      </View>

      <ScrollView ref={scroll} contentContainerStyle={{ height: total }} showsVerticalScrollIndicator={false}>
        <Svg width={width} height={total} style={StyleSheet.absoluteFill}>
          <Path d={road} stroke={shade(w.color, -0.15)} strokeWidth={10} strokeLinecap="round" strokeDasharray="2 18" fill="none" />
        </Svg>
        {pos.map((p, i) => {
          const lvl = i + 1;
          const s = stars[String(lvl)] ?? 0;
          const open = lvl <= unlocked;
          const current = lvl === unlocked && s === 0;
          const chest = lvl % 5 === 0;
          const face = open ? (s > 0 ? w.color : shade(w.color, 0.25)) : '#4B3F86';
          return (
            <View key={lvl} style={[styles.nodeWrap, { top: p.y }, physicalLeft(p.x, NODE, width)]}>
              {current ? <Pulse color={w.color} /> : null}
              <Pressable
                onPress={() => setSheet(lvl)}
                accessibilityRole="button"
                accessibilityLabel={`${fmt(t.level, { n: lvl })}${open ? `, ${s} כוכבים` : ', נעול'}`}
                style={({ pressed }) => [
                  styles.node,
                  { backgroundColor: face, borderBottomColor: open ? shade(w.color, -0.4) : '#2E2563' },
                  pressed && styles.pressed,
                ]}
              >
                {!open ? (
                  <Ionicons name="lock-closed" size={26} color="#9C92CC" />
                ) : chest ? (
                  <Ionicons name="gift" size={30} color={colors.textOnBright} />
                ) : (
                  <AppText variant="heading" color={colors.textOnBright} style={styles.nodeNum}>
                    {lvl}
                  </AppText>
                )}
              </Pressable>
              {open && !current ? <Stars n={s} /> : null}
              {current ? (
                <Animated.View entering={ZoomIn} style={[styles.here, { backgroundColor: colors.led }]}>
                  <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
                    {t.play}
                  </AppText>
                </Animated.View>
              ) : null}
            </View>
          );
        })}
      </ScrollView>

      <BottomSheet visible={sheet !== null} onClose={() => setSheet(null)} title={sheet ? fmt(t.levelOf, { n: sheet, total: levels }) : ''}>
        {sheet !== null ? (
          <View style={styles.sheet}>
            <Stars n={sheetStars} size={30} />
            <AppText color={colors.textMuted} align="center">
              {sheet <= unlocked ? t.rules : t.locked}
            </AppText>
            {sheet % 5 === 0 ? (
              <AppText variant="label" color={colors.led} align="center">
                🎁 {t.chestHint}
              </AppText>
            ) : null}
            <StickerButton
              label={sheet <= unlocked ? (sheetStars ? t.replay : t.play) : t.locked.split('.')[0]!}
              icon={sheet <= unlocked ? 'play' : 'lock-closed'}
              size="lg"
              fullWidth
              disabled={sheet > unlocked}
              onPress={() => {
                const lvl = sheet;
                setSheet(null);
                play(w.slug, lvl);
              }}
            />
          </View>
        ) : null}
      </BottomSheet>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  glow: { position: 'absolute', top: 0, left: 0, right: 0, height: 300 },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  header: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.md, paddingTop: space.sm },
  barTrack: { height: 8, borderRadius: 4, backgroundColor: palette.night950, marginHorizontal: space.md, marginTop: space.sm, overflow: 'hidden' },
  barFill: { height: 8, borderRadius: 4 },
  nodeWrap: { position: 'absolute', width: NODE, alignItems: 'center' },
  node: {
    width: NODE,
    height: NODE,
    borderRadius: NODE / 2,
    alignItems: 'center',
    justifyContent: 'center',
    borderBottomWidth: 7,
  },
  nodeNum: { fontSize: 24, lineHeight: 30 },
  pressed: { transform: [{ translateY: 3 }] },
  pulse: { position: 'absolute', top: -8, width: NODE + 16, height: NODE + 16, borderRadius: (NODE + 16) / 2, borderWidth: 4 },
  stars: { flexDirection: 'row', gap: 1, marginTop: 2 },
  here: { marginTop: 4, paddingHorizontal: space.md, paddingVertical: 2, borderRadius: radius.chip },
  sheet: { alignItems: 'center', gap: space.md },
});
