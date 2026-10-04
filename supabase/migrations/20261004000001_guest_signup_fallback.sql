-- =============================================================================
-- Migration 0002 — Guest accounts without Supabase "anonymous sign-ins".
--
-- The app first tries supabase.auth.signInAnonymously(). If that provider is
-- switched off, it calls the `guest-signup` Edge Function, which creates a
-- regular auth user flagged app_metadata.guest = true. Users cannot edit
-- app_metadata, so the flag is trustworthy.
--
-- Additive only (applied to production as-is on 2026-10-04).
-- =============================================================================

-- Per-IP throttle for the guest-signup function (service role only).
create table public.guest_signups (
  id         bigint generated always as identity primary key,
  ip_hash    text not null,
  created_at timestamptz not null default now()
);
create index guest_signups_ip_time_idx on public.guest_signups (ip_hash, created_at desc);
alter table public.guest_signups enable row level security;

-- Returns true and records the attempt if this IP is under the hourly cap.
create function public.guest_signup_allowed(p_ip_hash text, p_max integer)
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
  return true;
end $$;

-- Runs after on_auth_user_created (triggers fire in name order), so the
-- profile already exists.
create function public.mark_function_guest() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(new.raw_app_meta_data ->> 'guest', 'false') = 'true' then
    update public.profiles set is_guest = true where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_created_mark_guest after insert on auth.users
  for each row execute function public.mark_function_guest();

revoke all on public.guest_signups from anon, authenticated;
revoke execute on function public.guest_signup_allowed(text, integer) from public, anon, authenticated;
revoke execute on function public.mark_function_guest() from public, anon, authenticated;
grant execute on function public.guest_signup_allowed(text, integer) to service_role;
