-- =============================================================================
-- Migration 0002 — Guest accounts without Supabase "anonymous sign-ins".
--
-- The app first tries supabase.auth.signInAnonymously(). If that provider is
-- switched off, it calls the `guest-signup` Edge Function, which creates a
-- regular auth user flagged app_metadata.guest = true. Users cannot edit
-- app_metadata, so the flag is trustworthy.
-- =============================================================================

-- Guests are either real anonymous users or users the guest-signup function made.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, is_guest)
  values (
    new.id,
    public.generate_username(),
    coalesce(new.is_anonymous, false)
      or coalesce(new.raw_app_meta_data ->> 'guest', 'false') = 'true'
  );
  insert into public.user_settings (user_id) values (new.id);
  insert into public.wallets (user_id) values (new.id);
  return new;
end $$;

revoke execute on function public.handle_new_user() from public, anon, authenticated;

-- Per-IP throttle for the guest-signup function (service role only).
create table public.guest_signups (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index guest_signups_ip_time_idx on public.guest_signups (ip_hash, created_at desc);
alter table public.guest_signups enable row level security;
revoke all on public.guest_signups from anon, authenticated;

-- Returns true and records the attempt if this IP is under the hourly cap.
create or replace function public.guest_signup_allowed(p_ip_hash text, p_max integer)
returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_count integer;
begin
  perform pg_advisory_xact_lock(hashtext(p_ip_hash));
  select count(*) into v_count from public.guest_signups
   where ip_hash = p_ip_hash and created_at > now() - interval '1 hour';
  if v_count >= p_max then
    return false;
  end if;
  insert into public.guest_signups (ip_hash) values (p_ip_hash);
  delete from public.guest_signups where created_at < now() - interval '1 day';
  return true;
end $$;

revoke execute on function public.guest_signup_allowed(text, integer) from public, anon, authenticated;
grant execute on function public.guest_signup_allowed(text, integer) to service_role;
