import {
  QuizAnswerResultSchema,
  QuizCashOutResultSchema,
  QuizLifelineResultSchema,
  QuizPayloadSchema,
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
