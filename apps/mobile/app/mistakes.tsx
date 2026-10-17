import type { Mistake } from '@fm/shared';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Backdrop, Card, ProgressBar, Sloth, StickerButton } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, space } from '@/design-system/tokens';
import { QuestionImageView } from '@/features/quiz/QuestionImage';
import { AnswerTile, type AnswerState } from '@/features/quiz/ui';
import { useMistakes } from '@/features/teen/api';
import { fmt, strings } from '@/lib/i18n';

const t = strings.teen;
const ROUND = 10;

/** A short, calm practice round over the questions the player got wrong (answers checked here). */
export default function MistakesScreen() {
  const { data, isLoading, refetch } = useMistakes();
  const [round, setRound] = useState(0);
  const [idx, setIdx] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [score, setScore] = useState(0);
  const items = useMemo<Mistake[]>(() => {
    const all = data ?? [];
    // a fresh order every round
    return [...all].sort(() => Math.random() - 0.5).slice(0, ROUND);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, round]);
  const q = items[idx];
  const done = items.length > 0 && idx >= items.length;

  const pick = (i: number) => {
    if (picked !== null || !q) return;
    setPicked(i);
    const ok = q.answers[i]?.correct ?? false;
    if (ok) {
      setScore((s) => s + 1);
      haptic('success');
      playSound('answer_correct');
    } else {
      haptic('error');
      playSound('answer_wrong');
    }
  };
  const next = () => {
    setPicked(null);
    setIdx((i) => i + 1);
  };
  const again = () => {
    setRound((r) => r + 1);
    setIdx(0);
    setScore(0);
    setPicked(null);
    void refetch();
  };

  const stateOf = (i: number): AnswerState => {
    if (picked === null || !q) return 'idle';
    const a = q.answers[i]!;
    if (a.correct) return i === picked ? 'correctPicked' : 'correctMissed';
    return i === picked ? 'wrongPicked' : 'dim';
  };

  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <View style={styles.top}>
        <Pressable onPress={() => router.back()} hitSlop={12} accessibilityRole="button" accessibilityLabel={strings.common.back}>
          <Ionicons name="arrow-forward" size={26} color={colors.text} />
        </Pressable>
        <AppText variant="title" style={styles.flex}>
          {t.mistakesTitle}
        </AppText>
      </View>
      <ScrollView contentContainerStyle={styles.body}>
        {isLoading ? <ActivityIndicator color={colors.led} /> : null}
        {!isLoading && (data?.length ?? 0) === 0 ? (
          <View style={styles.center}>
            <Sloth size={140} say={t.mistakesEmpty} />
          </View>
        ) : null}
        {done ? (
          <View style={styles.center}>
            <Sloth size={140} say={t.mistakesDoneTitle} />
            <AppText variant="heading" align="center">
              {fmt(t.mistakesScore, { n: score, total: items.length })}
            </AppText>
            <StickerButton label={t.mistakesAgain} icon="refresh" fullWidth onPress={again} />
            <StickerButton label={strings.common.back} tone="ghost" fullWidth onPress={() => router.back()} />
          </View>
        ) : q ? (
          <>
            {idx === 0 && picked === null ? (
              <AppText color={colors.textMuted} align="center">
                {t.mistakesIntro}
              </AppText>
            ) : null}
            <View style={styles.progress}>
              <AppText variant="caption" color={colors.textMuted}>
                {fmt(t.mistakesCount, { n: idx + 1, total: items.length })}
              </AppText>
              <ProgressBar value={idx / items.length} height={6} accessibilityLabel={fmt(t.mistakesCount, { n: idx + 1, total: items.length })} />
            </View>
            <Card padding={space.md}>
              {q.category_name ? (
                <AppText variant="caption" color={colors.led}>
                  {q.category_name}
                </AppText>
              ) : null}
              <AppText variant="question">{q.text}</AppText>
            </Card>
            {q.image ? <QuestionImageView image={q.image} /> : null}
            <View style={styles.answers}>
              {q.answers.map((a, i) => (
                <AnswerTile key={`${q.id}${i}`} index={i} text={a.text} state={stateOf(i)} disabled={picked !== null} onPress={() => pick(i)} fill />
              ))}
            </View>
            {picked !== null ? (
              <Card kind="soft" padding={space.md}>
                <AppText variant="label" color={q.answers[picked]?.correct ? colors.correct : colors.led}>
                  {q.answers[picked]?.correct ? t.mistakesRight : t.mistakesWrong}
                </AppText>
                {q.explanation ? <AppText color={colors.textMuted}>{q.explanation}</AppText> : null}
                <StickerButton
                  label={idx + 1 < items.length ? t.mistakesNext : t.mistakesFinish}
                  icon="arrow-back"
                  fullWidth
                  onPress={next}
                  style={styles.nextBtn}
                />
              </Card>
            ) : null}
          </>
        ) : null}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  top: { flexDirection: 'row', alignItems: 'center', gap: space.md, paddingHorizontal: space.lg, paddingTop: space.sm },
  flex: { flex: 1 },
  body: { padding: space.lg, gap: space.md, paddingBottom: space.xl * 2 },
  center: { alignItems: 'center', gap: space.md, paddingTop: space.xl },
  progress: { gap: 4 },
  answers: { gap: space.sm },
  nextBtn: { marginTop: space.sm },
});
