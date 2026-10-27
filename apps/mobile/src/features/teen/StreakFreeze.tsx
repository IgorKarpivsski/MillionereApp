import { Ionicons } from '@expo/vector-icons';
import { StyleSheet, View } from 'react-native';
import { AppText, Card, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, space } from '@/design-system/tokens';
import { useMyState } from '@/features/profile/hooks';
import { useDailyStatus } from '@/features/quiz/hooks';
import { fmt, strings } from '@/lib/i18n';
import { useBuyFreeze } from './api';

const t = strings.teen;

/** Streak shields: each one covers a missed day of the daily challenge. */
export function StreakFreezeCard() {
  const { data } = useDailyStatus();
  const { data: me } = useMyState();
  const buy = useBuyFreeze();
  const toast = useToast();
  if (!data || data.freezes == null) return null;
  const n = data.freezes;
  const cost = data.freeze_coins ?? 200;
  const full = n >= 2;
  return (
    <Card padding={space.md}>
      <View style={styles.row}>
        <View style={styles.shields}>
          {[0, 1].map((i) => (
            <Ionicons key={i} name={i < n ? 'shield-checkmark' : 'shield-outline'} size={30} color={i < n ? colors.gem : colors.textDim} />
          ))}
        </View>
        <View style={styles.flex}>
          <AppText variant="label">{`${t.freezeTitle} · 🔥 ${data.streak}`}</AppText>
          <AppText variant="caption" color={colors.textMuted}>
            {fmt(t.freezeBody, { n })}
          </AppText>
        </View>
      </View>
      <StickerButton
        label={full ? t.freezeMax : fmt(t.freezeBuy, { n: cost })}
        icon="shield"
        tone={full ? 'ghost' : 'gem'}
        size="sm"
        fullWidth
        disabled={full || (me?.wallet.coins ?? 0) < cost}
        disabledReason={full ? undefined : strings.common.needCoins}
        loading={buy.isPending}
        onPress={() =>
          buy.mutate(undefined, {
            onSuccess: () => {
              haptic('success');
              toast(t.freezeBought, 'success');
            },
            onError: () => toast(strings.errors.generic, 'error'),
          })
        }
        style={styles.btn}
      />
      {!full && (me?.wallet.coins ?? 0) < cost ? (
        <AppText variant="caption" color={colors.textDim} align="center">
          {t.freezeNoCoins}
        </AppText>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  shields: { flexDirection: 'row', gap: 2 },
  flex: { flex: 1 },
  btn: { marginTop: space.sm },
});
