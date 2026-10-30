// Edge Function: art-ingest
//
// Copies the illustrated question pictures (made with Higgsfield) into the public
// "qart" storage bucket, resized to 800px and saved as JPEG, so question images do not
// depend on the generator's CDN. Called only from the database (pg_net) by the operator.
// Guarded by a one-time token: app_config 'art_ingest' -> {"token_sha256": "<hex>"};
// set it to "disabled" after each run.
//
// Deploy: supabase functions deploy art-ingest --no-verify-jwt
import { createClient } from 'jsr:@supabase/supabase-js@2';
import { Image } from 'https://deno.land/x/imagescript@1.3.0/mod.ts';

const ALLOWED_PREFIX = 'https://d8j0ntlcm91z4.cloudfront.net/user_2x1UegQvignkIVXKpKcIQL2jkLf/';

async function sha256(s: string): Promise<string> {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

Deno.serve(async (req) => {
  if (req.method !== 'POST') return new Response('method', { status: 405 });
  const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, {
    auth: { persistSession: false },
  });
  let body: { token?: string; items?: { url: string; path: string }[] };
  try {
    body = await req.json();
  } catch {
    return new Response('bad json', { status: 400 });
  }
  const { data: cfg } = await admin.from('app_config').select('value').eq('key', 'art_ingest').maybeSingle();
  const want = (cfg?.value as { token_sha256?: string } | null)?.token_sha256;
  if (!want || want === 'disabled' || !body.token || (await sha256(body.token)) !== want) {
    return new Response('forbidden', { status: 403 });
  }
  const items = (body.items ?? []).slice(0, 12);
  const out: { path: string; ok: boolean; w?: number; h?: number; err?: string }[] = [];
  for (const it of items) {
    try {
      if (!it.url.startsWith(ALLOWED_PREFIX) || !/^q\/[a-z0-9_-]+\.jpg$/.test(it.path)) throw new Error('not allowed');
      const r = await fetch(it.url);
      if (!r.ok) throw new Error(`fetch ${r.status}`);
      const img = await Image.decode(new Uint8Array(await r.arrayBuffer()));
      if (img.width > 800) img.resize(800, Image.RESIZE_AUTO);
      const jpg = await img.encodeJPEG(82);
      const { error } = await admin.storage.from('qart').upload(it.path, jpg, {
        contentType: 'image/jpeg',
        upsert: true,
        cacheControl: '31536000',
      });
      if (error) throw error;
      out.push({ path: it.path, ok: true, w: img.width, h: img.height });
    } catch (e) {
      out.push({ path: it.path, ok: false, err: String(e).slice(0, 200) });
    }
  }
  return new Response(JSON.stringify(out), { headers: { 'Content-Type': 'application/json' } });
});
