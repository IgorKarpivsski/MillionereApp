-- The Google Play service-account key (for verifying purchases) lives in Supabase Vault,
-- encrypted at rest. It is delivered once by the "Play key sync" GitHub workflow through the
-- play-key-ingest Edge Function, and read only by the iap-verify / iap-refresh functions
-- (service role). Nobody else can read or write it.

create or replace function public.play_key_store(p_key text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = 'google_play_service_account';
  if v_id is null then
    perform vault.create_secret(p_key, 'google_play_service_account', 'Google Play service account for purchase verification');
  else
    perform vault.update_secret(v_id, p_key);
  end if;
end;
$$;

create or replace function public.play_key_get()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select decrypted_secret from vault.decrypted_secrets where name = 'google_play_service_account' limit 1;
$$;

revoke all on function public.play_key_store(text) from public, anon, authenticated;
revoke all on function public.play_key_get() from public, anon, authenticated;
grant execute on function public.play_key_store(text) to service_role;
grant execute on function public.play_key_get() to service_role;
