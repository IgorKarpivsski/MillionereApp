// Edge Function: play-key-ingest
//
// Receives the Google Play service-account key from the "Play key sync" GitHub workflow
// (which decrypts it from the repo) and stores it in Supabase Vault for iap-verify and
// iap-refresh. The key never passes through a person or a chat.
// Guards: a one-time token (app_config 'play_key_ingest' -> {"token_sha256": "<hex>"}, set to
// "disabled" after the run), the key must belong to the expected service account, and it must
// actually work against this app in the Google Play Developer API before it is stored.
//
// Deploy: supabase functions deploy play-key-ingest --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';

const EXPECTED_EMAIL = 'id-play-uploader@trivia-haaluf.iam.gserviceaccount.com';
const PKG = 'com.haaluf.trivia';

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

async function googleAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 600,
  }));
  const pem = sa.private_key.replace(/-----[^-]+-----/g, '').replace(/\s+/g, '');
  const der = Uint8Array.from(atob(pem), (c) => c.charCodeAt(0));
  const key = await crypto.subtle.importKey('pkcs8', der, { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' }, false, ['sign']);
  const sig = await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(`${header}.${claim}`));
  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({ grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer', assertion: `${header}.${claim}.${b64url(sig)}` }),
  });
  if (!res.ok) throw new Error(`google token ${res.status}`);
  return (await res.json()).access_token;
}

const out = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  if (req.method !== 'POST') return out(405, { error: 'method' });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  let body: { token?: string; key?: string };
  try {
    body = await req.json();
  } catch {
    return out(400, { error: 'bad json' });
  }
  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'play_key_ingest').maybeSingle();
  const want = (cfg?.value as { token_sha256?: string } | null)?.token_sha256;
  if (!want || want === 'disabled' || !body.token || (await sha256(body.token)) !== want) {
    return out(403, { error: 'forbidden' });
  }
  let sa: { client_email?: string; private_key?: string };
  try {
    sa = JSON.parse(body.key ?? '');
  } catch {
    return out(400, { error: 'key is not json' });
  }
  if (sa.client_email !== EXPECTED_EMAIL || !sa.private_key) return out(400, { error: 'unexpected account' });
  try {
    const token = await googleAccessToken(sa as { client_email: string; private_key: string });
    const r = await fetch(`https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${PKG}/subscriptions`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!r.ok) return out(400, { error: `key does not work for the app (${r.status})` });
  } catch (e) {
    return out(400, { error: String(e).slice(0, 200) });
  }
  const { error } = await admin.rpc('play_key_store', { p_key: body.key });
  if (error) return out(500, { error: error.message });
  await admin.from('app_config').update({ value: { token_sha256: 'disabled' } }).eq('key', 'play_key_ingest');
  return out(200, { ok: true, account: sa.client_email });
});
