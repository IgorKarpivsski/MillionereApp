import { LADDER } from '@fm/economy-config';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { AppText, Card, Led, Screen, StickerButton, TrophyLogo } from '@/design-system/components';
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
          <TrophyLogo size={40} />
          <AppText variant="heading">{t.classic}</AppText>
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
      <Card kind="soft" padding={space.md}>
        <View style={styles.head}>
          <AppText variant="heading" style={styles.flex}>
            {strings.match.playCard}
          </AppText>
        </View>
        <AppText color={colors.textMuted} style={styles.body}>
          {strings.match.playCardBody}
        </AppText>
        <StickerButton label={strings.match.create} icon="people" tone="outline" fullWidth onPress={() => router.push('/match')} />
      </Card>
      <Card kind="soft" padding={space.md}>
        <AppText variant="heading">{strings.home.matchTitle}</AppText>
        <AppText color={colors.textMuted} style={styles.body}>
          {strings.home.dailyBody}
        </AppText>
        <StickerButton
          label={strings.home.kickoff}
          icon="calendar"
          tone="outline"
          fullWidth
          onPress={() => router.push({ pathname: '/quiz', params: { mode: 'daily' } })}
        />
      </Card>
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
});
