import type { MatchState } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { markModeSeen } from '@/features/settings/store';
import { ActivityIndicator, BackHandler, Pressable, ScrollView, Share, StyleSheet, TextInput, View } from 'react-native';
import Animated, { FadeIn, ZoomIn } from 'react-native-reanimated';
import { SafeAreaView } from 'react-native-safe-area-context';
import { appAlert, AppText, AvatarBadge, Card, Led, Sloth, StickerButton, TrophyLogo, useToast, Backdrop } from '@/design-system/components';
import { haptic } from '@/design-system/feedback/haptics';
import { useReducedMotion } from '@/design-system/feedback/reducedMotion';
import { playSound, preloadSounds } from '@/design-system/feedback/sound';
import { colors, radius, space } from '@/design-system/tokens';
import { matchApi } from '@/features/match/api';
import { RpcError } from '@/features/profile/api';
import { AnswerTile, type AnswerState } from '@/features/quiz/ui';
import { queryKeys } from '@/lib/queryClient';
import { goHome } from '@/lib/goHome';
import { teenApi } from '@/features/teen/api';
import { ReactionLayer } from '@/features/teen/Reactions';
import { ShareResultButton } from '@/features/teen/ShareResult';
import { PostGameRank } from '@/features/teen/PostGame';
import { fmt, strings } from '@/lib/i18n';
import { QuestionImageView } from '@/features/quiz/QuestionImage';
import { showName } from '@/lib/names';

const t = strings.match;

