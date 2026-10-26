import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useState } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { AppText, Card, CoinIcon, GemIcon, Led, StickerButton, useToast } from '@/design-system/components';
import { playSound } from '@/design-system/feedback/sound';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, space } from '@/design-system/tokens';
import { useLeaderboard } from '@/features/quiz/hooks';
import { useAdReward } from '@/features/store/hooks';
import { formatNumber } from '@/lib/format';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';

const t = strings.postGame;

/**
 * After a game: where the player stands this week, and a rewarded ad that
 * doubles this game's points (once per game).
 */
/** `double` = offer "double my points" (off on screens that already offer an ad, so there is one ad offer at most). */
export function PostGameRank({ runId, points, double: canDouble = true }: { runId?: string | null; points: number; double?: boolean }) {
  const qc = useQueryClient();
  const { data } = useLeaderboard();
  const ad = useAdReward();
  const toast = useToast();
  const [doubled, setDoubled] = useState(false);
  useEffect(() => {
    // the game just changed the table
    void qc.invalidateQueries({ queryKey: queryKeys.leaderboard });
  }, [qc]);
  const me = data?.me;
  const double = async () => {
    if (!runId) return;
    const r = await ad.run('double_points', runId);
    if (r) {
      setDoubled(true);
      playSound('coins');
      toast(fmt(t.doubled, { n: formatNumber(points * 2) }), 'success');
      void qc.invalidateQueries({ queryKey: queryKeys.leaderboard });
      void qc.invalidateQueries({ queryKey: queryKeys.league });
    }
  };
  return (
    <Card padding={space.md} style={styles.card}>
      <View style={styles.row}>
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.textMuted}>
            {t.weekRank}
          </AppText>
          <Led size="ledL">{me?.rank ? `#${me.rank}` : '--'}</Led>
        </View>
        <View style={styles.flex}>
          <AppText variant="caption" color={colors.textMuted}>
            {t.weekPoints}
          </AppText>
          <Led size="ledL" color={colors.text}>
            {formatNumber(me?.points ?? 0)}
          </Led>
        </View>
      </View>
      {canDouble && runId && points > 0 && !doubled ? (
        <StickerButton
          label={fmt(ad.adFree ? t.doubleFree : t.double, { n: formatNumber(points) })}
          icon={ad.adFree ? 'gift' : 'play-circle'}
          tone="gem"
          fullWidth
          loading={ad.busy}
          onPress={() => void double()}
          style={styles.btn}
        />
      ) : null}
      {doubled ? (
        <AppText variant="label" color={colors.correct} align="center" style={styles.btn}>
          {fmt(t.doubled, { n: formatNumber(points * 2) })}
        </AppText>
      ) : null}
    </Card>
  );
}

/** Every question right: the champion's prize. */
export function PerfectPrize({ prize }: { prize: { coins: number; gems: number } }) {
  const reduced = useReducedMotion();
  useEffect(() => {
    playSound('level_up');
  }, []);
  return (
    <Animated.View entering={reduced ? undefined : ZoomIn.springify().damping(12)} style={styles.card}>
      <Card kind="sticker" frame={colors.led} padding={space.md} style={styles.card}>
        <AppText variant="title" align="center" color={colors.led}>
          {`🏆 ${t.perfectTitle}`}
        </AppText>
        <AppText align="center">{t.perfectBody}</AppText>
        <View style={styles.prize}>
          <CoinIcon size={22} />
          <AppText variant="heading">{`+${prize.coins}`}</AppText>
          <GemIcon size={22} />
          <AppText variant="heading">{`+${prize.gems}`}</AppText>
        </View>
      </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  // results screens centre their content: stretch so the card isn't squeezed to nothing
  card: { alignSelf: 'stretch' },
  row: { flexDirection: 'row', gap: space.md },
  flex: { flex: 1, alignItems: 'center' },
  btn: { marginTop: space.sm },
  prize: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: space.sm, marginTop: space.xs },
});
