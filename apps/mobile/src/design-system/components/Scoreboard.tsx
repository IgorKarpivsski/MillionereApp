import { useEffect, useState, type ReactNode } from 'react';
import { StyleSheet, View, type StyleProp, type TextStyle, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from 'react-native-reanimated';
import Svg, { Circle } from 'react-native-svg';
import { useReducedMotion } from '../feedback/reducedMotion';
import { colors, radius, space, type TextVariant } from '../tokens';
import { AppText } from './AppText';
import { Icon, type IconName } from '../icons/Icon';

/* ------------------------------------------------------------------ */
/* Logo                                                                */
/* ------------------------------------------------------------------ */

/** The "האלוף" mark: a trophy drawn from scoreboard LED dots. Original art. */
const TROPHY_DOTS: ReadonlyArray<[number, number]> = [
  [30, 20], [46, 20], [62, 20], [78, 20], [94, 20], [110, 20],
  [14, 36], [30, 36], [46, 36], [62, 36], [78, 36], [94, 36], [110, 36], [126, 36],
  [14, 52], [46, 52], [62, 52], [78, 52], [94, 52], [126, 52],
  [30, 68], [46, 68], [62, 68], [78, 68], [94, 68], [110, 68],
  [62, 84], [78, 84],
  [62, 100], [78, 100],
  [46, 116], [62, 116], [78, 116], [94, 116],
];

export function TrophyLogo({ size = 96, color = colors.led }: { size?: number; color?: string }) {
  return (
    <Svg width={size} height={size * (124 / 140)} viewBox="0 8 140 124" accessibilityLabel="הלוגו של האלוף">
      {TROPHY_DOTS.map(([x, y]) => (
        <Circle key={`${x}-${y}`} cx={x} cy={y} r={6} fill={color} />
      ))}
    </Svg>
  );
}

/* ------------------------------------------------------------------ */
/* LED digits                                                          */
/* ------------------------------------------------------------------ */

/** Scoreboard digits. Digits/Latin only — the LED face has no Hebrew glyphs. */
export function Led({
  children,
  size = 'number',
  color = colors.led,
  style,
}: {
  children: ReactNode;
  size?: Extract<TextVariant, 'number' | 'ledS' | 'ledM' | 'ledL' | 'ledXL'>;
  color?: string;
  style?: StyleProp<TextStyle>;
}) {
  return (
    <AppText variant={size} color={color} style={[{ writingDirection: 'ltr' }, style]}>
      {children}
    </AppText>
  );
}

/* ------------------------------------------------------------------ */
/* Score line: "אתה  3 : 1  האלוף"                                       */
/* ------------------------------------------------------------------ */

export function ScoreLine({
  you,
  them,
  youLabel = 'אתה',
  themLabel = 'האלוף',
  size = 'ledL',
  color = colors.led,
}: {
  you: number;
  them: number;
  youLabel?: string;
  themLabel?: string;
  size?: 'ledM' | 'ledL' | 'ledXL';
  color?: string;
}) {
  return (
    <View
      style={styles.scoreRow}
      accessible
      accessibilityLabel={`${youLabel} ${you}, ${themLabel} ${them}`}
    >
      <AppText variant="label">{youLabel}</AppText>
      {/* RTL row: first digit sits next to "you" on the right. */}
      <View style={styles.scoreDigits}>
        <Led size={size} color={color}>{you}</Led>
        <Led size={size} color={color}>:</Led>
        <Led size={size} color={color}>{them}</Led>
      </View>
      <AppText variant="label">{themLabel}</AppText>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Stat tile                                                           */
/* ------------------------------------------------------------------ */

export function StatTile({
  value,
  label,
  color = colors.text,
  icon,
}: {
  value: string;
  label: string;
  color?: string;
  icon?: IconName;
}) {
  return (
    <View style={styles.tile} accessible accessibilityLabel={`${label}: ${value}`}>
      {icon ? <Icon name={icon} size={30} /> : null}
      <Led size="ledM" color={color}>{value}</Led>
      <AppText variant="caption" color={colors.textDim} align="center" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* LIVE ticker                                                         */
/* ------------------------------------------------------------------ */

const TICKER_EVERY_MS = 3800;

/**
 * Scoreboard "LIVE" strip: one line at a time, the next one sliding in like
 * a stadium board. With Reduced Motion the lines still change, without motion.
 */
export function LiveTicker({ items, style }: { items: readonly string[]; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const enter = useSharedValue(1);

  useEffect(() => {
    if (items.length < 2) return;
    const id = setInterval(() => setI((n) => (n + 1) % items.length), TICKER_EVERY_MS);
    return () => clearInterval(id);
  }, [items.length]);

  useEffect(() => {
    if (reduced) {
      enter.value = 1;
      return;
    }
    enter.value = 0;
    enter.value = withTiming(1, { duration: 360, easing: Easing.out(Easing.cubic) });
    return () => cancelAnimation(enter);
  }, [i, reduced, enter]);

  const line = useAnimatedStyle(() => ({
    opacity: enter.value,
    transform: [{ translateX: (1 - enter.value) * -18 }],
  }));

  return (
    <View style={[styles.ticker, style]} accessible accessibilityLabel={items.join('. ')}>
      <View style={styles.liveDot} />
      <Led size="ledS" style={styles.live}>LIVE</Led>
      <Animated.View style={[styles.tickerLine, line]}>
        <AppText variant="label" numberOfLines={1}>
          {items[i] ?? ''}
        </AppText>
      </Animated.View>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Countdown to local midnight (daily reset)                           */
/* ------------------------------------------------------------------ */

function pad(n: number) {
  return n.toString().padStart(2, '0');
}

export function useCountdownToMidnight(): string {
  const calc = () => {
    const now = new Date();
    const end = new Date(now);
    end.setHours(24, 0, 0, 0);
    const s = Math.max(0, Math.floor((end.getTime() - now.getTime()) / 1000));
    return `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`;
  };
  const [v, setV] = useState(calc);
  useEffect(() => {
    const id = setInterval(() => setV(calc()), 1000);
    return () => clearInterval(id);
  }, []);
  return v;
}

const styles = StyleSheet.create({
  scoreRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.md },
  scoreDigits: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  tile: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.md,
    paddingHorizontal: space.xs,
    borderRadius: radius.board,
    backgroundColor: colors.board,
  },
  ticker: {
    height: 34,
    borderRadius: 8,
    backgroundColor: colors.board,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.md,
    gap: space.md,
    overflow: 'hidden',
  },
  live: { lineHeight: 18 },
  liveDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.danger },
  tickerLine: { flex: 1 },
});
