import { LADDER } from '@fm/economy-config';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { LinearGradient } from 'expo-linear-gradient';
import { AppText, Card, ChampionBadge, Icon, Led, Screen, StickerButton } from '@/design-system/components';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { formatNumber } from '@/lib/format';
import { strings } from '@/lib/i18n';
import { usePlayClassic } from '@/features/engage/EnergySheet';

const t = strings.play;

/** The prize ladder as a stadium board — display only, values come from shared config. */
function LadderPreview() {
  const rungs = [...LADDER].reverse();
  return (
    <View style={styles.ladder} accessibilityLabel={t.ladderTitle}>
      {rungs.map((r) => {
        const top = r.rung === 12;
        const lit = top || r.checkpoint;
        return (
          <View key={r.rung} style={[styles.rung, lit && styles.rungLit, top && styles.rungTop]}>
            <Led size="ledS" color={top ? colors.textOnBright : colors.textDim}>
              {String(r.rung).padStart(2, '0')}
            </Led>
            {r.checkpoint ? (
              <AppText variant="caption" color={colors.correct}>
                {t.safe}
              </AppText>
            ) : null}
            <View style={styles.flex} />
            <Led size="number" color={top ? colors.textOnBright : lit ? colors.led : colors.text}>
              {formatNumber(r.prizePoints)}
            </Led>
          </View>
        );
      })}
    </View>
  );
}

export default function PlayScreen() {
  const playClassic = usePlayClassic();
  return (
    <Screen header={<TopBar />}>
      <AppText variant="title">{t.title}</AppText>
      <Card kind="sticker">
        <View style={styles.head}>
          <ChampionBadge size={52} />
          <AppText variant="heading" style={styles.flex}>{t.classic}</AppText>
          <Icon name="trophy" size={44} />
        </View>
        <AppText color={colors.textMuted} style={styles.body}>
          {t.classicBody}
        </AppText>
        <LadderPreview />
        <StickerButton
          label={t.kickoff}
          icon="football"
          size="lg"
          fullWidth
          style={styles.cta}
          onPress={playClassic}
        />
      </Card>
      <View style={styles.mode}>
        <LinearGradient colors={['#FF8A3D', '#FF5A4E']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.head}>
          <Icon name="friends" size={52} />
          <AppText variant="heading" color={colors.textOnBright} style={styles.flex}>
            {strings.match.playCard}
          </AppText>
        </View>
        <AppText color={colors.textOnBright} style={styles.body}>
          {strings.match.playCardBody}
        </AppText>
        <StickerButton label={strings.match.create} icon="people" tone="ghost" fullWidth onPress={() => router.push('/match')} />
      </View>
      <View style={styles.mode}>
        <LinearGradient colors={['#7FD1FF', '#5C7CFF']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={StyleSheet.absoluteFill} />
        <View style={styles.head}>
          <Icon name="daily" size={52} />
          <AppText variant="heading" color={colors.textOnBright} style={styles.flex}>
            {strings.home.matchTitle}
          </AppText>
        </View>
        <AppText color={colors.textOnBright} style={styles.body}>
          {strings.home.dailyBody}
        </AppText>
        <StickerButton
          label={strings.home.kickoff}
          icon="calendar"
          tone="ghost"
          fullWidth
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'daily' } })}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  body: { marginTop: space.xs, marginBottom: space.lg },
  flex: { flex: 1 },
  ladder: { gap: 4 },
  rung: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    height: 34,
    borderRadius: radius.sticker - 4,
    backgroundColor: palette.night800,
  },
  rungLit: { borderWidth: 1, borderColor: colors.border },
  rungTop: { backgroundColor: colors.led, borderWidth: 0 },
  cta: { marginTop: space.lg },
  mode: { padding: space.lg, borderRadius: 22, borderWidth: 3, borderColor: palette.night950, overflow: 'hidden' },
});
