// Edge Function: guest-signup
//
// Fallback for when the Supabase "anonymous sign-ins" provider is switched
// off. Creates a regular auth user flagged app_metadata.guest = true with a
// random password that never leaves the server, signs it in, and returns the
// session tokens. The app stores them like any other session.
//
// Abuse control: max 10 new guests per IP per hour (public.guest_signup_allowed).
// Deploy with verify_jwt = false: the caller has no session yet.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const MAX_PER_IP_PER_HOUR = 10;

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function randomHex(bytes: number): string {
  const a = new Uint8Array(bytes);
  crypto.getRandomValues(a);
  return Array.from(a, (b) => b.toString(16).padStart(2, '0')).join('');
}

async function sha256(text: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'server_misconfigured' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false, autoRefreshToken: false } });

  // Throttle by IP (stored only as a salted hash).
  const ip = (req.headers.get('x-forwarded-for') ?? '').split(',')[0]?.trim() || 'unknown';
  const ipHash = await sha256(`${serviceKey.slice(-16)}:${ip}`);
  const { data: allowed, error: rlError } = await admin.rpc('guest_signup_allowed', {
    p_ip_hash: ipHash,
    p_max: MAX_PER_IP_PER_HOUR,
  });
  if (rlError) {
    console.error('guest-signup rate check failed', rlError.message);
    return json(500, { error: 'server_error' });
  }
  if (!allowed) return json(429, { error: 'rate_limited' });

  const email = `guest-${crypto.randomUUID()}@guests.invalid`;
  const password = randomHex(32);

  const { error: createError } = await admin.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    app_metadata: { guest: true },
  });
  if (createError) {
    console.error('guest-signup create failed', createError.message);
    return json(500, { error: 'create_failed' });
  }

  const client = createClient(url, anonKey, { auth: { persistSession: false, autoRefreshToken: false } });
  const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
  if (signInError || !data.session) {
    console.error('guest-signup sign-in failed', signInError?.message);
    return json(500, { error: 'sign_in_failed' });
  }

  return json(200, {
    access_token: data.session.access_token,
    refresh_token: data.session.refresh_token,
  });
});
