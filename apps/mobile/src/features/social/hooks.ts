import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { queryKeys } from '@/lib/queryClient';
import { socialApi } from './api';

export function useFriends(poll = false) {
  const { session } = useAuth();
  return useQuery({
    queryKey: queryKeys.friends,
    queryFn: socialApi.state,
    enabled: !!session,
    refetchInterval: poll ? 8_000 : 60_000,
  });
}

/** Chat history, polled every few seconds while the chat is open. */
export function useChat(peer: string) {
  return useQuery({ queryKey: queryKeys.chat(peer), queryFn: () => socialApi.history(peer), refetchInterval: 3_000 });
}

export function useDupes(peer: string) {
  return useQuery({ queryKey: queryKeys.dupes(peer), queryFn: () => socialApi.dupes(peer) });
}

export function useSocialAction<A, R>(fn: (a: A) => Promise<R>) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: queryKeys.friends });
      void qc.invalidateQueries({ queryKey: queryKeys.collection });
    },
  });
}

export function useUnreadTotal(): number {
  const { data } = useFriends();
  if (!data) return 0;
  return (
    data.friends.reduce((n, f) => n + f.unread + (f.incoming ? 1 : 0), 0) + data.trades.filter((t) => t.incoming).length
  );
}
