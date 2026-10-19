import { ReferralStateSchema, type ReferralState } from '@fm/shared';
import { useQuery } from '@tanstack/react-query';
import { useAuth } from '@/features/auth/AuthProvider';
import { rpc } from '@/features/profile/api';

export const referralKey = ['referral'] as const;
const parse = (x: unknown) => ReferralStateSchema.parse(x);

export const referralApi = {
  state: (): Promise<ReferralState> => rpc('referral_state', undefined, parse),
  redeem: (code: string): Promise<ReferralState> => rpc('referral_redeem', { p_code: code }, parse),
};

export function useReferral() {
  const { session } = useAuth();
  return useQuery({ queryKey: referralKey, queryFn: referralApi.state, enabled: !!session, staleTime: 60_000 });
}

/** The Play Store link that carries the code, so the app can fill it in by itself. */
export function inviteLink(code: string) {
  return `https://play.google.com/store/apps/details?id=com.haaluf.trivia&referrer=${encodeURIComponent(`ref=${code}`)}`;
}
