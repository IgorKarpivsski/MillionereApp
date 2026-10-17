import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Modal, Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
import Animated, {
  Easing,
  FadeIn,
  FadeInDown,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { create } from 'zustand';
import { AppText, Sloth, StickerButton } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { fmt, gx, strings } from '@/lib/i18n';

type Rect = { x: number; y: number; w: number; h: number };

interface TourStore {
  targets: Record<string, Rect>;
  /** bumps whenever targets should measure themselves again */
  tick: number;
  setTarget: (id: string, r: Rect) => void;
  remeasure: () => void;
}

export const useTourStore = create<TourStore>((set) => ({
  targets: {},
  tick: 0,
  setTarget: (id, r) => set((s) => ({ targets: { ...s.targets, [id]: r } })),
  remeasure: () => set((s) => ({ tick: s.tick + 1 })),
}));

/** Marks something the tour can point at. */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: ViewStyle }) {
  const ref = useRef<View>(null);
  const setTarget = useTourStore((s) => s.setTarget);
  const tick = useTourStore((s) => s.tick);
  const measure = () =>
    ref.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) setTarget(id, { x, y, w, h });
    });
  useEffect(() => {
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  return (
    <View ref={ref} collapsable={false} onLayout={measure} style={style}>
      {children}
    </View>
  );
}

const t = strings.tour;

interface Step {
  target?: string;
  text: string;
}

function Arrow({ down }: { down: boolean }) {
  const reduced = useReducedMotion();
  const y = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    y.value = withRepeat(withSequence(withTiming(1, { duration: 450, easing: Easing.inOut(Easing.quad) }), withTiming(0, { duration: 450 })), -1);
  }, [reduced, y]);
  const s = useAnimatedStyle(() => ({ transform: [{ translateY: (down ? 8 : -8) * y.value }] }));
  return (
    <Animated.View style={s}>
      <Ionicons name={down ? 'arrow-down' : 'arrow-up'} size={44} color={colors.led} style={styles.arrowShadow} />
    </Animated.View>
  );
}

/**
 * The sloth's guided tour of the home screen: a dimmed screen with a spotlight on
 * one thing at a time, an arrow pointing at it and a line of explanation.
 */
