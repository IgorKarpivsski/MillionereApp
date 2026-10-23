-- =============================================================================
-- Missions 2: five daily missions from a bigger pool (new: king of the hill,
-- true or false, a perfect level, opening a pack, the family room, 30 correct),
-- and six WEEKLY missions with bigger targets and bigger prizes (coins + gems),
-- plus a weekly bonus (gems and a gold pack) for finishing all of them.
-- The week runs Sunday to Saturday, Israel time. Claimed missions drop off the
-- list in the app.
-- =============================================================================

insert into public.app_config (key, value, is_public) values
  ('missions', '{
     "per_day": 5, "bonus_gems": 10,
     "per_week": 6, "week_bonus": {"gems": 40, "pack": "gold"},
     "pool": [
       {"key": "correct",   "metric": "correct",  "title": "ענו נכון על 15 שאלות",         "target": 15, "coins": 60,  "icon": "play"},
       {"key": "correct30", "metric": "correct",  "title": "ענו נכון על 30 שאלות",         "target": 30, "coins": 100, "icon": "play"},
       {"key": "games",     "metric": "games",    "title": "שחקו 3 משחקים",                "target": 3,  "coins": 50,  "icon": "trophy"},
       {"key": "stars",     "metric": "stars",    "title": "אספו 3 כוכבים בשלבים",         "target": 3,  "coins": 60,  "icon": "podium"},
       {"key": "perfect",   "metric": "perfect",  "title": "סיימו שלב עם 3 כוכבים",        "target": 1,  "coins": 60,  "icon": "podium"},
       {"key": "blitz",     "metric": "blitz",    "title": "שחקו במצב נגד השעון",          "target": 1,  "coins": 40,  "icon": "timer"},
       {"key": "duel",      "metric": "duel",     "title": "שחקו ראש בראש (חבר או אקראי)", "target": 1,  "coins": 50,  "icon": "dice"},
       {"key": "worlds",    "metric": "worlds",   "title": "שחקו ב-2 עולמות שונים",        "target": 2,  "coins": 50,  "icon": "globe"},
       {"key": "daily",     "metric": "daily",    "title": "השלימו את האתגר היומי",         "target": 1,  "coins": 40,  "icon": "daily"},
       {"key": "survival",  "metric": "survival", "title": "שחקו במלך הגבעה",              "target": 1,  "coins": 40,  "icon": "trophy"},
       {"key": "tf",        "metric": "tf",       "title": "שחקו ב\"נכון או לא?\"",        "target": 1,  "coins": 40,  "icon": "timer"},
       {"key": "packs",     "metric": "packs",    "title": "פתחו חבילת מדבקות",            "target": 1,  "coins": 40,  "icon": "gift"},
       {"key": "family",    "metric": "family",   "title": "שחקו בחדר משפחה עם חברים",     "target": 1,  "coins": 60,  "icon": "family"}
     ],
     "weekly": [
       {"key": "w_correct",  "metric": "correct",       "title": "ענו נכון על 150 שאלות השבוע",       "target": 150, "coins": 300, "gems": 10, "icon": "play"},
       {"key": "w_games",    "metric": "games",         "title": "שחקו 20 משחקים השבוע",              "target": 20,  "coins": 250, "gems": 10, "icon": "trophy"},
       {"key": "w_stars",    "metric": "stars",         "title": "אספו 25 כוכבים בשלבים",             "target": 25,  "coins": 300, "gems": 10, "icon": "podium"},
       {"key": "w_perfect",  "metric": "perfect",       "title": "סיימו 5 שלבים עם 3 כוכבים",         "target": 5,   "coins": 300, "gems": 15, "icon": "podium"},
       {"key": "w_survival", "metric": "survival_best", "title": "שרדו 10 שאלות במלך הגבעה",          "target": 10,  "coins": 250, "gems": 10, "icon": "trophy"},
       {"key": "w_tf",       "metric": "tf",            "title": "שחקו 5 פעמים ב\"נכון או לא?\"",     "target": 5,   "coins": 200, "gems": 5,  "icon": "timer"},
       {"key": "w_duel",     "metric": "duel",          "title": "שחקו 5 משחקי ראש בראש",             "target": 5,   "coins": 250, "gems": 10, "icon": "dice"},
       {"key": "w_worlds",   "metric": "worlds",        "title": "שחקו ב-5 עולמות שונים",             "target": 5,   "coins": 250, "gems": 10, "icon": "globe"},
       {"key": "w_daily",    "metric": "daily",         "title": "השלימו 5 אתגרים יומיים",            "target": 5,   "coins": 250, "gems": 10, "icon": "daily"},
       {"key": "w_packs",    "metric": "packs",         "title": "פתחו 5 חבילות מדבקות",              "target": 5,   "coins": 200, "gems": 5,  "icon": "gift"}
     ]}'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

