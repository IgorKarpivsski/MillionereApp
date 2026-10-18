import { StyleSheet, View } from 'react-native';
import { AppText, AvatarBadge, Card, CoinIcon, GemIcon, Led, Skeleton } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useCountdownTo } from '@/features/engage/hooks';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';
import { useBoard } from './api';
import { RankList } from './RankList';

const t = strings.boards;

/** The monthly table (top 3 win a prize) or the all-time table (never resets). */
export function BoardView({ kind }: { kind: 'month' | 'all' }) {
  const { data, isLoading } = useBoard(kind);
  const left = useCountdownTo(kind === 'month' ? data?.ends_at : null);
  const days = data?.ends_at ? Math.floor((new Date(data.ends_at).getTime() - Date.now()) / 86_400_000) : 0;
  return (
    <>
      <AppText variant="title">{kind === 'month' ? t.month : t.all}</AppText>
      <AppText color={colors.textMuted}>{kind === 'month' ? t.monthBody : t.allBody}</AppText>
      {kind === 'month' && data?.ends_at ? (
        <AppText variant="label" color={colors.led}>
          {`⏳ ${fmt(t.endsIn, { t: days >= 1 ? fmt(strings.teen.eventDays, { n: days }) : (left ?? '') })}`}
        </AppText>
      ) : null}
      {kind === 'month' && data?.prizes ? (
        <Card padding={space.md}>
          {data.prizes.map((p, i) => (
            <View key={i} style={styles.prize}>
              <AppText style={styles.medal}>{['🥇', '🥈', '🥉'][i]}</AppText>
              <CoinIcon size={18} />
              <AppText variant="label">{formatNumber(p.coins)}</AppText>
              <GemIcon size={18} />
              <AppText variant="label">{formatNumber(p.gems)}</AppText>
            </View>
          ))}
        </Card>
      ) : null}
      <Card kind="sticker" padding={space.md}>
        <View style={styles.meRow}>
          <AppText variant="label" style={styles.flex}>
            {data?.me ? fmt(t.you, { n: data.me.rank }) : t.noRank}
          </AppText>
          {data?.me ? <Led size="number">{formatNumber(data.me.points)}</Led> : null}
        </View>
      </Card>
      {isLoading ? <Skeleton height={260} rounded={18} /> : null}
      {data && data.rows.length === 0 ? (
        <AppText color={colors.textMuted} align="center">
          {t.empty}
        </AppText>
      ) : null}
      {data ? <RankList rows={data.rows} /> : null}
      {kind === 'month' && data && data.last_winners.length > 0 ? (
        <Card padding={space.md}>
          <AppText variant="heading">{t.lastWinners}</AppText>
          {data.last_winners.map((w) => (
            <View key={w.rank} style={styles.winner}>
              <AppText style={styles.medal}>{['🥇', '🥈', '🥉'][w.rank - 1] ?? String(w.rank)}</AppText>
              <AvatarBadge avatarId={w.avatar_id} photo={w.photo} size={32} />
              <AppText variant="label" style={styles.flex} numberOfLines={1}>
                {w.username}
              </AppText>
              <Led size="number" color={colors.text}>
                {formatNumber(w.points)}
              </Led>
            </View>
          ))}
        </Card>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  prize: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingVertical: 2 },
  medal: { fontSize: 22, width: 30 },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  winner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
});
