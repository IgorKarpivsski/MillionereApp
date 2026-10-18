import { Ionicons } from '@expo/vector-icons';
import type { FamilyInvite, IncomingCall, MatchInvite } from '@fm/shared';
import { router } from 'expo-router';
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
import { teenApi } from '@/features/teen/api';
import { familyApi } from '@/features/modes/api';
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
  const [invite, setInvite] = useState<MatchInvite | null>(null);
  const [joining, setJoining] = useState(false);
  const seenInvites = useRef(new Set<number>());
  const [famInvite, setFamInvite] = useState<FamilyInvite | null>(null);
  const seenFam = useRef(new Set<number>());

  useEffect(() => {
    if (!session) return;
    let timer: ReturnType<typeof setInterval> | null = null;
    const ping = async () => {
      try {
        const { calls, invites, family_invites } = await boostsApi.ping();
        const fam = family_invites.find((i) => !seenFam.current.has(i.id));
        if (fam) {
          seenFam.current.add(fam.id);
          setFamInvite((cur) => {
            if (cur) return cur;
            haptic('heavy');
            playSound('whistle');
            return fam;
          });
        }
        const inv = invites.find((i) => !seenInvites.current.has(i.id));
        if (inv) {
          seenInvites.current.add(inv.id);
          setInvite((cur) => {
            if (cur) return cur;
            haptic('heavy');
            playSound('whistle');
            return inv;
          });
        }
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

  const answerInvite = async (accept: boolean) => {
    if (!invite) return;
    const inv = invite;
    setJoining(true);
    try {
      const room = await teenApi.answerInvite(inv.id, accept);
      setInvite(null);
      if (accept && room) router.push({ pathname: '/match', params: { room: room.room_id } });
    } catch {
      setInvite(null);
      if (accept) toast(strings.teen.inviteGone, 'info');
    } finally {
      setJoining(false);
    }
  };

  const answerFamily = async (accept: boolean) => {
    if (!famInvite) return;
    const inv = famInvite;
    setJoining(true);
    try {
      const room = await familyApi.answerInvite(inv.id, accept);
      setFamInvite(null);
      if (accept && room) router.push({ pathname: '/family', params: { room: room.room_id } });
    } catch {
      setFamInvite(null);
      if (accept) toast(strings.teen.inviteGone, 'info');
    } finally {
      setJoining(false);
    }
  };

  return (
    <>
    <Modal visible={!!famInvite && !call && !invite} transparent animationType="fade" onRequestClose={() => void answerFamily(false)} statusBarTranslucent>
      <View style={styles.scrim}>
        {famInvite ? (
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.wrap}>
            <Card kind="sticker" frame={colors.prize}>
              <View style={styles.inviteHead}>
                <AvatarBadge avatarId={famInvite.avatar_id ?? 'avatar_01'} photo={famInvite.photo} size={72} ring={colors.prize} />
                <AppText variant="title" align="center">
                  {fmt(strings.family.familyInviteTitle, { name: famInvite.from })}
                </AppText>
                <AppText color={colors.textMuted} align="center">
                  {strings.family.familyInviteBody}
                </AppText>
              </View>
              <StickerButton label={strings.teen.inviteAccept} icon="people" tone="prize" size="lg" fullWidth loading={joining} onPress={() => void answerFamily(true)} />
              <StickerButton label={strings.teen.inviteDecline} tone="ghost" size="sm" fullWidth disabled={joining} onPress={() => void answerFamily(false)} style={styles.later} />
            </Card>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
    <Modal visible={!!invite && !call} transparent animationType="fade" onRequestClose={() => void answerInvite(false)} statusBarTranslucent>
      <View style={styles.scrim}>
        {invite ? (
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.wrap}>
            <Card kind="sticker" frame={colors.danger}>
              <View style={styles.inviteHead}>
                <AvatarBadge avatarId={invite.avatar_id ?? 'avatar_01'} photo={invite.photo} size={72} ring={colors.danger} />
                <AppText variant="title" align="center">
                  {fmt(strings.teen.inviteTitle, { name: invite.from })}
                </AppText>
                <AppText color={colors.textMuted} align="center">
                  {strings.teen.inviteBody}
                </AppText>
              </View>
              <StickerButton label={strings.teen.inviteAccept} icon="flash" tone="prize" size="lg" fullWidth loading={joining} onPress={() => void answerInvite(true)} />
              <StickerButton label={strings.teen.inviteDecline} tone="ghost" size="sm" fullWidth disabled={joining} onPress={() => void answerInvite(false)} style={styles.later} />
            </Card>
          </Animated.View>
        ) : null}
      </View>
    </Modal>
    <Modal visible={!!call} transparent animationType="fade" onRequestClose={close} statusBarTranslucent>
      <View style={styles.scrim}>
        {call ? (
          <Animated.View entering={ZoomIn.springify().damping(14)} style={styles.wrap}>
            <Card kind="sticker" frame={colors.correct}>
              <View style={styles.head}>
                <AvatarBadge avatarId={call.avatar_id ?? 'avatar_01'} photo={call.photo} size={52} ring={colors.correct} />
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
    </>
  );
}

const styles = StyleSheet.create({
  scrim: { flex: 1, backgroundColor: 'rgba(8,4,24,0.82)', justifyContent: 'center', padding: space.md },
  wrap: { width: '100%' },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.sm, marginBottom: space.md },
  flex: { flex: 1 },
  inviteHead: { alignItems: 'center', gap: space.sm, marginBottom: space.md },
  later: { marginTop: space.sm },
  timer: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  question: { backgroundColor: colors.card, borderRadius: 16, padding: space.md, marginBottom: space.md },
  answers: { gap: space.sm, marginBottom: space.md },
});
