import { REACTION_EMOJIS, type Reaction } from '@fm/shared';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import Animated, { Easing, useAnimatedStyle, useSharedValue, withTiming, runOnJS } from 'react-native-reanimated';
import { AppText } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, space } from '@/design-system/tokens';
import { teenApi } from './api';

type Kind = 'match' | 'family';
interface Floater {
  key: string;
  emoji: string;
  name: string;
  x: number;
}

let seq = 0;

/** One emoji floating up from the bottom of the screen, then fading. */
function Float({ f, onDone }: { f: Floater; onDone: (k: string) => void }) {
  const reduced = useReducedMotion();
  const p = useSharedValue(0);
  useEffect(() => {
    p.value = withTiming(1, { duration: reduced ? 1200 : 2400, easing: Easing.out(Easing.quad) }, (fin) => {
      if (fin) runOnJS(onDone)(f.key);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  const style = useAnimatedStyle(() => ({
    opacity: p.value < 0.75 ? 1 : 1 - (p.value - 0.75) * 4,
    transform: [{ translateY: reduced ? 0 : -260 * p.value }, { scale: 0.7 + Math.min(p.value * 3, 1) * 0.5 }],
  }));
  return (
    <Animated.View style={[styles.float, { left: `${f.x}%` }, style]} pointerEvents="none">
      <Text style={styles.floatEmoji}>{f.emoji}</Text>
      <AppText variant="caption" style={styles.floatName} numberOfLines={1}>
        {f.name}
      </AppText>
    </Animated.View>
  );
}

/**
 * Emoji reactions in a live game: a row of fixed emojis to send, and the
 * room's reactions floating up the screen. Polls the room while it's live.
 */
export function ReactionLayer({ kind, room, live, meName }: { kind: Kind; room: string; live: boolean; meName: string }) {
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const after = useRef(0);
  const cooldown = useRef(0);

  const add = (r: Pick<Reaction, 'emoji' | 'username'>) =>
    setFloaters((fs) => [...fs.slice(-11), { key: `f${seq++}`, emoji: r.emoji, name: r.username, x: 8 + Math.random() * 76 }]);

  useEffect(() => {
    if (!live) return;
    let stop = false;
    const tick = async () => {
      try {
        const rows = await teenApi.reactions(kind, room, after.current);
        if (stop) return;
        for (const r of rows) {
          after.current = Math.max(after.current, r.id);
          if (!r.me) add(r);
        }
      } catch {
        // quiet: reactions are a bonus
      }
    };
    void tick();
    const id = setInterval(() => void tick(), 1500);
    return () => {
      stop = true;
      clearInterval(id);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [kind, room, live]);

  const send = (emoji: string) => {
    const now = Date.now();
    if (now - cooldown.current < 700) return;
    cooldown.current = now;
    haptic('tap');
    add({ emoji, username: meName });
    void teenApi.react(kind, room, emoji).catch(() => undefined);
  };

  return (
    <>
      <View style={styles.layer} pointerEvents="none">
        {floaters.map((f) => (
          <Float key={f.key} f={f} onDone={(k) => setFloaters((fs) => fs.filter((x) => x.key !== k))} />
        ))}
      </View>
      {live ? (
        <View style={styles.bar}>
          {REACTION_EMOJIS.map((e) => (
            <Pressable
              key={e}
              onPress={() => send(e)}
              hitSlop={4}
              accessibilityRole="button"
              accessibilityLabel={e}
              style={({ pressed }) => [styles.btn, pressed && styles.pressed]}
            >
              <Text style={styles.emoji}>{e}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  layer: { ...StyleSheet.absoluteFillObject, direction: 'ltr', overflow: 'hidden' },
  float: { position: 'absolute', bottom: 90, alignItems: 'center', width: 64, marginLeft: -32 },
  floatEmoji: { fontSize: 38 },
  floatName: { color: colors.text, backgroundColor: 'rgba(20,12,51,0.7)', paddingHorizontal: 6, borderRadius: 8, maxWidth: 80 },
  bar: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginHorizontal: space.md,
    marginBottom: space.sm,
    paddingHorizontal: space.sm,
    paddingVertical: 4,
    borderRadius: 22,
    backgroundColor: 'rgba(20,12,51,0.75)',
    borderWidth: 1,
    borderColor: 'rgba(255,214,140,0.25)',
  },
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  pressed: { transform: [{ scale: 1.3 }] },
  emoji: { fontSize: 24 },
});
