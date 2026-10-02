-- =============================================================================
-- Migration 0001 — Identity, settings, wallets and the currency ledger.
--
-- Security posture (see architecture doc, section 8):
--   * Clients may only SELECT their own rows (RLS). They have NO direct
--     INSERT/UPDATE/DELETE on any economy table.
--   * All writes go through SECURITY DEFINER functions with a locked
--     search_path. Every balance change goes through public.ledger_apply(),
--     which is NOT callable by clients.
--   * Every economy action carries an idempotency key; retries return the
--     original result instead of paying twice.
-- =============================================================================

create extension if not exists pgcrypto;

-- -----------------------------------------------------------------------------
-- Types
-- -----------------------------------------------------------------------------
create type public.currency_code as enum ('coins', 'gems', 'dust');
create type public.device_platform as enum ('ios', 'android', 'web');

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create or replace function public.set_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- Admin role lives in app_metadata, which users cannot edit themselves.
create or replace function public.is_admin() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'role', '') = 'admin'
$$;

-- -----------------------------------------------------------------------------
-- Profiles
-- -----------------------------------------------------------------------------
create table public.profiles (
  id          uuid primary key references auth.users (id) on delete cascade,
  username    text not null,
  avatar_id   text not null default 'avatar_01',
  country     char(2),
  level       integer not null default 1,
  xp          bigint  not null default 0,
  fav_leagues text[]  not null default '{}',
  fav_teams   text[]  not null default '{}',
  is_guest    boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint profiles_username_format check (username ~ '^[A-Za-z0-9_֐-׿]{3,20}$'),
  constraint profiles_avatar_format   check (avatar_id ~ '^avatar_[0-9]{2}$'),
  constraint profiles_country_format  check (country is null or country ~ '^[A-Z]{2}$'),
  constraint profiles_level_positive  check (level >= 1),
  constraint profiles_xp_nonnegative  check (xp >= 0),
  constraint profiles_fav_leagues_len check (cardinality(fav_leagues) <= 10),
  constraint profiles_fav_teams_len   check (cardinality(fav_teams) <= 10)
);
create unique index profiles_username_lower_key on public.profiles (lower(username));
create index profiles_leaderboard_idx on public.profiles (country, xp desc);
create trigger profiles_updated_at before update on public.profiles
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Settings
-- -----------------------------------------------------------------------------
create table public.user_settings (
  user_id        uuid primary key references auth.users (id) on delete cascade,
  locale         text    not null default 'he',
  sound          boolean not null default true,
  music          boolean not null default true,
  haptics        boolean not null default true,
  reduced_motion boolean not null default false,
  notif_prefs    jsonb   not null default '{}'::jsonb,
  updated_at     timestamptz not null default now(),
  constraint user_settings_locale check (locale in ('he', 'en')),
  constraint user_settings_notif_is_object check (jsonb_typeof(notif_prefs) = 'object')
);
create trigger user_settings_updated_at before update on public.user_settings
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Devices (push tokens)
-- -----------------------------------------------------------------------------
create table public.devices (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  push_token text not null unique,
  platform   public.device_platform not null,
  last_seen  timestamptz not null default now()
);
create index devices_user_idx on public.devices (user_id);

-- -----------------------------------------------------------------------------
-- Wallets + ledger
-- -----------------------------------------------------------------------------
create table public.wallets (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  coins      bigint not null default 0,
  gems       bigint not null default 0,
  dust       bigint not null default 0,
  version    bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint wallets_coins_nonnegative check (coins >= 0),
  constraint wallets_gems_nonnegative  check (gems  >= 0),
  constraint wallets_dust_nonnegative  check (dust  >= 0)
);

create table public.wallet_transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users (id) on delete cascade,
  currency        public.currency_code not null,
  amount          bigint not null,
  balance_after   bigint not null,
  reason          text not null,
  ref_type        text,
  ref_id          text,
  idempotency_key text not null,
  created_at      timestamptz not null default now(),
  constraint wallet_tx_amount_nonzero  check (amount <> 0),
  constraint wallet_tx_balance_nonneg  check (balance_after >= 0),
  constraint wallet_tx_reason_format   check (reason ~ '^[a-z][a-z0-9_]{1,40}$'),
  constraint wallet_tx_key_len         check (char_length(idempotency_key) between 1 and 200),
  constraint wallet_tx_idempotent unique (user_id, idempotency_key)
);
create index wallet_tx_user_time_idx on public.wallet_transactions (user_id, created_at desc);
create index wallet_tx_reason_time_idx on public.wallet_transactions (reason, created_at);

