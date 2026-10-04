import type { Session } from '@supabase/supabase-js';
import { useQueryClient } from '@tanstack/react-query';
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { resetAnalytics, track } from '@/lib/analytics';
import { setMonitoringUser } from '@/lib/monitoring';
import { supabase } from '@/lib/supabase';
import { linkProvider, signInWithProvider, type OAuthResult, type Provider } from './oauth';

interface AuthContextValue {
  session: Session | null;
  isGuest: boolean;
  /** True until we know whether a session exists (and created a guest if not). */
  booting: boolean;
  bootError: string | null;
  retryBoot: () => void;
  link: (provider: Provider) => Promise<OAuthResult>;
  signIn: (provider: Provider) => Promise<OAuthResult>;
  signOut: () => Promise<void>;
  deleteAccount: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

/**
 * New player → guest account. Uses Supabase anonymous sign-in when that
 * provider is on; otherwise the `guest-signup` Edge Function creates a guest
 * server-side and returns its session.
 */
async function createGuestSession(): Promise<Session> {
  const anon = await supabase.auth.signInAnonymously();
  if (!anon.error && anon.data.session) return anon.data.session;

  const { data, error } = await supabase.functions.invoke<{ access_token: string; refresh_token: string }>(
    'guest-signup',
    { body: {} },
  );
  if (error || !data?.access_token || !data.refresh_token) {
    throw new Error(error?.message ?? anon.error?.message ?? 'guest signup failed');
  }
  const set = await supabase.auth.setSession({
    access_token: data.access_token,
    refresh_token: data.refresh_token,
  });
  if (set.error || !set.data.session) throw new Error(set.error?.message ?? 'no session');
  return set.data.session;
}

/**
 * Every player has an account from the first second: if there is no session
 * we create an anonymous (guest) user. Linking Apple/Google later upgrades the
 * same user in place (see supabase trigger handle_user_upgraded).
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const qc = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [booting, setBooting] = useState(true);
  const [bootError, setBootError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setBooting(true);
      setBootError(null);
      const { data } = await supabase.auth.getSession();
      let current = data.session;
      if (!current) {
        try {
          current = await createGuestSession();
          track('auth_guest_created', {});
        } catch (e) {
          if (!cancelled) {
            setBootError(e instanceof Error ? e.message : String(e));
            setBooting(false);
          }
          return;
        }
      }
      if (!cancelled) {
        setSession(current);
        setBooting(false);
      }
    })();

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
      setMonitoringUser(next?.user.id ?? null);
      void qc.invalidateQueries();
    });
    return () => {
      cancelled = true;
      sub.subscription.unsubscribe();
    };
  }, [attempt, qc]);

  const link = useCallback(async (provider: Provider) => {
    track('auth_link_started', { provider });
    const res = await linkProvider(provider);
    if (res.ok) track('auth_link_completed', { provider });
    else track('auth_link_failed', { provider, reason: res.reason });
    return res;
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    qc.clear();
    resetAnalytics();
    track('auth_signed_out', {});
    setAttempt((n) => n + 1); // boot again → fresh guest
  }, [qc]);

  const deleteAccount = useCallback(async () => {
    const { error } = await supabase.functions.invoke('delete-account', { body: { confirm: 'DELETE' } });
    if (error) throw error;
    track('account_deleted', {});
    await supabase.auth.signOut({ scope: 'local' });
    qc.clear();
    resetAnalytics();
    setAttempt((n) => n + 1);
  }, [qc]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      isGuest: !session || session.user.is_anonymous === true || session.user.app_metadata?.guest === true,
      booting,
      bootError,
      retryBoot: () => setAttempt((n) => n + 1),
      link,
      signIn: signInWithProvider,
      signOut,
      deleteAccount,
    }),
    [session, booting, bootError, link, signOut, deleteAccount],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
