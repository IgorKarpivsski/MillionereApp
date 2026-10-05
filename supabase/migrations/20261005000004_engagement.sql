-- =============================================================================
-- Migration 0014 — Energy, daily wheel, rotating deals, season pass.
--
-- Energy ("כרטיסים"): a classic run costs 1 ticket; 5 max, +1 every 20 min.
--   The daily challenge and friend matches stay free. VIP plays without limit.
--   Refill: gems (full), a rewarded ad (+1, 5 a day), wheel / pass rewards.
-- Wheel: one free spin every 24 h, extra spins cost gems. Odds are public.
-- Deals: one rotating offer every 8 h, bought once per window with coins/gems.
-- Season pass: XP from every game fills a 30-tier track; free and premium rows.
-- Everything is server-authoritative and idempotent per request id.
-- =============================================================================

insert into public.app_config (key, value, is_public) values
  ('energy', '{"max":5,"refill_minutes":20,"gem_refill":20,"ad_per_day":5}'::jsonb, true),
  ('wheel', '{"spin_gems":15,"paid_per_day":20,"segments":[
     {"id":"c100","kind":"coins","amount":100,"weight":24},
     {"id":"t2","kind":"tickets","amount":2,"weight":12},
     {"id":"c250","kind":"coins","amount":250,"weight":18},
     {"id":"bronze","kind":"pack","pack":"bronze","amount":1,"weight":12},
     {"id":"g5","kind":"gems","amount":5,"weight":12},
     {"id":"c600","kind":"coins","amount":600,"weight":8},
     {"id":"silver","kind":"pack","pack":"silver","amount":1,"weight":7},
     {"id":"g25","kind":"gems","amount":25,"weight":3},
     {"id":"gold","kind":"pack","pack":"gold","amount":1,"weight":3},
     {"id":"g100","kind":"gems","amount":100,"weight":1}]}'::jsonb, true),
  ('deals', '{"hours":8,"list":[
     {"id":"gold_sale","title":"חבילת זהב בהנחה","body":"5 קלפים, לפחות אחד נדיר","price":{"currency":"coins","amount":2500},"was":4000,"rewards":[{"kind":"pack","pack":"gold","amount":1}]},
     {"id":"tickets_bundle","title":"חבילת אנרגיה","body":"5 כרטיסים + חבילת כסף","price":{"currency":"gems","amount":25},"was":45,"rewards":[{"kind":"tickets","amount":5},{"kind":"pack","pack":"silver","amount":1}]},
     {"id":"epic_sale","title":"חבילה אפית בהנחה","body":"מובטח קלף אפי ומעלה","price":{"currency":"gems","amount":40},"was":60,"rewards":[{"kind":"pack","pack":"epic","amount":1}]},
     {"id":"coins_bundle","title":"שק הפתעות","body":"1,500 מטבעות + 2 חבילות ארד","price":{"currency":"gems","amount":15},"was":30,"rewards":[{"kind":"coins","amount":1500},{"kind":"pack","pack":"bronze","amount":2}]},
     {"id":"legend_deal","title":"חבילה אגדית!","body":"מובטח קלף אגדי ומעלה — רק בדיל הזה","price":{"currency":"gems","amount":150},"was":250,"rewards":[{"kind":"pack","pack":"legendary","amount":1}]},
     {"id":"dust_deal","title":"אבקת קסמים","body":"400 אבקה לייצור קלפים","price":{"currency":"coins","amount":1500},"was":2400,"rewards":[{"kind":"dust","amount":400}]}]}'::jsonb, true),
  ('season.current', '{"id": "s1", "title": "עונה 1: הבעיטה הראשונה", "starts": "2026-10-01", "ends": "2026-12-01", "xp_per_tier": 250, "premium_gems": 450, "tiers": [{"tier": 1, "free": {"kind": "coins", "amount": 150}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 2, "free": {"kind": "coins", "amount": 300}, "premium": {"kind": "pack", "pack": "gold", "amount": 1}}, {"tier": 3, "free": {"kind": "tickets", "amount": 3}, "premium": {"kind": "cosmetic", "item": "frame_neon", "amount": 1}}, {"tier": 4, "free": {"kind": "coins", "amount": 300}, "premium": {"kind": "gems", "amount": 30}}, {"tier": 5, "free": {"kind": "pack", "pack": "silver", "amount": 1}, "premium": {"kind": "pack", "pack": "epic", "amount": 1}}, {"tier": 6, "free": {"kind": "tickets", "amount": 3}, "premium": {"kind": "pack", "pack": "gold", "amount": 1}}, {"tier": 7, "free": {"kind": "coins", "amount": 150}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 8, "free": {"kind": "coins", "amount": 300}, "premium": {"kind": "cosmetic", "item": "badge_whistle", "amount": 1}}, {"tier": 9, "free": {"kind": "tickets", "amount": 3}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 10, "free": {"kind": "pack", "pack": "gold", "amount": 1}, "premium": {"kind": "pack", "pack": "epic", "amount": 1}}, {"tier": 11, "free": {"kind": "coins", "amount": 150}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 12, "free": {"kind": "tickets", "amount": 3}, "premium": {"kind": "cosmetic", "item": "frame_fire", "amount": 1}}, {"tier": 13, "free": {"kind": "coins", "amount": 150}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 14, "free": {"kind": "coins", "amount": 300}, "premium": {"kind": "pack", "pack": "gold", "amount": 1}}, {"tier": 15, "free": {"kind": "pack", "pack": "silver", "amount": 1}, "premium": {"kind": "pack", "pack": "epic", "amount": 1}}, {"tier": 16, "free": {"kind": "coins", "amount": 300}, "premium": {"kind": "cosmetic", "item": "avatar_shades", "amount": 1}}, {"tier": 17, "free": {"kind": "coins", "amount": 150}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 18, "free": {"kind": "tickets", "amount": 3}, "premium": {"kind": "pack", "pack": "gold", "amount": 1}}, {"tier": 19, "free": {"kind": "coins", "amount": 150}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 20, "free": {"kind": "pack", "pack": "gold", "amount": 1}, "premium": {"kind": "cosmetic", "item": "frame_gold", "amount": 1}}, {"tier": 21, "free": {"kind": "tickets", "amount": 3}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 22, "free": {"kind": "coins", "amount": 300}, "premium": {"kind": "pack", "pack": "gold", "amount": 1}}, {"tier": 23, "free": {"kind": "coins", "amount": 150}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 24, "free": {"kind": "tickets", "amount": 3}, "premium": {"kind": "cosmetic", "item": "avatar_crown", "amount": 1}}, {"tier": 25, "free": {"kind": "pack", "pack": "silver", "amount": 1}, "premium": {"kind": "pack", "pack": "legendary", "amount": 1}}, {"tier": 26, "free": {"kind": "coins", "amount": 300}, "premium": {"kind": "pack", "pack": "gold", "amount": 1}}, {"tier": 27, "free": {"kind": "tickets", "amount": 3}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 28, "free": {"kind": "coins", "amount": 300}, "premium": {"kind": "gems", "amount": 30}}, {"tier": 29, "free": {"kind": "coins", "amount": 150}, "premium": {"kind": "coins", "amount": 600}}, {"tier": 30, "free": {"kind": "pack", "pack": "gold", "amount": 1}, "premium": {"kind": "cosmetic", "item": "frame_legend", "amount": 1}}]}'::jsonb, true)
