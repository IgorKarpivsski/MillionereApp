import { LADDER } from '@fm/economy-config';
import { StyleSheet, View } from 'react-native';
import { TopBar } from '@/components/TopBar';
import { AppText, Card, Screen, StickerButton, useToast } from '@/design-system/components';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { formatNumber } from '@/lib/format';
import { strings } from '@/lib/i18n';

const t = strings.play;

/** Preview of the prize ladder — display only, values come from shared config. */
function LadderPreview() {
  const rungs = [...LADDER].reverse();
  return (
    <View style={styles.ladder} accessibilityLabel="סולם הפרסים">
      {rungs.map((r) => (
        <View
          key={r.rung}
          style={[styles.rung, r.checkpoint && styles.checkpoint, r.rung === 12 && styles.top]}
        >
          <AppText variant="number" color={r.checkpoint || r.rung === 12 ? colors.textOnBright : colors.textMuted}>
            {r.rung}
          </AppText>
          <AppText
            variant="number"
            color={r.checkpoint || r.rung === 12 ? colors.textOnBright : colors.prize}
          >
            {formatNumber(r.prizePoints)}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export default function PlayScreen() {
  const toast = useToast();
  return (
    <Screen header={<TopBar />}>
      <AppText variant="title">{t.title}</AppText>
      <Card kind="sticker" tint={palette.night700}>
        <AppText variant="heading">{t.classic}</AppText>
        <AppText color={colors.textMuted} style={styles.body}>
          {t.classicBody}
        </AppText>
        <LadderPreview />
        <StickerButton
          label={strings.common.soon}
          icon="lock-closed"
          fullWidth
          style={styles.cta}
          onPress={() => toast(t.soonBody, 'info')}
        />
      </Card>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { marginTop: space.xs, marginBottom: space.lg },
  ladder: { gap: 6 },
  rung: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    height: 36,
    borderRadius: radius.control,
    backgroundColor: palette.night950,
  },
  checkpoint: { backgroundColor: colors.primary },
  top: { backgroundColor: colors.prize },
  cta: { marginTop: space.lg },
});