/** The week start (Sunday) for a day, Israel calendar. */
create or replace function public.israel_week_of(p_day date) returns date
language sql immutable set search_path = '' as $$
  select p_day - extract(dow from p_day)::int
$$;

/** How far a player got on one metric between two moments. */
create or replace function public.mission_metric(p_user uuid, p_metric text, p_from timestamptz, p_to timestamptz) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_n integer := 0;
begin
  if p_metric = 'correct' then
    select (select count(*) from public.quiz_run_questions rq join public.quiz_runs r on r.id = rq.run_id
             where r.user_id = p_user and rq.is_correct and rq.answered_at >= p_from and rq.answered_at < p_to)
         + (select count(*) from public.family_answers where user_id = p_user and is_correct and answered_at >= p_from and answered_at < p_to)
         + (select count(*) from public.match_answers where user_id = p_user and is_correct and answered_at >= p_from and answered_at < p_to)
         + (select coalesce(sum(correct), 0) from public.blitz_runs where user_id = p_user and started_at >= p_from and started_at < p_to)
         + (select coalesce(sum(correct), 0) from public.survival_runs where user_id = p_user and status = 'done' and started_at >= p_from and started_at < p_to)
         + (select coalesce(sum(correct), 0) from public.tf_runs where user_id = p_user and status = 'done' and started_at >= p_from and started_at < p_to)
      into v_n;
  elsif p_metric = 'games' then
    select (select count(*) from public.quiz_runs where user_id = p_user and status::text not in ('active', 'abandoned')
              and ended_at >= p_from and ended_at < p_to)
         + (select count(*) from public.blitz_runs where user_id = p_user and status = 'done' and started_at >= p_from and started_at < p_to)
         + (select count(*) from public.match_rooms where (host = p_user or guest = p_user) and status = 'done'
              and finished_at >= p_from and finished_at < p_to)
         + (select count(*) from public.family_rooms fr join public.family_players fp on fp.room_id = fr.id
             where fp.user_id = p_user and fr.status = 'done' and fr.finished_at >= p_from and fr.finished_at < p_to)
         + (select count(*) from public.survival_runs where user_id = p_user and status = 'done' and started_at >= p_from and started_at < p_to)
         + (select count(*) from public.tf_runs where user_id = p_user and status = 'done' and started_at >= p_from and started_at < p_to)
      into v_n;
  elsif p_metric = 'stars' then
    select coalesce(sum(stars), 0) into v_n from public.quiz_runs
     where user_id = p_user and mode = 'session' and ended_at >= p_from and ended_at < p_to;
  elsif p_metric = 'perfect' then
    select count(*) into v_n from public.quiz_runs
     where user_id = p_user and mode = 'session' and stars >= 3 and ended_at >= p_from and ended_at < p_to;
  elsif p_metric = 'blitz' then
    select count(*) into v_n from public.blitz_runs where user_id = p_user and status = 'done' and started_at >= p_from and started_at < p_to;
  elsif p_metric = 'duel' then
    select count(*) into v_n from public.match_rooms where (host = p_user or guest = p_user) and status = 'done'
       and finished_at >= p_from and finished_at < p_to;
  elsif p_metric = 'worlds' then
    select count(distinct world) into v_n from public.quiz_runs
     where user_id = p_user and mode = 'session' and world <> 'mix' and ended_at >= p_from and ended_at < p_to;
  elsif p_metric = 'daily' then
    select count(*) into v_n from public.quiz_runs where user_id = p_user and mode = 'daily' and status <> 'active'
       and day >= (p_from at time zone 'Asia/Jerusalem')::date and day < (p_to at time zone 'Asia/Jerusalem')::date;
  elsif p_metric = 'survival' then
    select count(*) into v_n from public.survival_runs where user_id = p_user and status = 'done' and started_at >= p_from and started_at < p_to;
  elsif p_metric = 'survival_best' then
    select coalesce(max(correct), 0) into v_n from public.survival_runs where user_id = p_user and status = 'done' and started_at >= p_from and started_at < p_to;
  elsif p_metric = 'tf' then
    select count(*) into v_n from public.tf_runs where user_id = p_user and status = 'done' and started_at >= p_from and started_at < p_to;
  elsif p_metric = 'packs' then
    select count(*) into v_n from public.pack_opens where user_id = p_user and created_at >= p_from and created_at < p_to;
  elsif p_metric = 'family' then
    select count(*) into v_n from public.family_rooms fr join public.family_players fp on fp.room_id = fr.id
     where fp.user_id = p_user and fr.status = 'done' and fr.finished_at >= p_from and fr.finished_at < p_to;
  end if;
  return coalesce(v_n, 0);
