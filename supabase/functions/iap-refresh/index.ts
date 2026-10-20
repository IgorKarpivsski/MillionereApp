// Edge Function: iap-refresh
//
// Runs every 6 hours (pg_cron → pg_net, see 20261020000001_subscriptions.sql).
// Asks Google about each VIP subscription that is about to renew or recently
// changed and records the answer (public.sub_apply): renewals extend VIP and
// pay the monthly gems, grace period / account hold / cancellation are kept so
// the app can tell the player.
//
// Called with header x-cron-secret = app_config 'ops.cron_secret'.
// Deploy with verify_jwt = false (pg_cron has no user session).
import { createClient } from 'jsr:@supabase/supabase-js@2';

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
  const saRaw = Deno.env.get('GOOGLE_PLAY_SERVICE_ACCOUNT');
  const pkg = Deno.env.get('ANDROID_PACKAGE_NAME') ?? 'com.haaluf.trivia';
  const service = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });

  const { data: secretRow } = await service.from('app_config').select('value').eq('key', 'ops.cron_secret').maybeSingle();
  const secret = typeof secretRow?.value === 'string' ? secretRow.value : null;
  if (!secret || req.headers.get('x-cron-secret') !== secret) return new Response('forbidden', { status: 403 });
  if (!saRaw) return new Response('store not configured', { status: 200 });

  const { data: rows, error } = await service.rpc('subs_to_refresh');
  if (error) return new Response(error.message, { status: 500 });
  const token = await googleAccessToken(JSON.parse(saRaw));
  let done = 0;
  for (const row of (rows ?? []) as { user_id: string; sku: string; purchase_token: string }[]) {
    try {
      const r = await fetch(
        `https://androidpublisher.googleapis.com/androidpublisher/v3/applications/${pkg}/purchases/subscriptionsv2/tokens/${encodeURIComponent(row.purchase_token)}`,
        { headers: { Authorization: `Bearer ${token}` } },
      );
      if (!r.ok) continue;
      const s = (await r.json()) as {
        subscriptionState?: string;
        latestOrderId?: string;
        lineItems?: Array<{ productId: string; expiryTime: string; autoRenewingPlan?: { autoRenewEnabled?: boolean } }>;
      };
      const line = s.lineItems?.find((l) => l.productId === row.sku) ?? s.lineItems?.[0];
      await service.rpc('sub_apply', {
        p_user: row.user_id,
        p_sku: row.sku,
        p_token: row.purchase_token,
        p_order: s.latestOrderId ?? null,
        p_state: s.subscriptionState ?? 'SUBSCRIPTION_STATE_UNSPECIFIED',
        p_expiry: line?.expiryTime ?? null,
        p_auto_renew: line?.autoRenewingPlan?.autoRenewEnabled ?? null,
      });
      done++;
    } catch (e) {
      console.error('iap-refresh', row.purchase_token.slice(0, 8), (e as Error).message);
    }
  }
  return new Response(JSON.stringify({ checked: done }), { status: 200, headers: { 'Content-Type': 'application/json' } });
});
