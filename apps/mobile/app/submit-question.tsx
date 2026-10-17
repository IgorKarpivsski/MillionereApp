import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { router } from 'expo-router';
import { useState } from 'react';
import { KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Backdrop, Card, Sloth, StickerButton, useToast } from '@/design-system/components';
import { colors, fontFamily, palette, radius, space } from '@/design-system/tokens';
import { RpcError } from '@/features/profile/api';
import { teenApi, teenKeys, useMySubmissions } from '@/features/teen/api';
import { useWorldsConfig } from '@/features/worlds/api';
import { fmt, strings } from '@/lib/i18n';

const t = strings.teen;
const STATUS = t.submitStatus as Record<string, string>;

function Field({ label, value, onChange, placeholder, tone }: { label: string; value: string; onChange: (s: string) => void; placeholder?: string; tone?: 'ok' | 'bad' }) {
  return (
    <View style={styles.field}>
      <AppText variant="label" color={tone === 'ok' ? colors.correct : tone === 'bad' ? colors.danger : colors.text}>
        {label}
      </AppText>
      <TextInput
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor={colors.textDim}
        maxLength={label === t.submitQuestion ? 200 : 80}
        multiline={label === t.submitQuestion}
        accessibilityLabel={label}
        style={[styles.input, label === t.submitQuestion && styles.inputTall, tone === 'ok' && styles.inputOk]}
      />
    </View>
  );
}

/** Players write their own questions; approved ones appear in the game with their name. */
export default function SubmitQuestionScreen() {
  const worlds = useWorldsConfig().filter((w) => w.active !== false && w.levels > 0);
  const { data: mine } = useMySubmissions();
  const qc = useQueryClient();
  const toast = useToast();
  const [world, setWorld] = useState<string | null>(null);
  const [text, setText] = useState('');
  const [correct, setCorrect] = useState('');
  const [wrongs, setWrongs] = useState(['', '', '']);
  const [busy, setBusy] = useState(false);

  const all = [correct, ...wrongs].map((x) => x.trim());
  const valid = !!world && text.trim().length >= 8 && all.every((x) => x.length > 0) && new Set(all).size === 4;

  const send = async () => {
    if (!valid || !world) {
      toast(t.submitInvalid, 'error');
      return;
    }
    setBusy(true);
    try {
      await teenApi.submit(world, text.trim(), correct.trim(), wrongs.map((w) => w.trim()));
      toast(t.submitSent, 'success');
      setText('');
      setCorrect('');
      setWrongs(['', '', '']);
      void qc.invalidateQueries({ queryKey: teenKeys.submissions });
    } catch (e) {
      const code = e instanceof RpcError ? e.code : '';
      toast(code === 'rate_limited' ? t.submitLimit : code === 'invalid_input' ? t.submitInvalid : strings.errors.generic, 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <Ionicons name="arrow-forward" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="title" style={styles.flex}>
          {t.submitTitle}
        </AppText>
      </View>
      <KeyboardAvoidingView style={styles.flex} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <View style={styles.center}>
            <Sloth size={110} say={t.submitIntro} />
          </View>
          <AppText variant="heading">{t.submitWorld}</AppText>
          <View style={styles.worlds}>
            {worlds.map((w) => (
              <Pressable
                key={w.slug}
                onPress={() => setWorld(w.slug)}
                accessibilityRole="radio"
                accessibilityState={{ selected: world === w.slug }}
                style={[styles.world, world === w.slug && { backgroundColor: w.color, borderColor: colors.led }]}
              >
                <AppText variant="caption" style={styles.bold}>
                  {w.name}
                </AppText>
              </Pressable>
            ))}
          </View>
          <Field label={t.submitQuestion} value={text} onChange={setText} placeholder={t.submitQuestionPh} />
          <Field label={t.submitCorrect} value={correct} onChange={setCorrect} tone="ok" />
          {wrongs.map((w, i) => (
            <Field
              key={i}
              label={fmt(t.submitWrong, { n: i + 1 })}
              value={w}
              onChange={(v) => setWrongs((ws) => ws.map((x, j) => (j === i ? v : x)))}
              tone="bad"
            />
          ))}
          <StickerButton label={t.submitSend} icon="send" tone="prize" fullWidth loading={busy} disabled={!valid} onPress={() => void send()} />

          {mine && mine.length > 0 ? (
            <Card padding={space.md}>
              <AppText variant="heading">{t.submitMine}</AppText>
              {mine.map((m) => (
                <View key={m.id} style={styles.mine}>
                  <AppText style={styles.flex} numberOfLines={2}>
                    {m.text}
                  </AppText>
                  <AppText
                    variant="caption"
                    style={styles.bold}
                    color={m.status === 'approved' ? colors.correct : m.status === 'rejected' ? colors.danger : colors.led}
                  >
                    {STATUS[m.status]}
                  </AppText>
                </View>
              ))}
            </Card>
          ) : null}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm },
  flex: { flex: 1 },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xxxl },
  center: { alignItems: 'center' },
  worlds: { flexDirection: 'row', flexWrap: 'wrap', gap: space.xs },
  world: {
    paddingHorizontal: space.sm,
    paddingVertical: 6,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'transparent',
    backgroundColor: 'rgba(255,255,255,0.1)',
  },
  field: { gap: 4 },
  input: {
    minHeight: 48,
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: palette.night950,
    color: colors.text,
    paddingHorizontal: space.md,
    fontFamily: fontFamily.uiMedium,
    fontSize: 16,
    textAlign: 'right',
  },
  inputTall: { minHeight: 80, textAlignVertical: 'top', paddingTop: space.sm },
  inputOk: { borderColor: colors.correct },
  mine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, paddingTop: space.sm },
});
