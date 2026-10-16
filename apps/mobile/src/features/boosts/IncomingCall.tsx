import { Ionicons } from '@expo/vector-icons';
import type { IncomingCall } from '@fm/shared';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, StyleSheet, View } from 'react-native';
import Animated, { ZoomIn } from 'react-native-reanimated';
import { AppText, AvatarBadge, Card, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { colors, space } from '@/design-system/tokens';
import { useAuth } from '@/features/auth/AuthProvider';
import { AnswerTile } from '@/features/quiz/ui';
import { fmt, strings } from '@/lib/i18n';
import { boostsApi } from './api';

const PING_MS = 8000;

/**
 * Keeps the player "online" while the app is open and shows a friend's
 * phone-a-friend call: the question, and one tap to send an answer back.
 */
export function IncomingCallHost() {
  const { session } = useAuth();
  const toast = useToast();
  const [call, setCall] = useState<IncomingCall | null>(null);
  const [secs, setSecs] = useState(0);
  const [sending, setSending] = useState(false);
  const handled = useRef(new Set<string>());

  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const ping = async () => {
      try {
        const calls = await boostsApi.ping();
        const fresh = calls.find((c) => !handled.current.has(c.id));
        if (fresh) {
          setCall((cur) => {
            if (cur) return cur;
            haptic('heavy');
            playSound('whistle');
            setSecs(fresh.seconds_left);
            return fresh;
          });
        }
      } catch {
        // offline: try again on the next tick
      }
    };
    const startTimer = () => {
      if (timer) return;
      void ping();
      timer = setInterval(() => void ping(), PING_MS);
    };
    const stopTimer = () => {
      if (timer) clearInterval(timer);
      timer = null;
    };
    if (AppState.currentState === 'active') startTimer();
    const sub = AppState.addEventListener('change', (st) => (st === 'active' ? startTimer() : stopTimer()));
    return () => {
      stopTimer();
      sub.remove();
    };
  }, [session]);

  // Countdown for the open call.
  useEffect(() => {
    if (!call) return;
    const id = setInterval(() => {
      setSecs((v) => {
        if (v <= 1) {
          handled.current.add(call.id);
          setCall(null);
          return 0;
        }
        return v - 1;
      });
    }, 1000);
    return () => clearInterval(id);
  }, [call]);

  const close = () => {
    if (call) handled.current.add(call.id);
    setCall(null);
  };

  const send = async (slot: number) => {
    if (!call || sending) return;
    setSending(true);
    try {
      await boostsApi.answerCall(call.id, slot);
      haptic('success');
      toast(fmt(strings.call.sent, { name: call.from }), 'success');
    } catch {
      toast(strings.errors.generic, 'error');
    } finally {
      setSending(false);
      close();
    }
  };

  return (
    <Modal visible={!!call} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.scrim}>
        {call ? (
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.wrap}>
            <Card kind="sticker" frame={colors.correct}>
              <View style={styles.head}>
                <AvatarBadge avatarId={call.avatar_id ?? 'avatar_01'} size={52} ring={colors.correct} />
                <View style={styles.flex}>
                  <AppText variant="heading">{fmt(strings.call.incomingTitle, { name: call.from })}</AppText>
                  <AppText variant="caption" color={colors.textMuted}>
                    {strings.call.incomingBody}
                  </AppText>
                </View>
                <View style={styles.timer}>
                  <Ionicons name="call" size={16} color={colors.correct} />
                  <AppText variant="label" color={colors.correct}>
                    {String(secs)}
                  </AppText>
                </View>
              </View>
              <View style={styles.question}>
                <AppText variant="question" color={colors.cardText}>
                  {call.question.text}
                </AppText>
              </View>
              <View style={styles.answers}>
                {call.question.answers.map((a, i) => (
                  <AnswerTile
                    key={a.slot}
                    index={i}
                    text={a.text}
                    state={call.question.removed.includes(a.slot) ? 'removed' : 'idle'}
                    disabled={sending}
                    fill
                    onPress={() => void send(a.slot)}
                  />
                ))}
              </View>
              <StickerButton label={strings.call.later} tone="ghost" size="sm" fullWidth onPress={close} />
            </Card>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,4,24,0.82)', justifyContent: 'center', padding: space.md },
  wrap: { width: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  flex: { flex: 1 },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  question: { backgroundColor: colors.card, borderRadius: 16, padding: space.md, marginBottom: space.md },
  answers: { gap: space.sm, marginBottom: space.md },
});
