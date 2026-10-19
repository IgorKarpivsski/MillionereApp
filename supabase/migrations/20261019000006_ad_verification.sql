-- =============================================================================
-- Rewarded ads: server-side verification.
-- Google calls the admob-ssv edge function after a player really watched an ad;
-- it records the view here. While 'ads.require_ssv' is on, claim_ad_reward
-- pays only against such a record (one record = one reward), so a script can't
-- claim ad rewards without watching. Turned on once AdMob is set to call us.
-- =============================================================================
insert into public.app_config (key, value, is_public) values ('ads.require_ssv', 'false'::jsonb, false)
on conflict (key) do nothing;

create table public.ad_views (
  transaction_id text primary key,
  user_id        uuid not null references auth.users (id) on delete cascade,
  ad_unit        text,
  custom_data    text,
  created_at     timestamptz not null default now(),
  used_at        timestamptz,
  used_for       text
);
create index ad_views_unused on public.ad_views (user_id, created_at) where used_at is null;
alter table public.ad_views enable row level security;
revoke all on public.ad_views from anon, authenticated;

/** Called by the admob-ssv edge function (service role) after checking Google's signature. */
create function public.ad_ssv_record(p_tx text, p_user uuid, p_unit text, p_custom text) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.ad_views (transaction_id, user_id, ad_unit, custom_data)
  select p_tx, p_user, left(p_unit, 120), left(p_custom, 200)
   where exists (select 1 from auth.users where id = p_user)
  on conflict (transaction_id) do nothing
$$;
revoke all on function public.ad_ssv_record(text, uuid, text, text) from public, anon, authenticated;
grant execute on function public.ad_ssv_record(text, uuid, text, text) to service_role;

/** Uses up one verified ad view (no-op while verification is off, for VIP's daily gift, and for no-ads players). */
create function public.ad_ssv_consume(p_user uuid, p_kind text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_tx text;
begin
  if not coalesce((select (value #>> '{}')::boolean from public.app_config where key = 'ads.require_ssv'), false) then return; end if;
  if p_kind = 'vip_daily' or public.has_ad_free(p_user) then return; end if;
  select transaction_id into v_tx from public.ad_views
   where user_id = p_user and used_at is null and created_at > now() - interval '15 minutes'
   order by created_at limit 1 for update skip locked;
  if v_tx is null then raise exception 'invalid_state: ad not verified' using errcode = 'P0001'; end if;
  update public.ad_views set used_at = now(), used_for = p_kind where transaction_id = v_tx;
end $$;
revoke all on function public.ad_ssv_consume(uuid, text) from public, anon, authenticated;

do $$
declare
  v_def text := pg_get_functiondef('public.claim_ad_reward(text, text)'::regprocedure);
  v_new text;
begin
  if position('ad_ssv_consume' in v_def) > 0 then return; end if;
  v_new := replace(v_def,
    $a$perform public.check_rate_limit(v_uid, 'claim_ad_reward', 20, 60);$a$,
    $a$perform public.check_rate_limit(v_uid, 'claim_ad_reward', 20, 60);
  perform public.ad_ssv_consume(v_uid, p_kind);$a$);
  if v_new = v_def then raise exception 'claim_ad_reward patch did not apply'; end if;
  execute v_new;
end $$;

-- The other ad-funded rewards: a ticket refill and a hint.
do $$
declare
  v_def text;
  v_new text;
begin
  v_def := pg_get_functiondef('public.energy_refill(text, uuid)'::regprocedure);
  if position('ad_ssv_consume' in v_def) = 0 then
    v_new := replace(v_def, $a$  elsif p_how = 'ad' then$a$, $a$  elsif p_how = 'ad' then
    perform public.ad_ssv_consume(v_uid, 'energy');$a$);
    if v_new = v_def then raise exception 'energy_refill patch did not apply'; end if;
    execute v_new;
  end if;
  v_def := pg_get_functiondef('public.session_hint(uuid, text)'::regprocedure);
  if position('ad_ssv_consume' in v_def) = 0 then
    v_new := replace(v_def, $a$  elsif p_pay = 'ad' then$a$, $a$  elsif p_pay = 'ad' then
    perform public.ad_ssv_consume(v_uid, 'hint');$a$);
    if v_new = v_def then raise exception 'session_hint patch did not apply'; end if;
    execute v_new;
  end if;
end $$;
