import { Ionicons } from '@expo/vector-icons';
import type { ComponentProps } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import Animated, { FadeInDown, ZoomIn } from 'react-native-reanimated';
import { AppText, Led } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, radius, space } from '@/design-system/tokens';

/* ------------------------------------------------------------------ */
/* Answer tile                                                         */
/* ------------------------------------------------------------------ */

export type AnswerState =
  | 'idle'
  | 'removed' // hidden by 50:50
  | 'overturned' // a wrong pick VAR struck out
  | 'picked' // locked in, waiting for the referee
  | 'correctPicked'
  | 'correctMissed' // the right answer, shown after a wrong pick / timeout
  | 'wrongPicked'
  | 'dim';

const look: Record<AnswerState, { bg: string; border: string; bw: number; text: string; opacity: number }> = {
  idle: { bg: colors.board, border: colors.border, bw: 2, text: colors.text, opacity: 1 },
  removed: { bg: colors.board, border: colors.board, bw: 2, text: colors.board, opacity: 0.35 },
  overturned: { bg: colors.board, border: colors.dangerLip, bw: 2, text: colors.textDim, opacity: 0.6 },
  picked: { bg: colors.board, border: colors.led, bw: 3, text: colors.text, opacity: 1 },
  correctPicked: { bg: colors.correctFill, border: colors.correct, bw: 3, text: colors.text, opacity: 1 },
  correctMissed: { bg: colors.board, border: colors.correct, bw: 3, text: colors.text, opacity: 1 },
  wrongPicked: { bg: '#4A1612', border: colors.danger, bw: 3, text: colors.text, opacity: 1 },
  dim: { bg: colors.board, border: colors.border, bw: 2, text: colors.textDim, opacity: 0.55 },
};

export function AnswerTile({
  index,
  text,
  state,
  fansPct,
  expertPick,
  disabled,
  onPress,
  fill = false,
}: {
  fill?: boolean;
  index: number;
  text: string;
  state: AnswerState;
  fansPct?: number;
  expertPick?: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const reduced = useReducedMotion();
  const l = look[state];
  const hidden = state === 'removed';
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(80 + index * 70).springify().damping(16)}
      style={fill ? styles.fill : styles.tileWrap}
    >
      <Pressable
        onPress={onPress}
        disabled={disabled || hidden || state === 'overturned'}
        accessibilityRole="button"
        accessibilityLabel={hidden ? 'תשובה שהוסרה' : text}
        accessibilityState={{ disabled: disabled || hidden, selected: state === 'picked' }}
        style={({ pressed }) => [
          styles.tile,
          { backgroundColor: l.bg, borderColor: l.border, borderWidth: l.bw, opacity: l.opacity },
          pressed && !disabled ? styles.pressed : null,
        ]}
      >
        {hidden ? null : (
          <>
            <AppText
              variant="bodyStrong"
              color={l.text}
              align="center"
              numberOfLines={3}
              adjustsFontSizeToFit
              style={[styles.tileText, state === 'overturned' && styles.struck]}
            >
              {text}
            </AppText>
            {state === 'correctPicked' ? (
              <Animated.View entering={reduced ? undefined : ZoomIn.springify()}>
                <Led size="ledS" color={colors.correct}>
                  GOAL +1
                </Led>
              </Animated.View>
            ) : null}
            {state === 'wrongPicked' ? <Ionicons name="close-circle" size={18} color={colors.danger} /> : null}
            {expertPick ? (
              <View style={styles.expertBadge}>
                <Ionicons name="mic" size={12} color={colors.textOnBright} />
              </View>
            ) : null}
            {fansPct !== undefined ? (
              <View style={styles.fans}>
                <View style={styles.fansTrack}>
                  <View style={[styles.fansFill, { width: `${fansPct}%` }]} />
                </View>
                <Led size="ledS" color={colors.gem}>
                  {`${fansPct}%`}
                </Led>
              </View>
            ) : null}
          </>
        )}
      </Pressable>
    </Animated.View>
  );
}

/* ------------------------------------------------------------------ */
/* Lifeline button                                                     */
/* ------------------------------------------------------------------ */

export function LifelineButton({
  label,
  icon,
  used,
  armed,
  busy,
  disabled,
  onPress,
}: {
  label: string;
  icon: ComponentProps<typeof Ionicons>['name'];
  used: boolean;
  armed?: boolean;
  busy: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const tint = armed ? colors.led : used ? colors.textDim : colors.text;
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled || used}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: disabled || used }}
      style={({ pressed }) => [
        styles.life,
        armed && styles.lifeArmed,
        used && !armed && styles.lifeUsed,
        pressed && !used ? styles.pressed : null,
      ]}
    >
      {busy ? <ActivityIndicator color={colors.led} /> : <Ionicons name={icon} size={20} color={tint} />}
      <AppText variant="label" color={tint} numberOfLines={1} style={used && !armed ? styles.struck : null}>
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  tileWrap: { width: '48.5%' },
  fill: { width: '100%' },
  tile: {
    minHeight: 88,
    borderRadius: radius.control + 2,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.sm,
    paddingVertical: space.sm,
    gap: 4,
  },
  tileText: { fontFamily: 'IBMPlexSansHebrew_700Bold', fontSize: 17, lineHeight: 23 },
  pressed: { transform: [{ scale: 0.97 }] },
  struck: { textDecorationLine: 'line-through' },
  expertBadge: {
    position: 'absolute',
    top: 6,
    start: 6,
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: colors.led,
    alignItems: 'center',
    justifyContent: 'center',
  },
  fans: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'stretch' },
  fansTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: colors.border, overflow: 'hidden' },
  fansFill: { height: 6, backgroundColor: colors.gem },
  life: {
    flex: 1,
    height: 60,
    borderRadius: radius.board - 2,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: colors.board,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  lifeArmed: { borderColor: colors.led },
  lifeUsed: { opacity: 0.45 },
});
