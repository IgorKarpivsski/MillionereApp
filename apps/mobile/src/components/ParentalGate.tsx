import { useEffect, useState } from 'react';
import { StyleSheet, TextInput, View } from 'react-native';
import { AppText, BottomSheet, StickerButton } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { colors, radius, space } from '@/design-system/tokens';
import { strings } from '@/lib/i18n';

const t = strings.parentGate;
/** Adults only: born at least 18 years ago, and a sane year (not 0, not 1900). */
const MIN_AGE = 18;
const isAdultYear = (y: number) => {
  const now = new Date().getFullYear();
  return y >= now - 100 && y <= now - MIN_AGE;
};

/**
 * "Ask a grown-up" check before any real-money purchase (and before a child links an account):
 * the grown-up types their birth year. Quick for a parent, a real pause for a young child.
 * The year isn't saved or sent anywhere. Google Play's own purchase approval (password,
 * fingerprint or Family Link) still applies on top of this.
 */
export function ParentalGate({ visible, onPass, onClose }: { visible: boolean; onPass: () => void; onClose: () => void }) {
  const [value, setValue] = useState('');
  const [wrong, setWrong] = useState(false);

  useEffect(() => {
    if (!visible) return;
    setValue('');
    setWrong(false);
  }, [visible]);

  const check = () => {
    if (isAdultYear(Number(value))) {
      haptic('success');
      onPass();
    } else {
      haptic('error');
      setWrong(true);
      setValue('');
    }
  };

  return (
    <BottomSheet visible={visible} onClose={onClose} title={t.title}>
      <View style={styles.body}>
        <AppText color={colors.textMuted} align="center">
          {t.body}
        </AppText>
        <AppText variant="heading" align="center">
          {t.question}
        </AppText>
        <TextInput
          value={value}
          onChangeText={(v) => {
            setValue(v.replace(/[^0-9]/g, '').slice(0, 4));
            setWrong(false);
          }}
          keyboardType="number-pad"
          maxLength={4}
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
        <StickerButton label={t.ok} icon="checkmark-circle" fullWidth disabled={value.length !== 4} onPress={check} />
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
