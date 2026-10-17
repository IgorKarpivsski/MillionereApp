import type { FamilyPlayer, FamilyState } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Alert, BackHandler, Image, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, FadeInDown, Layout, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { AppText, AvatarBadge, Backdrop, Card, Icon, Led, Sloth, StickerButton, useToast } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound, preloadSounds } from '@/design-system/feedback/sound';
import { colors, palette, radius, space } from '@/design-system/tokens';
import { useFly } from '@/features/home/RewardFly';
import { familyApi } from '@/features/modes/api';
import { RpcError } from '@/features/profile/api';
import { QuestionImageView } from '@/features/quiz/QuestionImage';
import { AnswerTile, type AnswerState } from '@/features/quiz/ui';
import { useWorldsConfig } from '@/features/worlds/api';
import { WORLD_IMAGES } from '@/features/worlds/worldImages';
import { goHome } from '@/lib/goHome';
import { fmt, strings } from '@/lib/i18n';
import { queryKeys } from '@/lib/queryClient';

const t = strings.family;
const COUNTS = [15, 20];

/* ------------------------------------------------------------------ */
/* Polling                                                             */
/* ------------------------------------------------------------------ */

function useFamilyState(room: string | null) {
  const [s, setS] = useState<FamilyState | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [, tick] = useState(0);
  const kick = useRef<() => void>(() => undefined);
  useEffect(() => {
    if (!room) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      clearTimeout(timer);
      try {
        const st = await familyApi.state(room);
        if (!alive) return;
        setS(st);
        setFetchedAt(Date.now());
        if (st.status === 'done' || st.status === 'expired') return;
        timer = setTimeout(poll, st.phase === 'lobby' ? 1500 : 700);
      } catch {
        if (alive) timer = setTimeout(poll, 2000);
      }
    };
    kick.current = () => void poll();
    void poll();
    const id = setInterval(() => tick((x) => x + 1), 250);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(id);
    };
  }, [room]);
  const left = s ? Math.max(0, s.seconds_left - (Date.now() - fetchedAt) / 1000) : 0;
  return { s, left, refresh: () => kick.current() };
}

/* ------------------------------------------------------------------ */
/* Lobby (no room yet)                                                 */
/* ------------------------------------------------------------------ */

