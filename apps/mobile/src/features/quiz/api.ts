import {
  DailyStatusSchema,
  LeaderboardSchema,
  QuizAnswerResultSchema,
  QuizCashOutResultSchema,
  QuizLifelineResultSchema,
  QuizPayloadSchema,
  type DailyStatus,
  type Leaderboard,
  type LifelineKind,
  type QuizAnswerResult,
  type QuizPayload,
  type QuizSummary,
  type ReportReason,
} from '@fm/shared';
import { rpc } from '@/features/profile/api';

/** All quiz logic lives on the server; these are thin, validated calls. */
export const quizApi = {
  start: (): Promise<QuizPayload> => rpc('quiz_start', undefined, (x) => QuizPayloadSchema.parse(x)),

  next: (runId: string): Promise<QuizPayload> =>
    rpc('quiz_next', { p_run: runId }, (x) => QuizPayloadSchema.parse(x)),

  answer: (runId: string, rung: number, slot: number): Promise<QuizAnswerResult> =>
    rpc('quiz_answer', { p_run: runId, p_rung: rung, p_slot: slot }, (x) => QuizAnswerResultSchema.parse(x)),

  /** Call once the local clock hits zero; the server checks its own deadline. */
  timeout: (runId: string): Promise<QuizAnswerResult> =>
    rpc('quiz_timeout', { p_run: runId }, (x) => QuizAnswerResultSchema.parse(x)),

  cashOut: (runId: string): Promise<QuizSummary> =>
    rpc('quiz_cash_out', { p_run: runId }, (x) => QuizCashOutResultSchema.parse(x).summary),

  lifeline: (runId: string, kind: LifelineKind) =>
    rpc('quiz_lifeline', { p_run: runId, p_kind: kind }, (x) => QuizLifelineResultSchema.parse(x)),

  report: (questionId: string, reason: ReportReason): Promise<void> =>
    rpc('report_question', { p_question_id: questionId, p_reason: reason }, () => undefined),
};

/** The daily challenge: same 10 questions for everyone, one go per day. */
export const dailyApi = {
  status: (): Promise<DailyStatus> => rpc('daily_status', undefined, (x) => DailyStatusSchema.parse(x)),
  start: (): Promise<QuizPayload> => rpc('daily_start', undefined, (x) => QuizPayloadSchema.parse(x)),
  next: (runId: string): Promise<QuizPayload> =>
    rpc('daily_next', { p_run: runId }, (x) => QuizPayloadSchema.parse(x)),
  answer: (runId: string, rung: number, slot: number): Promise<QuizAnswerResult> =>
    rpc('daily_answer', { p_run: runId, p_rung: rung, p_slot: slot }, (x) => QuizAnswerResultSchema.parse(x)),
  timeout: (runId: string): Promise<QuizAnswerResult> =>
    rpc('daily_timeout', { p_run: runId }, (x) => QuizAnswerResultSchema.parse(x)),
};

export const leaderboardApi = {
  week: (limit = 50): Promise<Leaderboard> =>
    rpc('leaderboard_week', { p_limit: limit }, (x) => LeaderboardSchema.parse(x)),
};
