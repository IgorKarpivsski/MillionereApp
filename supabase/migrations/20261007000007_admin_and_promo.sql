-- Owner tools: an admin panel (find a player, grant coins/gems/packs/tickets)
-- and promo codes for live streams ("first 50 to type LIVE100 get 100 gems").
--
-- Admins: rows in admin_users. An account becomes admin only by redeeming the
-- secret admin code (sha256 in app_config 'ops.admin_code_sha256'), capped at
-- 3 admins. Every admin action is written to admin_audit_log. All amounts are
-- bounded on the server.

create table public.admin_users (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.admin_grants (
  request_id uuid primary key,
  admin_id   uuid not null references auth.users (id) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  reward     jsonb not null,
  note       text,
  created_at timestamptz not null default now()
);
create index admin_grants_time_idx on public.admin_grants (created_at desc);

create table public.promo_codes (
  code       text primary key check (code ~ '^[A-Z0-9]{4,16}$'),
  reward     jsonb not null,
  max_uses   integer not null check (max_uses between 1 and 100000),
  uses       integer not null default 0,
  expires_at timestamptz not null,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  active     boolean not null default true
);

create table public.promo_redemptions (
  code       text not null references public.promo_codes (code) on delete cascade,
  user_id    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (code, user_id)
);
create index promo_redemptions_user_idx on public.promo_redemptions (user_id);

alter table public.admin_users enable row level security;
alter table public.admin_grants enable row level security;
alter table public.promo_codes enable row level security;
alter table public.promo_redemptions enable row level security;
revoke all on public.admin_users, public.admin_grants, public.promo_codes, public.promo_redemptions from anon, authenticated;

insert into public.app_config (key, value, is_public) values
  ('ops.admin_code_sha256', '"disabled"'::jsonb, false),
  ('admin.limits', '{"coins": 100000, "gems": 5000, "pack": 20, "tickets": 50}'::jsonb, false)
on conflict (key) do nothing;

create or replace function public.is_admin(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.admin_users where user_id = p_user)
$$;
revoke all on function public.is_admin(uuid) from public, anon, authenticated;

create or replace function public.require_admin() returns uuid
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  if not public.is_admin(v_uid) then
    raise exception 'not_admin' using errcode = '42501';
  end if;
  return v_uid;
end $$;
revoke all on function public.require_admin() from public, anon, authenticated;

/** Validates a reward for admin grants / promo codes against admin.limits. */
create or replace function public.admin_check_reward(p_r jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_lim jsonb := (select value from public.app_config where key = 'admin.limits');
  v_kind text := p_r ->> 'kind';
  v_amt int;
begin
  if jsonb_typeof(p_r) <> 'object' or v_kind not in ('coins', 'gems', 'pack', 'tickets') then
    raise exception 'invalid_input: kind' using errcode = '22023';
  end if;
  v_amt := (p_r ->> 'amount')::int;
  if v_amt is null or v_amt < 1 or v_amt > (v_lim ->> v_kind)::int then
    raise exception 'invalid_input: amount' using errcode = '22023';
  end if;
  if v_kind = 'pack' and not exists (
       select 1 from jsonb_array_elements((select value from public.app_config where key = 'packs.catalog')) c
        where c ->> 'slug' = p_r ->> 'pack') then
    raise exception 'invalid_input: pack' using errcode = '22023';
  end if;
  return jsonb_strip_nulls(jsonb_build_object('kind', v_kind, 'amount', v_amt,
                                              'pack', case when v_kind = 'pack' then p_r ->> 'pack' end));
end $$;
revoke all on function public.admin_check_reward(jsonb) from public, anon, authenticated;

/** Turns the calling account into an admin with the secret code. */
create or replace function public.admin_claim(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_hash text := (select value #>> '{}' from public.app_config where key = 'ops.admin_code_sha256');
begin
  perform public.check_rate_limit(v_uid, 'admin_claim', 5, 3600);
  if v_hash is null or v_hash = 'disabled'
     or v_hash <> encode(extensions.digest(coalesce(btrim(p_code), ''), 'sha256'), 'hex') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if not public.is_admin(v_uid) then
    if (select count(*) from public.admin_users) >= 3 then
      raise exception 'too_many_admins' using errcode = 'P0001';
    end if;
    insert into public.admin_users (user_id) values (v_uid);
    insert into public.admin_audit_log (admin_id, action, entity, entity_id) values (v_uid, 'admin_claim', 'admin_users', v_uid::text);
  end if;
  return jsonb_build_object('admin', true);
end $$;

/** Whether the caller is an admin (the app shows the panel only then; the server checks anyway). */
create or replace function public.admin_status() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('admin', public.is_admin(auth.uid()))
$$;

create or replace function public.admin_find_players(p_query text) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_q text := btrim(coalesce(p_query, ''));
begin
  perform public.require_admin();
  if length(v_q) < 2 then
    return '[]'::jsonb;
  end if;
  return (
    select coalesce(jsonb_agg(jsonb_build_object(
             'id', p.id, 'username', p.username, 'avatar_id', p.avatar_id, 'level', p.level,
             'friend_code', p.friend_code, 'created_at', p.created_at,
             'coins', coalesce(w.coins, 0), 'gems', coalesce(w.gems, 0)) order by p.username), '[]'::jsonb)
      from (select * from public.profiles
             where username ilike '%' || replace(replace(v_q, '%', ''), '_', '\_') || '%'
                or friend_code = upper(v_q)
                or id::text = v_q
             order by username limit 20) p
      left join public.wallets w on w.user_id = p.id);
end $$;

create or replace function public.admin_grant(p_user uuid, p_reward jsonb, p_note text, p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.require_admin();
  v_r jsonb := public.admin_check_reward(p_reward);
begin
  perform public.check_rate_limit(v_admin, 'admin_grant', 300, 3600);
  if p_request is null then
    raise exception 'invalid_input: request' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_user) then
    raise exception 'invalid_input: user' using errcode = '22023';
  end if;
  -- One request id = one grant, even if the app retries.
  insert into public.admin_grants (request_id, admin_id, user_id, reward, note)
  values (p_request, v_admin, p_user, v_r, left(p_note, 200))
  on conflict (request_id) do nothing;
  if found then
    perform public.grant_reward(p_user, v_r, 'admin:' || p_request);
    insert into public.admin_audit_log (admin_id, action, entity, entity_id, after)
    values (v_admin, 'grant', 'user', p_user::text, v_r || jsonb_build_object('note', left(p_note, 200)));
  end if;
  return jsonb_build_object('ok', true, 'reward', v_r);
end $$;

create or replace function public.admin_recent() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return jsonb_build_object(
    'grants', (select coalesce(jsonb_agg(x order by x ->> 'at' desc), '[]'::jsonb) from (
       select jsonb_build_object('at', g.created_at, 'username', p.username, 'reward', g.reward, 'note', g.note) x
         from public.admin_grants g join public.profiles p on p.id = g.user_id
        order by g.created_at desc limit 30) s),
    'promos', (select coalesce(jsonb_agg(jsonb_build_object(
         'code', c.code, 'reward', c.reward, 'max_uses', c.max_uses, 'uses', c.uses,
         'expires_at', c.expires_at, 'active', c.active and c.expires_at > now() and c.uses < c.max_uses)
         order by c.created_at desc), '[]'::jsonb)
       from (select * from public.promo_codes order by created_at desc limit 30) c),
    'players', (select count(*) from public.profiles));
end $$;

create or replace function public.admin_create_promo(p_code text, p_reward jsonb, p_max_uses integer, p_hours integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_admin uuid := public.require_admin();
  v_r jsonb := public.admin_check_reward(p_reward);
  v_code text := upper(btrim(coalesce(p_code, '')));
begin
  perform public.check_rate_limit(v_admin, 'admin_create_promo', 60, 3600);
  if v_code !~ '^[A-Z0-9]{4,16}$' then
    raise exception 'invalid_input: code' using errcode = '22023';
  end if;
  if p_max_uses is null or p_max_uses < 1 or p_max_uses > 100000 or p_hours is null or p_hours < 1 or p_hours > 24 * 30 then
    raise exception 'invalid_input: limits' using errcode = '22023';
  end if;
  insert into public.promo_codes (code, reward, max_uses, expires_at, created_by)
  values (v_code, v_r, p_max_uses, now() + make_interval(hours => p_hours), v_admin);
  insert into public.admin_audit_log (admin_id, action, entity, entity_id, after)
  values (v_admin, 'create_promo', 'promo_codes', v_code, v_r || jsonb_build_object('max_uses', p_max_uses, 'hours', p_hours));
  return jsonb_build_object('code', v_code);
exception when unique_violation then
  raise exception 'code_taken' using errcode = '23505';
end $$;

create or replace function public.admin_stop_promo(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_admin uuid := public.require_admin();
begin
  update public.promo_codes set active = false where code = upper(btrim(p_code));
  insert into public.admin_audit_log (admin_id, action, entity, entity_id) values (v_admin, 'stop_promo', 'promo_codes', upper(btrim(p_code)));
  return jsonb_build_object('ok', true);
end $$;

/** Any player: redeem a promo code once. */
create or replace function public.redeem_code(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_code text := upper(btrim(coalesce(p_code, '')));
  v_row  public.promo_codes;
begin
  perform public.check_rate_limit(v_uid, 'redeem_code', 10, 3600);
  select * into v_row from public.promo_codes where code = v_code for update;
  if not found or not v_row.active then
    raise exception 'code_invalid' using errcode = 'P0001';
  end if;
  if v_row.expires_at <= now() then
    raise exception 'code_expired' using errcode = 'P0001';
  end if;
  if v_row.uses >= v_row.max_uses then
    raise exception 'code_used_up' using errcode = 'P0001';
  end if;
  insert into public.promo_redemptions (code, user_id) values (v_code, v_uid) on conflict do nothing;
  if not found then
    raise exception 'code_already_redeemed' using errcode = 'P0001';
  end if;
  update public.promo_codes set uses = uses + 1 where code = v_code;
  perform public.grant_reward(v_uid, v_row.reward, 'promo:' || v_code);
  return jsonb_build_object('reward', v_row.reward);
end $$;

revoke all on function
  public.admin_claim(text), public.admin_status(), public.admin_find_players(text),
  public.admin_grant(uuid, jsonb, text, uuid), public.admin_recent(),
  public.admin_create_promo(text, jsonb, integer, integer), public.admin_stop_promo(text), public.redeem_code(text)
from public, anon;
grant execute on function
  public.admin_claim(text), public.admin_status(), public.admin_find_players(text),
  public.admin_grant(uuid, jsonb, text, uuid), public.admin_recent(),
  public.admin_create_promo(text, jsonb, integer, integer), public.admin_stop_promo(text), public.redeem_code(text)
to authenticated;
