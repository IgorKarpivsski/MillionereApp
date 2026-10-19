-- =============================================================================
-- Security review fixes
--  1. Guessing codes: a wrong admin / promo / friend-invite code no longer raises
--     (a raise rolled back the attempt counter, so guesses were unlimited).
--     Wrong codes now return {"error": ...} and the attempt is counted.
--     The admin code also refuses guest accounts and has a global hourly cap.
--  2. Friend brings friend: a friend counts after 3 real games (5+ correct answers
--     each) on at least 2 different days; at most 20 paid friends per player.
--  3. Coins from head-to-head and family games: at most 600 a day per player.
--  4. Usernames go through the same word filter as chat.
--  5. A blocked player's chat history can't be read.
-- =============================================================================

-- 1. Codes ------------------------------------------------------------------
create table public.admin_claim_attempts (
  window_start timestamptz primary key,
  count        integer not null default 0
);
alter table public.admin_claim_attempts enable row level security;
revoke all on public.admin_claim_attempts from anon, authenticated;

create or replace function public.admin_claim(p_code text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_hash text := (select value #>> '{}' from public.app_config where key = 'ops.admin_code_sha256');
  v_n    integer;
begin
  perform public.check_rate_limit(v_uid, 'admin_claim', 5, 3600);
  -- every guess anywhere counts against one shared hourly budget
  insert into public.admin_claim_attempts as a (window_start, count) values (date_trunc('hour', now()), 1)
    on conflict (window_start) do update set count = a.count + 1 returning a.count into v_n;
  if v_n > 30 then return jsonb_build_object('admin', false, 'error', 'rate_limited'); end if;
  if coalesce((select is_guest from public.profiles where id = v_uid), true) then
    return jsonb_build_object('admin', false, 'error', 'not_authorized');
  end if;
  if v_hash is null or v_hash = 'disabled'
     or v_hash <> encode(extensions.digest(coalesce(btrim(p_code), ''), 'sha256'), 'hex') then
    return jsonb_build_object('admin', false, 'error', 'not_authorized');
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
    return jsonb_build_object('error', 'code_invalid');
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

-- 2. Friend brings friend ---------------------------------------------------
/** Real games only: 5+ correct answers. */
create or replace function public.referral_games(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select ((select count(*) from public.quiz_runs where user_id = p_user and status <> 'active' and correct >= 5)
        + (select count(*) from public.blitz_runs where user_id = p_user and status = 'done' and correct >= 5)
        + (select count(*) from public.survival_runs where user_id = p_user and status = 'done' and correct >= 5)
        + (select count(*) from public.tf_runs where user_id = p_user and status = 'done' and correct >= 5))::int
$$;

/** On how many different days those real games were played. */
create function public.referral_days(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(distinct d)::int from (
    select (ended_at at time zone 'Asia/Jerusalem')::date d from public.quiz_runs
     where user_id = p_user and status <> 'active' and correct >= 5 and ended_at is not null
    union all
    select (ends_at at time zone 'Asia/Jerusalem')::date from public.blitz_runs where user_id = p_user and status = 'done' and correct >= 5
    union all
    select (ended_at at time zone 'Asia/Jerusalem')::date from public.survival_runs
     where user_id = p_user and status = 'done' and correct >= 5 and ended_at is not null
    union all
    select (ends_at at time zone 'Asia/Jerusalem')::date from public.tf_runs where user_id = p_user and status = 'done' and correct >= 5) x
$$;

create or replace function public.referral_settle(p_user uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_cfg  jsonb := (select value from public.app_config where key = 'referral');
  v_need integer := coalesce((v_cfg ->> 'qualify_games')::int, 3);
  v_max  integer := coalesce((v_cfg ->> 'max_paid_friends')::int, 20);
  v_n    integer;
  r      record;
  g      jsonb;
begin
  for r in select referred from public.referrals where referrer = p_user and qualified_at is null for update loop
    if public.referral_games(r.referred) >= v_need and public.referral_days(r.referred) >= 2 then
      update public.referrals set qualified_at = now() where referred = r.referred;
      if (select count(*) from public.referrals where referrer = p_user and qualified_at is not null) <= v_max then
        perform public.referral_grant(p_user, v_cfg -> 'per_friend', 'ref_friend:' || r.referred);
      end if;
    end if;
  end loop;
  select count(*) into v_n from public.referrals where referrer = p_user and qualified_at is not null;
  for g in select * from jsonb_array_elements(v_cfg -> 'goals') loop
    if v_n >= (g ->> 'n')::int then
      insert into public.referral_goals_paid (user_id, goal) values (p_user, (g ->> 'n')::int) on conflict do nothing;
      if found then
        perform public.referral_grant(p_user, g -> 'rewards', 'ref_goal:' || p_user || ':' || (g ->> 'n'));
      end if;
    end if;
  end loop;
end $$;

create or replace function public.referral_state() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_cfg   jsonb := (select value from public.app_config where key = 'referral');
  v_need  integer := coalesce((v_cfg ->> 'qualify_games')::int, 3);
  v_n     integer;
  v_by    jsonb;
begin
  perform public.check_rate_limit(v_uid, 'referral_state', 60, 60);
  perform public.referral_settle(v_uid);
  select count(*) into v_n from public.referrals where referrer = v_uid and qualified_at is not null;
  select jsonb_build_object('username', p.username, 'avatar_id', p.avatar_id, 'photo', p.photo_url) into v_by
    from public.referrals r join public.profiles p on p.id = r.referrer where r.referred = v_uid;
  return jsonb_build_object(
    'code', public.referral_code(v_uid),
    'qualified', v_n,
    'qualify_games', v_need,
    'friends', (select coalesce(jsonb_agg(jsonb_build_object('username', p.username, 'avatar_id', p.avatar_id, 'photo', p.photo_url,
                  'games', least(public.referral_games(r.referred), v_need), 'qualified', r.qualified_at is not null,
                  'days_ok', public.referral_days(r.referred) >= 2)
                  order by r.qualified_at is null, r.created_at desc), '[]'::jsonb)
                  from public.referrals r join public.profiles p on p.id = r.referred where r.referrer = v_uid),
    'per_friend', v_cfg -> 'per_friend',
    'welcome', v_cfg -> 'welcome',
    'goals', (select jsonb_agg(g || jsonb_build_object('reached', v_n >= (g ->> 'n')::int)) from jsonb_array_elements(v_cfg -> 'goals') g),
    'invited_by', v_by,
    'can_redeem', v_by is null
      and (select created_at from public.profiles where id = v_uid) > now() - make_interval(days => coalesce((v_cfg ->> 'max_age_days')::int, 7)));
end $$;

create or replace function public.referral_redeem(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_cfg jsonb := (select value from public.app_config where key = 'referral');
  v_ref uuid;
begin
  perform public.check_rate_limit(v_uid, 'referral_redeem', 10, 3600);
  select id into v_ref from public.profiles where ref_code = upper(btrim(coalesce(p_code, '')));
  if v_ref is null then return jsonb_build_object('error', 'unknown code'); end if;
  if v_ref = v_uid then raise exception 'invalid_input: own code' using errcode = '22023'; end if;
  if exists (select 1 from public.referrals where referred = v_uid) then raise exception 'invalid_state: already used' using errcode = 'P0001'; end if;
  if (select created_at from public.profiles where id = v_uid) <= now() - make_interval(days => coalesce((v_cfg ->> 'max_age_days')::int, 7)) then
    raise exception 'invalid_state: too late' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.referrals where referred = v_ref and referrer = v_uid) then
    raise exception 'invalid_input: own code' using errcode = '22023';
  end if;
  insert into public.referrals (referred, referrer) values (v_uid, v_ref);
  perform public.referral_grant(v_uid, v_cfg -> 'welcome', 'ref_welcome:' || v_uid);
  return public.referral_state();
end $$;

revoke all on function public.referral_days(uuid) from public, anon, authenticated;

-- 3. Daily cap on head-to-head / family coins -------------------------------
insert into public.app_config (key, value, is_public) values ('mode_coins_daily_cap', '600'::jsonb, true)
on conflict (key) do update set value = excluded.value;

create function public.pay_mode_coins(p_user uuid, p_currency public.currency_code, p_amount bigint, p_reason text,
                                      p_ref_type text, p_ref_id text, p_key text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_cap  bigint := coalesce((select (value #>> '{}')::bigint from public.app_config where key = 'mode_coins_daily_cap'), 600);
  v_got  bigint;
  v_pay  bigint;
begin
  select coalesce(sum(amount), 0) into v_got from public.wallet_transactions
   where user_id = p_user and currency = 'coins' and reason in ('friend_match', 'family_match')
     and created_at >= (public.israel_today()::timestamp at time zone 'Asia/Jerusalem');
  v_pay := least(p_amount, greatest(0, v_cap - v_got));
  if v_pay > 0 then
    perform public.ledger_apply(p_user, p_currency, v_pay, p_reason, p_ref_type, p_ref_id, p_key);
  end if;
end $$;
revoke all on function public.pay_mode_coins(uuid, public.currency_code, bigint, text, text, text, text) from public, anon, authenticated;

do $$
declare
  f     text;
  v_def text;
  v_new text;
begin
  foreach f in array array['public.match_finish(uuid)', 'public.family_finish(uuid)'] loop
    v_def := pg_get_functiondef(f::regprocedure);
    if position('pay_mode_coins' in v_def) > 0 then continue; end if;
    v_new := replace(v_def, 'perform public.ledger_apply(', 'perform public.pay_mode_coins(');
    if v_new = v_def then raise exception 'coin cap patch did not apply to %', f; end if;
    execute v_new;
  end loop;
end $$;

-- 4. Usernames through the word filter ---------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.update_my_profile(text, text, text[], text[])'::regprocedure);
  v_new text;
begin
  if position('chat_clean' in v_def) > 0 then return; end if;
  v_new := replace(v_def,
    $a$    if exists (select 1 from public.profiles
                where lower(username) = lower(p_username) and id <> v_uid) then$a$,
    $a$    if (public.chat_clean(replace(p_username, '_', ' '))).flagged then
      raise exception 'invalid_input: username' using errcode = '22023';
    end if;
    if exists (select 1 from public.profiles
                where lower(username) = lower(p_username) and id <> v_uid) then$a$);
  if v_new = v_def then raise exception 'username filter patch did not apply'; end if;
  execute v_new;
end $$;

-- 5. No chat history with someone who's blocked ------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.chat_history(uuid, bigint)'::regprocedure);
  v_new text;
begin
  if position('is_blocked' in v_def) > 0 then return; end if;
  v_new := replace(v_def,
    $a$  if not public.are_friends(v_uid, p_with) and not exists ($a$,
    $a$  if public.is_blocked(v_uid, p_with) then
    raise exception 'invalid_state: not friends' using errcode = 'P0001';
  end if;
  if not public.are_friends(v_uid, p_with) and not exists ($a$);
  if v_new = v_def then raise exception 'chat_history patch did not apply'; end if;
  execute v_new;
end $$;
