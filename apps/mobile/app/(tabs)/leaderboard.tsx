import { StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { AppText, AvatarBadge, Card, EmptyState, Led, Screen, Skeleton } from '@/design-system/components';
import { colors, radius, space } from '@/design-system/tokens';
import { useLeaderboard } from '@/features/quiz/hooks';
import { formatNumber } from '@/lib/format';
import { strings } from '@/lib/i18n';

const t = strings.leaderboard;

export default function LeaderboardScreen() {
  const { data, isLoading, refetch, isRefetching } = useLeaderboard();
  return (
    <Screen header={<TopBar />} onRefresh={() => void refetch()} refreshing={isRefetching}>
      <AppText variant="title">{t.title}</AppText>
      <AppText color={colors.textMuted}>{t.body}</AppText>

      {data ? (
        <Card kind="sticker" padding={space.md}>
          <View style={styles.meRow}>
            <AppText variant="label">{t.you}</AppText>
            <Led size="ledM">{data.me.rank ? `#${data.me.rank}` : '--'}</Led>
            <View style={styles.flex} />
            <Led size="number" color={colors.text}>
              {formatNumber(data.me.points)}
            </Led>
            <AppText variant="caption" color={colors.textDim}>
              {t.points}
            </AppText>
          </View>
        </Card>
      ) : null}

      {isLoading ? <Skeleton height={300} rounded={18} /> : null}
      {data && data.rows.length === 0 ? (
        <EmptyState icon="trophy-outline" title={t.emptyTitle} body={t.emptyBody} />
      ) : null}

      <View style={styles.list}>
        {data?.rows.map((r) => (
          <View key={`${r.rank}-${r.username}`} style={[styles.row, r.me && styles.rowMe, r.rank <= 3 && styles.rowTop]}>
            <Led size="number" color={r.rank === 1 ? colors.led : r.rank <= 3 ? colors.text : colors.textDim} style={styles.rank}>
              {r.rank}
            </Led>
            <AvatarBadge avatarId={r.avatar_id} level={r.level} size={36} />
            <AppText variant="label" numberOfLines={1} style={styles.flex}>
              {r.username}
            </AppText>
            <Led size="number" color={r.me ? colors.led : colors.text}>
              {formatNumber(r.points)}
            </Led>
          </View>
        ))}
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  list: { gap: 6 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
  },
  rowTop: { borderWidth: 1, borderColor: colors.border },
  rowMe: { borderWidth: 2, borderColor: colors.led },
  rank: { minWidth: 28, textAlign: 'center' },
});
