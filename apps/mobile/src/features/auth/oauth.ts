import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { supabase } from '@/lib/supabase';

WebBrowser.maybeCompleteAuthSession();

export type Provider = 'apple' | 'google';
export type OAuthResult =
  | { ok: true }
  | { ok: false; reason: 'cancelled' | 'identity_taken' | 'error'; message?: string };

const redirectTo = Linking.createURL('auth/callback');

async function runBrowserFlow(url: string): Promise<OAuthResult> {
  const res = await WebBrowser.openAuthSessionAsync(url, redirectTo);
  if (res.type !== 'success') return { ok: false, reason: 'cancelled' };

  const { queryParams } = Linking.parse(res.url);
  const err = queryParams?.error_description ?? queryParams?.error;
  if (typeof err === 'string') {
    const taken = /already|exists|linked/i.test(err);
    return { ok: false, reason: taken ? 'identity_taken' : 'error', message: err };
  }
  const code = queryParams?.code;
  if (typeof code !== 'string') return { ok: false, reason: 'error', message: 'missing auth code' };

  const { error } = await supabase.auth.exchangeCodeForSession(code);
  return error ? { ok: false, reason: 'error', message: error.message } : { ok: true };
}

/**
 * Guest → real account. linkIdentity attaches Apple/Google to the CURRENT
 * (anonymous) user, so the user id — and all progress — stays the same.
 */
export async function linkProvider(provider: Provider): Promise<OAuthResult> {
  const { data, error } = await supabase.auth.linkIdentity({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { ok: false, reason: 'error', message: error?.message };
  return runBrowserFlow(data.url);
}

/** Returning player on a new device: sign in to an existing account. */
export async function signInWithProvider(provider: Provider): Promise<OAuthResult> {
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo, skipBrowserRedirect: true },
  });
  if (error || !data?.url) return { ok: false, reason: 'error', message: error?.message };
  return runBrowserFlow(data.url);
}
