// Edge Function: push-send
//
// Delivers queued push notifications (public.push_outbox) through Firebase Cloud Messaging (HTTP v1).
// Called by public.push_enqueue right after a row is queued (body {"id": n}), and can be called with {}
// to flush anything left over. Header x-cron-secret = app_config 'ops.cron_secret'.
// Credentials: the Google service account already in Vault (play_key_get), which needs the
// "Firebase Cloud Messaging API Admin" role in the Firebase project named in app_config 'push'.project.
//
// Deploy: supabase functions deploy push-send --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';

const b64url = (data: ArrayBuffer | string) => {
  const bytes = typeof data === 'string' ? new TextEncoder().encode(data) : new Uint8Array(data);
  let s = '';
  for (const b of bytes) s += String.fromCharCode(b);
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
};

let cached: { token: string; exp: number } | null = null;

async function accessToken(sa: { client_email: string; private_key: string }): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  if (cached && cached.exp > now + 60) return cached.token;
  const header = b64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }));
  const claim = b64url(JSON.stringify({
    iss: sa.client_email,
    scope: 'https://www.googleapis.com/auth/firebase.messaging',
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
  cached = { token: j.access_token, exp: now + (j.expires_in ?? 3600) };
  return cached.token;
}

const out = (status: number, body: unknown) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });

Deno.serve(async (req) => {
  const db = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false } });
  const { data: secretRow } = await db.from('app_config').select('value').eq('key', 'ops.cron_secret').maybeSingle();
  const secret = typeof secretRow?.value === 'string' ? secretRow.value : null;
  if (!secret || req.headers.get('x-cron-secret') !== secret) return out(403, { error: 'forbidden' });

  const { data: cfgRow } = await db.from('app_config').select('value').eq('key', 'push').maybeSingle();
  const cfg = (cfgRow?.value ?? {}) as { enabled?: boolean; project?: string };
  if (!cfg.enabled || !cfg.project) return out(200, { skipped: 'push off' });

  let body: { id?: number } = {};
  try {
    body = await req.json();
  } catch {
    /* flush everything */
  }
  // only fresh rows: an invite from an hour ago is no use any more
  let q = db.from('push_outbox').select('id, user_id, kind, title, body, data').is('sent_at', null)
    .gte('created_at', new Date(Date.now() - 30 * 60_000).toISOString()).order('id').limit(50);
  if (body.id) q = q.eq('id', body.id);
  const { data: rows, error } = await q;
  if (error) return out(500, { error: error.message });
  if (!rows?.length) return out(200, { sent: 0 });

  const saRaw = (await db.rpc('play_key_get')).data as string | null;
  if (!saRaw) return out(200, { skipped: 'no key' });
  const token = await accessToken(JSON.parse(saRaw));

  let sent = 0;
  for (const r of rows) {
    // claim the row first so two calls never send it twice
    const { data: claimed } = await db.from('push_outbox').update({ sent_at: new Date().toISOString(), result: 'sending' })
      .eq('id', r.id).is('sent_at', null).select('id');
    if (!claimed?.length) continue;
    const { data: devices } = await db.from('devices').select('push_token').eq('user_id', r.user_id);
    const results: string[] = [];
    for (const d of devices ?? []) {
      const data: Record<string, string> = { kind: r.kind };
      for (const [k, v] of Object.entries(r.data ?? {})) data[k] = String(v);
      const res = await fetch(`https://fcm.googleapis.com/v1/projects/${cfg.project}/messages:send`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: d.push_token,
            notification: { title: r.title, body: r.body },
            data,
            android: { priority: 'high', notification: { channel_id: 'friends', color: '#FFB000', icon: 'notification_icon' } },
          },
        }),
      });
      if (res.ok) {
        results.push('ok');
        sent++;
      } else {
        const text = await res.text();
        // the app was removed or the token rotated: forget it
        if (res.status === 404 || text.includes('UNREGISTERED')) await db.from('devices').delete().eq('push_token', d.push_token);
        results.push(`${res.status}`);
      }
    }
    await db.from('push_outbox').update({ result: results.join(',') || 'no_device' }).eq('id', r.id);
  }
  return out(200, { sent });
});
