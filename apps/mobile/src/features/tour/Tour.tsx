import { Ionicons } from '@expo/vector-icons';
import { useEffect, useRef, useState, type ReactNode } from 'react';
import { BackHandler, Pressable, StyleSheet, View, useWindowDimensions, type ViewStyle } from 'react-native';
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

type Gender = 'male' | 'female' | 'other' | null | undefined;

interface TourStore {
  /** the running tour, if any (shown by TourHost at the app root) */
  session: { name: string; gender: Gender; onDone: () => void } | null;
  start: (name: string, gender: Gender, onDone: () => void) => void;
  stop: () => void;
  targets: Record<string, Rect>;
  /** bumps whenever targets should measure themselves again */
  tick: number;
  setTarget: (id: string, r: Rect) => void;
  removeTarget: (id: string) => void;
  remeasure: () => void;
}

export const useTourStore = create<TourStore>((set) => ({
  session: null,
  start: (name, gender, onDone) => set({ session: { name, gender, onDone } }),
  stop: () => set({ session: null }),
  targets: {},
  tick: 0,
  // only store real changes, so the overlay doesn't re-render (and stutter) on every measure
  setTarget: (id, r) =>
    set((s) => {
      const o = s.targets[id];
      if (o && Math.abs(o.x - r.x) < 1 && Math.abs(o.y - r.y) < 1 && Math.abs(o.w - r.w) < 1 && Math.abs(o.h - r.h) < 1) return s;
      return { targets: { ...s.targets, [id]: r } };
    }),
  removeTarget: (id) =>
    set((s) => {
      if (!(id in s.targets)) return s;
      const rest = { ...s.targets };
      delete rest[id];
      return { targets: rest };
    }),
  remeasure: () => set((s) => ({ tick: s.tick + 1 })),
}));

/** Marks something the tour can point at. */
export function TourTarget({ id, children, style }: { id: string; children: ReactNode; style?: ViewStyle }) {
  const ref = useRef<View>(null);
  const setTarget = useTourStore((s) => s.setTarget);
  const removeTarget = useTourStore((s) => s.removeTarget);
  const tick = useTourStore((s) => s.tick);
  const touring = useTourStore((s) => s.session !== null);
  const measure = () =>
    ref.current?.measureInWindow((x, y, w, h) => {
      if (w > 0 && h > 0) setTarget(id, { x, y, w, h });
    });
  useEffect(() => {
    const t = setTimeout(measure, 60);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick]);
  // While the tour runs, keep following the target: things above it can change height
  // (the sloth's tip, data loading in) or the screen can scroll, which onLayout doesn't report.
  useEffect(() => {
    if (!touring) return;
    measure();
    const iv = setInterval(measure, 300);
    return () => clearInterval(iv);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [touring]);
  // a target that's gone (unmounted) must not leave a stale spotlight behind
  useEffect(() => () => removeTarget(id), [id, removeTarget]);
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

/** Mounted once at the app root, above the tab bar, in the same coordinates the targets measure in. */
export function TourHost() {
  const session = useTourStore((s) => s.session);
  const stop = useTourStore((s) => s.stop);
  if (!session) return null;
  return (
    <Tour
      visible
      name={session.name}
      gender={session.gender}
      onDone={() => {
        stop();
        session.onDone();
      }}
    />
  );
}

/**
 * The sloth's guided tour of the home screen: a dimmed screen with a spotlight on
 * one thing at a time, an arrow pointing at it and a line of explanation.
 */
function Tour({
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
  const win = useWindowDimensions();
  // the overlay's real size (can differ from the window's: navigation bar, edge-to-edge)
  const [box, setBox] = useState<{ w: number; h: number } | null>(null);
  const W = box?.w ?? win.width;
  const H = box?.h ?? win.height;
  const targets = useTourStore((s) => s.targets);
  const remeasure = useTourStore((s) => s.remeasure);
  const reduced = useReducedMotion();
  const [i, setI] = useState(0);
  const rootRef = useRef<View>(null);
  const [origin, setOrigin] = useState<{ x: number; y: number } | null>(null);
  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      onDone();
      return true;
    });
    return () => sub.remove();
  }, [onDone]);

  // short on purpose: five cards, the rest is explained the first time it's opened
  const all: Step[] = [
    { text: `${fmt(t.hello, { name })}\n${gx(t.intro, gender)}` },
    { target: 'play', text: t.play },
    { target: 'bubbles', text: t.bubbles },
    { target: 'modes', text: gx(t.modes, gender) },
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
  const raw = step.target ? targets[step.target] : undefined;
  // targets are measured in window coordinates; shift them into this overlay's own
  const r = raw && origin ? { ...raw, x: raw.x - origin.x, y: raw.y - origin.y } : undefined;
  const pad = 8;
  // never let the spotlight run under the tab bar (a long list can reach past it)
  const tabTops = Object.entries(targets)
    .filter(([k]) => k.startsWith('tab-'))
    .map(([, v]) => v.y - (origin?.y ?? 0));
  const floor = tabTops.length ? Math.min(...tabTops) - 6 : Infinity;
  const hole = r
    ? (() => {
        const y = r.y - pad;
        const bottom = Math.min(r.y + r.h + pad, floor);
        return { x: r.x - pad, y, w: r.w + pad * 2, h: Math.max(24, bottom - y) };
      })()
    : null;
  const below = hole ? hole.y + hole.h / 2 < H / 2 : false;
  const counter = fmt(t.stepOf, { n: i + 1, total: steps.length });

  const card = (
    <Animated.View key={`c${i}`} entering={reduced ? undefined : FadeInDown.springify().damping(16)} style={styles.card}>
      <Pressable onPress={next} style={styles.cardRow} accessibilityRole="button" accessibilityLabel={step.text}>
        {hole ? <Sloth head size={64} bob={false} /> : null}
        <AppText variant="bodyStrong" color={palette.night950} style={styles.text}>
          {step.text}
        </AppText>
      </Pressable>
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
    <View
      ref={rootRef}
      collapsable={false}
      onLayout={(e) => {
        const { width, height } = e.nativeEvent.layout;
        setBox({ w: width, h: height });
        rootRef.current?.measureInWindow((x, y) => setOrigin({ x, y }));
      }}
      style={styles.root}
    >
      <View style={StyleSheet.absoluteFill}>
        {hole ? (
          <>
            {/* four panes around the spotlight */}
            <Pressable onPress={next} style={[styles.dim, { left: 0, top: 0, width: W, height: Math.max(0, hole.y) }]} />
            {/* bottom and right panes run to the overlay's own edges: the window size can be
                smaller than the screen (navigation bar), which left the tab bar undimmed */}
            <Pressable onPress={next} style={[styles.dim, { left: 0, right: 0, top: hole.y + hole.h, bottom: 0 }]} />
            <Pressable onPress={next} style={[styles.dim, { left: 0, top: hole.y, width: Math.max(0, hole.x), height: hole.h }]} />
            <Pressable onPress={next} style={[styles.dim, { left: hole.x + hole.w, right: 0, top: hole.y, height: hole.h }]} />
            {/* the spotlit thing itself isn't pressable during the tour */}
            <Pressable onPress={next} style={{ position: 'absolute', left: hole.x, top: hole.y, width: hole.w, height: hole.h }} />
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
    </View>
  );
}

const styles = StyleSheet.create({
  // physical left/top here: the targets were measured physically, so no RTL mirroring
  root: { ...StyleSheet.absoluteFillObject, zIndex: 1000, elevation: 1000, direction: 'ltr' },
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
    direction: 'rtl',
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