end $$;

-- Old name kept for anything still calling it (one day, by key).
create or replace function public.mission_progress(p_user uuid, p_key text, p_day date) returns integer
language sql stable security definer set search_path = '' as $$
  select public.mission_metric(p_user,
           coalesce((select m ->> 'metric' from public.app_config c, jsonb_array_elements(c.value -> 'pool') m
                      where c.key = 'missions' and m ->> 'key' = p_key), p_key),
           (p_day::timestamp at time zone 'Asia/Jerusalem'), ((p_day + 1)::timestamp at time zone 'Asia/Jerusalem'))
$$;

/** This period's missions for a player: a fixed pick from the pool ('pool' daily or 'weekly'), different each period. */
create or replace function public.mission_pick(p_user uuid, p_list text, p_period date, p_n integer) returns text[]
language sql stable security definer set search_path = '' as $$
  select (array_agg(k order by md5(p_user::text || p_period::text || k)))[1:p_n]
    from (select m ->> 'key' as k from public.app_config c, jsonb_array_elements(c.value -> p_list) m where c.key = 'missions') x
$$;

create or replace function public.missions_list(p_user uuid, p_list text, p_period date, p_n integer, p_prefix text,
                                                p_from timestamptz, p_to timestamptz) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cfg jsonb := (select value from public.app_config where key = 'missions');
  v_out jsonb := '[]'::jsonb;
  v_m   jsonb;
  k     text;
begin
  foreach k in array coalesce(public.mission_pick(p_user, p_list, p_period, p_n), '{}') loop
    select m into v_m from jsonb_array_elements(v_cfg -> p_list) m where m ->> 'key' = k;
    v_out := v_out || jsonb_build_array(v_m || jsonb_build_object(
      'key', p_prefix || k,
      'gems', coalesce((v_m ->> 'gems')::int, 0),
      'progress', least(public.mission_metric(p_user, coalesce(v_m ->> 'metric', k), p_from, p_to), (v_m ->> 'target')::int),
      'claimed', exists (select 1 from public.user_missions where user_id = p_user and day = p_period and key = p_prefix || k)));
  end loop;
  return v_out;
end $$;

create or replace function public.missions_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_day  date := public.israel_today();
  v_week date := public.israel_week_of(public.israel_today());
  v_cfg  jsonb := (select value from public.app_config where key = 'missions');
