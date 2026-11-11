import { levelFromXp } from '@fm/economy-config';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { Easing, ZoomIn, runOnJS, useAnimatedStyle, useSharedValue, withDelay, withSequence, withTiming } from 'react-native-reanimated';
import { AppText, SparkBurst } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, palette, space } from '@/design-system/tokens';
import { formatNumber, ltr } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';
import { rankTitle } from '@/lib/rank';

const t = strings.xp;

/** A slim level bar for the top bar: "רמה 7" and how full the level is. */
export function XpMini({ xp }: { xp: number }) {
  const { level, intoLevel, needed } = levelFromXp(Math.max(0, xp));
  const p = intoLevel / needed;
  const w = useSharedValue(p);
  useEffect(() => {
    w.value = withTiming(p, { duration: 700, easing: Easing.out(Easing.cubic) });
  }, [p, w]);
  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0.04, w.value) * 100}%` }));
  return (
    <View style={styles.mini} accessible accessibilityLabel={fmt(t.a11y, { level, n: intoLevel, total: needed })}>
      <AppText variant="caption" color={colors.led} style={styles.bold}>
        {fmt(t.levelShort, { n: level })}
      </AppText>
      <View style={styles.miniTrack}>
        <Animated.View style={[styles.miniFill, fill]} />
      </View>
    </View>
  );
}

/**
 * After a game: the level bar fills from where it was by the XP just earned. Crossing a level
 * fills to the end, bursts, and starts the next level from empty.
 */
export function XpGain({ before, gained }: { before: number; gained: number }) {
  const reduced = useReducedMotion();
  const start = levelFromXp(Math.max(0, before));
  const end = levelFromXp(Math.max(0, before + gained));
  const ups = end.level - start.level;
  const [level, setLevel] = useState(start.level);
  const [burst, setBurst] = useState(0);
  const w = useSharedValue(start.intoLevel / start.needed);

  useEffect(() => {
    const target = end.intoLevel / end.needed;
    const levelUp = (n: number) => {
      setLevel(n);
      setBurst((b) => b + 1);
      playSound('level_up');
      haptic('success');
    };
    if (reduced) {
      w.value = target;
      setLevel(end.level);
      return;
    }
    if (ups <= 0) {
      w.value = withDelay(600, withTiming(target, { duration: 900, easing: Easing.out(Easing.cubic) }));
      return;
    }
    // fill to the top, jump to the new level, then fill the rest
    w.value = withDelay(
      600,
      withSequence(
        withTiming(1, { duration: 700, easing: Easing.in(Easing.quad) }, (done) => {
          if (done) runOnJS(levelUp)(end.level);
        }),
        withTiming(0, { duration: 0 }),
        withTiming(target, { duration: 700, easing: Easing.out(Easing.cubic) }),
      ),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const fill = useAnimatedStyle(() => ({ width: `${Math.max(0.03, w.value) * 100}%` }));
  return (
    <View style={styles.gain} accessible accessibilityLabel={fmt(t.gainA11y, { n: gained, level: end.level })}>
      <View style={styles.gainHead}>
        <View style={styles.levelBadge}>
          {burst ? <SparkBurst key={burst} count={12} radius={60} /> : null}
          <Animated.View key={level} entering={reduced ? undefined : ZoomIn.springify().damping(8)}>
            <AppText variant="heading" color={colors.textOnBright} style={styles.bold}>
              {level}
            </AppText>
          </Animated.View>
        </View>
        <View style={styles.flex}>
          <AppText variant="label" style={styles.bold}>
            {burst ? fmt(t.levelUp, { n: level }) : fmt(t.levelLine, { n: level, rank: rankTitle(level) })}
          </AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {fmt(t.toNext, { n: formatNumber(Math.max(0, end.needed - end.intoLevel)), next: end.level + 1 })}
          </AppText>
        </View>
        <AppText variant="label" color={colors.correct} style={styles.bold}>
          {ltr(`+${formatNumber(gained)} XP`)}
        </AppText>
      </View>
      <View style={styles.track}>
        <Animated.View style={[styles.fill, fill]} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  flex: { flex: 1 },
  mini: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  miniTrack: { width: 56, height: 6, borderRadius: 3, backgroundColor: palette.night950, overflow: 'hidden' },
  miniFill: { height: 6, borderRadius: 3, backgroundColor: colors.led },
  gain: { alignSelf: 'stretch', gap: space.sm },
  gainHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  levelBadge: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.led,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 3,
    borderColor: '#FFE08A',
  },
  track: { height: 14, borderRadius: 7, backgroundColor: palette.night950, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.15)' },
  fill: { height: '100%', borderRadius: 7, backgroundColor: colors.correct },
});