on conflict (key) do update set value = excluded.value, updated_at = now();

create table public.user_energy (
  user_id uuid primary key references auth.users (id) on delete cascade,
  tickets integer not null default 5,
  stamp   timestamptz not null default now(),
  constraint user_energy_range check (tickets between 0 and 99)
);
create table public.wheel_spins (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  paid_with  text not null check (paid_with in ('free', 'gems')),
  segment    text not null,
  result     jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);
create index wheel_spins_user_idx on public.wheel_spins (user_id, created_at desc);
create table public.deal_purchases (
  user_id    uuid not null references auth.users (id) on delete cascade,
  deal_id    text not null,
  win        bigint not null,
  created_at timestamptz not null default now(),
  primary key (user_id, deal_id, win)
);
create table public.user_pass (
  user_id         uuid not null references auth.users (id) on delete cascade,
  season          text not null,
  xp              integer not null default 0,
  premium         boolean not null default false,
  claimed_free    integer[] not null default '{}',
  claimed_premium integer[] not null default '{}',
  primary key (user_id, season)
);
create table public.user_cosmetics (
  user_id    uuid not null references auth.users (id) on delete cascade,
  item       text not null,
  source     text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, item)
);

alter table public.user_energy enable row level security;
alter table public.wheel_spins enable row level security;
alter table public.deal_purchases enable row level security;
alter table public.user_pass enable row level security;
alter table public.user_cosmetics enable row level security;
create policy user_energy_own on public.user_energy for select to authenticated using (user_id = (select auth.uid()));
create policy wheel_spins_own on public.wheel_spins for select to authenticated using (user_id = (select auth.uid()));
create policy deal_purchases_own on public.deal_purchases for select to authenticated using (user_id = (select auth.uid()));
create policy user_pass_own on public.user_pass for select to authenticated using (user_id = (select auth.uid()));
create policy user_cosmetics_own on public.user_cosmetics for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.user_energy, public.wheel_spins, public.deal_purchases, public.user_pass, public.user_cosmetics
  from anon, authenticated;