-- The ledger is append-only.
create or replace function public.forbid_ledger_update() returns trigger
language plpgsql set search_path = '' as $$
begin
  raise exception 'wallet_transactions is append-only';
end $$;
create trigger wallet_tx_no_update before update on public.wallet_transactions
  for each row execute function public.forbid_ledger_update();

-- -----------------------------------------------------------------------------
-- Remote config, rate limits, audit
-- -----------------------------------------------------------------------------
create table public.app_config (
  key        text primary key,
  value      jsonb not null,
  is_public  boolean not null default false,
  version    integer not null default 1,
  updated_at timestamptz not null default now(),
  constraint app_config_key_format check (key ~ '^[a-z][a-z0-9_.]{1,80}$')
);
create trigger app_config_updated_at before update on public.app_config
  for each row execute function public.set_updated_at();

create table public.rate_limits (
  user_id      uuid not null references auth.users (id) on delete cascade,
  action       text not null,
  window_start timestamptz not null,
  count        integer not null default 0,
  primary key (user_id, action, window_start)
);

create table public.admin_audit_log (
  id         bigint generated always as identity primary key,
  admin_id   uuid,
  action     text not null,
  entity     text not null,
  entity_id  text,
  before     jsonb,
  after      jsonb,
  created_at timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- Row Level Security
-- -----------------------------------------------------------------------------
alter table public.profiles            enable row level security;
alter table public.user_settings       enable row level security;
alter table public.devices             enable row level security;
alter table public.wallets             enable row level security;
alter table public.wallet_transactions enable row level security;
alter table public.app_config          enable row level security;
alter table public.rate_limits         enable row level security;
alter table public.admin_audit_log     enable row level security;

create policy profiles_select_own on public.profiles
  for select to authenticated using (id = auth.uid());
create policy settings_select_own on public.user_settings
  for select to authenticated using (user_id = auth.uid());
create policy devices_select_own on public.devices
  for select to authenticated using (user_id = auth.uid());
create policy wallets_select_own on public.wallets
  for select to authenticated using (user_id = auth.uid());
create policy wallet_tx_select_own on public.wallet_transactions
  for select to authenticated using (user_id = auth.uid());
create policy app_config_select_public on public.app_config
  for select to anon, authenticated using (is_public);
-- rate_limits and admin_audit_log: no policies → no client access at all.

-- Defense in depth: even if a policy is added by mistake later, clients still
-- cannot write economy or identity tables directly.
revoke insert, update, delete, truncate on
  public.profiles, public.user_settings, public.devices, public.wallets,
  public.wallet_transactions, public.app_config, public.rate_limits,
  public.admin_audit_log
from anon, authenticated;

-- -----------------------------------------------------------------------------
-- Rate limiting (fixed window). Internal.
-- -----------------------------------------------------------------------------
create or replace function public.check_rate_limit(
  p_user uuid, p_action text, p_max integer, p_window_seconds integer
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_window timestamptz := to_timestamp(
    floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);
  v_count integer;
begin
  insert into public.rate_limits as r (user_id, action, window_start, count)
  values (p_user, p_action, v_window, 1)
  on conflict (user_id, action, window_start) do update set count = r.count + 1
  returning r.count into v_count;

  if v_count > p_max then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
end $$;


-- -----------------------------------------------------------------------------
-- The ledger. The ONLY way balances change. Internal: never granted to clients.
-- -----------------------------------------------------------------------------
create or replace function public.ledger_apply(
  p_user     uuid,
  p_currency public.currency_code,
  p_amount   bigint,
  p_reason   text,
  p_ref_type text,
  p_ref_id   text,
  p_key      text
) returns public.wallet_transactions
language plpgsql security definer set search_path = '' as $$
declare
  v_wallet   public.wallets;
  v_existing public.wallet_transactions;
  v_balance  bigint;
  v_row      public.wallet_transactions;
begin
  if p_amount is null or p_amount = 0 then
    raise exception 'invalid_input: amount must be non-zero' using errcode = '22023';
  end if;
  if p_key is null or char_length(p_key) = 0 then
    raise exception 'invalid_input: idempotency key required' using errcode = '22023';
  end if;

  -- Lock the wallet row: concurrent calls for this user serialize here, so the
  -- idempotency check below is race-free.
  select * into v_wallet from public.wallets where user_id = p_user for update;
  if not found then
    raise exception 'invalid_input: wallet not found' using errcode = '22023';
  end if;

  select * into v_existing from public.wallet_transactions
   where user_id = p_user and idempotency_key = p_key;
  if found then
    if v_existing.currency <> p_currency or v_existing.amount <> p_amount
       or v_existing.reason <> p_reason then
      raise exception 'idempotency_conflict' using errcode = 'P0409';
    end if;
    return v_existing;  -- retry: same result, no second movement
  end if;

  v_balance := case p_currency
                 when 'coins' then v_wallet.coins
                 when 'gems'  then v_wallet.gems
                 else v_wallet.dust
               end + p_amount;
  if v_balance < 0 then
    raise exception 'insufficient_funds' using errcode = 'P0402';
  end if;

  update public.wallets set
    coins   = case when p_currency = 'coins' then v_balance else coins end,
    gems    = case when p_currency = 'gems'  then v_balance else gems  end,
    dust    = case when p_currency = 'dust'  then v_balance else dust  end,
    version = version + 1,
    updated_at = now()
  where user_id = p_user;

  insert into public.wallet_transactions
    (user_id, currency, amount, balance_after, reason, ref_type, ref_id, idempotency_key)
  values (p_user, p_currency, p_amount, v_balance, p_reason, p_ref_type, p_ref_id, p_key)
  returning * into v_row;

  return v_row;
end $$;

-- -----------------------------------------------------------------------------
-- New user bootstrap (fires for guests and full accounts alike)
-- -----------------------------------------------------------------------------
create or replace function public.generate_username() returns text
language plpgsql volatile set search_path = '' as $$
declare
  v_name text;
begin
  for i in 1..20 loop
    v_name := 'שחקן' || lpad((floor(random() * 1000000))::int::text, 6, '0');
    if not exists (select 1 from public.profiles where lower(username) = lower(v_name)) then
      return v_name;
    end if;
  end loop;
  return 'שחקן' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
end $$;

create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.profiles (id, username, is_guest)
  values (new.id, public.generate_username(), coalesce(new.is_anonymous, false));
  insert into public.user_settings (user_id) values (new.id);
  insert into public.wallets (user_id) values (new.id);
  return new;
end $$;

create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Guest → linked account keeps the SAME user id, so all progress stays.
create or replace function public.handle_user_upgraded() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if coalesce(old.is_anonymous, false) is distinct from coalesce(new.is_anonymous, false) then
    update public.profiles set is_guest = coalesce(new.is_anonymous, false) where id = new.id;
  end if;
  return new;
end $$;

create trigger on_auth_user_updated after update of is_anonymous on auth.users
  for each row execute function public.handle_user_upgraded();

-- -----------------------------------------------------------------------------
-- Client RPCs (Phase 1)
-- -----------------------------------------------------------------------------
create or replace function public.require_user() returns uuid
language plpgsql stable set search_path = '' as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception 'not_authenticated' using errcode = '28000';
  end if;
  return v_uid;
end $$;

-- One round-trip for the Home screen.
create or replace function public.get_my_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  return jsonb_build_object(
    'profile', (select to_jsonb(p) - 'updated_at' from public.profiles p where p.id = v_uid),
    'wallet',  (select jsonb_build_object('coins', w.coins, 'gems', w.gems, 'dust', w.dust)
                  from public.wallets w where w.user_id = v_uid),
    'settings', (select to_jsonb(s) - 'user_id' - 'updated_at'
                   from public.user_settings s where s.user_id = v_uid),
    'welcome_bonus_claimed', exists (
      select 1 from public.wallet_transactions t
       where t.user_id = v_uid and t.idempotency_key = 'welcome_bonus')
  );
end $$;

create or replace function public.update_my_profile(
  p_username    text    default null,
  p_avatar_id   text    default null,
  p_fav_leagues text[]  default null,
  p_fav_teams   text[]  default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  perform public.check_rate_limit(v_uid, 'update_profile', 20, 3600);

  if p_username is not null then
    p_username := btrim(p_username);
    if p_username !~ '^[A-Za-z0-9_֐-׿]{3,20}$' then
      raise exception 'invalid_input: username' using errcode = '22023';
    end if;
    if exists (select 1 from public.profiles
                where lower(username) = lower(p_username) and id <> v_uid) then
      raise exception 'username_taken' using errcode = '23505';
    end if;
  end if;

  update public.profiles set
    username    = coalesce(p_username, username),
    avatar_id   = coalesce(p_avatar_id, avatar_id),
    fav_leagues = coalesce(p_fav_leagues, fav_leagues),
    fav_teams   = coalesce(p_fav_teams, fav_teams)
  where id = v_uid;

  return public.get_my_state();
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = '23505';
  when check_violation then
    raise exception 'invalid_input: %', sqlerrm using errcode = '22023';
end $$;

create or replace function public.update_my_settings(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_key text;
begin
  perform public.check_rate_limit(v_uid, 'update_settings', 120, 3600);

  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'invalid_input: patch must be an object' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('locale', 'sound', 'music', 'haptics', 'reduced_motion', 'notif_prefs') then
      raise exception 'invalid_input: unknown setting %', v_key using errcode = '22023';
    end if;
  end loop;

  update public.user_settings set
    locale         = coalesce(p_patch ->> 'locale', locale),
    sound          = coalesce((p_patch ->> 'sound')::boolean, sound),
    music          = coalesce((p_patch ->> 'music')::boolean, music),
    haptics        = coalesce((p_patch ->> 'haptics')::boolean, haptics),
    reduced_motion = coalesce((p_patch ->> 'reduced_motion')::boolean, reduced_motion),
    notif_prefs    = coalesce(p_patch -> 'notif_prefs', notif_prefs)
  where user_id = v_uid;

  return public.get_my_state();
exception
  when check_violation or invalid_text_representation then
    raise exception 'invalid_input: %', sqlerrm using errcode = '22023';
end $$;

create or replace function public.register_device(p_token text, p_platform public.device_platform)
returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  if p_token is null or char_length(p_token) not between 10 and 400 then
    raise exception 'invalid_input: token' using errcode = '22023';
  end if;
  perform public.check_rate_limit(v_uid, 'register_device', 30, 3600);
  insert into public.devices (user_id, push_token, platform)
  values (v_uid, p_token, p_platform)
  on conflict (push_token) do update
    set user_id = excluded.user_id, platform = excluded.platform, last_seen = now();
end $$;

-- First economy action: proves the server-side flow end-to-end.
-- Amount comes from server config, never from the client.
create or replace function public.claim_welcome_bonus() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := public.require_user();
  v_amount bigint;
  v_tx     public.wallet_transactions;
begin
  perform public.check_rate_limit(v_uid, 'claim_welcome_bonus', 10, 60);
  select (value #>> '{}')::bigint into v_amount
    from public.app_config where key = 'economy.welcome_bonus_coins';
  if v_amount is null or v_amount <= 0 then
    raise exception 'invalid_input: welcome bonus not configured' using errcode = '22023';
  end if;

  v_tx := public.ledger_apply(v_uid, 'coins', v_amount, 'welcome_bonus', 'system', null, 'welcome_bonus');
  return jsonb_build_object('amount', v_tx.amount, 'balance', v_tx.balance_after);
end $$;

-- -----------------------------------------------------------------------------
-- Function privileges: internal helpers are NOT callable by clients.
-- -----------------------------------------------------------------------------
revoke execute on function
  public.ledger_apply(uuid, public.currency_code, bigint, text, text, text, text),
  public.check_rate_limit(uuid, text, integer, integer),
  public.handle_new_user(),
  public.handle_user_upgraded(),
  public.generate_username(),
  public.forbid_ledger_update(),
  public.set_updated_at()
from public, anon, authenticated;

revoke execute on function
  public.get_my_state(),
  public.update_my_profile(text, text, text[], text[]),
  public.update_my_settings(jsonb),
  public.register_device(text, public.device_platform),
  public.claim_welcome_bonus()
from public, anon;

grant execute on function
  public.get_my_state(),
  public.update_my_profile(text, text, text[], text[]),
  public.update_my_settings(jsonb),
  public.register_device(text, public.device_platform),
  public.claim_welcome_bonus()
to authenticated;

-- -----------------------------------------------------------------------------
-- Seed config (economy values live here, not in the app)
-- -----------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values
  ('economy.welcome_bonus_coins', '500'::jsonb, true),
  ('app.min_supported_version',   '"1.0.0"'::jsonb, true),
  ('app.maintenance',             'false'::jsonb, true),
  ('ops.anomaly_threshold_ms',    '350'::jsonb, false);
