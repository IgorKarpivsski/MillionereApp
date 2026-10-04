// Edge Function: iap-verify
//
// The app sends a Google Play purchase token after a purchase; this function
// asks the Google Play Developer API whether the purchase is real and paid,
// checks it belongs to the caller, and only then grants it through
// public.grant_purchase (service role). Nothing is granted on the client's word.
//
// Secrets (Supabase → Edge Functions → Secrets):
//   GOOGLE_PLAY_SERVICE_ACCOUNT  JSON key of a Play Console service account
//                                with "View financial data" + "Manage orders".
//   ANDROID_PACKAGE_NAME         e.g. com.footballmillionaire.app
// Deploy with verify_jwt = true.
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, 'Content-Type': 'application/json' } });

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cachedToken: { token: string; exp: number } | null = null;

async function googleAccessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  if (cachedToken && cachedToken.exp > Date.now() / 1000 + 60) return cachedToken.token;
  const now = Math.floor(Date.now() / 1000);
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/androidpublisher',
    aud: 'https://oauth2.googleapis.com/token',
    iat: now,
    exp: now + 3600,
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
  const j = await res.json();
  cachedToken = { token: j.access_token, exp: now + (j.expires_in ?? 3600) };
  return j.access_token;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const saRaw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
  const pkg = Deno.env.get('ANDROID_PACKAGE_NAME') ?? 'com.footballmillionaire.app';
  if (!saRaw) return json(503, { error: 'store_not_configured' });

  const url = Deno.env.get('SUPABASE_URL')!;
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const jwt = (req.headers.get('Authorization') ?? '').replace(/^Bearer\s+/i, '');
  const { data: userData, error: userErr } = await service.auth.getUser(jwt);
  if (userErr || !userData.user) return json(401, { error: 'not_authenticated' });
  const uid = userData.user.id;

  let body: { sku?: string; purchaseToken?: string; type?: 'in-app' | 'subs' };
  try {
    body = await req.json();
  } catch {
    return json(400, { error: 'invalid_input' });
  }
  const { sku, purchaseToken, type } = body;
  if (!sku || !purchaseToken || !/^[a-z0-9_.]{2,100}$/.test(sku)) return json(400, { error: 'invalid_input' });

  try {
    const token = await googleAccessToken(JSON.parse(saRaw));
    const base = `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases`;
    let expiry: string | null = null;
    let order: string | null = null;
    let raw: unknown;
    if (type === 'subs') {
      const r = await fetch(`${base}/subscriptionsv2/tokens/${encodeURIComponent(purchaseToken)}`, { headers: { Authorization: `Bearer ${token}` } });
      raw = await r.json();
      if (!r.ok) return json(402, { error: 'not_verified' });
      const s = raw as { subscriptionState?: string; lineItems?: Array<{ productId: string; expiryTime: string }>; latestOrderId?: string; externalAccountIdentifiers?: { obfuscatedExternalAccountId?: string } };
      const line = s.lineItems?.find((l) => l.productId === sku);
      const ok = line && ['SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD'].includes(s.subscriptionState ?? '');
      const owner = s.externalAccountIdentifiers?.obfuscatedExternalAccountId;
      if (!ok || (owner && owner !== uid)) return json(402, { error: 'not_verified' });
      expiry = line!.expiryTime;
      order = s.latestOrderId ?? null;
    } else {
      const r = await fetch(`${base}/products/${sku}/tokens/${encodeURIComponent(purchaseToken)}`, { headers: { Authorization: `Bearer ${token}` } });
      raw = await r.json();
      if (!r.ok) return json(402, { error: 'not_verified' });
      const p = raw as { purchaseState?: number; orderId?: string; obfuscatedExternalAccountId?: string };
      // 0 = purchased (1 = cancelled, 2 = pending)
      if (p.purchaseState !== 0 || (p.obfuscatedExternalAccountId && p.obfuscatedExternalAccountId !== uid)) {
        return json(402, { error: 'not_verified', state: p.purchaseState });
      }
      order = p.orderId ?? null;
    }
    const { data, error } = await service.rpc('grant_purchase', {
      p_user: uid, p_sku: sku, p_token: purchaseToken, p_order: order, p_raw: raw, p_expiry: expiry,
    });
    if (error) return json(409, { error: error.message });
    return json(200, data);
  } catch (e) {
    console.error('iap-verify', e);
    return json(502, { error: 'verify_failed' });
  }
});
