import { Ionicons } from '@expo/vector-icons';
import { legendParams, legendSvg, objectSvg, type Collectible } from '@fm/shared';
import { LinearGradient } from 'expo-linear-gradient';
import { memo, useEffect, useMemo, type ComponentProps, type ReactNode } from 'react';
import { Image, Platform, StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  cancelAnimation,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withRepeat,
  withSequence,
  withTiming,
} from 'react-native-reanimated';
import { SvgXml } from 'react-native-svg';
import { AppText, Led } from '@/design-system/components';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, radius, rarityColors } from '@/design-system/tokens';
import { CARD_ART } from './cardArt';

const POS_HE: Record<Collectible['position'], string> = { GK: 'שוער', DEF: 'הגנה', MID: 'קישור', FWD: 'התקפה', OBJ: 'פריט אספנים' };
const ERA_HE: Record<Collectible['era'], string> = { '70s': 'שנות ה-70', '80s': 'שנות ה-80', '90s': 'שנות ה-90', '00s': 'שנות ה-2000', modern: 'הדור החדש' };
const OBJ_ICON: Record<string, ComponentProps<typeof Ionicons>['name']> = {
  stadiums: 'business',
  shirts: 'shirt',
  balls: 'football',
  clubs: 'shield-half',
  merch: 'gift',
};
const RANK = { common: 0, uncommon: 1, rare: 2, epic: 3, legendary: 4, iconic: 5 } as const;

type CardItem = Pick<Collectible, 'id' | 'album' | 'number' | 'rarity' | 'name' | 'art_seed' | 'era' | 'position'> & {
  kind?: Collectible['kind'];
};

/** Android 12+ can grey out the real art; older devices get a tinted silhouette instead. */
const CAN_FILTER = Platform.OS === 'android' && Number(Platform.Version) >= 31;
const GREY = '#7E8E86';

/**
 * Collectible sticker: illustrated art (or the drawn fallback), number badge,
 * name banner and rarity frame. Rare and above get a moving foil shine;
 * legendary and "מיתי" also sparkle. Missing stickers show in grey so the
 * player sees what to hunt for; glowing copies get an animated rainbow aura.
 * Motion is off when reduced motion is on.
 */
export const LegendCard = memo(function LegendCard(props: { item: CardItem; width?: number; locked?: boolean; glow?: boolean }) {
  const { glow = false, locked = false, width = 104 } = props;
  if (glow && !locked) {
    return (
      <GlowFrame width={width}>
        <CardBody {...props} width={width - 8} locked={false} glow />
      </GlowFrame>
    );
  }
  return <CardBody {...props} width={width} locked={locked} glow={false} />;
});

