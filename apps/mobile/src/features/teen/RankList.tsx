import type { RankRow } from '@fm/shared';
import { StyleSheet, View } from 'react-native';
import { AppText, AvatarBadge, Led } from '@/design-system/components';
import { colors, radius, space } from '@/design-system/tokens';
import { formatNumber } from '@/lib/format';

/** A ranked table of players (friends' table, the weekly event). */
export function RankList({ rows }: { rows: RankRow[] }) {
  return (
    <View style={styles.list}>
      {rows.map((r) => (
        <View key={`${r.rank}-${r.username}`} style={[styles.row, r.me && styles.rowMe, r.rank <= 3 && styles.rowTop]}>
          <Led size="number" color={r.rank === 1 ? colors.led : r.rank <= 3 ? colors.text : colors.textDim} style={styles.rank}>
            {r.rank <= 3 ? ['🥇', '🥈', '🥉'][r.rank - 1]! : String(r.rank)}
          </Led>
          <AvatarBadge avatarId={r.avatar_id} photo={r.photo} level={r.level} frame={r.frame} size={36} />
          <AppText variant="label" numberOfLines={1} style={styles.flex}>
            {r.username}
          </AppText>
          <Led size="number" color={r.me ? colors.led : colors.text}>
            {formatNumber(r.points)}
          </Led>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
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
