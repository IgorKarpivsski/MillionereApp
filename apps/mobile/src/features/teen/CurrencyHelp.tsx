import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AppText, BottomSheet, CoinIcon, DustIcon, GemIcon, StickerButton, TicketIcon } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useSettingsStore } from '@/features/settings/store';
import { strings } from '@/lib/i18n';

const t = strings.teen;

/** The four things you can collect, explained in one short sheet. */
export function CurrencyHelpSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const rows = [
    { icon: <CoinIcon size={30} />, text: t.currencyCoins },
    { icon: <GemIcon size={30} />, text: t.currencyGems },
    { icon: <TicketIcon size={30} />, text: t.currencyTickets },
    { icon: <DustIcon size={30} />, text: t.currencyDust },
  ];
  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.currencyTitle}>
      {rows.map((r) => (
        <View key={r.text} style={styles.row}>
          {r.icon}
          <AppText style={styles.flex}>{r.text}</AppText>
        </View>
      ))}
      <AppText variant="label" color={colors.correct} align="center">
        {t.currencyFree}
      </AppText>
      <StickerButton label={t.currencyOk} fullWidth onPress={onClose} />
    </BottomSheet>
  );
}

/** A "?" button that opens the explainer; it also opens by itself the first time. */
export function CurrencyHelpButton({ auto = false }: { auto?: boolean }) {
  const seen = useSettingsStore((s) => s.currencyHelpSeen);
  const set = useSettingsStore((s) => s.set);
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!auto || seen) return;
    const id = setTimeout(() => setOpen(true), 600);
    return () => clearTimeout(id);
  }, [auto, seen]);
  const close = () => {
    setOpen(false);
    if (!seen) set({ currencyHelpSeen: true });
  };
  return (
    <>
      <Pressable onPress={() => setOpen(true)} hitSlop={10} accessibilityRole="button" accessibilityLabel={t.currencyTitle} style={styles.btn}>
        <Ionicons name="help-circle" size={26} color={colors.led} />
      </Pressable>
      <CurrencyHelpSheet visible={open} onClose={close} />
    </>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1 },
  btn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
});
