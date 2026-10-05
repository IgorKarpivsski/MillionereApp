import type { WheelSpin } from '@fm/shared';
import { router } from 'expo-router';
import { useRef, useState } from 'react';
import { Alert, ScrollView, StyleSheet, View, useWindowDimensions } from 'react-native';
import Animated, { Easing, ZoomIn, runOnJS, useAnimatedStyle, useSharedValue, withTiming } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import Svg, { Circle, G, Path, Polygon } from 'react-native-svg';
import { AppText, Card, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound } from '@/design-system/feedback/sound';
import { colors, palette, space } from '@/design-system/tokens';
import { requestId } from '@/features/collection/api';
import { engageApi } from '@/features/engage/api';
import { useCountdownTo, useRefreshEconomy, useWheel } from '@/features/engage/hooks';
import { RewardIcon, rewardLabel } from '@/features/engage/rewards';
import { RpcError } from '@/features/profile/api';
import { fmt, strings } from '@/lib/i18n';

const t = strings.engage;
const SLICE = [palette.gold, palette.night700, palette.sky, palette.night800, palette.flare, palette.night700, palette.pitch, palette.night800, palette.violet, palette.night700];

function slicePath(c: number, r: number, a0: number, a1: number) {
  const p = (a: number) => [c + r * Math.sin(a), c - r * Math.cos(a)];
  const [x0, y0] = p(a0);
  const [x1, y1] = p(a1);
  return `M${c} ${c} L${x0} ${y0} A${r} ${r} 0 0 1 ${x1} ${y1} Z`;
}