function Lobby({ onRoom, initialCode }: { onRoom: (id: string) => void; initialCode?: string }) {
  const [code, setCode] = useState(initialCode ?? '');
  const [busy, setBusy] = useState<'create' | 'join' | null>(null);
  const toast = useToast();

  const join = useCallback(
    async (c: string) => {
      setBusy('join');
      try {
        const r = await matchApi.join(c);
        onRoom(r.room_id);
      } catch (e) {
        toast(e instanceof RpcError && e.message.includes('closed') ? t.roomClosed : t.badCode, 'error');
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
      <TrophyLogo size={90} />
      <AppText variant="title" align="center">
        {t.title}
      </AppText>
      <AppText color={colors.textMuted} align="center">
        {t.body}
      </AppText>
      <StickerButton
        label={t.create}
        icon="add-circle"
        size="lg"
        fullWidth
        loading={busy === 'create'}
        onPress={async () => {
          setBusy('create');
          try {
            const r = await matchApi.create();
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
        <StickerButton
          label={t.join}
          tone="outline"
          fullWidth
          disabled={code.length !== 6}
          loading={busy === 'join'}
          onPress={() => void join(code)}
        />
      </Card>
    </ScrollView>
  );
}

const r = strings.random;

/** Random opponent: matchmaking, then — if nobody is around — an offer to play the sloth. */
function Searching({ room, onCancel }: { room: string; onCancel: () => void }) {
  const [secs, setSecs] = useState(0);
  const [offer, setOffer] = useState(false);
  const [busy, setBusy] = useState(false);
  const toast = useToast();
  useEffect(() => {
    const id = setInterval(() => setSecs((x) => x + 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (secs === 10) setOffer(true);
  }, [secs]);
  return (
    <ScrollView contentContainerStyle={[styles.lobby, styles.grow]}>
      <Sloth size={140} say={offer ? r.botTitle : r.searching} />
      <View style={styles.waitRow}>
        <ActivityIndicator color={colors.led} />
        <Led size="ledM">{`${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, '0')}`}</Led>
      </View>
      <AppText color={colors.textMuted} align="center">
        {offer ? r.botBody : r.searchingBody}
      </AppText>
      {offer ? (
        <>
          <StickerButton
            label={r.botPlay}
            icon="game-controller"
            tone="prize"
            size="lg"
            fullWidth
            loading={busy}
            onPress={async () => {
              setBusy(true);
              try {
                await matchApi.bot(room);
              } catch {
                toast(strings.errors.generic, 'error');
              } finally {
                setBusy(false);
              }
            }}
          />
          <StickerButton label={r.keepWaiting} tone="outline" fullWidth onPress={() => { setOffer(false); setSecs(0); }} />
        </>
      ) : null}
      <StickerButton label={r.cancel} tone="ghost" fullWidth onPress={onCancel} />
    </ScrollView>
  );
}

function useMatchState(room: string | null) {
  const [s, setS] = useState<MatchState | null>(null);
  const [fetchedAt, setFetchedAt] = useState(0);
  const [, tick] = useState(0);
  useEffect(() => {
    if (!room) return;
    let alive = true;
    let timer: ReturnType<typeof setTimeout>;
    const poll = async () => {
      try {
        const st = await matchApi.state(room);
        if (!alive) return;
        setS(st);
        setFetchedAt(Date.now());
        if (st.phase === 'done' || st.phase === 'expired') return;
        timer = setTimeout(poll, st.phase === 'waiting' ? 1500 : 800);
      } catch {
        if (alive) timer = setTimeout(poll, 2000);
      }
    };
    void poll();
    const id = setInterval(() => tick((x) => x + 1), 250);
    return () => {
      alive = false;
      clearTimeout(timer);
      clearInterval(id);
    };
  }, [room]);
  const left = s ? Math.max(0, s.seconds_left - (Date.now() - fetchedAt) / 1000) : 0;
  return { s, left };
}

function Players({ s }: { s: MatchState }) {
  const reduced = useReducedMotion();
  return (
    <View style={styles.board}>
      <View style={styles.player}>
        <AvatarBadge avatarId={s.me.avatar_id} photo={s.me.photo} level={s.me.level} frame={s.me.frame} size={34} />
        <AppText variant="caption" numberOfLines={1} style={styles.pname}>
          {showName(s.me.username)}
        </AppText>
      </View>
      <View style={styles.digits}>
        <Animated.View key={`m${s.my_score}`} entering={reduced ? undefined : ZoomIn}>
          <Led size="ledM">{s.my_score}</Led>
        </Animated.View>
        <Led size="ledM">:</Led>
        <Animated.View key={`o${s.opp_score}`} entering={reduced ? undefined : ZoomIn}>
          <Led size="ledM" color={colors.text}>
            {s.opp_score}
          </Led>
        </Animated.View>
      </View>
      <View style={styles.player}>
        <AvatarBadge avatarId={s.opponent?.avatar_id ?? 'avatar_01'} photo={s.opponent?.photo} level={s.opponent?.level ?? 1} frame={s.opponent?.frame} size={34} />
        <AppText variant="caption" numberOfLines={1} style={styles.pname}>
          {s.opponent ? showName(s.opponent.username) : '…'}
        </AppText>
        {s.is_bot ? (
          <AppText variant="caption" color={colors.textDim} numberOfLines={1} style={styles.botTag}>
            {strings.random.botTag}
          </AppText>
        ) : s.opponent?.title ? (
          <AppText variant="caption" color={colors.led} numberOfLines={1} style={styles.botTag}>
            {s.opponent.title}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

export default function MatchScreen() {
  const params = useLocalSearchParams<{ code?: string; mode?: string; room?: string }>();
  useEffect(() => {
    if (params.mode === 'random') markModeSeen('random');
  }, [params.mode]);
  const toast = useToast();
  const random = params.mode === 'random';
  const [room, setRoom] = useState<string | null>(params.room ?? null);
  const [finding, setFinding] = useState(false);
  const [rematching, setRematching] = useState(false);
  // an accepted invite (revenge round / challenge) opens the match with its room
  useEffect(() => {
    if (params.room) setRoom(params.room);
  }, [params.room]);
  const find = useCallback(async () => {
    setFinding(true);
    setRoom(null);
    try {
      const f = await matchApi.find();
      setRoom(f.room_id);
    } catch {
      toast(strings.errors.generic, 'error');
      router.back();
    } finally {
      setFinding(false);
    }
  }, [toast]);
  useEffect(() => {
    if (random) void find();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [random]);
  const { s, left } = useMatchState(room);
  const [picked, setPicked] = useState<{ idx: number; slot: number } | null>(null);
  const qc = useQueryClient();
  const lastPhase = useRef<string>('');

  useEffect(() => {
    preloadSounds(['whistle', 'answer_lock', 'answer_correct', 'answer_wrong', 'coins']);
  }, []);

  // Sounds on phase changes.
  useEffect(() => {
    if (!s) return;
    const key = `${s.phase}:${s.idx}`;
    if (key === lastPhase.current) return;
    lastPhase.current = key;
    if (s.phase === 'question' && s.idx === 0) playSound('whistle');
    if (s.phase === 'reveal' && s.reveal) {
      const mine = s.my_answer ?? picked?.slot;
      playSound(mine === s.reveal.correct_slot ? 'answer_correct' : 'answer_wrong');
    }
    if (s.phase === 'done') {
      playSound('coins');
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
    }
  }, [s, picked, qc]);

  // Leaving a live match needs a confirmation (Android back button).
  const live = !!s && (s.phase === 'countdown' || s.phase === 'question' || s.phase === 'reveal');
  useEffect(() => {
    if (!live) return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      appAlert(t.exitTitle, t.exitBody, [
        { text: strings.common.cancel, style: 'cancel' },
        { text: t.exit, style: 'destructive', onPress: () => router.back() },
      ]);
      return true;
    });
    return () => sub.remove();
  }, [live]);

  if (!room && (random || finding)) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Backdrop />
        <Sloth size={140} say={r.searching} />
        <ActivityIndicator color={colors.led} />
      </SafeAreaView>
    );
  }

  if (!room) {
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop />
        <View style={styles.top}>
          <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
        </View>
        <Lobby onRoom={setRoom} initialCode={params.code} />
      </SafeAreaView>
    );
  }

  if (!s) {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Backdrop />
        <ActivityIndicator color={colors.led} />
      </SafeAreaView>
    );
  }

  if (s.kind === 'random' && s.phase === 'waiting') {
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop />
        <Searching
          room={s.room_id}
          onCancel={() => {
            void matchApi.cancel(s.room_id).catch(() => undefined);
            router.back();
          }}
        />
      </SafeAreaView>
    );
  }

  if (s.phase === 'waiting' || s.phase === 'expired') {
    const link = `footballmillionaire://match?code=${s.code}`;
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop />
        <View style={styles.top}>
          <StickerButton label={strings.common.close} tone="ghost" size="sm" onPress={() => router.back()} />
        </View>
        <View style={[styles.center, styles.pad]}>
          <AppText variant="heading">{s.phase === 'expired' ? t.expired : t.shareTitle}</AppText>
          <Led size="ledXL">{s.code}</Led>
          <AppText color={colors.textMuted} align="center">
            {t.shareBody}
          </AppText>
          <StickerButton
            label={t.share}
            icon="logo-whatsapp"
            size="lg"
            fullWidth
            onPress={() => void Share.share({ message: fmt(t.shareMessage, { code: s.code, link }) })}
          />
          {s.phase === 'waiting' ? (
            <View style={styles.waitRow}>
              <ActivityIndicator color={colors.led} />
              <AppText color={colors.textDim}>{t.waiting}</AppText>
            </View>
          ) : null}
        </View>
      </SafeAreaView>
    );
  }

  if (s.phase === 'countdown') {
    return (
      <SafeAreaView style={[styles.root, styles.center]}>
        <Backdrop />
        {s.kind === 'random' ? <AppText variant="title">{r.found}</AppText> : null}
        <AvatarBadge avatarId={s.opponent?.avatar_id ?? 'avatar_01'} photo={s.opponent?.photo} level={s.opponent?.level ?? 1} size={88} ring={colors.led} />
        <AppText variant="heading">{fmt(t.vs, { name: showName(s.opponent?.username) ?? '' })}</AppText>
        {s.is_bot ? <AppText color={colors.textDim}>{r.botTag}</AppText> : null}
        <Animated.View key={Math.ceil(left)} entering={ZoomIn}>
          <Led size="ledXL">{Math.max(1, Math.ceil(left))}</Led>
        </Animated.View>
      </SafeAreaView>
    );
  }

  if (s.phase === 'done') {
    const win = s.my_score > s.opp_score;
    const draw = s.my_score === s.opp_score;
    return (
      <SafeAreaView style={styles.root}>
        <Backdrop />
        <ScrollView contentContainerStyle={[styles.center, styles.pad]}>
          <TrophyLogo size={win ? 120 : 80} color={win ? colors.led : colors.border} />
          <AppText variant="title" align="center">
            {draw ? t.draw : win ? t.win : fmt(t.lose, { name: showName(s.opponent?.username) ?? '' })}
          </AppText>
          <Players s={s} />
          {s.result?.coins ? (
            <Animated.View entering={FadeIn.delay(300)}>
              <Led size="ledM">{`+${s.result.coins}`}</Led>
            </Animated.View>
          ) : null}
          <StickerButton
            label={s.is_bot ? r.again : win ? strings.teen.again : strings.teen.revenge}
            icon={win || s.is_bot ? 'refresh' : 'flame'}
            size="lg"
            tone={win || s.is_bot ? 'primary' : 'danger'}
            fullWidth
            loading={rematching}
            onPress={async () => {
              if (s.is_bot) return void find();
              setRematching(true);
              try {
                const next = await teenApi.rematch(s.room_id);
                toast(fmt(strings.teen.revengeSent, { name: showName(s.opponent?.username) ?? '' }), 'success');
                setPicked(null);
                setRoom(next.room_id);
              } catch {
                if (s.kind === 'random') void find();
                else setRoom(null);
              } finally {
                setRematching(false);
              }
            }}
          />
          <PostGameRank points={0} />
          <ShareResultButton
            big={`${s.my_score}:${s.opp_score}`}
            line={fmt(win ? strings.teen.shareMatchWin : strings.teen.shareMatch, { me: s.my_score, opp: s.opp_score })}
          />
          <StickerButton label={strings.quiz.home} icon="home" tone="ghost" fullWidth onPress={goHome} />
        </ScrollView>
      </SafeAreaView>
    );
  }

  const q = s.question;
  const idx = s.idx ?? 0;
  const mine = s.my_answer ?? (picked?.idx === idx ? picked.slot : null);
  const stateFor = (slot: number): AnswerState => {
    if (s.phase === 'reveal' && s.reveal) {
      if (slot === s.reveal.correct_slot) return mine === slot ? 'correctPicked' : 'correctMissed';
      if (slot === mine) return 'wrongPicked';
      return 'dim';
    }
    if (mine === slot) return 'picked';
    return mine !== null ? 'dim' : 'idle';
  };

  return (
    <SafeAreaView style={styles.root}>
      <Backdrop />
      <Players s={s} />
      <ScrollView style={styles.scrollArea} contentContainerStyle={styles.body}>
        <View style={styles.info}>
          <AppText variant="caption" color={colors.textDim}>
            {fmt(strings.quiz.questionOf, { n: idx + 1, total: s.total })}
          </AppText>
          <Led size="ledM" color={s.phase === 'question' && left <= 5 ? colors.danger : colors.text}>
            {String(Math.ceil(left)).padStart(2, '0')}
          </Led>
        </View>
        {q ? (
          <Animated.View key={q.id} entering={FadeIn} style={styles.qCard}>
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
            {q.author ? (
              <AppText variant="caption" color={colors.cardMuted}>
                {`✍️ ${fmt(strings.teen.questionBy, { name: q.author })}`}
              </AppText>
            ) : null}
          </Animated.View>
        ) : null}
        <AppText variant="caption" color={colors.textDim} align="center">
          {s.phase === 'reveal'
            ? s.reveal?.explanation ?? ''
            : s.opp_answered
              ? fmt(t.oppAnswered, { name: showName(s.opponent?.username) ?? '' })
              : t.fastBonus}
        </AppText>
      </ScrollView>
      {/* answers stay pinned under the question: always on screen, even on small phones */}
      <View style={styles.answersDock}>
          <View style={styles.grid}>
            {q?.answers.map((a, i) => (
              <View key={`${q.id}-${a.slot}`} style={styles.tileWrap}>
                <AnswerTile
                  fill
                  index={i}
                  text={a.text}
                  state={stateFor(a.slot)}
                  disabled={s.phase !== 'question' || mine !== null}
                  onPress={() => {
                    setPicked({ idx, slot: a.slot });
                    playSound('answer_lock');
                    haptic('tap');
                    matchApi.answer(s.room_id, idx, a.slot).catch(() => toast(t.tooLate, 'error'));
                  }}
                />
                {s.phase === 'reveal' && s.reveal?.opp_slot === a.slot ? (
                  <View style={styles.oppMark}>
                    <AppText variant="caption" color={colors.textOnBright} numberOfLines={1}>
                      {showName(s.opponent?.username) ?? ''}
                    </AppText>
                  </View>
                ) : null}
              </View>
            ))}
          </View>
      </View>
      <ReactionLayer kind="match" room={s.room_id} live={!s.is_bot} meName={s.me.username} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  scrollArea: { flex: 1 },
  answersDock: { paddingHorizontal: space.md, paddingTop: space.xs, paddingBottom: space.sm },
  root: { flex: 1, backgroundColor: colors.bgDeep },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.lg },
  pad: { padding: space.xl },
  top: { flexDirection: 'row', justifyContent: 'flex-end', paddingHorizontal: space.lg, paddingTop: space.sm },
  lobby: { padding: space.xl, gap: space.lg, alignItems: 'center' },
  joinCard: { alignSelf: 'stretch', gap: space.sm },
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
  waitRow: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  board: {
    marginHorizontal: space.md,
    marginTop: space.sm,
    padding: space.sm,
    borderRadius: radius.board,
    backgroundColor: colors.board,
    borderWidth: 2,
    borderColor: colors.border,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    alignSelf: 'stretch',
  },
  player: { alignItems: 'center', width: 90, gap: 2 },
  pname: { maxWidth: 90 },
  botTag: { fontSize: 12, lineHeight: 15 },
  grow: { flexGrow: 1, justifyContent: 'center' },
  digits: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  body: { padding: space.md, gap: space.md },
  info: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  qCard: { backgroundColor: colors.card, borderRadius: radius.card, padding: space.lg, gap: space.sm },
  chip: { alignSelf: 'flex-start', paddingHorizontal: space.sm, paddingVertical: 2, borderRadius: 6, backgroundColor: colors.board },
  grid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: space.sm },
  tileWrap: { width: '48.5%' },
  oppMark: {
    position: 'absolute',
    bottom: -6,
    alignSelf: 'center',
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: colors.gem,
    maxWidth: '90%',
  },
});
