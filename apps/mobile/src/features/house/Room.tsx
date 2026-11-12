import { Image, Pressable, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { AppText, Sloth, SparkBurst } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors } from '@/design-system/tokens';
import { formatCompact } from '@/lib/format';
import { HATS, ROOM, ROOM_RATIO, SLOTH_SPOT, SPOTS } from './art';

/**
 * The treehouse, drawn to fit `width`. Owned items stand in their places; the rest show as
 * faint outlines with their price (tap one to buy it). The sloth sits on the rug wearing its hat.
 */
export function Room({
  width,
  owned,
  hat,
  prices,
  justBought,
  onPickSpot,
  interactive = true,
}: {
  width: number;
  owned: string[];
  hat: string | null;
  prices?: Record<string, number>;
  justBought?: string | null;
  onPickSpot?: (id: string) => void;
  interactive?: boolean;
}) {
  const reduced = useReducedMotion();
  const height = width * ROOM_RATIO;
  const layers = [
    ...Object.entries(SPOTS).map(([id, s]) => ({ id, z: s.z })),
    { id: '_sloth', z: SLOTH_SPOT.z },
  ].sort((a, b) => a.z - b.z);
  return (
    <View style={[styles.room, { width, height }]}>
      <Image source={ROOM} style={{ position: 'absolute', left: 0, top: 0, width, height }} resizeMode="stretch" />
      {layers.map(({ id }) => {
        if (id === '_sloth') {
          const w = (width * SLOTH_SPOT.w) / 100;
          const h = w * (946 / 728);
          return (
            <View key={id} pointerEvents="none" style={{ position: 'absolute', left: (width * SLOTH_SPOT.cx) / 100 - w / 2, top: (height * SLOTH_SPOT.bottom) / 100 - h }}>
              <Sloth size={w} hat={hat ? HATS[hat] : null} />
            </View>
          );
        }
        const s = SPOTS[id]!;
        const w = (width * s.w) / 100;
        const h = w * s.ratio * (s.flat ?? 1);
        const left = (width * s.cx) / 100 - w / 2;
        const top = (height * s.bottom) / 100 - h;
        const have = owned.includes(id);
        const fresh = justBought === id;
        if (have) {
          return (
            <Animated.View
              key={id}
              pointerEvents="none"
              entering={fresh && !reduced ? ZoomIn.springify().damping(9) : undefined}
              style={{ position: 'absolute', left, top, width: w, height: h }}
            >
              <Image source={s.src} style={styles.fill} resizeMode="stretch" />
              {fresh ? (
                <View style={styles.burst}>
                  <SparkBurst count={12} radius={Math.max(60, w * 0.7)} />
                </View>
              ) : null}
            </Animated.View>
          );
        }
        return (
          <Pressable
            key={id}
            disabled={!interactive}
            onPress={() => onPickSpot?.(id)}
            accessibilityRole="button"
            style={{ position: 'absolute', left, top, width: w, height: h }}
          >
            <Image source={s.src} style={[styles.fill, styles.ghost]} resizeMode="stretch" tintColor="#FFFFFF" />
            {interactive && prices?.[id] != null ? (
              <View style={styles.tagWrap} pointerEvents="none">
                <View style={styles.tag}>
                  <AppText variant="caption" color={colors.textOnBright} style={styles.bold}>
                    {`🪙 ${formatCompact(prices[id]!)}`}
                  </AppText>
                </View>
              </View>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  // physical positions over the picture: no RTL mirroring
  room: { direction: 'ltr', overflow: 'hidden', borderRadius: 24 },
  fill: { width: '100%', height: '100%' },
  ghost: { opacity: 0.28 },
  burst: { position: 'absolute', left: '50%', top: '50%' },
  tagWrap: { ...StyleSheet.absoluteFillObject, alignItems: 'center', justifyContent: 'center' },
  tag: { paddingHorizontal: 6, paddingVertical: 1, borderRadius: 999, backgroundColor: colors.led },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
});
