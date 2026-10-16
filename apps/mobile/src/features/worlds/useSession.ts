import type { BoostKind, SessionPayload, SessionSummary } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/queryClient';
import { RpcError } from '@/features/profile/api';
import { boostsApi } from '@/features/boosts/api';
import { sessionApi } from './api';

export type SessionPhase = 'loading' | 'question' | 'locked' | 'reveal' | 'finished' | 'error';

export interface SessionReveal {
  result: 'correct' | 'wrong' | 'timeout';
  correctSlot: number;
  pickedSlot: number | null;
  explanation: string;
  points: number;
  speedBonus: number;
  shielded: boolean;
}

export interface SessionState {
  phase: SessionPhase;
  payload: SessionPayload | null;
  /** Per-question outcome so far (true = right), for the progress dots. */
  results: boolean[];
  score: number;
  picked: number | null;
  reveal: SessionReveal | null;
  summary: SessionSummary | null;
  deadlineAt: number | null;
  busy5050: boolean;
  /** A boost / hint / call request is in flight. */
  busyTool: string | null;
  notice: string | null;
}

const initial: SessionState = {
  phase: 'loading',
  payload: null,
  results: [],
  score: 0,
  picked: null,
  reveal: null,
  summary: null,
  deadlineAt: null,
  busy5050: false,
  busyTool: null,
  notice: null,
};

function withQuestion(s: SessionState, p: SessionPayload): SessionState {
  return {
    ...s,
    phase: p.question ? 'question' : 'loading',
    payload: p,
    score: p.score,
    picked: null,
    reveal: null,
    deadlineAt: p.question ? Date.now() + p.question.seconds_left * 1000 : null,
    notice: null,
  };
}