alter table public.ad_claims drop constraint ad_claims_kind;
alter table public.ad_claims add constraint ad_claims_kind check (kind in ('double_run', 'free_pack', 'vip_daily', 'energy'));

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create function public.is_vip(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select vip_until > now() from public.user_entitlements where user_id = p_user), false)
$$;

create function public.paid_region_blocked(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select p.country is not null and (select value from public.app_config where key = 'packs.paid_blocked_regions') ? p.country
                     from public.profiles p where p.id = p_user), false)
$$;

/** Brings the ticket count up to date (lazy regeneration) and returns the locked row. */
create function public.energy_sync(p_user uuid) returns public.user_energy
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_e   public.user_energy;
  v_cfg jsonb := (select value from public.app_config where key = 'energy');
  v_max integer := coalesce((v_cfg ->> 'max')::int, 5);
  v_min integer := coalesce((v_cfg ->> 'refill_minutes')::int, 20);
  v_n   integer;
begin
  select * into v_e from public.user_energy where user_id = p_user for update;
  if not found then
    insert into public.user_energy (user_id, tickets, stamp) values (p_user, v_max, now())
    on conflict (user_id) do nothing;
    select * into v_e from public.user_energy where user_id = p_user for update;
  end if;
  if v_e.tickets < v_max then
    v_n := floor(extract(epoch from now() - v_e.stamp) / (v_min * 60))::int;
    if v_n > 0 then
      v_e.tickets := least(v_max, v_e.tickets + v_n);
      v_e.stamp := case when v_e.tickets >= v_max then now() else v_e.stamp + make_interval(mins => v_n * v_min) end;
      update public.user_energy set tickets = v_e.tickets, stamp = v_e.stamp where user_id = p_user;
    end if;
  end if;
  return v_e;
end $$;

