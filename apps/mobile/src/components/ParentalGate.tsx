import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, BottomSheet, StickerButton } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, radius, space } from '@/design-system/tokens';
import { strings } from '@/lib/i18n';

const WORDS = ['', '', '', '', '', '', 'שש', 'שבע', 'שמונה', 'תשע'];
const t = strings.parentGate;

/**
 * "Ask a grown-up" check before any real-money purchase: a multiplication
 * written in words, answered on the number pad. Easy for an adult, a real
 * pause for a young child.
 */
export function ParentalGate({ visible, onPass, onClose }: { visible: boolean; onPass: () => void; onClose: () => void }) {
  const [q, setQ] = useState({ a: 7, b: 8 });
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setQ({ a: 6 + Math.floor(Math.random() * 4), b: 6 + Math.floor(Math.random() * 4) });
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
      setQ({ a: 6 + Math.floor(Math.random() * 4), b: 6 + Math.floor(Math.random() * 4) });
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.title}>
      <View style={styles.body}>
        <AppText color={colors.textMuted} align="center">
          {t.body}
        </AppText>
        <AppText variant="heading" align="center">
          {`${WORDS[q.a]} כפול ${WORDS[q.b]}?`}
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
