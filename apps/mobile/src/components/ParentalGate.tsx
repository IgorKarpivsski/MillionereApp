import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, BottomSheet, StickerButton } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, radius, space } from '@/design-system/tokens';
import { fmt, strings } from '@/lib/i18n';

const t = strings.parentGate;
const TENS = ['', '', 'עשרים', 'שלושים', 'ארבעים', 'חמישים', 'שישים', 'שבעים', 'שמונים', 'תשעים'];
const ONES = ['', 'אחת', 'שתיים', 'שלוש', 'ארבע', 'חמש', 'שש', 'שבע', 'שמונה', 'תשע'];
/** 21–99 (not a round ten) written out in Hebrew words, e.g. 47 → "ארבעים ושבע". */
function numberWords(n: number): string {
  return `${TENS[Math.floor(n / 10)]} ו${ONES[n % 10]}`;
}
const pickNumber = () => {
  let n = 0;
  while (n % 10 === 0) n = 21 + Math.floor(Math.random() * 79);
  return n;
};

/**
 * Parent check before any real-money purchase (and before a child links an account): type a
 * number that is written out in words. Quick for a parent, a real pause for a young child.
 * It asks nothing about age (Google Play Families: no age question outside the neutral age
 * screen). Google Play's own purchase approval (password, fingerprint or Family Link) still
 * applies on top of this.
 */
export function ParentalGate({ visible, onPass, onClose }: { visible: boolean; onPass: () => void; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);
  const [n, setN] = useState(pickNumber);

  useEffect(() => {
    if (!visible) return;
    setValue('');
    setWrong(false);
    setN(pickNumber());
  }, [visible]);

  const check = () => {
    if (Number(value) === n) {
      haptic('success');
      onPass();
    } else {
      haptic('error');
      setWrong(true);
      setValue('');
      setN(pickNumber());
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.title}>
      <View style={styles.body}>
        <AppText color={colors.textMuted} align="center">
          {t.body}
        </AppText>
        <AppText variant="heading" align="center">
          {fmt(t.question, { words: numberWords(n) })}
        </AppText>
        <TextInput
          value={value}
          onChangeText={(v) => {
            setValue(v.replace(/[^0-9]/g, '').slice(0, 2));
            setWrong(false);
          }}
          keyboardType="number-pad"
          maxLength={2}
          autoFocus
          accessibilityLabel={t.answer}
          style={[styles.input, wrong && styles.inputWrong]}
          placeholder={t.placeholder}
          placeholderTextColor={colors.textMuted}
        />
        {wrong ? (
          <AppText variant="caption" color={colors.danger} align="center">
            ✕ {t.wrong}
          </AppText>
        ) : null}
        <StickerButton label={t.ok} icon="checkmark-circle" fullWidth disabled={value.length !== 2} onPress={check} />
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
