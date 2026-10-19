// Edge Function: admob-ssv
//
// AdMob server-side verification callback for rewarded ads. Google calls this
// URL after a player really watched an ad; we check Google's signature and
// record the reward for that player. claim_ad_reward() then only pays when
// such a record exists (once public.app_config 'ads.require_ssv' is true).
//
// Set in AdMob → the rewarded ad unit → "Server-side verification":
//   https://<project>.supabase.co/functions/v1/admob-ssv
// Deploy with verify_jwt = false: Google calls it without a session.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const KEYS_URL = 'https://www.gstatic.com/admob/reward/verifier-keys.json';
let keyCache: { at: number; keys: Map<string, CryptoKey> } | null = null;

function b64ToBytes(s: string): Uint8Array {
  const norm = s.replace(/-/g, '+').replace(/_/g, '/');
  const pad = norm.length % 4 ? '='.repeat(4 - (norm.length % 4)) : '';
  const bin = atob(norm + pad);
  return Uint8Array.from(bin, (c) => c.charCodeAt(0));
}

async function keys(): Promise<Map<string, CryptoKey>> {
  if (keyCache && Date.now() - keyCache.at < 6 * 3600_000) return keyCache.keys;
  const res = await fetch(KEYS_URL);
  const json = (await res.json()) as { keys: { keyId: number; base64: string }[] };
  const out = new Map<string, CryptoKey>();
  for (const k of json.keys) {
    const key = await crypto.subtle.importKey('spki', b64ToBytes(k.base64), { name: 'ECDSA', namedCurve: 'P-256' }, false, ['verify']);
    out.set(String(k.keyId), key);
  }
  keyCache = { at: Date.now(), keys: out };
  return out;
}

/** DER ECDSA signature → raw r||s (64 bytes) as WebCrypto expects. */
function derToRaw(der: Uint8Array): Uint8Array {
  let i = 2;
  if (der[1]! & 0x80) i = 2 + (der[1]! & 0x7f);
  const read = () => {
    if (der[i] !== 0x02) throw new Error('bad der');
    const len = der[i + 1]!;
    let v = der.slice(i + 2, i + 2 + len);
    i += 2 + len;
    while (v.length > 32 && v[0] === 0) v = v.slice(1);
    const out = new Uint8Array(32);
    out.set(v, 32 - v.length);
    return out;
  };
  const r = read();
  const s = read();
  const raw = new Uint8Array(64);
  raw.set(r, 0);
  raw.set(s, 32);
  return raw;
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const query = url.search.startsWith('?') ? url.search.slice(1) : url.search;
  const at = query.indexOf('&signature=');
  if (at < 0) return new Response('missing signature', { status: 400 });
  const message = query.slice(0, at);
  const sig = url.searchParams.get('signature') ?? '';
  const keyId = url.searchParams.get('key_id') ?? '';
  try {
    const key = (await keys()).get(keyId);
    if (!key) return new Response('unknown key', { status: 400 });
    const ok = await crypto.subtle.verify({ name: 'ECDSA', hash: 'SHA-256' }, key, derToRaw(b64ToBytes(sig)), new TextEncoder().encode(message));
    if (!ok) return new Response('bad signature', { status: 403 });
  } catch (e) {
    console.error('ssv verify failed', (e as Error).message);
    return new Response('verify error', { status: 400 });
  }

  const userId = url.searchParams.get('user_id') ?? '';
  const tx = url.searchParams.get('transaction_id') ?? '';
  // AdMob's console "verify URL" test sends no user: accept it so the setup check passes.
  if (!userId || !/^[0-9a-f-]{36}$/i.test(userId) || !tx) return new Response('ok', { status: 200 });

  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.rpc('ad_ssv_record', {
    p_tx: tx,
    p_user: userId,
    p_unit: url.searchParams.get('ad_unit') ?? '',
    p_custom: url.searchParams.get('custom_data') ?? '',
  });
  if (error) {
    console.error('ssv record failed', error.message);
    return new Response('store error', { status: 500 });
  }
  return new Response('ok', { status: 200 });
});
