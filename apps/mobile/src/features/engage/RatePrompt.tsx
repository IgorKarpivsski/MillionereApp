import { Linking, Modal, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { create } from 'zustand';
import { AppText, Card, Sloth, StickerButton } from '@/design-system/components';
import { colors, space } from '@/design-system/tokens';
import { useSettingsStore } from '@/features/settings/store';
import { strings } from '@/lib/i18n';

const PACKAGE = 'com.haaluf.trivia';
const WEEK = 7 * 24 * 60 * 60 * 1000;
/** Ask at most this many times in total. */
const MAX_SHOWS = 2;
/** Wait for this many good results first, so new players aren't asked on their first game. */
const MIN_GOOD = 3;

/**
 * The sloth asks for a Google Play rating after a good game.
 * Google Play rules: no "do you like the app?" question and no filtering (everyone gets the same
 * button, and it opens the Play Store page itself, not the in-app review card), and no reward for
 * rating. Shown at most twice ("later" waits a week), never again after "rate".
 */
const useRatePrompt = create<{ open: boolean }>(() => ({ open: false }));

/** Call after a good result. Opens the popup if it's due. */
export function maybeAskForRating(): void {
  const st = useSettingsStore.getState();
  if (st.reviewAsked || st.rateShown >= MAX_SHOWS) return;
  const good = st.rateGood + 1;
  st.set({ rateGood: good });
  if (good < MIN_GOOD) return;
  if (st.rateNextAt && Date.now() < st.rateNextAt) return;
  st.set({ rateShown: st.rateShown + 1, rateNextAt: Date.now() + WEEK });
  useRatePrompt.setState({ open: true });
}

/** Opens the game's page in the Play Store (falls back to the web page). */
export function openStorePage(): void {
  Linking.openURL(`market://details?id=${PACKAGE}`).catch(() =>
    Linking.openURL(`https://play.google.com/store/apps/details?id=${PACKAGE}`),
  );
}

export function RatePromptHost() {
  const open = useRatePrompt((s) => s.open);
  const t = strings.rate;
  const close = (done: boolean) => {
    const st = useSettingsStore.getState();
    if (done || st.rateShown >= MAX_SHOWS) st.set({ reviewAsked: true });
    useRatePrompt.setState({ open: false });
  };
  return (
    <Modal visible={open} transparent animationType="fade" onRequestClose={() => close(false)} statusBarTranslucent>
      <View style={styles.scrim}>
        <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.wrap}>
          <Card kind="sticker">
            <View style={styles.center}>
              <Sloth size={130} say={t.bubble} />
            </View>
            <AppText variant="title" align="center">
              {t.title}
            </AppText>
            <AppText color={colors.textMuted} align="center" style={styles.body}>
              {t.body}
            </AppText>
            <StickerButton
              label={t.rate}
              icon="star"
              size="lg"
              tone="prize"
              fullWidth
              onPress={() => {
                close(true);
                openStorePage();
              }}
            />
            <StickerButton label={t.later} tone="ghost" size="sm" fullWidth style={styles.later} onPress={() => close(false)} />
          </Card>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,4,24,0.82)', justifyContent: 'center', padding: space.lg },
  wrap: { width: '100%' },
  center: { alignItems: 'center', justifyContent: 'flex-end', minHeight: 190, marginBottom: space.sm },
  body: { marginVertical: space.md },
  later: { marginTop: space.sm },
});
