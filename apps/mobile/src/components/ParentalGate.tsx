import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, BottomSheet, StickerButton } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, radius, space } from '@/design-system/tokens';
import { strings } from '@/lib/i18n';

const ONES: Record<number, string> = { 3: 'שלוש', 4: 'ארבע', 5: 'חמש', 6: 'שש', 7: 'שבע', 8: 'שמונה', 9: 'תשע' };
const TEENS: Record<number, string> = {
  12: 'שתים עשרה', 13: 'שלוש עשרה', 14: 'ארבע עשרה', 15: 'חמש עשרה', 16: 'שש עשרה', 17: 'שבע עשרה', 18: 'שמונה עשרה', 19: 'תשע עשרה',
};
/** A two-digit number times a one-digit number, written in words: easy for an adult, hard for a child. */
const ask = () => ({ a: 12 + Math.floor(Math.random() * 8), b: 3 + Math.floor(Math.random() * 7) });
const t = strings.parentGate;

/**
 * "Ask a grown-up" check before any real-money purchase: a multiplication
 * written in words, answered on the number pad. Easy for an adult, a real
 * pause for a young child.
 */
export function ParentalGate({ visible, onPass, onClose }: { visible: boolean; onPass: () => void; onClose: () => void }) {
  const [q, setQ] = useState(ask);
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQ(ask());
    setValue('');
    setWrong(false);
  }, [visible]);

  const check = () => {
    if (Number(value) === q.a * q.b) {
      haptic('success');
      onPass();
    } else {
      haptic('error');
      setWrong(true);
      setValue('');
      setQ(ask());
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.title}>
      <View style={styles.body}>
        <AppText color={colors.textMuted} align="center">
          {t.body}
        </AppText>
        <AppText variant="heading" align="center">
          {`${TEENS[q.a]} כפול ${ONES[q.b]}?`}
        </AppText>
        <TextInput
          value={value}
          onChangeText={(v) => {
            setValue(v.replace(/[^0-9]/g, '').slice(0, 3));
            setWrong(false);
          }}
          keyboardType="number-pad"
          maxLength={3}
          autoFocus
          accessibilityLabel={t.answer}
          style={[styles.input, wrong && styles.inputWrong]}
          placeholder="?"
          placeholderTextColor={colors.textMuted}
        />
        {wrong ? (
          <AppText variant="caption" color={colors.danger} align="center">
            ✕ {t.wrong}
          </AppText>
        ) : null}
        <StickerButton label={t.ok} icon="checkmark-circle" fullWidth disabled={!value} onPress={check} />
        <StickerButton label={strings.common.cancel} tone="ghost" fullWidth onPress={onClose} />
      </View>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  body: { gap: space.md },
  input: {
    alignSelf: 'center',
    minWidth: 120,
    minHeight: 56,
    borderRadius: radius.card,
    borderWidth: 2,
    borderColor: colors.border,
    color: colors.text,
    fontSize: 28,
    textAlign: 'center',
    paddingHorizontal: space.md,
  },
  inputWrong: { borderColor: colors.danger },
});
