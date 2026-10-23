import { LinearGradient } from 'expo-linear-gradient';
import { StyleSheet, View } from 'react-native';
import { AppText, AvatarBadge, Card, CoinIcon, GemIcon, Led, Skeleton } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { PACK_NAMES } from '@/features/collection/PackArt';
import { useCountdownTo } from '@/features/engage/hooks';
import { useMyState } from '@/features/profile/hooks';
import { formatNumber } from '@/lib/format';
import { fmt, strings } from '@/lib/i18n';
import { useBoard } from './api';
import { RankList } from './RankList';

const t = strings.boards;

/** The monthly table (top 3 win a prize) or the all-time table (never resets). */
function Extra({ text }: { text: string }) {
  return (
    <View style={styles.extra}>
      <AppText variant="caption" color={colors.text} style={styles.bold}>
        {text}
      </AppText>
    </View>
  );
}

export function BoardView({ kind }: { kind: 'month' | 'all' }) {
  const { data, isLoading } = useBoard(kind);
  const { data: me } = useMyState();
  const month = new Date().getMonth() + 1;
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
        <View style={styles.prizeCard}>
          <LinearGradient colors={['#FFB000', '#B5451B', '#3B2A8F']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
          <View style={styles.prizeHead}>
            <AvatarBadge avatarId={me?.profile.avatar_id ?? 'avatar_01'} photo={me?.profile.photo_url} frame={`m${month}`} size={58} />
            <View style={styles.flex}>
              <AppText variant="title" color={colors.textOnBright}>
                {fmt(t.champTitle, { month: data.month_name ?? '' })}
              </AppText>
              <AppText variant="caption" color={colors.textOnBright}>
                {t.champBody}
              </AppText>
            </View>
          </View>
          {data.prizes.map((p, i) => {
            const from = i === 0 ? 1 : (data.prizes![i - 1]!.upto ?? i) + 1;
            const to = p.upto ?? i + 1;
            const medal = to === 1 ? '🥇' : to <= 3 ? '🥈🥉' : '🏅';
            return (
              <View key={i} style={styles.prizeRowBox}>
                <View style={styles.prize}>
                  <AppText style={styles.medal}>{medal}</AppText>
                  <AppText variant="label" style={styles.flex}>
                    {from === to ? fmt(t.place, { n: to }) : fmt(t.places, { from, to })}
                  </AppText>
                  <CoinIcon size={16} />
                  <AppText variant="label">{formatNumber(p.coins)}</AppText>
                  <GemIcon size={16} />
                  <AppText variant="label">{formatNumber(p.gems)}</AppText>
                </View>
                <View style={styles.extras}>
                  {p.pack ? <Extra text={PACK_NAMES[p.pack]} /> : null}
                  {p.title ? (
                    <Extra text={fmt(p.title === 'champion' ? t.prizeTitleChamp : t.prizeTitleTop, { month: data.month_name ?? '' })} />
                  ) : null}
                  {p.frame ? <Extra text={fmt(t.prizeFrame, { month: data.month_name ?? '' })} /> : null}
                  {p.color ? <Extra text={fmt(t.prizeColor, { color: (strings.teen.colorNames as Record<string, string>)[p.color] ?? p.color })} /> : null}
                </View>
              </View>
            );
          })}
        </View>
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
  prize: { flexDirection: 'row', alignItems: 'center', gap: space.xs, paddingVertical: 2 },
  prizeCard: { padding: space.md, gap: space.sm, borderRadius: 22, overflow: 'hidden', borderWidth: 2, borderColor: '#FFD27D' },
  prizeHead: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  prizeRowBox: { gap: 4, padding: space.sm, borderRadius: 14, backgroundColor: 'rgba(14,8,38,0.55)' },
  extras: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  extra: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999, backgroundColor: 'rgba(255,214,140,0.22)', borderWidth: 1, borderColor: 'rgba(255,214,140,0.5)' },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  medal: { fontSize: 22, width: 30 },
  meRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  winner: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
});