create function public.energy_add(p_user uuid, p_n integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
begin
  perform public.energy_sync(p_user);
  update public.user_energy set tickets = least(99, tickets + p_n) where user_id = p_user;
end $$;

/** Spends one ticket for a classic run. VIP plays for free. */
create function public.energy_spend(p_user uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_e   public.user_energy;
  v_max integer := coalesce(((select value from public.app_config where key = 'energy') ->> 'max')::int, 5);
begin
  if public.is_vip(p_user) then return; end if;
  v_e := public.energy_sync(p_user);
  if v_e.tickets < 1 then
    raise exception 'invalid_state: no_energy' using errcode = 'P0001';
  end if;
  update public.user_energy
     set tickets = tickets - 1, stamp = case when v_e.tickets >= v_max then now() else stamp end
   where user_id = p_user;
end $$;

create function public.energy_state() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_e   public.user_energy;
  v_cfg jsonb := (select value from public.app_config where key = 'energy');
  v_max integer := coalesce((v_cfg ->> 'max')::int, 5);
  v_ads integer;
begin
  v_e := public.energy_sync(v_uid);
  select count(*) into v_ads from public.ad_claims where user_id = v_uid and kind = 'energy' and created_at > now() - interval '1 day';
  return jsonb_build_object(
    'tickets', v_e.tickets, 'max', v_max, 'refill_minutes', (v_cfg ->> 'refill_minutes')::int,
    'next_at', case when v_e.tickets < v_max then v_e.stamp + make_interval(mins => (v_cfg ->> 'refill_minutes')::int) end,
    'unlimited', public.is_vip(v_uid), 'gem_refill', (v_cfg ->> 'gem_refill')::int,
    'ad_left', greatest(0, (v_cfg ->> 'ad_per_day')::int - v_ads));
end $$;

/** Refill with gems (to full) or with a watched ad (+1). */
create function public.energy_refill(p_how text, p_request uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_cfg jsonb := (select value from public.app_config where key = 'energy');
  v_max integer := coalesce((v_cfg ->> 'max')::int, 5);
  v_e   public.user_energy;
  v_n   integer;
begin
  perform public.check_rate_limit(v_uid, 'energy_refill', 20, 60);
  if p_request is null then raise exception 'invalid_input: request id' using errcode = '22023'; end if;
  v_e := public.energy_sync(v_uid);
  if p_how = 'gems' then
    if v_e.tickets >= v_max then raise exception 'invalid_state: already full' using errcode = 'P0001'; end if;
    perform public.ledger_apply(v_uid, 'gems', -((v_cfg ->> 'gem_refill')::bigint), 'energy_refill', 'energy', p_request::text,
      'energy:' || p_request::text);
    update public.user_energy set tickets = v_max, stamp = now() where user_id = v_uid and tickets < v_max;
  elsif p_how = 'ad' then
    select count(*) into v_n from public.ad_claims where user_id = v_uid and kind = 'energy' and created_at > now() - interval '1 day';
    if v_n >= (v_cfg ->> 'ad_per_day')::int then raise exception 'rate_limited' using errcode = 'P0429'; end if;
    insert into public.ad_claims (user_id, kind, ref) values (v_uid, 'energy', p_request::text) on conflict do nothing;
    if found then perform public.energy_add(v_uid, 1); end if;
  else
    raise exception 'invalid_input: how' using errcode = '22023';
  end if;
  return public.energy_state();
end $$;

/** Grants one reward object: coins / gems / dust / pack / tickets / cosmetic. */
create function public.grant_reward(p_user uuid, p_r jsonb, p_key text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_amt integer := coalesce((p_r ->> 'amount')::int, 1);
begin
  case p_r ->> 'kind'
    when 'coins' then perform public.ledger_apply(p_user, 'coins', v_amt, 'reward', 'reward', p_key, p_key || ':c');
    when 'gems'  then perform public.ledger_apply(p_user, 'gems', v_amt, 'reward', 'reward', p_key, p_key || ':g');
    when 'dust'  then perform public.ledger_apply(p_user, 'dust', v_amt, 'reward', 'reward', p_key, p_key || ':d');
    when 'pack'  then perform public.grant_pack_token(p_user, p_r ->> 'pack', v_amt);
    when 'tickets' then perform public.energy_add(p_user, v_amt);
    when 'cosmetic' then
      insert into public.user_cosmetics (user_id, item, source) values (p_user, p_r ->> 'item', p_key) on conflict do nothing;
    else raise exception 'invalid_input: reward kind' using errcode = '22023';
  end case;
end $$;

-- Classic runs now cost a ticket.
create or replace function public.quiz_start() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_old uuid;
  v_id  uuid;
begin
  perform public.check_rate_limit(v_uid, 'quiz_start', 60, 3600);
  perform public.energy_spend(v_uid);
  for v_old in select id from public.quiz_runs where user_id = v_uid and status = 'active' and mode = 'classic' for update loop
    perform public.quiz_finish(v_old, 'abandoned');
  end loop;
  for v_old in select id from public.quiz_runs where user_id = v_uid and status = 'active' and mode = 'daily' for update loop
    perform public.daily_finish(v_old);
  end loop;
  insert into public.quiz_runs (user_id) values (v_uid) returning id into v_id;
  return public.quiz_next(v_id);
end $$;

-- -----------------------------------------------------------------------------
-- Daily wheel
-- -----------------------------------------------------------------------------
create function public.wheel_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_cfg  jsonb := (select value from public.app_config where key = 'wheel');
  v_last timestamptz;
  v_tot  numeric;
begin
  select max(created_at) into v_last from public.wheel_spins where user_id = v_uid and paid_with = 'free';
  select sum((s ->> 'weight')::numeric) into v_tot from jsonb_array_elements(v_cfg -> 'segments') s;
  return jsonb_build_object(
    'free_available', v_last is null or v_last <= now() - interval '24 hours',
    'next_free_at', case when v_last is not null and v_last > now() - interval '24 hours' then v_last + interval '24 hours' end,
    'spin_gems', (v_cfg ->> 'spin_gems')::int,
    'paid_left', greatest(0, (v_cfg ->> 'paid_per_day')::int - (select count(*) from public.wheel_spins where user_id = v_uid and paid_with = 'gems' and created_at > now() - interval '1 day')),
    'blocked', public.paid_region_blocked(v_uid),
    'segments', (select jsonb_agg((s - 'weight') || jsonb_build_object('pct', round((s ->> 'weight')::numeric * 100 / v_tot, 1)) order by o)
                   from jsonb_array_elements(v_cfg -> 'segments') with ordinality as x(s, o)));
end $$;

create function public.wheel_spin(p_pay text, p_request uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_cfg  jsonb := (select value from public.app_config where key = 'wheel');
  v_prev jsonb;
  v_tot  numeric;
  v_roll numeric;
  v_acc  numeric := 0;
  v_seg  jsonb;
  v_idx  integer;
  v_res  jsonb;
  s      jsonb;
  o      bigint;
begin
  perform public.check_rate_limit(v_uid, 'wheel_spin', 30, 60);
  if p_request is null then raise exception 'invalid_input: request id' using errcode = '22023'; end if;
  perform 1 from public.wallets where user_id = v_uid for update;   -- serialize spins per user
  select result into v_prev from public.wheel_spins where user_id = v_uid and request_id = p_request;
  if found then return v_prev; end if;

  if p_pay = 'free' then
    if exists (select 1 from public.wheel_spins where user_id = v_uid and paid_with = 'free' and created_at > now() - interval '24 hours') then
      raise exception 'invalid_state: free spin used' using errcode = 'P0001';
    end if;
  elsif p_pay = 'gems' then
    if public.paid_region_blocked(v_uid) then raise exception 'invalid_state: region' using errcode = 'P0001'; end if;
    if (select count(*) from public.wheel_spins where user_id = v_uid and paid_with = 'gems' and created_at > now() - interval '1 day')
       >= (v_cfg ->> 'paid_per_day')::int then
      raise exception 'rate_limited' using errcode = 'P0429';
    end if;
    perform public.ledger_apply(v_uid, 'gems', -((v_cfg ->> 'spin_gems')::bigint), 'wheel_spin', 'wheel', p_request::text, 'wheel:' || p_request::text);
  else
    raise exception 'invalid_input: pay' using errcode = '22023';
  end if;

  select sum((x.s ->> 'weight')::numeric) into v_tot from jsonb_array_elements(v_cfg -> 'segments') x(s);
  v_roll := random() * v_tot;
  for s, o in select x.s, x.o from jsonb_array_elements(v_cfg -> 'segments') with ordinality x(s, o) loop
    v_acc := v_acc + (s ->> 'weight')::numeric;
    if v_roll < v_acc then v_seg := s; v_idx := o - 1; exit; end if;
  end loop;
  if v_seg is null then
    v_seg := v_cfg -> 'segments' -> 0; v_idx := 0;
  end if;
  perform public.grant_reward(v_uid, v_seg, 'wheel:' || p_request::text);
  v_res := jsonb_build_object('index', v_idx, 'segment', v_seg - 'weight');
  insert into public.wheel_spins (user_id, request_id, paid_with, segment, result) values (v_uid, p_request, p_pay, v_seg ->> 'id', v_res);
  return v_res;
end $$;

-- -----------------------------------------------------------------------------
-- Rotating deals
-- -----------------------------------------------------------------------------
create function public.deal_window() returns bigint
language sql stable set search_path = '' as $$
  select floor(extract(epoch from now()) / (coalesce(((select value from public.app_config where key = 'deals') ->> 'hours')::int, 8) * 3600))::bigint
$$;

create function public.deals_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_cfg  jsonb := (select value from public.app_config where key = 'deals');
  v_win  bigint := public.deal_window();
  v_n    integer := jsonb_array_length(v_cfg -> 'list');
  v_deal jsonb := (v_cfg -> 'list') -> (v_win % v_n)::int;
begin
  return jsonb_build_object(
    'window', v_win,
    'ends_at', to_timestamp((v_win + 1) * (v_cfg ->> 'hours')::int * 3600),
    'deal', v_deal,
    'bought', exists (select 1 from public.deal_purchases where user_id = v_uid and deal_id = v_deal ->> 'id' and win = v_win));
end $$;

create function public.deal_buy(p_deal text, p_window bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_cfg  jsonb := (select value from public.app_config where key = 'deals');
  v_win  bigint := public.deal_window();
  v_deal jsonb := (v_cfg -> 'list') -> (v_win % jsonb_array_length(v_cfg -> 'list'))::int;
  v_key  text;
  r      jsonb;
  i      integer := 0;
begin
  perform public.check_rate_limit(v_uid, 'deal_buy', 10, 60);
  if p_window is distinct from v_win or p_deal is distinct from v_deal ->> 'id' then
    raise exception 'invalid_state: deal expired' using errcode = 'P0001';
  end if;
  if (v_deal #>> '{price,currency}') = 'gems' and public.paid_region_blocked(v_uid)
     and exists (select 1 from jsonb_array_elements(v_deal -> 'rewards') x where x ->> 'kind' = 'pack') then
    raise exception 'invalid_state: region' using errcode = 'P0001';
  end if;
  insert into public.deal_purchases (user_id, deal_id, win) values (v_uid, p_deal, v_win) on conflict do nothing;
  if not found then raise exception 'invalid_state: already bought' using errcode = 'P0001'; end if;
  v_key := 'deal:' || p_deal || ':' || v_win;
  perform public.ledger_apply(v_uid, (v_deal #>> '{price,currency}')::public.currency_code, -((v_deal #>> '{price,amount}')::bigint),
    'deal', 'deal', p_deal, v_key);
  for r in select * from jsonb_array_elements(v_deal -> 'rewards') loop
    i := i + 1;
    perform public.grant_reward(v_uid, r, v_key || ':' || i);
  end loop;
  return jsonb_build_object('bought', true, 'rewards', v_deal -> 'rewards');
end $$;

-- -----------------------------------------------------------------------------
-- Season pass
-- -----------------------------------------------------------------------------
create function public.season_active() returns jsonb
language sql stable set search_path = '' as $$
  select value from public.app_config
   where key = 'season.current'
     and public.israel_today() >= (value ->> 'starts')::date and public.israel_today() < (value ->> 'ends')::date
$$;

/** Every XP point a player earns also fills the season pass. */
create function public.on_profile_xp_pass() returns trigger
language plpgsql security definer set search_path = '' as $$
declare v_season jsonb := public.season_active();
begin
  if v_season is not null and new.xp > old.xp then
    insert into public.user_pass as p (user_id, season, xp) values (new.id, v_season ->> 'id', (new.xp - old.xp)::int)
    on conflict (user_id, season) do update set xp = p.xp + excluded.xp;
  end if;
  return new;
end $$;
create trigger profiles_xp_pass after update of xp on public.profiles
  for each row execute function public.on_profile_xp_pass();

create function public.pass_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_s   jsonb := public.season_active();
  v_p   public.user_pass;
begin
  if v_s is null then return jsonb_build_object('active', false); end if;
  select * into v_p from public.user_pass where user_id = v_uid and season = v_s ->> 'id';
  return jsonb_build_object(
    'active', true, 'id', v_s ->> 'id', 'title', v_s ->> 'title', 'ends', v_s ->> 'ends',
    'xp_per_tier', (v_s ->> 'xp_per_tier')::int, 'premium_gems', (v_s ->> 'premium_gems')::int,
    'xp', coalesce(v_p.xp, 0), 'premium', coalesce(v_p.premium, false),
    'tier', least(jsonb_array_length(v_s -> 'tiers'), coalesce(v_p.xp, 0) / (v_s ->> 'xp_per_tier')::int),
    'claimed_free', to_jsonb(coalesce(v_p.claimed_free, '{}')),
    'claimed_premium', to_jsonb(coalesce(v_p.claimed_premium, '{}')),
    'tiers', v_s -> 'tiers');
end $$;

create function public.pass_claim(p_tier integer, p_track text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_s   jsonb := public.season_active();
  v_p   public.user_pass;
  v_r   jsonb;
begin
  perform public.check_rate_limit(v_uid, 'pass_claim', 60, 60);
  if v_s is null then raise exception 'invalid_state: no season' using errcode = 'P0001'; end if;
  if p_track not in ('free', 'premium') or p_tier < 1 or p_tier > jsonb_array_length(v_s -> 'tiers') then
    raise exception 'invalid_input: tier' using errcode = '22023';
  end if;
  insert into public.user_pass (user_id, season) values (v_uid, v_s ->> 'id') on conflict do nothing;
  select * into v_p from public.user_pass where user_id = v_uid and season = v_s ->> 'id' for update;
  if v_p.xp / (v_s ->> 'xp_per_tier')::int < p_tier then raise exception 'invalid_state: tier locked' using errcode = 'P0001'; end if;
  if p_track = 'premium' and not v_p.premium then raise exception 'invalid_state: not premium' using errcode = 'P0001'; end if;
  if (p_track = 'free' and p_tier = any (v_p.claimed_free)) or (p_track = 'premium' and p_tier = any (v_p.claimed_premium)) then
    raise exception 'invalid_state: already claimed' using errcode = 'P0001';
  end if;
  v_r := (v_s -> 'tiers' -> (p_tier - 1)) -> p_track;
  if p_track = 'free' then
    update public.user_pass set claimed_free = claimed_free || p_tier where user_id = v_uid and season = v_s ->> 'id';
  else
    update public.user_pass set claimed_premium = claimed_premium || p_tier where user_id = v_uid and season = v_s ->> 'id';
  end if;
  perform public.grant_reward(v_uid, v_r, 'pass:' || (v_s ->> 'id') || ':' || p_track || ':' || p_tier);
  return jsonb_build_object('reward', v_r);
end $$;

create function public.pass_buy_premium() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_s   jsonb := public.season_active();
begin
  perform public.check_rate_limit(v_uid, 'pass_buy', 10, 60);
  if v_s is null then raise exception 'invalid_state: no season' using errcode = 'P0001'; end if;
  insert into public.user_pass (user_id, season) values (v_uid, v_s ->> 'id') on conflict do nothing;
  if (select premium from public.user_pass where user_id = v_uid and season = v_s ->> 'id' for update) then
    raise exception 'invalid_state: already premium' using errcode = 'P0001';
  end if;
  perform public.ledger_apply(v_uid, 'gems', -((v_s ->> 'premium_gems')::bigint), 'season_pass', 'season', v_s ->> 'id',
    'pass:' || (v_s ->> 'id') || ':premium');
  update public.user_pass set premium = true where user_id = v_uid and season = v_s ->> 'id';
  return public.pass_state();
end $$;

revoke execute on function public.is_vip(uuid), public.paid_region_blocked(uuid), public.energy_sync(uuid), public.energy_add(uuid, integer),
  public.energy_spend(uuid), public.energy_state(), public.energy_refill(text, uuid), public.grant_reward(uuid, jsonb, text),
  public.wheel_state(), public.wheel_spin(text, uuid), public.deal_window(), public.deals_state(), public.deal_buy(text, bigint),
  public.season_active(), public.on_profile_xp_pass(), public.pass_state(), public.pass_claim(integer, text), public.pass_buy_premium()
  from public, anon, authenticated;
grant execute on function public.energy_state(), public.energy_refill(text, uuid), public.wheel_state(), public.wheel_spin(text, uuid),
  public.deals_state(), public.deal_buy(text, bigint), public.pass_state(), public.pass_claim(integer, text), public.pass_buy_premium()
  to authenticated;
