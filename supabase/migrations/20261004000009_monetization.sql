-- =============================================================================
-- Migration 0010 — Rewarded ads and in-app purchases.
--
-- Ads are opt-in only: the player chooses to watch and gets a reward
-- (double the coins of a finished run, or one free pack a day). Players with
-- "no ads" or VIP get the same rewards without watching.
-- Purchases are verified server-side by the `iap-verify` Edge Function against
-- the Google Play Developer API before anything is granted (grant_purchase is
-- service-role only). Every grant is idempotent per purchase token.
-- =============================================================================

create table public.user_entitlements (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  no_ads     boolean not null default false,
  vip_until  timestamptz,
  updated_at timestamptz not null default now()
);

create table public.ad_claims (
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  ref        text not null,
  created_at timestamptz not null default now(),
  primary key (user_id, kind, ref),
  constraint ad_claims_kind check (kind in ('double_run', 'free_pack', 'vip_daily'))
);

create table public.purchases (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users (id) on delete cascade,
  platform       text not null default 'android',
  sku            text not null,
  purchase_token text not null unique,
  order_id       text,
  state          text not null default 'granted',
  raw            jsonb,
  created_at     timestamptz not null default now()
);

alter table public.user_entitlements enable row level security;
alter table public.ad_claims enable row level security;
alter table public.purchases enable row level security;
create policy entitlements_own on public.user_entitlements for select to authenticated using (user_id = (select auth.uid()));
create policy purchases_own on public.purchases for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.user_entitlements, public.ad_claims, public.purchases from anon, authenticated;
revoke all on public.ad_claims from anon, authenticated;

insert into public.app_config (key, value, is_public) values
  ('ads.daily_cap', '15'::jsonb, false),
  ('store.products', '[
     {"sku":"coins_2000","kind":"coins","amount":2000,"title":"שק מטבעות"},
     {"sku":"coins_6000","kind":"coins","amount":6000,"title":"ארגז מטבעות","badge":"פופולרי"},
     {"sku":"coins_16000","kind":"coins","amount":16000,"title":"כספת מטבעות","badge":"הכי משתלם"},
     {"sku":"gems_80","kind":"gems","amount":80,"title":"קומץ יהלומים"},
     {"sku":"gems_300","kind":"gems","amount":300,"title":"תיבת יהלומים"},
     {"sku":"no_ads","kind":"no_ads","amount":0,"title":"בלי פרסומות"},
     {"sku":"vip_monthly","kind":"vip","amount":30,"title":"כרטיס VIP"}
   ]'::jsonb, true)
on conflict (key) do nothing;

create function public.has_ad_free(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select no_ads or coalesce(vip_until > now(), false) from public.user_entitlements where user_id = p_user), false)
$$;

