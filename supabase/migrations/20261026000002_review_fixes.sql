-- =============================================================================
-- Fixes from the reviewers' round (2026-10-26):
--   1. Profile sticker count: only the stickers that are in play (300, not 528).
--   2. Three times the coins per correct answer in the solo modes.
--   3. The weekly league only holds players who played this week; groups of 10.
--   4. The easy first games are for players under 13 only (the age the player picked).
--   5. One code per player: the friend code is also the invite code (old invite
--      codes keep working).
-- =============================================================================

-- 1. Sticker count --------------------------------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.user_stats(uuid)'::regprocedure);
begin
  if position('c.active' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$'stickers', (select count(*) from public.user_collectibles where user_id = v_uid and count > 0),$a$,
    $a$'stickers', (select count(*) from public.user_collectibles u join public.collectibles c on c.id = u.item_id
                  where u.user_id = v_uid and u.count > 0 and c.active),$a$);
  v_def := replace(v_def,
    $a$'stickers_total', (select count(*) from public.collectibles),$a$,
    $a$'stickers_total', (select count(*) from public.collectibles c where c.active),$a$);
  if (length(v_def) - length(replace(v_def, 'c.active', ''))) / length('c.active') <> 2 then
    raise exception 'user_stats patch did not apply';
  end if;
  execute v_def;
end $$;

-- 2. Coins ×3 in the solo modes ---------------------------------------------------
update public.app_config set value = value || '{"coins_per_correct": 12, "star_coins": [0, 60, 120, 210]}'::jsonb where key = 'session';
update public.app_config set value = value || '{"coins_per_correct": 9, "max_coins": 180}'::jsonb where key = 'blitz';
update public.app_config set value = value || '{"coins_per_correct": 6, "max_coins": 180}'::jsonb where key = 'truefalse';
update public.app_config set value = value || '{"coins_per_correct": 6, "max_coins": 450}'::jsonb where key = 'survival';

-- 3. League: active players only, groups of 10 --------------------------------------
update public.app_config set value = value || '{"group_size": 10, "promote": 3, "demote": 3}'::jsonb where key = 'league';

/** Whether a player finished a game this league week (only they join a group). */
create or replace function public.league_active(p_uid uuid, p_week date) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.quiz_runs
                  where user_id = p_uid and status in ('won', 'lost')
                    and ended_at >= (p_week::timestamp at time zone 'Asia/Jerusalem'))
$$;
revoke all on function public.league_active(uuid, date) from public, anon, authenticated;

do $$
declare
  v_def text := pg_get_functiondef('public.league_state()'::regprocedure);
begin
  if position('league_active' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$  if not found then
    v_size := (v_cfg ->> 'group_size')::int;$a$,
    $a$  if not found and not public.league_active(v_uid, v_week) then
    -- not in a group until the first game of the week
    return jsonb_build_object(
      'week_start', v_week,
      'seconds_left', greatest(0, extract(epoch from (public.israel_week_start() + interval '7 days' - now()))::int),
      'tier', v_tier, 'tier_name', v_cfg -> 'tiers' ->> v_tier, 'tiers', v_cfg -> 'tiers',
      'promote', case when v_tier < 4 then (v_cfg ->> 'promote')::int else 0 end,
      'demote', case when v_tier > 0 then (v_cfg ->> 'demote')::int else 0 end,
      'rewards', v_cfg -> 'rewards', 'tier_bonus', v_cfg -> 'tier_bonus',
      'rows', '[]'::jsonb, 'joined', false,
      'last_result', (select last_result from public.user_leagues where user_id = v_uid));
  end if;
  if not found then
    v_size := (v_cfg ->> 'group_size')::int;$a$);
  v_def := replace(v_def,
    $a$    'rows', v_rows,$a$,
    $a$    'rows', v_rows, 'joined', true,$a$);
  if position('league_active' in v_def) = 0 or position($a$'joined', true$a$ in v_def) = 0 then
    raise exception 'league_state patch did not apply';
  end if;
  execute v_def;
end $$;

-- 4. Age band, and easy first games only under 13 -----------------------------------
alter table public.profiles add column if not exists age_band text
  check (age_band is null or age_band in ('under13', '13to15', '16plus'));

/** The age band the player picked on the age screen (never a birth date). */
create or replace function public.set_age_band(p_band text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  if p_band is null or p_band not in ('under13', '13to15', '16plus') then
    raise exception 'invalid_input: age band' using errcode = '22023';
  end if;
  perform public.check_rate_limit(v_uid, 'set_age_band', 30, 3600);
  update public.profiles set age_band = p_band where id = v_uid and age_band is distinct from p_band;
end $$;
revoke all on function public.set_age_band(text) from public, anon;
grant execute on function public.set_age_band(text) to authenticated;

do $$
declare
  v_def text := pg_get_functiondef('public.session_start(text, integer)'::regprocedure);
begin
  if position('age_band' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$          (select count(*) from public.quiz_runs r where r.user_id = v_uid and r.mode = 'session' and r.status in ('won', 'lost')) < 2)$a$,
    $a$          (select count(*) from public.quiz_runs r where r.user_id = v_uid and r.mode = 'session' and r.status in ('won', 'lost')) < 2
          and coalesce((select age_band from public.profiles where id = v_uid), 'under13') = 'under13')$a$);
  if position('age_band' in v_def) = 0 then raise exception 'session_start age patch did not apply'; end if;
  execute v_def;
end $$;

-- 5. One code: the friend code is the invite code -----------------------------------
create or replace function public.referral_code(p_user uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text := (select friend_code from public.profiles where id = p_user);
  i      integer := 0;
begin
  while v_code is null loop
    i := i + 1;
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
                 from generate_series(1, 6));
    begin
      update public.profiles set friend_code = v_code where id = p_user and friend_code is null;
      if not found then v_code := (select friend_code from public.profiles where id = p_user); end if;
    exception when unique_violation then
      v_code := null;
      if i > 10 then raise; end if;
    end;
  end loop;
  return v_code;
end $$;
revoke all on function public.referral_code(uuid) from public, anon, authenticated;

do $$
declare
  v_def text := pg_get_functiondef('public.referral_redeem(text)'::regprocedure);
begin
  if position('friend_code' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$where ref_code = upper(btrim(coalesce(p_code, '')));$a$,
    $a$where friend_code = upper(btrim(coalesce(p_code, '')))
     or ref_code = upper(btrim(coalesce(p_code, ''))) order by (friend_code = upper(btrim(coalesce(p_code, '')))) desc limit 1;$a$);
  if position('friend_code' in v_def) = 0 then raise exception 'referral_redeem patch did not apply'; end if;
  execute v_def;
end $$;

do $$
declare
  v_def text := pg_get_functiondef('public.friend_request(text)'::regprocedure);
begin
  if position('ref_code' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$friend_code = upper(btrim(p_code));$a$,
    $a$(friend_code = upper(btrim(p_code)) or ref_code = upper(btrim(p_code))) order by (friend_code = upper(btrim(p_code))) desc limit 1;$a$);
  if position('ref_code' in v_def) = 0 then raise exception 'friend_request patch did not apply'; end if;
  execute v_def;
end $$;