export function Tour({
  visible,
  name,
  gender,
  onDone,
}: {
  visible: boolean;
  name: string;
  gender?: 'male' | 'female' | 'other' | null;
  onDone: () => void;
}) {
  const { width: W, height: H } = useWindowDimensions();
  const targets = useTourStore((s) => s.targets);
  const remeasure = useTourStore((s) => s.remeasure);
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);

  const all: Step[] = [
    { text: `${fmt(t.hello, { name })}\n${gx(t.intro, gender)}` },
    { target: 'play', text: t.play },
    { target: 'bubbles', text: t.bubbles },
    { target: 'wallet', text: t.wallet },
    { target: 'tickets', text: t.tickets },
    { target: 'modes', text: gx(t.modes, gender) },
    { target: 'tab-play', text: t.tabPlay },
    { target: 'tab-packs', text: t.tabPacks },
    { target: 'profile', text: t.profile },
    { text: fmt(gx(t.bye, gender), { name }) },
  ];
  // skip anything that isn't on screen (e.g. no prize bubbles right now)
  const steps = all.filter((s) => !s.target || targets[s.target]);
  const step = steps[Math.min(i, steps.length - 1)];

  useEffect(() => {
    if (visible) remeasure();
  }, [visible, i, remeasure]);

  if (!visible || !step) return null;
  const last = i >= steps.length - 1;
  const next = () => {
    haptic('tap');
    if (last) onDone();
    else setI(i + 1);
  };
  const r = step.target ? targets[step.target] : undefined;
  const pad = 8;
  const hole = r ? { x: r.x - pad, y: r.y - pad, w: r.w + pad * 2, h: r.h + pad * 2 } : null;
  const below = hole ? hole.y + hole.h / 2 < H / 2 : false;
  const counter = fmt(t.stepOf, { n: i + 1, total: steps.length });

  const card = (
    <Animated.View key={`c${i}`} entering={reduced ? undefined : FadeInDown.springify().damping(16)} style={styles.card}>
      <View style={styles.cardRow}>
        {hole ? <Sloth head size={64} bob={false} /> : null}
        <AppText variant="bodyStrong" color={palette.night950} style={styles.text}>
          {step.text}
        </AppText>
      </View>
      <View style={styles.cardFoot}>
        <Pressable onPress={onDone} hitSlop={10} accessibilityRole="button">
          <AppText variant="caption" color="#6B5A9A" style={styles.bold}>
            {last ? '' : t.skip}
          </AppText>
        </Pressable>
        <AppText variant="caption" color="#6B5A9A">
          {counter}
        </AppText>
        <StickerButton label={last ? t.done : t.next} size="sm" tone="prize" icon={last ? 'trophy' : 'arrow-back'} onPress={next} />
      </View>
    </Animated.View>
  );

  return (
    <Modal visible transparent statusBarTranslucent animationType="fade" onRequestClose={onDone}>
      <View style={StyleSheet.absoluteFill}>
        {hole ? (
          <>
            {/* four panes around the spotlight */}
            <Pressable onPress={next} style={[styles.dim, { left: 0, top: 0, width: W, height: Math.max(0, hole.y) }]} />
            <Pressable onPress={next} style={[styles.dim, { left: 0, top: hole.y + hole.h, width: W, height: Math.max(0, H - hole.y - hole.h) }]} />
            <Pressable onPress={next} style={[styles.dim, { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }]} />
            <Pressable onPress={next} style={[styles.dim, { left: hole.x + hole.w, top: hole.y, width: Math.max(0, W - hole.x - hole.w), height: hole.h }]} />
            <Animated.View
              key={`h${i}`}
              entering={reduced ? undefined : FadeIn}
              pointerEvents="none"
              style={[styles.ring, { left: hole.x, top: hole.y, width: hole.w, height: hole.h }]}
            />
            <View
              style={[
                styles.callout,
                below ? { top: hole.y + hole.h + 4 } : { bottom: H - hole.y + 4 },
              ]}
            >
              {below ? (
                <>
                  <View style={[styles.arrowWrap, { left: Math.min(Math.max(hole.x + hole.w / 2 - 22 - space.md, 4), W - space.md * 2 - 48) }]}>
                    <Arrow down={false} />
                  </View>
                  {card}
                </>
              ) : (
                <>
                  {card}
                  <View style={[styles.arrowWrap, { left: Math.min(Math.max(hole.x + hole.w / 2 - 22 - space.md, 4), W - space.md * 2 - 48) }]}>
                    <Arrow down />
                  </View>
                </>
              )}
            </View>
          </>
        ) : (
          <Pressable onPress={next} style={[styles.dim, StyleSheet.absoluteFill, styles.center]}>
            <Animated.View key={`s${i}`} entering={reduced ? undefined : FadeIn.duration(400)} style={styles.centerCol}>
              <Sloth size={190} />
              {card}
            </Animated.View>
          </Pressable>
        )}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  dim: { position: 'absolute', backgroundColor: 'rgba(8,4,24,0.82)' },
  center: { alignItems: 'center', justifyContent: 'center', padding: space.lg },
  centerCol: { alignItems: 'center', gap: space.md, alignSelf: 'stretch' },
  ring: {
    position: 'absolute',
    borderRadius: 18,
    borderWidth: 3,
    borderColor: colors.led,
    shadowColor: colors.led,
    shadowOpacity: 0.9,
    shadowRadius: 14,
    elevation: 12,
  },
  callout: { position: 'absolute', left: space.md, right: space.md, gap: 2 },
  arrowWrap: { width: 44, position: 'relative' },
  arrowShadow: { textShadowColor: 'rgba(0,0,0,0.6)', textShadowRadius: 6 },
  card: {
    alignSelf: 'stretch',
    backgroundColor: '#FFF8EA',
    borderRadius: radius.sheet,
    padding: space.md,
    gap: space.sm,
    borderWidth: 3,
    borderColor: colors.led,
    shadowColor: '#000',
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 14,
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  text: { flex: 1, lineHeight: 24 },
  cardFoot: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});