/** Rewards for an opt-in ad (or for free with no-ads / VIP). */
create function public.claim_ad_reward(p_kind text, p_ref text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_run  public.quiz_runs;
  v_cap  integer;
  v_n    integer;
  v_ref  text;
begin
  perform public.check_rate_limit(v_uid, 'claim_ad_reward', 20, 60);
  select (value #>> '{}')::int into v_cap from public.app_config where key = 'ads.daily_cap';
  select count(*) into v_n from public.ad_claims where user_id = v_uid and created_at > now() - interval '1 day';
  if v_n >= coalesce(v_cap, 15) then raise exception 'rate_limited' using errcode = 'P0429'; end if;

  if p_kind = 'double_run' then
    select * into v_run from public.quiz_runs where id = p_ref::uuid and user_id = v_uid;
    if not found or v_run.status = 'active' or v_run.coins_awarded <= 0 or v_run.ended_at < now() - interval '30 minutes' then
      raise exception 'invalid_state: nothing to double' using errcode = 'P0001';
    end if;
    insert into public.ad_claims (user_id, kind, ref) values (v_uid, p_kind, p_ref) on conflict do nothing;
    if not found then raise exception 'invalid_state: already claimed' using errcode = 'P0001'; end if;
    perform public.ledger_apply(v_uid, 'coins', v_run.coins_awarded, 'ad_double', 'quiz_run', p_ref, 'ad_double:' || p_ref);
    return jsonb_build_object('coins', v_run.coins_awarded);
  elsif p_kind = 'free_pack' then
    v_ref := public.israel_today()::text;
    insert into public.ad_claims (user_id, kind, ref) values (v_uid, p_kind, v_ref) on conflict do nothing;
    if not found then raise exception 'invalid_state: already claimed' using errcode = 'P0001'; end if;
    perform public.grant_pack_token(v_uid, 'bronze', 1);
    return jsonb_build_object('pack', 'bronze');
  elsif p_kind = 'vip_daily' then
    if not coalesce((select vip_until > now() from public.user_entitlements where user_id = v_uid), false) then
      raise exception 'invalid_state: not vip' using errcode = 'P0001';
    end if;
    v_ref := public.israel_today()::text;
    insert into public.ad_claims (user_id, kind, ref) values (v_uid, p_kind, v_ref) on conflict do nothing;
    if not found then raise exception 'invalid_state: already claimed' using errcode = 'P0001'; end if;
    perform public.grant_pack_token(v_uid, 'gold', 1);
    return jsonb_build_object('pack', 'gold');
  end if;
  raise exception 'invalid_input: kind' using errcode = '22023';
end $$;

create function public.store_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  return jsonb_build_object(
    'products', (select value from public.app_config where key = 'store.products'),
    'no_ads', coalesce((select no_ads from public.user_entitlements where user_id = v_uid), false),
    'vip_until', (select vip_until from public.user_entitlements where user_id = v_uid),
    'free_pack_today', not exists (select 1 from public.ad_claims where user_id = v_uid and kind = 'free_pack' and ref = public.israel_today()::text),
    'vip_daily_today', not exists (select 1 from public.ad_claims where user_id = v_uid and kind = 'vip_daily' and ref = public.israel_today()::text),
    'ad_free', public.has_ad_free(v_uid));
end $$;

/**
 * Grants a verified purchase. Called ONLY by the iap-verify Edge Function
 * (service role) after Google confirmed the token. Idempotent per token.
 */
create function public.grant_purchase(p_user uuid, p_sku text, p_token text, p_order text, p_raw jsonb, p_expiry timestamptz default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_p     jsonb;
  v_prev  public.purchases;
begin
  select * into v_prev from public.purchases where purchase_token = p_token;
  if found then
    if v_prev.user_id <> p_user then raise exception 'not_authorized' using errcode = '42501'; end if;
    -- Subscription renewals reuse the token: extend VIP, nothing else.
    if p_expiry is not null then
      update public.user_entitlements set vip_until = greatest(coalesce(vip_until, now()), p_expiry), updated_at = now() where user_id = p_user;
    end if;
    return jsonb_build_object('granted', false, 'duplicate', true);
  end if;
  select e into v_p from public.app_config c, jsonb_array_elements(c.value) e where c.key = 'store.products' and e ->> 'sku' = p_sku;
  if v_p is null then raise exception 'invalid_input: sku' using errcode = '22023'; end if;

  insert into public.purchases (user_id, sku, purchase_token, order_id, raw) values (p_user, p_sku, p_token, p_order, p_raw);
  insert into public.user_entitlements (user_id) values (p_user) on conflict (user_id) do nothing;

  case v_p ->> 'kind'
    when 'coins' then
      perform public.ledger_apply(p_user, 'coins', (v_p ->> 'amount')::bigint, 'purchase', 'purchase', p_token, 'iap:' || p_token);
    when 'gems' then
      perform public.ledger_apply(p_user, 'gems', (v_p ->> 'amount')::bigint, 'purchase', 'purchase', p_token, 'iap:' || p_token);
    when 'no_ads' then
      update public.user_entitlements set no_ads = true, updated_at = now() where user_id = p_user;
    when 'vip' then
      update public.user_entitlements set vip_until = greatest(coalesce(vip_until, now()), coalesce(p_expiry, now() + interval '30 days')), updated_at = now()
       where user_id = p_user;
      if (v_p ->> 'amount')::int > 0 then
        perform public.ledger_apply(p_user, 'gems', (v_p ->> 'amount')::bigint, 'vip_bonus', 'purchase', p_token, 'iapvip:' || p_token);
      end if;
    else
      raise exception 'invalid_input: kind' using errcode = '22023';
  end case;
  return jsonb_build_object('granted', true, 'sku', p_sku);
end $$;

revoke execute on function public.has_ad_free(uuid), public.claim_ad_reward(text, text), public.store_state(),
  public.grant_purchase(uuid, text, text, text, jsonb, timestamptz) from public, anon, authenticated;
grant execute on function public.claim_ad_reward(text, text), public.store_state() to authenticated;
grant execute on function public.grant_purchase(uuid, text, text, text, jsonb, timestamptz) to service_role;