/** Drives one session (10 questions). The server decides correctness, points and rewards. */
export function useSession(world: string, level: number | null, resumeRun?: string | null) {
  const [s, setS] = useState<SessionState>(initial);
  const qc = useQueryClient();
  const live = useRef(true);
  const sRef = useRef(s);
  sRef.current = s;

  useEffect(() => {
    live.current = true;
    return () => {
      live.current = false;
    };
  }, []);

  const set = useCallback((f: (x: SessionState) => SessionState) => {
    if (live.current) setS(f);
  }, []);

  const fail = useCallback(
    (e: unknown) => {
      const code =
        e instanceof RpcError
          ? e.message.includes('no_energy') ? 'no_energy' : e.message.includes('level locked') ? 'locked' : e.code
          : 'unknown';
      set((x) => ({ ...x, phase: 'error', notice: code }));
    },
    [set],
  );

  const finish = useCallback(
    (summary: SessionSummary) => {
      for (const k of [queryKeys.worlds, queryKeys.myState, queryKeys.leaderboard, queryKeys.league, queryKeys.collection, queryKeys.energy, queryKeys.pass]) {
        void qc.invalidateQueries({ queryKey: k });
      }
      track('quiz_completed', { rung: summary.correct, ended_by: summary.status === 'won' ? 'completed' : 'wrong' });
      return summary;
    },
    [qc],
  );

  const start = useCallback(
    async (opts?: { world?: string; level?: number | null }) => {
      set(() => initial);
      try {
        const p = resumeRun && !opts ? await sessionApi.resume(resumeRun) : await sessionApi.start(opts?.world ?? world, opts?.level ?? level);
        void qc.invalidateQueries({ queryKey: queryKeys.energy });
        playSound('whistle');
        haptic('heavy');
        track('quiz_started', { mode: 'session' });
        set((x) => ({ ...withQuestion(x, p), results: Array.from({ length: p.rung - 1 }, (_, i) => i < p.correct) }));
      } catch (e) {
        fail(e);
      }
    },
    [fail, set, qc, world, level, resumeRun],
  );

  const answer = useCallback(
    async (slot: number) => {
      const cur = sRef.current;
      if (!cur.payload || (slot >= 0 && cur.phase !== 'question')) return;
      const { run_id, rung } = cur.payload;
      if (slot >= 0) {
        playSound('answer_lock');
        haptic('tap');
      }
      set((x) => ({ ...x, phase: 'locked', picked: slot >= 0 ? slot : null }));
      for (let attempt = 0; attempt < 6; attempt++) {
        try {
          const r = await sessionApi.answer(run_id, rung, slot);
          const good = r.result === 'correct';
          const summary = r.summary ? finish(r.summary) : null;
          track('question_answered', { rung, correct: good, ms: 0, difficulty: cur.payload.question?.difficulty ?? 'unknown' });
          playSound(good ? 'answer_correct' : 'answer_wrong');
          haptic(good ? 'success' : 'error');
          set((x) => ({
            ...x,
            phase: 'reveal',
            score: r.score,
            results: [...x.results, good || r.shielded],
            reveal: { result: r.result, correctSlot: r.correct_slot, pickedSlot: slot >= 0 ? slot : null, explanation: r.explanation, points: r.points, speedBonus: r.speed_bonus, shielded: r.shielded },
            summary,
          }));
          return;
        } catch (e) {
          // Time-out: the device clock can run a little ahead of the server's.
          if (slot < 0 && e instanceof RpcError && e.message.includes('clock still running')) {
            await new Promise((res) => setTimeout(res, 800));
            continue;
          }
          fail(e);
          return;
        }
      }
      fail(new RpcError('unknown', 'timeout not accepted'));
    },
    [fail, finish, set],
  );

  const timeUp = useCallback(() => {
    if (sRef.current.phase === 'question') void answer(-1);
  }, [answer]);

  const next = useCallback(async () => {
    const cur = sRef.current;
    if (!cur.payload || cur.phase !== 'reveal') return;
    if (cur.summary) {
      if (cur.summary.coins > 0) playSound('coins');
      if (cur.summary.leveled_up) setTimeout(() => playSound('level_up'), 500);
      set((x) => ({ ...x, phase: 'finished' }));
      return;
    }
    set((x) => ({ ...x, phase: 'loading' }));
    try {
      const p = await sessionApi.next(cur.payload.run_id);
      set((x) => withQuestion(x, p));
    } catch (e) {
      fail(e);
    }
  }, [fail, set]);

  const fifty = useCallback(async () => {
    const cur = sRef.current;
    if (cur.phase !== 'question' || !cur.payload?.question || cur.busy5050 || cur.payload.question.removed.length) return;
    haptic('select');
    set((x) => ({ ...x, busy5050: true }));
    try {
      const p = await sessionApi.fifty(cur.payload.run_id);
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
      set((x) => ({ ...x, busy5050: false, payload: x.payload ? { ...x.payload, lifelines_used: p.lifelines_used, question: p.question } : p }));
    } catch (e) {
      set((x) => ({ ...x, busy5050: false, notice: e instanceof RpcError && e.message.includes('insufficient') ? 'no_coins' : 'lifeline' }));
    }
  }, [set, qc]);

  /** Applies a fresh payload for the same question (boost / hint / call): keeps the phase, resets the clock. */
  const applySame = useCallback(
    (p: SessionPayload) =>
      set((x) => ({
        ...x,
        busyTool: null,
        payload: p,
        deadlineAt: p.question ? Date.now() + p.question.seconds_left * 1000 : x.deadlineAt,
      })),
    [set],
  );

  const toolError = useCallback(
    (e: unknown) => {
      const m = e instanceof RpcError ? e.message : '';
      const notice = m.includes('insufficient') ? 'no_coins' : m.includes('no boost') ? 'no_boost' : m.includes('offline') ? 'offline' : m.includes('rate_limited') ? 'ad_cap' : 'lifeline';
      set((x) => ({ ...x, busyTool: null, notice }));
    },
    [set],
  );

  const boost = useCallback(
    async (kind: BoostKind) => {
      const cur = sRef.current;
      if (!cur.payload || cur.busyTool) return false;
      if ((kind === 'time' || kind === 'freeze' || kind === 'skip') && cur.phase !== 'question') return false;
      haptic('select');
      set((x) => ({ ...x, busyTool: kind, notice: null }));
      try {
        const p = await boostsApi.use(cur.payload.run_id, kind);
        void qc.invalidateQueries({ queryKey: queryKeys.boosts });
        playSound(kind === 'skip' ? 'whistle' : 'answer_lock');
        if (kind === 'skip') set((x) => ({ ...withQuestion(x, p), busyTool: null }));
        else applySame(p);
        return true;
      } catch (e) {
        toolError(e);
        return false;
      }
    },
    [set, qc, applySame, toolError],
  );

  const hint = useCallback(
    async (pay: 'coins' | 'ad') => {
      const cur = sRef.current;
      if (!cur.payload || cur.phase !== 'question' || cur.busyTool) return;
      set((x) => ({ ...x, busyTool: 'hint', notice: null }));
      try {
        const p = await boostsApi.hint(cur.payload.run_id, pay);
        if (pay === 'coins') void qc.invalidateQueries({ queryKey: queryKeys.myState });
        haptic('select');
        applySame(p);
      } catch (e) {
        toolError(e);
      }
    },
    [set, qc, applySame, toolError],
  );

  /** Calls a friend: the clock pauses on the server; returns the call id to follow. */
  const callFriend = useCallback(
    async (friendId: string) => {
      const cur = sRef.current;
      if (!cur.payload || cur.phase !== 'question' || cur.busyTool) return null;
      set((x) => ({ ...x, busyTool: 'call', notice: null }));
      try {
        const p = await boostsApi.call(cur.payload.run_id, friendId);
        applySame(p);
        return p.call_id ?? null;
      } catch (e) {
        toolError(e);
        return null;
      }
    },
    [set, applySame, toolError],
  );

  /** Heart: keep going on a failed level with a few more questions. */
  const continueRun = useCallback(async () => {
    const cur = sRef.current;
    const runId = cur.payload?.run_id;
    if (!runId) return;
    set((x) => ({ ...x, phase: 'loading', summary: null, reveal: null }));
    try {
      const p = await boostsApi.continueRun(runId);
      void qc.invalidateQueries({ queryKey: queryKeys.boosts });
      playSound('whistle');
      set((x) => ({ ...withQuestion(x, p), results: x.results.slice(0, p.rung - 1) }));
    } catch (e) {
      fail(e);
    }
  }, [set, qc, fail]);

  return { state: s, start, answer, timeUp, next, fifty, boost, hint, callFriend, continueRun };
}
