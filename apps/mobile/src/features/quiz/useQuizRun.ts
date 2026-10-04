import type { LifelineKind, QuizHints, QuizPayload, QuizSummary } from '@fm/shared';
import { useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useRef, useState } from 'react';
import { haptic } from '@/design-system/feedback/haptics';
import { playSound } from '@/design-system/feedback/sound';
import { track } from '@/lib/analytics';
import { queryKeys } from '@/lib/queryClient';
import { RpcError } from '@/features/profile/api';
import { quizApi } from './api';

export type QuizPhase = 'loading' | 'question' | 'locked' | 'reveal' | 'finished' | 'error';

export interface Reveal {
  result: 'correct' | 'wrong' | 'timeout';
  correctSlot: number;
  pickedSlot: number | null;
  explanation: string;
}

export interface QuizRunState {
  phase: QuizPhase;
  payload: QuizPayload | null;
  /** Correct answers so far (the "you" score). */
  score: number;
  picked: number | null;
  reveal: Reveal | null;
  summary: QuizSummary | null;
  /** Epoch ms when the current question's clock runs out (device clock, server-anchored). */
  deadlineAt: number | null;
  busyLifeline: LifelineKind | null;
  notice: string | null;
}

const initial: QuizRunState = {
  phase: 'loading',
  payload: null,
  score: 0,
  picked: null,
  reveal: null,
  summary: null,
  deadlineAt: null,
  busyLifeline: null,
  notice: null,
};

function withQuestion(s: QuizRunState, p: QuizPayload): QuizRunState {
  return {
    ...s,
    phase: p.question ? 'question' : 'loading',
    payload: p,
    score: p.correct,
    picked: null,
    reveal: null,
    deadlineAt: p.question ? Date.now() + p.question.seconds_left * 1000 : null,
    notice: null,
  };
}

/**
 * Drives one classic run. The server decides everything (correctness, payouts,
 * the clock); this hook only sequences calls and keeps the UI state.
 */