function Entry({ onRoom, initialCode }: { onRoom: (id: string) => void; initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? '');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const toast = useToast();
  const join = useCallback(
    async (c: string) => {
      setBusy('join');
      try {
        const r = await familyApi.join(c);
        onRoom(r.room_id);
      } catch (e) {
        const m = e instanceof RpcError ? e.message : '';
        toast(m.includes('full') ? t.full : m.includes('closed') ? t.closed : t.badCode, 'error');
      } finally {
        setBusy(null);
      }
    },
    [onRoom, toast],
  );
  useEffect(() => {
    if (initialCode && /^\d{6}$/.test(initialCode)) void join(initialCode);
  }, [initialCode, join]);

  return (
    <ScrollView contentContainerStyle={styles.lobby}>
      <Sloth size={140} say={t.hostPicks} />
      <View style={styles.titleRow}>
        <Icon name="family" size={44} />
        <AppText variant="title" align="center">
          {t.title}
        </AppText>
      </View>
      <AppText color={colors.textMuted} align="center">
        {t.body}
      </AppText>
      <StickerButton
        label={t.create}
        icon="add-circle"
        tone="prize"
        size="lg"
        fullWidth
        loading={busy === 'create'}
        onPress={async () => {
          setBusy('create');
          try {
            const r = await familyApi.create('mix', 15);
            onRoom(r.room_id);
          } catch {
            toast(strings.errors.generic, 'error');
          } finally {
            setBusy(null);
          }
        }}
      />
      <Card padding={space.md} style={styles.joinCard}>
        <AppText variant="label">{t.haveCode}</AppText>
        <TextInput
          value={code}
          onChangeText={(v) => setCode(v.replace(/\D/g, '').slice(0, 6))}
          keyboardType="number-pad"
          placeholder="000000"
          placeholderTextColor={colors.textDim}
          style={styles.codeInput}
          maxLength={6}
          accessibilityLabel={t.haveCode}
        />
        <StickerButton label={t.join} tone="outline" fullWidth disabled={code.length !== 6} loading={busy === 'join'} onPress={() => void join(code)} />
      </Card>
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Pieces                                                              */
/* ------------------------------------------------------------------ */

function Seat({ p, size = 52 }: { p: FamilyPlayer | null; size?: number }) {
  if (!p) {
    return (
      <View style={[styles.seat, { width: size + 18 }]}>
        <View style={[styles.emptySeat, { width: size, height: size, borderRadius: size / 2 }]}>
          <AppText color={colors.textDim}>+</AppText>
        </View>
      </View>
    );
  }
  return (
    <Animated.View entering={ZoomIn.springify()} style={[styles.seat, { width: size + 18 }]}>
      <View style={!p.online && styles.offline}>
        <AvatarBadge avatarId={p.avatar_id} level={p.level} size={size} ring={p.me ? colors.led : colors.border} />
      </View>
      {p.host ? (
        <View style={styles.crownTag}>
          <AppText variant="caption" style={styles.tiny}>
            👑
          </AppText>
        </View>
      ) : null}
      <AppText variant="caption" numberOfLines={1} style={styles.seatName}>
        {p.me ? t.you : p.username}
      </AppText>
    </Animated.View>
  );
}

function TopicPicker({ value, onChange, disabled }: { value: string; onChange: (w: string) => void; disabled: boolean }) {
  const worlds = useWorldsConfig();
  const items = [{ slug: 'mix', name: t.mix, icon: 'bolt', color: '#FF8A3D' }, ...worlds];
  return (
    <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.topics}>
      {items.map((w) => {
        const on = w.slug === value;
        const img = WORLD_IMAGES[w.icon];
        return (
          <Pressable
            key={w.slug}
            disabled={disabled}
            onPress={() => {
              haptic('tap');
              onChange(w.slug);
            }}
            accessibilityRole="radio"
            accessibilityState={{ checked: on, disabled }}
            accessibilityLabel={w.name}
            style={[styles.topic, { borderColor: on ? colors.led : 'rgba(255,255,255,0.18)' }, on && { backgroundColor: `${w.color}55` }]}
          >
            {img ? <Image source={img} style={styles.topicImg} /> : null}
            <AppText variant="caption" numberOfLines={1} style={styles.bold}>
              {w.name}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

function RoomLobby({ s, onLeave, refresh }: { s: FamilyState; onLeave: () => void; refresh: () => void }) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const worlds = useWorldsConfig();
  const link = `footballmillionaire://family?code=${s.code}`;
  const active = s.players.filter((p) => !p.left);
  const seats: (FamilyPlayer | null)[] = [...active, ...Array.from({ length: Math.max(0, s.max_players - active.length) }, () => null)];
  const topicName = s.world === 'mix' ? t.mix : s.world_name ?? worlds.find((w) => w.slug === s.world)?.name ?? s.world;
  const configure = async (world: string, total: number) => {
    try {
      await familyApi.configure(s.room_id, world, total);
      refresh();
    } catch {
      toast(strings.errors.generic, 'error');
    }
  };
  return (
    <ScrollView contentContainerStyle={styles.lobby}>
      <AppText variant="label" color={colors.textMuted}>
        {t.code}
      </AppText>
      <View style={styles.codeBoard}>
        <Led size="ledXL">{s.code}</Led>
      </View>
      <StickerButton
        label={t.invite}
        icon="logo-whatsapp"
        size="md"
        fullWidth
        onPress={() => void Share.share({ message: fmt(t.shareMessage, { code: s.code, link }) })}
      />
      <Card padding={space.md} style={styles.block}>
        <AppText variant="label">{fmt(t.players, { n: active.length, max: s.max_players })}</AppText>
        <View style={styles.seats}>
          {seats.map((p, i) => (
            <Seat key={p ? `p${p.seat}` : `e${i}`} p={p} />
          ))}
        </View>
        {active.length < 2 ? (
          <View style={styles.waitRow}>
            <ActivityIndicator color={colors.led} size="small" />
            <AppText variant="caption" color={colors.textDim}>
              {t.waitingPlayers}
            </AppText>
          </View>
        ) : null}
      </Card>
      <Card padding={space.md} style={styles.block}>
        <AppText variant="label">{t.topic}</AppText>
        {s.is_host ? (
          <TopicPicker value={s.world} disabled={false} onChange={(w) => void configure(w, s.total)} />
        ) : (
          <AppText variant="heading" color={colors.led}>
            {topicName}
          </AppText>
        )}
        <AppText variant="label">{t.questions}</AppText>
        <View style={styles.counts}>
          {COUNTS.map((n) => {
            const on = s.total === n;
            return (
              <Pressable
                key={n}
                disabled={!s.is_host}
                onPress={() => void configure(s.world, n)}
                accessibilityRole="radio"
                accessibilityState={{ checked: on, disabled: !s.is_host }}
                style={[styles.count, on && styles.countOn, !s.is_host && !on && styles.countOff]}
              >
                <AppText variant="label" color={on ? palette.night950 : colors.text}>
                  {fmt(t.nQuestions, { n })}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </Card>
      {s.is_host ? (
        <StickerButton
          label={active.length < 2 ? t.needTwo : t.start}
          icon="play"
          tone="prize"
          size="lg"
          fullWidth
          disabled={active.length < 2}
          loading={busy}
          onPress={async () => {
            setBusy(true);
            try {
              await familyApi.start(s.room_id);
              refresh();
            } catch {
              toast(strings.errors.generic, 'error');
            } finally {
              setBusy(false);
            }
          }}
        />
      ) : (
        <View style={styles.waitRow}>
          <ActivityIndicator color={colors.led} size="small" />
          <AppText color={colors.textMuted}>{t.hostPicks}</AppText>
        </View>
      )}
      <StickerButton label={t.leave} tone="ghost" fullWidth onPress={onLeave} />
    </ScrollView>
  );
}

/** A strip of everyone in the room: who has answered, and the scores. */
function Strip({ s }: { s: FamilyState }) {
  const reduced = useReducedMotion();
  const players = s.players.filter((p) => !p.left);
  return (
    <View style={styles.strip}>
      {players.map((p) => (
        <Animated.View key={p.seat} layout={reduced ? undefined : Layout.springify()} style={styles.stripItem}>
          <View style={!p.online && styles.offline}>
            <AvatarBadge avatarId={p.avatar_id} size={36} ring={p.me ? colors.led : p.answered ? colors.correct : colors.border} />
          </View>
          {s.phase === 'question' && p.answered ? (
            <View style={styles.check}>
              <AppText variant="caption" style={styles.tiny}>
                ✓
              </AppText>
            </View>
          ) : null}
          {s.phase === 'reveal' && p.points ? (
            <Animated.View entering={reduced ? undefined : FadeInDown} style={styles.gain}>
              <AppText variant="caption" color={palette.night950} style={styles.tiny}>
                {`+${p.points}`}
              </AppText>
            </Animated.View>
          ) : null}
          <Led size="ledS" color={p.me ? colors.led : colors.text}>
            {String(p.score)}
          </Led>
        </Animated.View>
      ))}
    </View>
  );
}

function Results({ s, onAgain }: { s: FamilyState; onAgain: () => void }) {
  const reduced = useReducedMotion();
  const launch = useFly((x) => x.launch);
  const ref = useRef<View>(null);
  const players = s.players.filter((p) => p.score > 0 || !p.left);
  const top = players[0]?.score ?? 0;
  const champs = players.filter((p) => p.score === top && top > 0);
  const meChamp = champs.some((p) => p.me);
  const coins = s.result?.coins ?? 0;
  useEffect(() => {
    if (!coins) return;
    const id = setTimeout(
      () => ref.current?.measureInWindow((x, y, w, h) => launch({ from: { x: x + w / 2, y: y + h / 2 }, kind: 'coins', label: fmt(t.coins, { n: coins }) })),
      900,
    );
    return () => clearTimeout(id);
  }, [coins, launch]);
  return (
    <ScrollView contentContainerStyle={styles.lobby}>
      <Animated.View entering={reduced ? undefined : ZoomIn.springify()} style={styles.center2}>
        <AppText style={styles.crown}>👑</AppText>
        <View style={styles.champRow}>
          {champs.map((p) => (
            <AvatarBadge key={p.seat} avatarId={p.avatar_id} level={p.level} size={96} ring={colors.led} />
          ))}
        </View>
        <AppText variant="title" align="center" color={colors.led}>
          {meChamp ? t.youChampion : champs[0] ? fmt(t.championIs, { name: champs.map((c) => c.username).join(' + ') }) : t.champion}
        </AppText>
      </Animated.View>
      <Card padding={space.md} style={styles.block}>
        <AppText variant="label">{t.finalTable}</AppText>
        {players.map((p, i) => (
          <Animated.View
            key={p.seat}
            entering={reduced ? undefined : FadeInDown.delay(200 + i * 120)}
            style={[styles.rowLine, p.me && styles.rowMe]}
          >
            <AppText variant="heading" style={styles.rank}>
              {i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : String(i + 1)}
            </AppText>
            <AvatarBadge avatarId={p.avatar_id} size={36} />
            <View style={styles.flex}>
              <AppText variant="label" numberOfLines={1}>
                {p.me ? `${p.username} (${t.you})` : p.username}
              </AppText>
              <AppText variant="caption" color={colors.textDim}>
                {fmt(t.correctN, { n: p.correct })}
              </AppText>
            </View>
            <Led size="ledM" color={i === 0 ? colors.led : colors.text}>
              {String(p.score)}
            </Led>
          </Animated.View>
        ))}
      </Card>
      <View ref={ref} collapsable={false}>
        {coins ? (
          <AppText variant="heading" color={colors.led} align="center">
            {fmt(t.coins, { n: coins })}
          </AppText>
        ) : null}
      </View>
      <Sloth size={110} say={meChamp ? t.youChampion : strings.modes.slothHello[3]} />
      <StickerButton label={t.again} icon="refresh" tone="prize" size="lg" fullWidth onPress={onAgain} />
      <StickerButton label={strings.quiz.home} icon="home" tone="ghost" fullWidth onPress={goHome} />
    </ScrollView>
  );
}

/* ------------------------------------------------------------------ */
/* Screen                                                              */
/* ------------------------------------------------------------------ */

export default function FamilyScreen() {
  const params = useLocalSearchParams<{ code?: string }>();
  const [room, setRoom] = useState<string | null>(null);
  const { s, left, refresh } = useFamilyState(room);
  const [picked, setPicked] = useState<{ idx: number; slot: number } | null>(null);
  const toast = useToast();
  const qc = useQueryClient();
  const reduced = useReducedMotion();
  const last = useRef('');

  useEffect(() => {
    preloadSounds(['whistle', 'answer_lock', 'answer_correct', 'answer_wrong', 'coins', 'level_up']);
  }, []);

  useEffect(() => {
    if (!s) return;
    const key = `${s.phase}:${s.idx}`;
    if (key === last.current) return;
    last.current = key;
    if (s.phase === 'question' && s.idx === 0) playSound('whistle');
    if (s.phase === 'reveal' && s.reveal) {
      const mine = s.my_answer ?? (picked?.idx === s.idx ? picked.slot : null);
      playSound(mine === s.reveal.correct_slot ? 'answer_correct' : 'answer_wrong');
    }
    if (s.phase === 'done') {
      playSound('level_up');
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
    }
  }, [s, picked, qc]);

  const leave = useCallback(() => {
    if (room) void familyApi.leave(room).catch(() => undefined);
    router.back();
  }, [room]);

  const live = !!s && (s.phase === 'countdown' || s.phase === 'question' || s.phase === 'reveal');
  useEffect(() => {
    if (!live) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      Alert.alert(t.leaveTitle, t.leaveBody, [
        { text: strings.common.cancel, style: 'cancel' },
        { text: t.leave, style: 'destructive', onPress: leave },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [live, leave]);

  if (!room) {
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop accent="#B14CFF" />
        <View style={styles.top}>
          <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
        </View>
        <Entry onRoom={setRoom} initialCode={params.code} />
      </SafeAreaView>
    );
  }

  if (!s) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Backdrop accent="#B14CFF" />
        <ActivityIndicator color={colors.led} />
      </SafeAreaView>
    );
  }

  if (s.status === 'expired') {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Backdrop />
        <Sloth size={120} say={t.expired} />
        <StickerButton label={t.again} icon="refresh" fullWidth onPress={() => setRoom(null)} />
        <StickerButton label={strings.quiz.home} icon="home" tone="ghost" fullWidth onPress={goHome} />
      </SafeAreaView>
    );
  }

  if (s.phase === 'lobby') {
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop accent="#B14CFF" />
        <RoomLobby s={s} onLeave={leave} refresh={refresh} />
      </SafeAreaView>
    );
  }

  if (s.phase === 'done') {
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop accent="#FFB000" />
        <Results s={s} onAgain={() => setRoom(null)} />
      </SafeAreaView>
    );
  }

  if (s.phase === 'countdown') {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Backdrop accent="#B14CFF" />
        <Strip s={s} />
        <AppText variant="title">{s.world === 'mix' ? t.mix : s.world_name ?? ''}</AppText>
        <Animated.View key={Math.ceil(left)} entering={reduced ? undefined : ZoomIn}>
          <Led size="ledXL">{String(Math.max(1, Math.ceil(left)))}</Led>
        </Animated.View>
        <AppText color={colors.textMuted}>{fmt(t.nQuestions, { n: s.total })}</AppText>
      </SafeAreaView>
    );
  }

  // question / reveal
  const q = s.question;
  const mine = s.my_answer ?? (picked?.idx === s.idx ? picked.slot : null);
  const pending = s.players.filter((p) => !p.left && p.online && !p.answered).length;
  const stateFor = (slot: number): AnswerState => {
    if (s.phase === 'reveal' && s.reveal) {
      if (slot === s.reveal.correct_slot) return mine === slot ? 'correctPicked' : 'correctMissed';
      if (slot === mine) return 'wrongPicked';
      return 'dim';
    }
    if (mine === slot) return 'picked';
    return mine !== null ? 'dim' : 'idle';
  };
  const pickers = (slot: number) => (s.phase === 'reveal' ? s.players.filter((p) => p.slot === slot) : []);

  return (
    <SafeAreaView style={styles.root}>
      <Backdrop accent="#B14CFF" />
      <Strip s={s} />
      <ScrollView contentContainerStyle={styles.body}>
        <View style={styles.info}>
          <AppText variant="caption" color={colors.textDim}>
            {fmt(t.questionOf, { n: s.idx + 1, total: s.total })}
          </AppText>
          {s.phase === 'question' ? (
            <Led size="ledM" color={left <= 5 ? colors.danger : colors.text}>
              {String(Math.ceil(left)).padStart(2, '0')}
            </Led>
          ) : null}
        </View>
        <View style={styles.progress}>
          <View style={[styles.progressFill, { width: `${((s.idx + (s.phase === 'reveal' ? 1 : 0)) / s.total) * 100}%` }]} />
        </View>
        {q ? (
          <Animated.View key={q.id} entering={reduced ? undefined : FadeIn} style={styles.qCard}>
            {q.category_name ? (
              <View style={styles.chip}>
                <AppText variant="caption" color={colors.led}>
                  {q.category_name}
                </AppText>
              </View>
            ) : null}
            <AppText variant="question" color={colors.cardText}>
              {q.text}
            </AppText>
            {q.image ? <QuestionImageView image={q.image} /> : null}
          </Animated.View>
        ) : null}
        <View style={styles.answers}>
          {q?.answers.map((a, i) => (
            <View key={`${q.id}-${a.slot}`}>
              <AnswerTile
                fill
                index={i}
                text={a.text}
                state={stateFor(a.slot)}
                disabled={s.phase !== 'question' || mine !== null}
                onPress={() => {
                  setPicked({ idx: s.idx, slot: a.slot });
                  playSound('answer_lock');
                  haptic('tap');
                  familyApi
                    .answer(s.room_id, s.idx, a.slot)
                    .then(refresh)
                    .catch(() => toast(t.tooLate, 'error'));
                }}
              />
              {pickers(a.slot).length ? (
                <View style={styles.pickers}>
                  {pickers(a.slot).map((p) => (
                    <AvatarBadge key={p.seat} avatarId={p.avatar_id} size={24} ring={p.me ? colors.led : colors.border} />
                  ))}
                </View>
              ) : null}
            </View>
          ))}
        </View>
        <AppText variant="label" color={colors.textMuted} align="center">
          {s.phase === 'reveal'
            ? s.reveal?.explanation ?? ''
            : mine !== null
              ? pending > 0
                ? `${t.locked} · ${fmt(t.waitingOthers, { n: pending })}`
                : t.everyone
              : strings.match.fastBonus}
        </AppText>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bgDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg, padding: space.xl },
  center2: { alignItems: 'center', gap: space.sm },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.sm },
  lobby: { padding: space.lg, gap: space.md, alignItems: 'center' },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  joinCard: { alignSelf: 'stretch', gap: space.sm },
  block: { alignSelf: 'stretch', gap: space.sm },
  codeInput: {
    backgroundColor: colors.bgDeep,
    color: colors.led,
    fontFamily: 'DotGothic16_400Regular',
    fontSize: 34,
    textAlign: 'center',
    letterSpacing: 6,
    borderRadius: radius.board,
    paddingVertical: space.sm,
    writingDirection: 'ltr',
  },
  codeBoard: {
    paddingHorizontal: space.xl,
    paddingVertical: space.xs,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.led,
  },
  seats: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: space.xs },
  seat: { alignItems: 'center', gap: 2, paddingVertical: space.xs },
  emptySeat: { borderWidth: 2, borderStyle: 'dashed', borderColor: 'rgba(255,255,255,0.3)', alignItems: 'center', justifyContent: 'center' },
  seatName: { maxWidth: 70, fontFamily: 'IBMPlexSansHebrew_700Bold' },
  crownTag: { position: 'absolute', top: -2, start: 2 },
  offline: { opacity: 0.4 },
  tiny: { fontSize: 11, lineHeight: 14, fontFamily: 'IBMPlexSansHebrew_700Bold' },
  bold: { fontFamily: 'IBMPlexSansHebrew_700Bold' },
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm, justifyContent: 'center' },
  topics: { gap: space.sm, paddingVertical: 2 },
  topic: { width: 84, alignItems: 'center', gap: 4, padding: space.xs, borderRadius: 14, borderWidth: 2, backgroundColor: 'rgba(255,255,255,0.06)' },
  topicImg: { width: 56, height: 56, borderRadius: 12 },
  counts: { flexDirection: 'row', gap: space.sm },
  count: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: space.sm,
    borderRadius: 12,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.25)',
  },
  countOn: { backgroundColor: colors.led, borderColor: '#FFF3C4' },
  countOff: { opacity: 0.4 },
  strip: {
    flexDirection: 'row',
    justifyContent: 'center',
    flexWrap: 'wrap',
    gap: space.sm,
    marginHorizontal: space.md,
    marginTop: space.sm,
    padding: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.border,
  },
  stripItem: { alignItems: 'center', minWidth: 44 },
  check: {
    position: 'absolute',
    top: -4,
    end: -2,
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: colors.correct,
    alignItems: 'center',
    justifyContent: 'center',
  },
  gain: { position: 'absolute', top: -8, paddingHorizontal: 4, borderRadius: 6, backgroundColor: colors.led },
  body: { padding: space.md, gap: space.md },
  info: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  progress: { height: 6, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  progressFill: { height: '100%', backgroundColor: colors.led },
  qCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.sm },
  chip: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.board },
  answers: { gap: space.sm },
  pickers: { flexDirection: 'row', gap: 4, position: 'absolute', bottom: -8, start: space.md },
  crown: { fontSize: 46, lineHeight: 56 },
  champRow: { flexDirection: 'row', gap: space.md },
  rowLine: { flexDirection: 'row', alignItems: 'center', gap: space.sm, padding: space.xs, borderRadius: 12 },
  rowMe: { backgroundColor: 'rgba(255,176,0,0.15)' },
  rank: { width: 34, textAlign: 'center' },
  flex: { flex: 1 },
});
