import { Ionicons } from '@expo/vector-icons';
import { type ComponentProps, useEffect } from 'react';
import { ActivityIndicator, Image, Pressable, StyleSheet, View } from 'react-native';
import type { QuestionPhoto } from '@fm/shared';
import Animated, { FadeInDown, useAnimatedStyle, useSharedValue, withSequence, withSpring, withTiming, ZoomIn } from 'react-native-reanimated';
import { AppText, Led, SparkBurst } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, radius, space } from '@/design-system/tokens';

/* ------------------------------------------------------------------ */
/* Answer tile                                                         */
/* ------------------------------------------------------------------ */

/** Wikimedia asks apps that load its files to identify themselves. */
const PHOTO_UA = 'HaAlufTrivia/1.0 (Android; https://github.com/IgorKarpivsski/MillionereApp)';

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
  idle: { bg: 'rgba(44,28,108,0.88)', border: colors.border, bw: 1.5, text: colors.text, opacity: 1 },
  removed: { bg: colors.board, border: 'transparent', bw: 1.5, text: 'transparent', opacity: 0.3 },
  overturned: { bg: colors.board, border: colors.dangerLip, bw: 2, text: colors.textDim, opacity: 0.6 },
  // waiting for the server's verdict: a neutral white outline, so the first colour the player sees is the real one (green/red)
  picked: { bg: 'rgba(255,255,255,0.14)', border: '#FFFFFF', bw: 2.5, text: colors.text, opacity: 1 },
  correctPicked: { bg: 'rgba(30,158,90,0.55)', border: colors.correct, bw: 2.5, text: colors.text, opacity: 1 },
  correctMissed: { bg: 'rgba(30,158,90,0.25)', border: colors.correct, bw: 2.5, text: colors.text, opacity: 1 },
  wrongPicked: { bg: 'rgba(184,50,42,0.5)', border: colors.danger, bw: 2.5, text: colors.text, opacity: 1 },
  dim: { bg: colors.board, border: colors.border, bw: 1.5, text: colors.textDim, opacity: 0.55 },
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
  image,
}: {
  fill?: boolean;
  /** a picture answer: the photo is the answer; its name shows only once the answer is revealed */
  image?: QuestionPhoto | null;
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
  // the verdict moves: a right pick pops, a wrong pick shakes
  const scale = useSharedValue(1);
  const shake = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    if (state === 'correctPicked') scale.value = withSequence(withSpring(1.08, { damping: 6, stiffness: 300 }), withSpring(1));
    if (state === 'wrongPicked') {
      shake.value = withSequence(
        withTiming(-10, { duration: 50 }),
        withTiming(10, { duration: 70 }),
        withTiming(-7, { duration: 60 }),
        withTiming(5, { duration: 60 }),
        withTiming(0, { duration: 50 }),
      );
    }
  }, [state, reduced, scale, shake]);
  const motion = useAnimatedStyle(() => ({ transform: [{ scale: scale.value }, { translateX: shake.value }] }));
  return (
    <Animated.View
      entering={reduced ? undefined : FadeInDown.delay(80 + index * 70).springify().damping(16)}
      style={[fill ? styles.fill : styles.tileWrap, motion]}
    >
      {state === 'correctPicked' ? <SparkBurst count={12} radius={110} /> : null}
      <Pressable
        onPress={onPress}
        disabled={disabled || hidden || state === 'overturned'}
        accessibilityRole="button"
        accessibilityLabel={
          hidden
            ? 'תשובה שהוסרה'
            : `תשובה ${index + 1}: ${image && state === 'idle' ? 'תמונה' : text}${
                state === 'correctPicked' ? ', נכון!' : state === 'correctMissed' ? ', זו התשובה הנכונה' : state === 'wrongPicked' ? ', לא נכון' : state === 'overturned' ? ', נפסלה' : ''
              }`
        }
        accessibilityState={{ disabled: disabled || hidden, selected: state === 'picked' }}
        style={({ pressed }) => [
          styles.tile,
          fill && !image && styles.tileRow,
          image ? styles.picTile : null,
          { backgroundColor: l.bg, borderColor: l.border, borderWidth: l.bw, opacity: l.opacity },
          pressed && !disabled ? styles.pressed : null,
        ]}
      >
        {hidden ? null : image ? (
          <>
            <View style={styles.picFrame}>
              <Image source={{ uri: image.url, headers: { 'User-Agent': PHOTO_UA } }} style={StyleSheet.absoluteFill} resizeMode="cover" blurRadius={14} accessible={false} />
              <Image source={{ uri: image.url, headers: { 'User-Agent': PHOTO_UA } }} style={StyleSheet.absoluteFill} resizeMode="contain" accessible={false} />
            </View>
            <View style={[styles.numBadge, styles.numOnPic, { borderColor: l.border }]}>
              <AppText variant="caption" color={l.text} style={styles.numText}>
                {index + 1}
              </AppText>
            </View>
            {state === 'correctPicked' || state === 'correctMissed' || state === 'wrongPicked' || state === 'dim' ? (
              <Animated.View entering={reduced ? undefined : FadeInDown} style={styles.picName}>
                {state === 'wrongPicked' ? <Ionicons name="close-circle" size={18} color={colors.danger} /> : null}
                {state === 'correctPicked' || state === 'correctMissed' ? <Ionicons name="checkmark-circle" size={18} color={colors.correct} /> : null}
                <AppText variant="caption" color={colors.text} numberOfLines={1} style={styles.numText}>
                  {text}
                </AppText>
              </Animated.View>
            ) : null}
          </>
        ) : (
          <>
            <View style={[styles.numBadge, { borderColor: l.border }]}>
              <AppText variant="caption" color={l.text} style={styles.numText}>
                {index + 1}
              </AppText>
            </View>
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
            {state === 'correctPicked' || state === 'correctMissed' ? (
              <Animated.View entering={reduced ? undefined : ZoomIn.springify()}>
                <Ionicons name="checkmark-circle" size={24} color={colors.correct} />
              </Animated.View>
            ) : null}
            {state === 'wrongPicked' ? <Ionicons name="close-circle" size={24} color={colors.danger} /> : null}
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
  picTile: { padding: 3, minHeight: 0, aspectRatio: 1.25, overflow: 'hidden' },
  picFrame: { ...StyleSheet.absoluteFillObject, margin: 3, borderRadius: radius.control - 3, overflow: 'hidden', backgroundColor: '#1B1240' },
  numOnPic: { backgroundColor: 'rgba(14,8,38,0.75)' },
  picName: {
    position: 'absolute',
    bottom: 3,
    start: 3,
    end: 3,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
    paddingVertical: 4,
    paddingHorizontal: 6,
    borderBottomLeftRadius: radius.control - 3,
    borderBottomRightRadius: radius.control - 3,
    backgroundColor: 'rgba(14,8,38,0.82)',
  },
  fill: { width: '100%' },
  tile: {
    minHeight: 88,
    borderRadius: radius.control + 2,
    alignItems: 'center',
    justifyContent: 'center',
    // room for the number badge on the reading side, so long answers never run under it
    paddingHorizontal: 32,
    paddingVertical: space.sm,
    gap: 4,
  },
  tileText: { fontFamily: 'IBMPlexSansHebrew_700Bold', fontSize: 17, lineHeight: 23 },
  tileRow: { minHeight: 58, paddingHorizontal: space.xl + space.md, borderBottomWidth: 5 },
  pressed: { transform: [{ scale: 0.97 }] },
  numBadge: {
    position: 'absolute',
    top: 6,
    start: 6,
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numText: { fontFamily: 'IBMPlexSansHebrew_700Bold', lineHeight: 16 },
  struck: { textDecorationLine: 'line-through' },
  expertBadge: {
    position: 'absolute',
    top: 6,
    end: 6,
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