export function useQuizRun() {
  const [s, setS] = useState<QuizRunState>(initial);
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

  const set = useCallback((f: (x: QuizRunState) => QuizRunState) => {
    if (live.current) setS(f);
  }, []);

  const fail = useCallback(
    (e: unknown) => {
      const code = e instanceof RpcError ? e.code : 'unknown';
      set((x) => ({ ...x, phase: 'error', notice: code }));
    },
    [set],
  );

  const finish = useCallback(
    (summary: QuizSummary) => {
      void qc.invalidateQueries({ queryKey: queryKeys.myState });
      const endedBy =
        summary.status === 'won' ? 'completed'
        : summary.status === 'cashed_out' ? 'walk_away'
        : summary.status === 'timed_out' ? 'timeout'
        : 'wrong';
      track('quiz_completed', { rung: summary.correct, ended_by: endedBy });
      return summary;
    },
    [qc],
  );

  const start = useCallback(async () => {
    set(() => initial);
    try {
      const p = await quizApi.start();
      playSound('whistle');
      haptic('heavy');
      track('quiz_started', { mode: 'classic' });
      set((x) => withQuestion(x, p));
    } catch (e) {
      fail(e);
    }
  }, [fail, set]);

  const pick = useCallback(
    async (slot: number) => {
      const cur = sRef.current;
      if (cur.phase !== 'question' || !cur.payload) return;
      const { run_id, rung } = cur.payload;
      playSound('answer_lock');
      haptic('tap');
      set((x) => ({ ...x, phase: 'locked', picked: slot }));
      try {
        const r = await quizApi.answer(run_id, rung, slot);
        if (r.result === 'var_overturned') {
          playSound('var');
          haptic('heavy');
          set((x) => ({ ...withQuestion(x, r.payload), notice: 'var' }));
          return;
        }
        const good = r.result === 'correct';
        const summary = r.summary ? finish(r.summary) : null;
        track('question_answered', {
          rung,
          correct: good,
          ms: cur.deadlineAt ? Math.max(0, Date.now() - (cur.deadlineAt - 30_000)) : 0,
          difficulty: cur.payload.question?.difficulty ?? 'unknown',
        });
        playSound(good ? 'answer_correct' : 'answer_wrong');
        haptic(good ? 'success' : 'error');
        set((x) => ({
          ...x,
          phase: 'reveal',
          score: good ? x.score + 1 : x.score,
          reveal: { result: r.result, correctSlot: r.correct_slot, pickedSlot: slot, explanation: r.explanation },
          summary,
        }));
      } catch (e) {
        fail(e);
      }
    },
    [fail, finish, set],
  );

  const whistle = useCallback(async () => {
    const cur = sRef.current;
    if (cur.phase !== 'question' || !cur.payload) return;
    set((x) => ({ ...x, phase: 'locked' }));
    const runId = cur.payload.run_id;
    // The device clock may run slightly ahead of the server's; retry briefly.
    for (let attempt = 0; attempt < 6; attempt++) {
      try {
        const r = await quizApi.timeout(runId);
        if (r.result !== 'timeout') return;
        const summary = finish(r.summary);
        playSound('answer_wrong');
        haptic('error');
        set((x) => ({
          ...x,
          phase: 'reveal',
          reveal: { result: 'timeout', correctSlot: r.correct_slot, pickedSlot: null, explanation: r.explanation },
          summary,
        }));
        return;
      } catch (e) {
        if (e instanceof RpcError && e.message.includes('clock still running')) {
          await new Promise((res) => setTimeout(res, 800));
          continue;
        }
        fail(e);
        return;
      }
    }
    fail(new RpcError('unknown', 'timeout not accepted'));
  }, [fail, finish, set]);

  const next = useCallback(async () => {
    const cur = sRef.current;
    if (!cur.payload) return;
    if (cur.summary) {
      if (cur.summary.coins > 0) playSound('coins');
      if (cur.summary.leveled_up) setTimeout(() => playSound('level_up'), 500);
      set((x) => ({ ...x, phase: 'finished' }));
      return;
    }
    set((x) => ({ ...x, phase: 'loading' }));
    try {
      const p = await quizApi.next(cur.payload.run_id);
      set((x) => withQuestion(x, p));
    } catch (e) {
      fail(e);
    }
  }, [fail, set]);

  const lifeline = useCallback(
    async (kind: LifelineKind) => {
      const cur = sRef.current;
      if (cur.phase !== 'question' || !cur.payload?.question || cur.busyLifeline) return;
      if (cur.payload.lifelines_used.includes(kind)) return;
      haptic('select');
      set((x) => ({ ...x, busyLifeline: kind }));
      try {
        const r = await quizApi.lifeline(cur.payload.run_id, kind);
        track('lifeline_used', { lifeline: kind, rung: cur.payload.rung });
        if (kind === 'var') playSound('var');
        set((x) => {
          if (!x.payload?.question) return { ...x, busyLifeline: null };
          const q = x.payload.question;
          const hints = { ...q.hints, [kind]: r.result } as QuizHints;
          const removed =
            kind === 'fifty' && Array.isArray((r.result as { removed?: unknown }).removed)
              ? [...q.removed, ...((r.result as { removed: number[] }).removed ?? [])]
              : q.removed;
          return {
            ...x,
            busyLifeline: null,
            payload: {
              ...x.payload,
              lifelines_used: [...x.payload.lifelines_used, kind],
              question: { ...q, hints, removed, var_armed: kind === 'var' ? true : q.var_armed },
            },
          };
        });
      } catch (e) {
        set((x) => ({ ...x, busyLifeline: null }));
        if (!(e instanceof RpcError && e.code === 'invalid_state')) fail(e);
      }
    },
    [fail, set],
  );

  const cashOut = useCallback(async () => {
    const cur = sRef.current;
    if (!cur.payload || cur.summary) return;
    set((x) => ({ ...x, phase: 'loading' }));
    try {
      const summary = finish(await quizApi.cashOut(cur.payload.run_id));
      if (summary.coins > 0) playSound('coins');
      if (summary.leveled_up) setTimeout(() => playSound('level_up'), 500);
      set((x) => ({ ...x, phase: 'finished', summary }));
    } catch (e) {
      fail(e);
    }
  }, [fail, finish, set]);

  return { state: s, start, pick, next, lifeline, cashOut, whistle };
}
