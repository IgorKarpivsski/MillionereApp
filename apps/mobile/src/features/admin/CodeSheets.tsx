import { useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, BottomSheet, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, fontFamily, palette, radius, space } from '@/design-system/tokens';
import { useRefreshEconomy } from '@/features/engage/hooks';
import { rewardLabel } from '@/features/engage/rewards';
import { fmt, strings } from '@/lib/i18n';
import { adminApi } from './api';

export const inputStyle = StyleSheet.create({
  input: {
    height: 52,
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: palette.night950,
    color: colors.text,
    paddingHorizontal: space.lg,
    fontFamily: fontFamily.uiMedium,
    fontSize: 18,
    textAlign: 'right',
  },
}).input;

/** Any player: type a gift code from a live stream. */
export function RedeemSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = strings.redeem;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const refresh = useRefreshEconomy();
  const submit = async () => {
    if (!code.trim()) return;
    setBusy(true);
    try {
      const r = await adminApi.redeem(code);
      haptic('success');
      playSound('rare_reveal');
      toast(fmt(t.success, { label: rewardLabel(r.reward) }), 'success');
      refresh();
      setCode('');
      onClose();
    } catch (e) {
      const m = (e as Error).message ?? '';
      haptic('error');
      toast(
        m.includes('code_expired') ? t.expired : m.includes('code_used_up') ? t.usedUp : m.includes('code_already') ? t.already
          : m.includes('rate_limited') ? strings.errors.rateLimited : t.invalid,
        'error',
      );
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.title}>
      <View style={styles.gap}>
        <AppText color={colors.textMuted}>{t.hint}</AppText>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.toUpperCase().replace(/[^A-Z0-9]/g, ''))}
          placeholder={t.placeholder}
          placeholderTextColor={colors.textDim}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={16}
          accessibilityLabel={t.placeholder}
          style={[inputStyle, styles.code]}
          onSubmitEditing={() => void submit()}
        />
        <StickerButton label={t.cta} icon="gift" tone="prize" fullWidth loading={busy} disabled={code.length < 4} onPress={() => void submit()} />
      </View>
    </BottomSheet>
  );
}

/** Hidden: turn this account into the owner's admin account with the secret code. */
export function AdminUnlockSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const t = strings.admin;
  const [code, setCode] = useState('');
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  const qc = useQueryClient();
  const submit = async () => {
    setBusy(true);
    try {
      await adminApi.claim(code.trim());
      await qc.invalidateQueries({ queryKey: ['admin-status'] });
      toast(t.unlockOk, 'success');
      setCode('');
      onClose();
    } catch {
      toast(t.unlockBad, 'error');
    } finally {
      setBusy(false);
    }
  };
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.unlockTitle}>
      <View style={styles.gap}>
        <AppText color={colors.textMuted}>{t.unlockHint}</AppText>
        <TextInput
          value={code}
          onChangeText={setCode}
          autoCapitalize="characters"
          autoCorrect={false}
          secureTextEntry
          accessibilityLabel={t.unlockHint}
          style={inputStyle}
        />
        <StickerButton label={strings.common.save} fullWidth loading={busy} disabled={code.length < 6} onPress={() => void submit()} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  gap: { gap: space.md },
  code: { textAlign: 'center', letterSpacing: 4, fontSize: 22 },
});
