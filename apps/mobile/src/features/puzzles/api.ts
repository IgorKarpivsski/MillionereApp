import { PuzzleSolveSchema, PuzzlesStateSchema, type PuzzleSolve, type PuzzlesState } from '@fm/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';
import { queryKeys } from '@/lib/queryClient';

export const puzzleApi = {
  state: (): Promise<PuzzlesState> => rpc('puzzles_state', undefined, (x) => PuzzlesStateSchema.parse(x)),
  solve: (id: number, answer: string): Promise<PuzzleSolve> =>
    rpc('puzzle_solve', { p_id: id, p_answer: answer }, (x) => PuzzleSolveSchema.parse(x)),
  hint: (id: number): Promise<string> => rpc('puzzle_hint', { p_id: id }, (x) => String((x as { answer: string }).answer)),
};

export function usePuzzlesState() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.puzzles, queryFn: puzzleApi.state, enabled: !!session, staleTime: 60_000 });
}
