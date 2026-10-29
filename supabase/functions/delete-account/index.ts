// Edge Function: delete-account
//
// App Store guideline 5.1.1(v) requires in-app account deletion, including
// for guest accounts. The caller's JWT identifies the user; the service role
// key (server-only secret) performs the delete. Every user-owned row is
// removed by ON DELETE CASCADE from auth.users.
//
// Deploy: supabase functions deploy delete-account
import { createClient } from 'jsr:@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { error: 'method_not_allowed' });

  const authHeader = req.headers.get('Authorization');
  if (!authHeader?.startsWith('Bearer ')) return json(401, { error: 'not_authenticated' });

  const url = Deno.env.get('SUPABASE_URL');
  const anonKey = Deno.env.get('SUPABASE_ANON_KEY');
  const serviceKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
  if (!url || !anonKey || !serviceKey) return json(500, { error: 'server_misconfigured' });

  // Resolve the caller from their own token — never from a request body.
  const userClient = createClient(url, anonKey, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false },
  });
  const { data, error } = await userClient.auth.getUser();
  if (error || !data.user) return json(401, { error: 'not_authenticated' });

  // Require an explicit confirmation flag so a stray call can't delete an account.
  let body: { confirm?: unknown } = {};
  try {
    body = await req.json();
  } catch {
    // fall through to validation
  }
  if (body.confirm !== 'DELETE') return json(400, { error: 'confirmation_required' });

  const admin = createClient(url, serviceKey, { auth: { persistSession: false } });
  // The profile photos live in storage, outside the database cascade: remove the player's folder.
  try {
    const bucket = admin.storage.from('avatars');
    const { data: files } = await bucket.list(data.user.id, { limit: 1000 });
    if (files?.length) await bucket.remove(files.map((f) => `${data.user.id}/${f.name}`));
  } catch (e) {
    console.error('delete-account photos', { user: data.user.id, message: (e as Error).message });
  }
  const { error: delError } = await admin.auth.admin.deleteUser(data.user.id);
  if (delError) {
    console.error('delete-account failed', { user: data.user.id, message: delError.message });
    return json(500, { error: 'delete_failed' });
  }

  console.info('account deleted', { user: data.user.id });
  return json(200, { ok: true });
});
