import { useQueryClient } from '@tanstack/react-query';
import { useEffect, useRef } from 'react';
import { useAuth } from '@/features/auth/AuthProvider';
import { queryKeys } from '@/lib/queryClient';
import { recoverPurchases } from './purchases';

/** Once per launch: finish purchases that were paid but never confirmed, and refresh the subscription. */
export function PurchaseRecovery() {
  const { session } = useAuth();
  const qc = useQueryClient();
  const done = useRef(false);
  useEffect(() => {
    if (!session || done.current) return;
    done.current = true;
    void recoverPurchases()
      .then((n) => {
        if (n > 0) for (const k of [queryKeys.store, queryKeys.myState]) void qc.invalidateQueries({ queryKey: k });
      })
      .catch(() => undefined);
  }, [session, qc]);
  return null;
}
