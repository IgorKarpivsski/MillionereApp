import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { queryKeys } from '@/lib/queryClient';
import { dailyApi, leaderboardApi } from './api';

export function useDailyStatus() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.daily, queryFn: dailyApi.status, enabled: !!session, staleTime: 15_000 });
}

export function useLeaderboard() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.leaderboard, queryFn: () => leaderboardApi.week(50), enabled: !!session });
}