begin
  return jsonb_build_object(
    'day', v_day,
    'missions', public.missions_list(v_uid, 'pool', v_day, coalesce((v_cfg ->> 'per_day')::int, 5), '',
                  (v_day::timestamp at time zone 'Asia/Jerusalem'), ((v_day + 1)::timestamp at time zone 'Asia/Jerusalem')),
    'bonus_gems', (v_cfg ->> 'bonus_gems')::int,
    'bonus_claimed', exists (select 1 from public.wallet_transactions where user_id = v_uid and idempotency_key = 'missions_bonus:' || v_day),
    'seconds_to_reset', extract(epoch from ((v_day + 1)::timestamp at time zone 'Asia/Jerusalem') - now())::int,
    'week', jsonb_build_object(
      'start', v_week,
      'missions', public.missions_list(v_uid, 'weekly', v_week, coalesce((v_cfg ->> 'per_week')::int, 6), 'w:',
                    (v_week::timestamp at time zone 'Asia/Jerusalem'), ((v_week + 7)::timestamp at time zone 'Asia/Jerusalem')),
      'bonus_gems', coalesce((v_cfg #>> '{week_bonus,gems}')::int, 0),
      'bonus_pack', v_cfg #>> '{week_bonus,pack}',
      'bonus_claimed', exists (select 1 from public.wallet_transactions where user_id = v_uid and idempotency_key = 'missions_week_bonus:' || v_week),
      'seconds_to_reset', extract(epoch from ((v_week + 7)::timestamp at time zone 'Asia/Jerusalem') - now())::int));
end $$;

create or replace function public.mission_claim(p_key text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid    uuid := public.require_user();
  v_cfg    jsonb := (select value from public.app_config where key = 'missions');
  v_weekly boolean := p_key like 'w:%';
  v_list   text := case when v_weekly then 'weekly' else 'pool' end;
  v_key    text := case when v_weekly then substr(p_key, 3) else p_key end;
  v_period date := case when v_weekly then public.israel_week_of(public.israel_today()) else public.israel_today() end;
  v_len    integer := case when v_weekly then 7 else 1 end;
  v_keys   text[];
  v_m      jsonb;
  v_n      integer;
  v_gems   integer;
  v_bonus  boolean := false;
begin
  perform public.check_rate_limit(v_uid, 'mission_claim', 40, 3600);
  perform pg_advisory_xact_lock(hashtext('missions:' || v_uid::text));
  v_keys := public.mission_pick(v_uid, v_list, v_period,
              coalesce((v_cfg ->> case when v_weekly then 'per_week' else 'per_day' end)::int, case when v_weekly then 6 else 5 end));
  if v_keys is null or not (v_key = any (v_keys)) then raise exception 'invalid_input: mission' using errcode = '22023'; end if;
  select m into v_m from jsonb_array_elements(v_cfg -> v_list) m where m ->> 'key' = v_key;
  if public.mission_metric(v_uid, coalesce(v_m ->> 'metric', v_key),
       (v_period::timestamp at time zone 'Asia/Jerusalem'), ((v_period + v_len)::timestamp at time zone 'Asia/Jerusalem'))
     < (v_m ->> 'target')::int then
    raise exception 'invalid_state: not done' using errcode = 'P0001';
  end if;
  insert into public.user_missions (user_id, day, key) values (v_uid, v_period, p_key) on conflict do nothing;
  if not found then raise exception 'invalid_state: already claimed' using errcode = 'P0001'; end if;
  perform public.ledger_apply(v_uid, 'coins', (v_m ->> 'coins')::int, 'mission', 'mission', p_key, 'mission:' || v_period || ':' || p_key);
  v_gems := coalesce((v_m ->> 'gems')::int, 0);
  if v_gems > 0 then
    perform public.ledger_apply(v_uid, 'gems', v_gems, 'mission', 'mission', p_key, 'mission:' || v_period || ':' || p_key || ':g');
  end if;
  select count(*) into v_n from public.user_missions
   where user_id = v_uid and day = v_period
     and key = any (case when v_weekly then (select array_agg('w:' || x) from unnest(v_keys) x) else v_keys end);
  if v_n >= cardinality(v_keys) then
    if v_weekly then
      if not exists (select 1 from public.wallet_transactions where user_id = v_uid and idempotency_key = 'missions_week_bonus:' || v_period) then
        perform public.ledger_apply(v_uid, 'gems', greatest(1, coalesce((v_cfg #>> '{week_bonus,gems}')::int, 40)), 'mission_bonus', 'mission',
          v_period::text, 'missions_week_bonus:' || v_period);
        if v_cfg #>> '{week_bonus,pack}' is not null then
          perform public.grant_pack_token(v_uid, v_cfg #>> '{week_bonus,pack}', 1);
        end if;
        v_bonus := true;
      end if;
    elsif not exists (select 1 from public.wallet_transactions where user_id = v_uid and idempotency_key = 'missions_bonus:' || v_period) then
      perform public.ledger_apply(v_uid, 'gems', coalesce((v_cfg ->> 'bonus_gems')::int, 10), 'mission_bonus', 'mission', v_period::text,
        'missions_bonus:' || v_period);
      v_bonus := true;
    end if;
  end if;
  return public.missions_state() || jsonb_build_object('coins', (v_m ->> 'coins')::int, 'gems', v_gems, 'bonus', v_bonus,
    'weekly', v_weekly);
end $$;

revoke all on function public.mission_metric(uuid, text, timestamptz, timestamptz), public.mission_pick(uuid, text, date, integer),
  public.missions_list(uuid, text, date, integer, text, timestamptz, timestamptz), public.israel_week_of(date)
  from public, anon, authenticated;
revoke all on function public.mission_progress(uuid, text, date), public.missions_state(), public.mission_claim(text)
  from public, anon, authenticated;
grant execute on function public.missions_state(), public.mission_claim(text) to authenticated;