export default function WheelScreen() {
  const { data } = useWheel();
  const { width } = useWindowDimensions();
  const size = Math.min(width - space.xl * 2, 340);
  const reduced = useReducedMotion();
  const toast = useToast();
  const refresh = useRefreshEconomy();
  const rot = useSharedValue(0);
  const [busy, setBusy] = useState(false);
  const [won, setWon] = useState<WheelSpin | null>(null);
  const pending = useRef<string | null>(null);
  const nextFree = useCountdownTo(data?.next_free_at);
  const style = useAnimatedStyle(() => ({ transform: [{ rotate: `${rot.value}deg` }] }));

  if (!data) return <SafeAreaView style={styles.root} />;
  const n = data.segments.length;
  const step = 360 / n;
  const c = size / 2;

  const landed = (r: WheelSpin) => {
    setBusy(false);
    setWon(r);
    refresh();
    playSound(r.segment.kind === 'gems' && r.segment.amount >= 25 ? 'rare_reveal' : 'coins');
    haptic('success');
    toast(fmt(t.won, { label: rewardLabel(r.segment) }), 'success');
  };

  const spin = async (pay: 'free' | 'gems') => {
    if (busy) return;
    setBusy(true);
    setWon(null);
    // One id per attempt, reused on retry so a dropped response cannot double-charge.
    pending.current ??= requestId();
    try {
      const r = await engageApi.spin(pay, pending.current);
      pending.current = null;
      playSound('pack_open');
      const base = rot.value - (rot.value % 360);
      const target = base + 360 * 6 - (r.index * step + step / 2);
      if (reduced) {
        rot.value = target;
        landed(r);
      } else {
        rot.value = withTiming(target, { duration: 4200, easing: Easing.out(Easing.cubic) }, (done) => {
          if (done) runOnJS(landed)(r);
        });
      }
    } catch (e) {
      setBusy(false);
      const code = e instanceof RpcError ? e.code : 'unknown';
      if (code !== 'network') pending.current = null;
      toast(code === 'insufficient_funds' ? t.notEnoughGems : code === 'rate_limited' ? strings.errors.rateLimited : strings.errors.generic, 'error');
    }
  };

  const confirmPaid = () =>
    Alert.alert(t.buySpinTitle, fmt(t.buySpinBody, { n: data.spin_gems }), [
      { text: strings.common.cancel, style: 'cancel' },
      { text: fmt(t.spinGems, { n: data.spin_gems }), onPress: () => void spin('gems') },
    ]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.top}>
        <AppText variant="title">{t.wheelTitle}</AppText>
        <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        <AppText color={colors.textMuted} align="center">
          {t.wheelBody}
        </AppText>

        <View style={{ width: size, height: size + 18, alignSelf: 'center' }} accessible accessibilityLabel={t.wheelTitle}>
          <Animated.View style={[{ width: size, height: size, marginTop: 18 }, style]}>
            <Svg width={size} height={size}>
              <Circle cx={c} cy={c} r={c} fill={palette.gold} />
              <G>
                {data.segments.map((s, i) => (
                  <Path
                    key={s.id}
                    d={slicePath(c, c - 6, ((i * step) * Math.PI) / 180, (((i + 1) * step) * Math.PI) / 180)}
                    fill={SLICE[i % SLICE.length]}
                    stroke={palette.night950}
                    strokeWidth={2}
                  />
                ))}
              </G>
              <Circle cx={c} cy={c} r={size * 0.11} fill={palette.night950} stroke={palette.gold} strokeWidth={4} />
            </Svg>
            {data.segments.map((s, i) => {
              const a = ((i * step + step / 2) * Math.PI) / 180;
              const rr = c * 0.68;
              const icon = Math.max(26, size * 0.1);
              return (
                <View
                  key={s.id}
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    left: c + rr * Math.sin(a) - icon / 2,
                    top: c - rr * Math.cos(a) - icon / 2,
                    width: icon,
                    alignItems: 'center',
                    transform: [{ rotate: `${i * step + step / 2}deg` }],
                  }}
                >
                  <RewardIcon r={s} size={icon} />
                  <AppText variant="caption" style={styles.amount}>
                    {s.kind === 'pack' || s.kind === 'cosmetic' ? '' : String(s.amount)}
                  </AppText>
                </View>
              );
            })}
          </Animated.View>
          <View style={[styles.pointer, { left: c - 14 }]} pointerEvents="none">
            <Svg width={28} height={34}>
              <Polygon points="0,0 28,0 14,34" fill={palette.chalk} stroke={palette.night950} strokeWidth={2} />
            </Svg>
          </View>
        </View>

        {won ? (
          <Animated.View entering={reduced ? undefined : ZoomIn.springify()} style={styles.won} accessibilityLiveRegion="assertive">
            <RewardIcon r={won.segment} size={40} />
            <AppText variant="heading" color={colors.led}>
              {fmt(t.won, { label: rewardLabel(won.segment) })}
            </AppText>
          </Animated.View>
        ) : null}

        {data.free_available ? (
          <StickerButton label={busy ? t.spinning : t.spinFree} icon="sync" tone="prize" size="lg" fullWidth loading={busy} onPress={() => void spin('free')} />
        ) : (
          <>
            {nextFree ? (
              <AppText variant="label" color={colors.led} align="center">
                {fmt(t.nextFree, { t: nextFree })}
              </AppText>
            ) : null}
            {data.blocked ? (
              <AppText variant="caption" color={colors.textDim} align="center">
                {t.wheelBlocked}
              </AppText>
            ) : (
              <StickerButton
                label={busy ? t.spinning : fmt(t.spinGems, { n: data.spin_gems })}
                icon="diamond"
                tone="gem"
                size="lg"
                fullWidth
                loading={busy}
                disabled={data.paid_left < 1}
                onPress={confirmPaid}
              />
            )}
            {!data.blocked ? (
              <AppText variant="caption" color={colors.textDim} align="center">
                {fmt(t.paidLeft, { n: data.paid_left })}
              </AppText>
            ) : null}
          </>
        )}

        <Card kind="panel" padding={space.md} style={styles.odds}>
          <AppText variant="label">{t.odds}</AppText>
          {data.segments.map((s) => (
            <View key={s.id} style={styles.oddsRow}>
              <RewardIcon r={s} size={20} />
              <AppText variant="caption" color={colors.textMuted} style={styles.flex}>
                {fmt(t.oddsLine, { label: rewardLabel(s), p: s.pct ?? 0 })}
              </AppText>
            </View>
          ))}
        </Card>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  body: { padding: space.lg, gap: space.md },
  pointer: { position: 'absolute', top: 0 },
  amount: { fontFamily: 'IBMPlexSansHebrew_700Bold', color: palette.chalk, textShadowColor: palette.night950, textShadowRadius: 3 },
  won: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm },
  odds: { gap: space.xs },
  oddsRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  flex: { flex: 1 },
});