function CardBody({
  item,
  width,
  locked,
  glow,
}: {
  item: CardItem;
  width: number;
  locked: boolean;
  glow: boolean;
}) {
  const r = rarityColors[item.rarity];
  const artW = width - 8;
  const artH = artW * 1.25;
  const art = CARD_ART[item.id];
  const isObject = item.kind === 'object' || item.position === 'OBJ';
  const xml = useMemo(
    () =>
      art
        ? null
        : isObject
          ? objectSvg(item.id, item.rarity, artW, `${item.id}${Math.round(artW)}`)
          : legendSvg(legendParams(item.art_seed, item.era), locked ? '#3A4A43' : r.fill, artW),
    [art, isObject, item.id, item.rarity, item.art_seed, item.era, r.fill, artW, locked],
  );
  const big = width >= 180;
  const rank = RANK[item.rarity];
  return (
    <View
      accessible
      accessibilityLabel={locked ? `${item.number}. ${item.name}, עוד לא באוסף` : `${item.name}, ${r.label}${glow ? ', מדבקה זוהרת' : ''}`}
      style={[
        styles.card,
        { width, borderColor: locked ? '#3A4A43' : glow ? '#FFF8D0' : r.fill },
        !locked && rank >= 4 ? { shadowColor: r.fill, shadowOpacity: 0.8, shadowRadius: 10, elevation: 8 } : null,
      ]}
    >
      <View style={[styles.art, { height: artH, backgroundColor: locked ? '#26332E' : r.lip }]}>
        {art ? (
          locked ? (
            CAN_FILTER ? (
              <Image
                source={art}
                style={{ width: artW, height: artH, opacity: 0.5, filter: [{ grayscale: 1 }] } as never}
                resizeMode="cover"
                accessibilityIgnoresInvertColors
              />
            ) : (
              <Image source={art} style={{ width: artW, height: artH, opacity: 0.35, tintColor: GREY }} resizeMode="cover" />
            )
          ) : (
            <Image source={art} style={{ width: artW, height: artH }} resizeMode="cover" accessibilityIgnoresInvertColors />
          )
        ) : xml ? (
          <View style={locked ? styles.ghost : null}>
            <SvgXml xml={xml} width={artW} height={artH} />
          </View>
        ) : (
          <Ionicons name={OBJ_ICON[item.album] ?? 'star'} size={artW * 0.45} color={locked ? GREY : r.fill} />
        )}
        {locked ? (
          <View style={styles.lockBadge}>
            <Led size={big ? 'ledL' : 'ledM'} color="#C9D4CE">
              {item.number}
            </Led>
          </View>
        ) : null}
        {!locked && rank >= 2 ? <Foil width={artW} height={artH} strong={rank >= 3} /> : null}
        {!locked && rank >= 4 ? <Sparkles width={artW} height={artH} color={rank === 5 ? '#FFFFFF' : r.fill} /> : null}
      </View>
      {!locked ? (
        <View style={[styles.num, { backgroundColor: r.fill }]}>
          <AppText variant="caption" color={colors.textOnBright} style={styles.numText}>
            {item.number}
          </AppText>
        </View>
      ) : null}
      {!locked && rank === 5 ? (
        <View style={styles.mythic}>
          <AppText variant="caption" color={colors.textOnBright} style={styles.numText}>
            {r.label}
          </AppText>
        </View>
      ) : null}
      {glow ? (
        <View style={styles.glowTag}>
          <AppText variant="caption" color={colors.textOnBright} style={styles.numText}>
            ✨ זוהרת
          </AppText>
        </View>
      ) : null}
      <View style={[styles.banner, { backgroundColor: locked ? '#26332E' : colors.card }]}>
        <AppText variant={big ? 'heading' : 'caption'} color={locked ? '#9FB0A8' : colors.cardText} numberOfLines={1} align="center" style={styles.name}>
          {item.name}
        </AppText>
        {big && !locked ? (
          <AppText variant="caption" color={colors.cardMuted} align="center">
            {isObject ? `${POS_HE.OBJ} · ${r.label}` : `${POS_HE[item.position]} · ${ERA_HE[item.era]} · ${r.label}`}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

const RAINBOW = ['#FF6FB5', '#FFC93C', '#3DDC84', '#7FD1FF', '#B49CFF', '#FF6FB5'] as const;

/** Animated rainbow frame + pulsing halo for glowing stickers. */
function GlowFrame({ width, children }: { width: number; children: ReactNode }) {
  const reduced = useReducedMotion();
  const spin = useSharedValue(0);
  const pulse = useSharedValue(0);
  useEffect(() => {
    if (reduced) return;
    spin.value = withRepeat(withTiming(360, { duration: 3200, easing: Easing.linear }), -1);
    pulse.value = withRepeat(withSequence(withTiming(1, { duration: 900 }), withTiming(0, { duration: 900 })), -1);
    return () => {
      cancelAnimation(spin);
      cancelAnimation(pulse);
    };
  }, [reduced, spin, pulse]);
  const ring = useAnimatedStyle(() => ({ transform: [{ rotate: `${spin.value}deg` }] }));
  const halo = useAnimatedStyle(() => ({ opacity: 0.35 + pulse.value * 0.45, transform: [{ scale: 1 + pulse.value * 0.04 }] }));
  const side = width * 2.2;
  return (
    <View style={{ width }}>
      <Animated.View pointerEvents="none" style={[styles.halo, halo]} />
      <View style={[styles.glowRing, { width }]}>
        <Animated.View style={[{ position: 'absolute', width: side, height: side, top: '50%', left: '50%', marginTop: -side / 2, marginLeft: -side / 2 }, ring]}>
          <LinearGradient colors={RAINBOW} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        </Animated.View>
        {children}
      </View>
      <Sparkles width={width} height={width * 1.5} color="#FFF8D0" />
    </View>
  );
}

/** A diagonal band of light that sweeps across the art every few seconds. */
function Foil({ width, height, strong }: { width: number; height: number; strong: boolean }) {
  const reduced = useReducedMotion();
  const x = useSharedValue(-1);
  useEffect(() => {
    if (reduced) return;
    x.value = withRepeat(
      withSequence(withTiming(1, { duration: strong ? 1400 : 1800, easing: Easing.inOut(Easing.quad) }), withDelay(strong ? 1200 : 2600, withTiming(-1, { duration: 0 }))),
      -1,
    );
    return () => cancelAnimation(x);
  }, [reduced, strong, x]);
  const style = useAnimatedStyle(() => ({ transform: [{ translateX: x.value * width * 1.3 }, { rotate: '20deg' }] }));
  if (reduced) return null;
  const a = strong ? 0.55 : 0.35;
  return (
    <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.clip]}>
      <Animated.View style={[{ position: 'absolute', top: -height * 0.25, left: width * 0.25, width: width * 0.5, height: height * 1.5 }, style]}>
        <LinearGradient
          colors={['rgba(255,255,255,0)', `rgba(255,255,255,${a})`, 'rgba(255,255,255,0)']}
          start={{ x: 0, y: 0.5 }}
          end={{ x: 1, y: 0.5 }}
          style={StyleSheet.absoluteFill}
        />
      </Animated.View>
    </View>
  );
}

const SPARKS = [
  [0.15, 0.12, 0],
  [0.8, 0.2, 500],
  [0.25, 0.7, 900],
  [0.7, 0.62, 300],
  [0.5, 0.35, 1300],
] as const;

function Sparkles({ width, height, color }: { width: number; height: number; color: string }) {
  const reduced = useReducedMotion();
  if (reduced) return null;
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      {SPARKS.map(([fx, fy, delay]) => (
        <Spark key={`${fx}-${fy}`} x={fx * width} y={fy * height} delay={delay} size={Math.max(8, width * 0.09)} color={color} />
      ))}
    </View>
  );
}

function Spark({ x, y, delay, size, color }: { x: number; y: number; delay: number; size: number; color: string }) {
  const t = useSharedValue(0);
  useEffect(() => {
    t.value = withDelay(delay, withRepeat(withSequence(withTiming(1, { duration: 450 }), withTiming(0, { duration: 650 }), withTiming(0, { duration: 900 })), -1));
    return () => cancelAnimation(t);
  }, [delay, t]);
  const style = useAnimatedStyle(() => ({ opacity: t.value, transform: [{ scale: 0.4 + t.value * 0.8 }, { rotate: `${t.value * 90}deg` }] }));
  return (
    <Animated.View style={[{ position: 'absolute', left: x - size / 2, top: y - size / 2 }, style]}>
      <Ionicons name="sparkles" size={size} color={color} />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: { borderWidth: 3, borderRadius: radius.sticker, backgroundColor: colors.board, padding: 2 },
  art: { borderRadius: radius.sticker - 4, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
  clip: { overflow: 'hidden' },
  num: { position: 'absolute', top: 6, start: 6, minWidth: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 4 },
  mythic: { position: 'absolute', top: 6, end: 6, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 6, backgroundColor: '#FFFFFF' },
  numText: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  banner: { paddingVertical: 4, paddingHorizontal: 4, borderBottomLeftRadius: radius.sticker - 4, borderBottomRightRadius: radius.sticker - 4, marginTop: 2 },
  name: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  ghost: { opacity: 0.35 },
  lockBadge: {
    position: 'absolute',
    minWidth: 44,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: 'rgba(6,19,15,0.75)',
    alignItems: 'center',
  },
  glowTag: {
    position: 'absolute',
    top: 6,
    end: 6,
    height: 22,
    borderRadius: 11,
    paddingHorizontal: 6,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF8D0',
  },
  glowRing: { padding: 4, borderRadius: radius.sticker + 4, overflow: 'hidden', alignItems: 'center' },
  halo: {
    position: 'absolute',
    top: -6,
    bottom: -6,
    left: -6,
    right: -6,
    borderRadius: radius.sticker + 10,
    backgroundColor: '#FFC93C',
  },
});
