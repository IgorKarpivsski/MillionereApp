import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { queryKeys } from '@/lib/queryClient';
import { collectionApi } from './api';

export function useCollection() {
  const { session } = useAuth();
  return useQuery({ queryKey: queryKeys.collection, queryFn: collectionApi.state, enabled: !!session });
}

function useRefreshAfter() {
  const qc = useQueryClient();
  return () => {
    void qc.invalidateQueries({ queryKey: queryKeys.collection });
    void qc.invalidateQueries({ queryKey: queryKeys.myState });
  };
}

export function useCraft() {
  const refresh = useRefreshAfter();
  return useMutation({ mutationFn: collectionApi.craft, onSuccess: refresh });
}

export function useClaimAlbum() {
  const refresh = useRefreshAfter();
  return useMutation({ mutationFn: collectionApi.claim, onSuccess: refresh });
}
