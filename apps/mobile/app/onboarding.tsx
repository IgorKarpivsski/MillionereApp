import { USERNAME_REGEX } from '@fm/shared';
import { router } from 'expo-router';
import { useCallback, useRef, useState } from 'react';
import {
  Image,
  KeyboardAvoidingView,
  type NativeScrollEvent,
  type NativeSyntheticEvent,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import Animated, { FadeInDown, SlideInLeft, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, Backdrop, Card, GlassFill, Icon, Sloth, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { colors, fontFamily, palette, radius, space } from '@/design-system/tokens';
import { rpc, RpcError } from '@/features/profile/api';
import { useUpdateProfile } from '@/features/profile/hooks';
import { requestReminderPermission } from '@/features/reminders/useReminders';
import { useSettingsStore } from '@/features/settings/store';
import { refreshAdAudience } from '@/features/store/ads';
import { useWorldsConfig } from '@/features/worlds/api';
import { WORLD_IMAGES } from '@/features/worlds/worldImages';
import { MyStateSchema } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { queryKeys } from '@/lib/queryClient';
import { fmt, strings } from '@/lib/i18n';

const t = strings.onboarding;
type Step = 'notif' | 'age' | 'about' | 'nick';
// Notifications are asked after the first win, not here (the first screen is the age question).
const STEPS: Step[] = ['age', 'about', 'nick'];

/* ------------------------------------------------------------------ */
/* Frame                                                               */
/* ------------------------------------------------------------------ */

function Dots({ step }: { step: Step }) {
  const i = STEPS.indexOf(step);
  return (
    <View style={styles.dots} accessible accessibilityLabel={fmt(t.stepOf, { n: i + 1, total: STEPS.length })}>
      {STEPS.map((s, k) => (
        <View key={s} style={[styles.dot, k <= i && styles.dotOn, k === i && styles.dotNow]} />
      ))}
    </View>
  );
}

function Frame({
  step,
  say,
  title,
  body,
  onSkip,
  children,
  footer,
}: {
  step: Step;
  say: string;
  title: string;
  body: string;
  onSkip?: () => void;
  children?: React.ReactNode;
  footer: React.ReactNode;
}) {
  const reduced = useReducedMotion();
  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <View style={styles.top}>
        <Dots step={step} />
        {onSkip ? (
          <Pressable onPress={onSkip} hitSlop={12} accessibilityRole="button" style={styles.skip}>
            <AppText variant="label" color={colors.textMuted}>
              {t.skip}
            </AppText>
          </Pressable>
        ) : (
          <View style={styles.skip} />
        )}
      </View>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.flex}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Animated.View key={step} entering={reduced ? undefined : SlideInLeft.springify().damping(18)} style={styles.head}>
            <Sloth size={step === 'about' ? 96 : 124} say={say} />
            <AppText variant="title" align="center">
              {title}
            </AppText>
            <AppText color={colors.textMuted} align="center">
              {body}
            </AppText>
          </Animated.View>
          {children}
        </ScrollView>
        <View style={styles.footer}>{footer}</View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

/* ------------------------------------------------------------------ */
/* Age wheel — neutral: starts on "scroll to choose", never on an age  */
/* ------------------------------------------------------------------ */

const ROW = 56;
const AGES: (number | null)[] = [null, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16, 17, 18];

function AgeWheel({ value, onChange }: { value: number | null; onChange: (a: number | null) => void }) {
  const last = useRef(-1);
  const onScroll = (e: NativeSyntheticEvent<NativeScrollEvent>) => {
    const i = Math.max(0, Math.min(AGES.length - 1, Math.round(e.nativeEvent.contentOffset.y / ROW)));
    if (i !== last.current) {
      last.current = i;
      haptic('select');
      onChange(AGES[i] ?? null);
    }
  };
  return (
    <View style={styles.wheel} accessibilityRole="adjustable" accessibilityLabel={t.ageTitle} accessibilityValue={{ text: value ? String(value) : t.agePick }}>
      <GlassFill />
      <View pointerEvents="none" style={styles.wheelBand} />
      <ScrollView
        showsVerticalScrollIndicator={false}
        snapToInterval={ROW}
        decelerationRate="fast"
        onScroll={onScroll}
        scrollEventThrottle={16}
        contentContainerStyle={{ paddingVertical: ROW * 2 }}
        nestedScrollEnabled
      >
        {AGES.map((a, i) => {
          const on = a === value;
          return (
            <View key={i} style={styles.wheelRow}>
              <AppText
                variant={on ? 'title' : 'heading'}
                color={on ? colors.led : a === null ? colors.textDim : colors.textMuted}
                style={!on && a !== null ? styles.dim : null}
              >
                {a === null ? t.agePick : a === 18 ? t.ageAdult : String(a)}
              </AppText>
            </View>
          );
        })}
      </ScrollView>
    </View>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function OnboardingScreen() {
  const set = useSettingsStore((s) => s.set);
  const qc = useQueryClient();
  const toast = useToast();
  const worlds = useWorldsConfig();
  const update = useUpdateProfile();
  const [step, setStep] = useState<Step>('age');
  const [busy, setBusy] = useState(false);
  const [age, setAge] = useState<number | null>(null);
  const [gender, setGender] = useState<'male' | 'female' | 'other' | null>(null);
  const [topics, setTopics] = useState<string[]>([]);
  const [nick, setNick] = useState('');
  const go = (s: Step) => {
    haptic('tap');
    setStep(s);
  };

  const finish = useCallback(() => {
    set({ onboarded: true, tourDone: false });
    router.replace('/(tabs)');
  }, [set]);

  const savePrefs = async (g: typeof gender, w: string[] | null) => {
    try {
      const st = await rpc('save_preferences', { p_gender: g, p_worlds: w }, (x) => MyStateSchema.parse(x));
      qc.setQueryData(queryKeys.myState, st);
    } catch {
      // preferences are a nicety; never block the first run on them
    }
  };

  if (step === 'notif') {
    return (
      <Frame
        step={step}
        say={t.notifSloth}
        title={t.notifTitle}
        body={t.notifBody}
        footer={
          <>
            <StickerButton
              label={t.notifAllow}
              icon="notifications"
              tone="prize"
              size="lg"
              fullWidth
              loading={busy}
              onPress={async () => {
                setBusy(true);
                await requestReminderPermission();
                setBusy(false);
                go('age');
              }}
            />
            <StickerButton
              label={t.notifLater}
              tone="ghost"
              fullWidth
              onPress={() => {
                set({ remindersAsked: true });
                go('age');
              }}
            />
          </>
        }
      >
        <Animated.View entering={ZoomIn.delay(250)} style={styles.bell}>
          <Icon name="gift" size={64} />
          <Icon name="wheel" size={64} />
          <Icon name="fire" size={64} />
        </Animated.View>
      </Frame>
    );
  }

  if (step === 'age') {
    return (
      <Frame
        step={step}
        say={t.ageSloth}
        title={t.ageTitle}
        body={t.ageBody}
        footer={
          <StickerButton
            label={t.next}
            icon="arrow-back"
            tone="prize"
            size="lg"
            fullWidth
            disabled={age === null}
            onPress={() => {
              if (age === null) return;
              set({ ageBand: age < 13 ? 'under13' : age < 16 ? '13to15' : '16plus' });
              refreshAdAudience();
              go('about');
            }}
          />
        }
      >
        <AgeWheel value={age} onChange={setAge} />
      </Frame>
    );
  }

  if (step === 'about') {
    const ready = gender !== null && topics.length >= 3;
    const toggle = (slug: string) => {
      haptic('select');
      setTopics((xs) => (xs.includes(slug) ? xs.filter((x) => x !== slug) : [...xs, slug]));
    };
    return (
      <Frame
        step={step}
        say={t.aboutSloth}
        title={t.aboutTitle}
        body={t.aboutBody}
        onSkip={() => go('nick')}
        footer={
          <StickerButton
            label={t.next}
            icon="arrow-back"
            tone="prize"
            size="lg"
            fullWidth
            disabled={!ready}
            loading={busy}
            onPress={async () => {
              setBusy(true);
              await savePrefs(gender, topics);
              setBusy(false);
              go('nick');
            }}
          />
        }
      >
        <Card padding={space.md} style={styles.block}>
          <AppText variant="label">{t.genderTitle}</AppText>
          <View style={styles.genders}>
            {(['male', 'female', 'other'] as const).map((g) => {
              const on = gender === g;
              return (
                <Pressable
                  key={g}
                  onPress={() => {
                    haptic('select');
                    setGender(g);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: on }}
                  style={[styles.gender, on && styles.genderOn]}
                >
                  <AppText style={styles.emoji}>{g === 'male' ? '👦' : g === 'female' ? '👧' : '🙂'}</AppText>
                  <AppText variant="label" color={on ? palette.night950 : colors.text}>
                    {t[g]}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </Card>
        <Card padding={space.md} style={styles.block}>
          <View style={styles.rowBetween}>
            <AppText variant="label">{t.topicsTitle}</AppText>
            <AppText variant="caption" color={topics.length >= 3 ? colors.correct : colors.led} style={styles.bold}>
              {topics.length >= 3 ? fmt(t.topicsDone, { n: topics.length }) : fmt(t.topicsCount, { n: topics.length })}
            </AppText>
          </View>
          <View style={styles.topics}>
            {worlds.map((w) => {
              const on = topics.includes(w.slug);
              const img = WORLD_IMAGES[w.icon];
              return (
                <Pressable
                  key={w.slug}
                  onPress={() => toggle(w.slug)}
                  accessibilityRole="checkbox"
                  accessibilityState={{ checked: on }}
                  accessibilityLabel={w.name}
                  style={[styles.topic, on && { borderColor: colors.led, backgroundColor: `${w.color}55` }]}
                >
                  {img ? <Image source={img} style={styles.topicImg} /> : null}
                  <AppText variant="caption" numberOfLines={1} style={styles.bold}>
                    {w.name}
                  </AppText>
                  {on ? (
                    <Animated.View entering={ZoomIn} style={styles.check}>
                      <AppText variant="caption" color={palette.night950} style={styles.bold}>
                        ✓
                      </AppText>
                    </Animated.View>
                  ) : null}
                </Pressable>
              );
            })}
          </View>
        </Card>
      </Frame>
    );
  }

  // nickname
  const valid = USERNAME_REGEX.test(nick.trim());
  return (
    <Frame
      step={step}
      say={t.nickSloth}
      title={t.nickTitle}
      body={t.nickBody}
      onSkip={finish}
      footer={
        <StickerButton
          label={t.finish}
          icon="rocket"
          tone="prize"
          size="lg"
          fullWidth
          disabled={!valid}
          loading={update.isPending}
          onPress={() =>
            update.mutate(
              { username: nick.trim() },
              {
                onSuccess: finish,
                onError: (e) =>
                  toast(e instanceof RpcError && e.code === 'username_taken' ? t.nickTaken : t.nickInvalid, 'error'),
              },
            )
          }
        />
      }
    >
      <Animated.View entering={FadeInDown.delay(150)} style={styles.block}>
        <TextInput
          value={nick}
          onChangeText={setNick}
          placeholder={t.nickPlaceholder}
          placeholderTextColor={colors.textDim}
          maxLength={20}
          autoCorrect={false}
          autoCapitalize="none"
          style={[styles.input, nick.length > 0 && !valid && styles.inputBad]}
          accessibilityLabel={t.nickTitle}
          returnKeyType="done"
        />
        <AppText variant="caption" color={nick.length > 0 && !valid ? colors.danger : colors.textDim} align="center">
          {t.nickInvalid}
        </AppText>
        <StickerButton
          label={t.nickSuggest}
          icon="sparkles"
          tone="outline"
          fullWidth
          onPress={() => {
            haptic('tap');
            const pool = t.nickSuggestions;
            const base = pool[Math.floor(Math.random() * pool.length)]!;
            setNick(`${base}${Math.floor(10 + Math.random() * 89)}`);
          }}
        />
      </Animated.View>
    </Frame>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  flex: { flex: 1 },
  top: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: space.lg, paddingTop: space.sm },
  skip: { minWidth: 48, alignItems: 'flex-end' },
  dots: { flexDirection: 'row', gap: 6 },
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: 'rgba(255,255,255,0.2)' },
  dotOn: { backgroundColor: colors.led },
  dotNow: { width: 28 },
  body: { padding: space.lg, gap: space.md, flexGrow: 1 },
  head: { alignItems: 'center', gap: space.sm },
  footer: { paddingHorizontal: space.lg, paddingBottom: space.md, gap: space.sm },
  bell: { flexDirection: 'row', justifyContent: 'center', gap: space.lg, marginTop: space.md },
  wheel: {
    height: ROW * 5,
    borderRadius: radius.sheet,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: 'rgba(255,214,140,0.3)',
    marginHorizontal: space.xl,
  },
  wheelBand: {
    position: 'absolute',
    top: ROW * 2,
    left: space.md,
    right: space.md,
    height: ROW,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: colors.led,
    backgroundColor: 'rgba(255,176,0,0.12)',
  },
  wheelRow: { height: ROW, alignItems: 'center', justifyContent: 'center' },
  dim: { opacity: 0.55 },
  block: { alignSelf: 'stretch', gap: space.sm },
  genders: { flexDirection: 'row', gap: space.sm },
  gender: {
    flex: 1,
    alignItems: 'center',
    gap: 2,
    paddingVertical: space.sm,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  genderOn: { backgroundColor: colors.led, borderColor: '#FFF3C4' },
  emoji: { fontSize: 30, lineHeight: 38 },
  rowBetween: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  topics: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, justifyContent: 'center' },
  topic: {
    width: 92,
    alignItems: 'center',
    gap: 4,
    padding: space.xs,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  topicImg: { width: 60, height: 60, borderRadius: 12 },
  check: {
    position: 'absolute',
    top: -6,
    end: -6,
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: colors.led,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFF3C4',
  },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  input: {
    height: 60,
    borderRadius: radius.control,
    borderWidth: 2,
    borderColor: colors.border,
    backgroundColor: palette.night950,
    color: colors.text,
    paddingHorizontal: space.lg,
    fontFamily: fontFamily.uiMedium,
    fontSize: 22,
    textAlign: 'center',
  },
  inputBad: { borderColor: colors.danger },
});
