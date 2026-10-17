-- =============================================================================
-- Upgrades from a "picky teenager" review:
--   names, a free first week, daily missions, streak freezes, mistakes review,
--   reactions, friend profiles, rematch invites, friends' table, frames & titles,
--   a weekly event, community questions and a starter deal in coins.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- 1. Fun default names instead of "שחקן123456"
-- ---------------------------------------------------------------------------
create or replace function public.generate_username() returns text
language plpgsql set search_path = '' as $$
declare
  v_animals text[] := array['שועל','נמר','אריה','דולפין','ינשוף','פנדה','נשר','זאב','קוף','צב','לוויתן',
                            'ברדלס','דוב','תנין','פינגווין','קיפוד','סוס','עצלן','תוכי','ג׳ירפה'];
  v_adjs    text[] := array['חכם','מהיר','זריז','אמיץ','שנון','ערני','סקרן','מבריק','נועז','שמח','מסתורי','ענק','קוסם','חד'];
  v_name    text;
begin
  for i in 1 .. 40 loop
    v_name := v_animals[1 + floor(random() * cardinality(v_animals))::int] || '_'
           || v_adjs[1 + floor(random() * cardinality(v_adjs))::int] || '_'
           || (10 + floor(random() * 90))::int;
    if not exists (select 1 from public.profiles where lower(username) = lower(v_name)) then
      return v_name;
    end if;
  end loop;
  return 'אלוף_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
end $$;

do $$
declare r record;
begin
  for r in select id from public.profiles where username ~ '^שחקן[0-9]+$' loop
    update public.profiles set username = public.generate_username() where id = r.id;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. The first week is free: unlimited tickets
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values ('energy.newbie_days', '7'::jsonb, true)
on conflict (key) do nothing;

create function public.newbie_until(p_user uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select created_at + make_interval(days => coalesce((select (value #>> '{}')::int from public.app_config where key = 'energy.newbie_days'), 7))
    from public.profiles where id = p_user
$$;
create function public.is_newbie(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(public.newbie_until(p_user) > now(), false)
$$;
revoke all on function public.newbie_until(uuid), public.is_newbie(uuid) from public, anon, authenticated;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.energy_spend(uuid)'::regprocedure);
  d := replace(d, 'if public.is_vip(p_user) then return; end if;', 'if public.is_vip(p_user) or public.is_newbie(p_user) then return; end if;');
  if position('is_newbie' in d) = 0 then raise exception 'energy_spend patch failed'; end if;
  execute d;
  d := pg_get_functiondef('public.energy_state()'::regprocedure);
  d := replace(d, $x$'unlimited', public.is_vip(v_uid),$x$,
    $x$'unlimited', public.is_vip(v_uid) or public.is_newbie(v_uid),
    'newbie_until', case when public.is_newbie(v_uid) and not public.is_vip(v_uid) then public.newbie_until(v_uid) end,$x$);
  if position('newbie_until' in d) = 0 then raise exception 'energy_state patch failed'; end if;
  execute d;
end $$;

-- ---------------------------------------------------------------------------
-- 3. Daily missions
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values
  ('missions', '{
     "per_day": 3, "bonus_gems": 5,
     "pool": [
       {"key": "correct",  "title": "ענו נכון על 15 שאלות",          "target": 15, "coins": 60, "icon": "play"},
       {"key": "games",    "title": "שחקו 3 משחקים",                 "target": 3,  "coins": 50, "icon": "trophy"},
       {"key": "stars",    "title": "אספו 3 כוכבים בשלבים",          "target": 3,  "coins": 60, "icon": "podium"},
       {"key": "blitz",    "title": "שחקו במצב נגד השעון",           "target": 1,  "coins": 40, "icon": "timer"},
       {"key": "duel",     "title": "שחקו ראש בראש (חבר או אקראי)",  "target": 1,  "coins": 50, "icon": "dice"},
       {"key": "worlds",   "title": "שחקו ב-2 עולמות שונים",         "target": 2,  "coins": 50, "icon": "globe"},
       {"key": "daily",    "title": "השלימו את האתגר היומי",          "target": 1,  "coins": 40, "icon": "daily"}
     ]}'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

create table public.user_missions (
  user_id    uuid not null references auth.users (id) on delete cascade,
  day        date not null,
  key        text not null,
  claimed_at timestamptz not null default now(),
  primary key (user_id, day, key)
);
alter table public.user_missions enable row level security;
revoke all on public.user_missions from anon, authenticated;

create function public.mission_progress(p_user uuid, p_key text, p_day date) returns integer
language plpgsql stable security definer set search_path = '' as $$
declare
  v_from timestamptz := (p_day::timestamp at time zone 'Asia/Jerusalem');
  v_to   timestamptz := ((p_day + 1)::timestamp at time zone 'Asia/Jerusalem');
  v_n    integer := 0;
begin
  if p_key = 'correct' then
    select (select count(*) from public.quiz_run_questions rq join public.quiz_runs r on r.id = rq.run_id
             where r.user_id = p_user and rq.is_correct and rq.answered_at >= v_from and rq.answered_at < v_to)
         + (select count(*) from public.family_answers where user_id = p_user and is_correct and answered_at >= v_from and answered_at < v_to)
         + (select count(*) from public.match_answers where user_id = p_user and is_correct and answered_at >= v_from and answered_at < v_to)
         + (select coalesce(sum(correct), 0) from public.blitz_runs where user_id = p_user and started_at >= v_from and started_at < v_to)
      into v_n;
  elsif p_key = 'games' then
    select (select count(*) from public.quiz_runs where user_id = p_user and status::text not in ('active', 'abandoned')
              and ended_at >= v_from and ended_at < v_to)
         + (select count(*) from public.blitz_runs where user_id = p_user and status = 'done' and started_at >= v_from and started_at < v_to)
         + (select count(*) from public.match_rooms where (host = p_user or guest = p_user) and status = 'done'
              and finished_at >= v_from and finished_at < v_to)
         + (select count(*) from public.family_rooms fr join public.family_players fp on fp.room_id = fr.id
             where fp.user_id = p_user and fr.status = 'done' and fr.finished_at >= v_from and fr.finished_at < v_to)
      into v_n;
  elsif p_key = 'stars' then
    select coalesce(sum(stars), 0) into v_n from public.quiz_runs
     where user_id = p_user and mode = 'session' and ended_at >= v_from and ended_at < v_to;
  elsif p_key = 'blitz' then
    select count(*) into v_n from public.blitz_runs where user_id = p_user and status = 'done' and started_at >= v_from and started_at < v_to;
  elsif p_key = 'duel' then
    select count(*) into v_n from public.match_rooms where (host = p_user or guest = p_user) and status = 'done'
       and finished_at >= v_from and finished_at < v_to;
  elsif p_key = 'worlds' then
    select count(distinct world) into v_n from public.quiz_runs
     where user_id = p_user and mode = 'session' and world <> 'mix' and ended_at >= v_from and ended_at < v_to;
  elsif p_key = 'daily' then
    select count(*) into v_n from public.quiz_runs where user_id = p_user and mode = 'daily' and day = p_day and status <> 'active';
  end if;
  return coalesce(v_n, 0);
end $$;

/** Today's missions for a player: a fixed pick from the pool, different each day. */
create function public.mission_keys(p_user uuid, p_day date) returns text[]
language sql stable security definer set search_path = '' as $$
  select array_agg(k order by md5(p_user::text || p_day::text || k))
    from (select m ->> 'key' as k from public.app_config c, jsonb_array_elements(c.value -> 'pool') m where c.key = 'missions') x
   limit 1
$$;

create function public.missions_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_day  date := public.israel_today();
  v_cfg  jsonb := (select value from public.app_config where key = 'missions');
  v_keys text[];
  v_out  jsonb := '[]'::jsonb;
  v_m    jsonb;
  k      text;
begin
  v_keys := (public.mission_keys(v_uid, v_day))[1:coalesce((v_cfg ->> 'per_day')::int, 3)];
  foreach k in array v_keys loop
    select m into v_m from jsonb_array_elements(v_cfg -> 'pool') m where m ->> 'key' = k;
    v_out := v_out || jsonb_build_array(v_m || jsonb_build_object(
      'progress', least(public.mission_progress(v_uid, k, v_day), (v_m ->> 'target')::int),
      'claimed', exists (select 1 from public.user_missions where user_id = v_uid and day = v_day and key = k)));
  end loop;
  return jsonb_build_object('day', v_day, 'missions', v_out, 'bonus_gems', (v_cfg ->> 'bonus_gems')::int,
    'bonus_claimed', exists (select 1 from public.wallet_transactions where user_id = v_uid and idempotency_key = 'missions_bonus:' || v_day),
    'seconds_to_reset', extract(epoch from ((v_day + 1)::timestamp at time zone 'Asia/Jerusalem') - now())::int);
end $$;

create function public.mission_claim(p_key text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_day  date := public.israel_today();
  v_cfg  jsonb := (select value from public.app_config where key = 'missions');
  v_keys text[];
  v_m    jsonb;
  v_n    integer;
begin
  perform public.check_rate_limit(v_uid, 'mission_claim', 30, 3600);
  v_keys := (public.mission_keys(v_uid, v_day))[1:coalesce((v_cfg ->> 'per_day')::int, 3)];
  if not (p_key = any (v_keys)) then raise exception 'invalid_input: mission' using errcode = '22023'; end if;
  select m into v_m from jsonb_array_elements(v_cfg -> 'pool') m where m ->> 'key' = p_key;
  if public.mission_progress(v_uid, p_key, v_day) < (v_m ->> 'target')::int then
    raise exception 'invalid_state: not done' using errcode = 'P0001';
  end if;
  insert into public.user_missions (user_id, day, key) values (v_uid, v_day, p_key) on conflict do nothing;
  if not found then raise exception 'invalid_state: already claimed' using errcode = 'P0001'; end if;
  perform public.ledger_apply(v_uid, 'coins', (v_m ->> 'coins')::int, 'mission', 'mission', p_key, 'mission:' || v_day || ':' || p_key);
  select count(*) into v_n from public.user_missions where user_id = v_uid and day = v_day and key = any (v_keys);
  if v_n >= cardinality(v_keys) then
    perform public.ledger_apply(v_uid, 'gems', coalesce((v_cfg ->> 'bonus_gems')::int, 5), 'mission_bonus', 'mission', v_day::text,
      'missions_bonus:' || v_day);
  end if;
  return public.missions_state() || jsonb_build_object('coins', (v_m ->> 'coins')::int, 'bonus', v_n >= cardinality(v_keys));
end $$;

revoke all on function public.mission_progress(uuid, text, date), public.mission_keys(uuid, date),
  public.missions_state(), public.mission_claim(text) from public, anon, authenticated;
grant execute on function public.missions_state(), public.mission_claim(text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Streak freeze: a missed day doesn't reset the streak
-- ---------------------------------------------------------------------------
alter table public.user_streaks add column freezes integer not null default 1;
alter table public.user_streaks add constraint user_streaks_freezes check (freezes between 0 and 2);
insert into public.app_config (key, value, is_public) values ('streak.freeze_coins', '200'::jsonb, true)
on conflict (key) do nothing;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.daily_finish(uuid)'::regprocedure);
  d := replace(d,
$x$  v_cur := case when v_st.last_day = v_run.day then v_st.current
                when v_st.last_day = v_run.day - 1 then v_st.current + 1
                else 1 end;
  update public.user_streaks set current = v_cur, best = greatest(best, v_cur), last_day = v_run.day, updated_at = now()
   where user_id = v_run.user_id;$x$,
$x$  v_cur := case when v_st.last_day = v_run.day then v_st.current
                when v_st.last_day = v_run.day - 1 then v_st.current + 1
                -- missed days are covered by streak freezes, one per day
                when v_st.last_day is not null and v_run.day - v_st.last_day - 1 <= v_st.freezes then v_st.current + 1
                else 1 end;
  update public.user_streaks
     set current = v_cur, best = greatest(best, v_cur), last_day = v_run.day, updated_at = now(),
         freezes = case when v_st.last_day is not null and v_run.day - v_st.last_day > 1
                         and v_run.day - v_st.last_day - 1 <= v_st.freezes
                        then v_st.freezes - (v_run.day - v_st.last_day - 1) else v_st.freezes end
   where user_id = v_run.user_id;$x$);
  if position('streak freezes' in d) = 0 then raise exception 'daily_finish patch failed'; end if;
  execute d;

  d := pg_get_functiondef('public.daily_status()'::regprocedure);
  d := replace(d, $x$'streak', case when v_st.last_day >= v_day - 1 then v_st.current else 0 end,$x$,
    $x$'streak', case when v_st.last_day >= v_day - 1 - coalesce(v_st.freezes, 0) then v_st.current else 0 end,
    'freezes', coalesce(v_st.freezes, 1),
    'freeze_coins', coalesce((select (value #>> '{}')::int from public.app_config where key = 'streak.freeze_coins'), 200),$x$);
  if position('freeze_coins' in d) = 0 then raise exception 'daily_status patch failed'; end if;
  execute d;
end $$;

create function public.streak_freeze_buy() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_cost integer := coalesce((select (value #>> '{}')::int from public.app_config where key = 'streak.freeze_coins'), 200);
  v_n    integer;
begin
  perform public.check_rate_limit(v_uid, 'streak_freeze_buy', 10, 3600);
  insert into public.user_streaks (user_id) values (v_uid) on conflict (user_id) do nothing;
  select freezes into v_n from public.user_streaks where user_id = v_uid for update;
  if v_n >= 2 then raise exception 'invalid_state: max freezes' using errcode = 'P0001'; end if;
  perform public.ledger_apply(v_uid, 'coins', -v_cost, 'streak_freeze', 'streak', v_uid::text,
    'freeze:' || v_uid || ':' || extract(epoch from clock_timestamp())::bigint);
  update public.user_streaks set freezes = freezes + 1 where user_id = v_uid returning freezes into v_n;
  return jsonb_build_object('freezes', v_n);
end $$;
revoke all on function public.streak_freeze_buy() from public, anon, authenticated;
grant execute on function public.streak_freeze_buy() to authenticated;

-- ---------------------------------------------------------------------------
-- 5. The questions I got wrong
-- ---------------------------------------------------------------------------
create function public.my_mistakes(p_limit integer default 40) returns jsonb
language sql stable security definer set search_path = '' as $$
  with w as (
    select distinct on (rq.question_id) rq.question_id, rq.answered_at
      from public.quiz_runs r join public.quiz_run_questions rq on rq.run_id = r.id
     where r.user_id = public.require_user() and rq.answered_at is not null and rq.is_correct = false
     order by rq.question_id, rq.answered_at desc)
  select coalesce(jsonb_agg(jsonb_build_object(
           'id', q.id, 'text', q.text_he, 'image', q.image, 'explanation', q.explanation_he,
           'category_name', (select name_he from public.question_categories where slug = q.category),
           'answers', (select jsonb_agg(jsonb_build_object('text', a.text_he, 'correct', a.is_correct) order by md5(a.text_he))
                         from public.question_answers a where a.question_id = q.id),
           'at', w.answered_at) order by w.answered_at desc), '[]'::jsonb)
    from (select * from w order by answered_at desc limit least(greatest(coalesce(p_limit, 40), 1), 100)) w
    join public.questions q on q.id = w.question_id
   where q.status = 'active'
$$;
revoke all on function public.my_mistakes(integer) from public, anon, authenticated;
grant execute on function public.my_mistakes(integer) to authenticated;

-- ---------------------------------------------------------------------------
-- 6. Emoji reactions in live games (a fixed set — no free text)
-- ---------------------------------------------------------------------------
create table public.mode_reactions (
  id         bigint generated always as identity primary key,
  kind       text not null check (kind in ('match', 'family')),
  room_id    uuid not null,
  user_id    uuid not null references auth.users (id) on delete cascade,
  emoji      text not null,
  created_at timestamptz not null default now()
);
create index mode_reactions_room on public.mode_reactions (room_id, id);
alter table public.mode_reactions enable row level security;
revoke all on public.mode_reactions from anon, authenticated;

create function public.room_member(p_kind text, p_room uuid, p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case p_kind
    when 'match' then exists (select 1 from public.match_rooms where id = p_room and (host = p_user or guest = p_user))
    when 'family' then exists (select 1 from public.family_players where room_id = p_room and user_id = p_user)
    else false end
$$;

create function public.send_reaction(p_kind text, p_room uuid, p_emoji text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  perform public.check_rate_limit(v_uid, 'send_reaction', 30, 60);
  if p_emoji is null or not (p_emoji = any (array['😂','🔥','😱','👏','😎','🤯','💪','😴'])) then
    raise exception 'invalid_input: emoji' using errcode = '22023';
  end if;
  if not public.room_member(p_kind, p_room, v_uid) then raise exception 'invalid_input: room' using errcode = '22023'; end if;
  insert into public.mode_reactions (kind, room_id, user_id, emoji) values (p_kind, p_room, v_uid, p_emoji);
end $$;

create function public.room_reactions(p_kind text, p_room uuid, p_after bigint) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  if not public.room_member(p_kind, p_room, v_uid) then raise exception 'invalid_input: room' using errcode = '22023'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', r.id, 'emoji', r.emoji, 'me', r.user_id = v_uid,
             'username', p.username, 'avatar_id', p.avatar_id,
             'seat', (select seat from public.family_players fp where fp.room_id = r.room_id and fp.user_id = r.user_id)) order by r.id)
      from public.mode_reactions r join public.profiles p on p.id = r.user_id
     where r.room_id = p_room and r.kind = p_kind and r.id > coalesce(p_after, 0) and r.created_at > now() - interval '8 seconds'), '[]'::jsonb);
end $$;
revoke all on function public.room_member(text, uuid, uuid), public.send_reaction(text, uuid, text), public.room_reactions(text, uuid, bigint)
from public, anon, authenticated;
grant execute on function public.send_reaction(text, uuid, text), public.room_reactions(text, uuid, bigint) to authenticated;

-- ---------------------------------------------------------------------------
-- 7. Statistics for any player (mine, or a friend's), frames and titles
-- ---------------------------------------------------------------------------
alter table public.profiles add column frame text;
alter table public.profiles add column title text;
alter table public.profiles add constraint profiles_title_len check (title is null or char_length(title) <= 40);

do $$
declare d text;
begin
  -- my_stats(): the body becomes user_stats(p_uid)
  d := pg_get_functiondef('public.my_stats()'::regprocedure);
  d := replace(d, 'CREATE OR REPLACE FUNCTION public.my_stats()', 'CREATE OR REPLACE FUNCTION public.user_stats(p_uid uuid)');
  d := replace(d, 'v_uid     uuid := public.require_user();', 'v_uid     uuid := p_uid;');
  if position('user_stats(p_uid uuid)' in d) = 0 or position('v_uid     uuid := p_uid;' in d) = 0 then
    raise exception 'user_stats patch failed';
  end if;
  execute d;
end $$;
revoke all on function public.user_stats(uuid) from public, anon, authenticated;

create or replace function public.my_stats() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.user_stats(public.require_user())
$$;

/** Bronze/silver/gold per badge — the same thresholds the app shows. */
create function public.badge_tiers(p_stats jsonb) returns jsonb
language plpgsql immutable set search_path = '' as $$
declare
  v_out jsonb := '{}'::jsonb;
  v_def jsonb := '{"correct":[50,500,2000],"levels":[5,30,100],"wins":[1,10,50],"streak":[3,7,30],"blitz":[10,20,30],"stickers":[25,100,300]}';
  v_val jsonb;
  k     text;
  v     integer;
  t     integer;
begin
  v_val := jsonb_build_object(
    'correct', (p_stats ->> 'correct')::int, 'levels', (p_stats ->> 'levels')::int,
    'wins', (p_stats ->> 'match_wins')::int + (p_stats ->> 'family_wins')::int,
    'streak', (p_stats ->> 'best_streak')::int, 'blitz', (p_stats ->> 'blitz_best')::int,
    'stickers', (p_stats ->> 'stickers')::int);
  for k in select jsonb_object_keys(v_def) loop
    v := coalesce((v_val ->> k)::int, 0);
    select count(*) into t from jsonb_array_elements_text(v_def -> k) x where v >= x::int;
    v_out := v_out || jsonb_build_object(k, t);
  end loop;
  return v_out;
end $$;

create function public.flair_options(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_stats  jsonb := public.user_stats(p_uid);
  v_tiers  jsonb := public.badge_tiers(v_stats);
  v_sum    integer;
  v_all    boolean;
  v_g      text := (select gender from public.profiles where id = p_uid);
  v_champ  text := case when v_g = 'female' then 'אלופת' else 'אלוף' end;
  v_frames jsonb;
  v_titles jsonb;
begin
  select coalesce(sum(value::int), 0), bool_and(value::int >= 1) into v_sum, v_all from jsonb_each_text(v_tiers);
  v_frames := jsonb_build_array(
    jsonb_build_object('key', 'bronze', 'need', 1, 'unlocked', v_sum >= 1),
    jsonb_build_object('key', 'silver', 'need', 4, 'unlocked', v_sum >= 4),
    jsonb_build_object('key', 'gold', 'need', 8, 'unlocked', v_sum >= 8),
    jsonb_build_object('key', 'fire', 'need', 7, 'unlocked', (v_stats ->> 'best_streak')::int >= 7),
    jsonb_build_object('key', 'rainbow', 'need', 6, 'unlocked', coalesce(v_all, false)));
  select coalesce(jsonb_agg(x), '[]'::jsonb) into v_titles from (
    select jsonb_build_object('text', t.title, 'unlocked', (v_tiers ->> t.k)::int >= 1, 'badge', t.k) as x
      from (values ('correct', 'מוח חריף'), ('levels', 'מטפס שלבים'), ('wins', 'מנצח סדרתי'),
                   ('streak', 'מתמיד'), ('blitz', 'זריז כמו ברק'), ('stickers', 'אספן מדבקות')) t(k, title)
    union all
    select jsonb_build_object('text', v_champ || ' ה' || (w ->> 'name'),
             'unlocked', coalesce((select (s ->> 'levels')::int from jsonb_array_elements(v_stats -> 'worlds') s where s ->> 'world' = w ->> 'slug'), 0) >= 5,
             'world', w ->> 'slug')
      from public.app_config c, jsonb_array_elements(c.value) w
     where c.key = 'worlds' and coalesce((w ->> 'active')::boolean, true)) y;
  return jsonb_build_object('frames', v_frames, 'titles', v_titles, 'tiers', v_tiers,
    'frame', (select frame from public.profiles where id = p_uid), 'title', (select title from public.profiles where id = p_uid));
end $$;

create function public.my_flair() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.flair_options(public.require_user())
$$;

create function public.set_flair(p_frame text, p_title text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_opt jsonb := public.flair_options(v_uid);
begin
  perform public.check_rate_limit(v_uid, 'set_flair', 60, 3600);
  if p_frame is not null and not exists (select 1 from jsonb_array_elements(v_opt -> 'frames') f
                                          where f ->> 'key' = p_frame and (f ->> 'unlocked')::boolean) then
    raise exception 'invalid_input: frame' using errcode = '22023';
  end if;
  if p_title is not null and not exists (select 1 from jsonb_array_elements(v_opt -> 'titles') t
                                          where t ->> 'text' = p_title and (t ->> 'unlocked')::boolean) then
    raise exception 'invalid_input: title' using errcode = '22023';
  end if;
  update public.profiles set frame = p_frame, title = p_title where id = v_uid;
  return public.get_my_state();
end $$;

create or replace function public.mode_profile(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('username', username, 'avatar_id', avatar_id, 'level', level, 'frame', frame, 'title', title)
    from public.profiles where id = p_user
$$;

create function public.friend_profile(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  perform public.check_rate_limit(v_uid, 'friend_profile', 120, 3600);
  if p_user <> v_uid and not public.are_friends(v_uid, p_user) then
    raise exception 'invalid_input: not friends' using errcode = '22023';
  end if;
  return jsonb_build_object(
    'id', p_user,
    'profile', (select jsonb_build_object('username', username, 'avatar_id', avatar_id, 'level', level,
                  'frame', frame, 'title', title, 'gender', gender) from public.profiles where id = p_user),
    'stats', public.user_stats(p_user) - 'xp',
    'tiers', public.badge_tiers(public.user_stats(p_user)));
end $$;

revoke all on function public.badge_tiers(jsonb), public.flair_options(uuid) from public, anon, authenticated;
revoke all on function public.my_flair(), public.set_flair(text, text), public.friend_profile(uuid) from public, anon, authenticated;
grant execute on function public.my_stats(), public.my_flair(), public.set_flair(text, text), public.friend_profile(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- 8. Friends' table this week
-- ---------------------------------------------------------------------------
create function public.leaderboard_friends() returns jsonb
language sql stable security definer set search_path = '' as $$
  with me as (select public.require_user() as id),
  ppl as (
    select (select id from me) as id
    union
    select case when f.user_a = (select id from me) then f.user_b else f.user_a end
      from public.friendships f
     where f.status = 'accepted' and (f.user_a = (select id from me) or f.user_b = (select id from me))),
  pts as (
    select p.id, coalesce((select sum(r.prize_points) from public.quiz_runs r
                            where r.user_id = p.id and r.status <> 'active' and r.ended_at >= public.israel_week_start()), 0)::bigint as points
      from ppl p)
  select jsonb_build_object('rows', coalesce(jsonb_agg(jsonb_build_object(
           'rank', x.rank, 'username', pr.username, 'avatar_id', pr.avatar_id, 'level', pr.level,
           'frame', pr.frame, 'points', x.points, 'me', x.id = (select id from me)) order by x.rank, pr.username), '[]'::jsonb))
    from (select pts.*, rank() over (order by points desc) as rank from pts) x
    join public.profiles pr on pr.id = x.id
$$;
revoke all on function public.leaderboard_friends() from public, anon, authenticated;
grant execute on function public.leaderboard_friends() to authenticated;

-- ---------------------------------------------------------------------------
-- 9. "Revenge round": invite the player who just beat you
-- ---------------------------------------------------------------------------
create table public.match_invites (
  id         bigint generated always as identity primary key,
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  room_id    uuid not null references public.match_rooms (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index match_invites_to on public.match_invites (to_user, status, created_at);
alter table public.match_invites enable row level security;
revoke all on public.match_invites from anon, authenticated;

create function public.match_rematch(p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_old  public.match_rooms;
  v_opp  uuid;
  v_new  jsonb;
begin
  perform public.check_rate_limit(v_uid, 'match_rematch', 20, 3600);
  select * into v_old from public.match_rooms where id = p_room and (host = v_uid or guest = v_uid);
  if not found or v_old.status <> 'done' then raise exception 'invalid_state: room' using errcode = 'P0001'; end if;
  v_opp := case when v_old.host = v_uid then v_old.guest else v_old.host end;
  if v_opp is null then raise exception 'invalid_state: bot' using errcode = 'P0001'; end if;
  v_new := public.match_create();
  insert into public.match_invites (from_user, to_user, room_id) values (v_uid, v_opp, (v_new ->> 'room_id')::uuid);
  return v_new;
end $$;

create function public.match_invite_answer(p_invite bigint, p_accept boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_inv public.match_invites;
  v_code text;
begin
  select * into v_inv from public.match_invites where id = p_invite and to_user = v_uid and status = 'pending' for update;
  if not found then raise exception 'invalid_state: invite' using errcode = 'P0001'; end if;
  update public.match_invites set status = case when p_accept then 'accepted' else 'declined' end where id = p_invite;
  if not p_accept then return jsonb_build_object('ok', true); end if;
  select code into v_code from public.match_rooms where id = v_inv.room_id;
  return public.match_join(v_code);
end $$;

create or replace function public.presence_ping() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  update public.profiles set last_active = now() where id = v_uid and (last_active is null or last_active < now() - interval '5 seconds');
  return jsonb_build_object(
    'calls', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'from', p.username, 'avatar_id', p.avatar_id, 'question', c.question,
                                          'seconds_left', greatest(0, ceil(extract(epoch from (c.expires_at - now()))))::int)
                       order by c.created_at)
        from public.friend_calls c join public.profiles p on p.id = c.caller
       where c.friend = v_uid and c.answer_slot is null and c.expires_at > now()), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'from', p.username, 'avatar_id', p.avatar_id) order by i.created_at)
        from public.match_invites i join public.profiles p on p.id = i.from_user
        join public.match_rooms r on r.id = i.room_id
       where i.to_user = v_uid and i.status = 'pending' and i.created_at > now() - interval '90 seconds'
         and r.status = 'waiting'), '[]'::jsonb));
end $$;

revoke all on function public.match_rematch(uuid), public.match_invite_answer(bigint, boolean) from public, anon, authenticated;
grant execute on function public.match_rematch(uuid), public.match_invite_answer(bigint, boolean) to authenticated;

-- ---------------------------------------------------------------------------
-- 10. Weekly event: one world in the spotlight, double coins, its own table
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values ('event', '{"enabled": true, "coins_mult": 2}'::jsonb, true)
on conflict (key) do nothing;

create function public.event_world() returns text
language sql stable security definer set search_path = '' as $$
  select case when coalesce(((select value from public.app_config where key = 'event') ->> 'enabled')::boolean, false)
    then (select w[1 + (floor(extract(epoch from public.israel_week_start()) / 604800)::int % cardinality(w))]
            from (select array_remove(public.world_slugs(), 'hanukkah') as w) x)
    end
$$;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.session_finish(uuid, boolean)'::regprocedure);
  d := replace(d, 'if v_run.doubled then v_mult := v_mult * 2; end if;',
    'if v_run.doubled then v_mult := v_mult * 2; end if;
  -- the weekly event world pays extra coins
  if v_run.world = public.event_world() then
    v_mult := v_mult * coalesce(((select value from public.app_config where key = ''event'') ->> ''coins_mult'')::numeric, 2);
  end if;');
  if position('event_world' in d) = 0 then raise exception 'session_finish patch failed'; end if;
  execute d;
end $$;

create function public.event_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_w    text := public.event_world();
  v_rows jsonb;
  v_me   jsonb;
begin
  if v_w is null then return jsonb_build_object('active', false); end if;
  with t as (
    select r.user_id, sum(r.prize_points)::bigint as points
      from public.quiz_runs r
     where r.world = v_w and r.mode = 'session' and r.status <> 'active' and r.ended_at >= public.israel_week_start()
     group by r.user_id having sum(r.prize_points) > 0),
  k as (select t.*, rank() over (order by points desc) as rank from t)
  select (select coalesce(jsonb_agg(jsonb_build_object('rank', k.rank, 'username', p.username, 'avatar_id', p.avatar_id,
                   'frame', p.frame, 'points', k.points, 'me', k.user_id = v_uid) order by k.rank), '[]'::jsonb)
            from (select * from k order by rank limit 20) k join public.profiles p on p.id = k.user_id),
         (select jsonb_build_object('rank', rank, 'points', points) from k where user_id = v_uid)
    into v_rows, v_me;
  return jsonb_build_object('active', true, 'world', v_w,
    'coins_mult', coalesce(((select value from public.app_config where key = 'event') ->> 'coins_mult')::numeric, 2),
    'ends_at', public.israel_week_start() + interval '7 days', 'rows', v_rows, 'me', v_me);
end $$;
revoke all on function public.event_world() from public, anon, authenticated;
revoke all on function public.event_state() from public, anon, authenticated;
grant execute on function public.event_state() to authenticated;

-- ---------------------------------------------------------------------------
-- 11. Community questions: players send, the admin approves, the author is credited
-- ---------------------------------------------------------------------------
alter table public.questions add column author text;

create table public.question_submissions (
  id          bigint generated always as identity primary key,
  user_id     uuid not null references auth.users (id) on delete cascade,
  world       text not null,
  text_he     text not null check (char_length(text_he) between 8 and 200),
  correct     text not null check (char_length(correct) between 1 and 80),
  wrongs      text[] not null check (cardinality(wrongs) = 3),
  status      text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  question_id text,
  created_at  timestamptz not null default now(),
  reviewed_at timestamptz
);
create index question_submissions_status on public.question_submissions (status, created_at);
alter table public.question_submissions enable row level security;
revoke all on public.question_submissions from anon, authenticated;

create function public.submit_question(p_world text, p_text text, p_correct text, p_wrongs text[]) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_w   text[];
begin
  perform public.check_rate_limit(v_uid, 'submit_question', 5, 86400);
  if public.world_cfg(p_world) is null then raise exception 'invalid_input: world' using errcode = '22023'; end if;
  select array_agg(btrim(x)) into v_w from unnest(p_wrongs) x;
  if cardinality(v_w) <> 3 or exists (select 1 from unnest(v_w) x where char_length(x) not between 1 and 80)
     or char_length(btrim(p_text)) not between 8 and 200 or char_length(btrim(p_correct)) not between 1 and 80
     or btrim(p_correct) = any (v_w) or (select count(distinct x) from unnest(v_w) x) < 3 then
    raise exception 'invalid_input: question' using errcode = '22023';
  end if;
  insert into public.question_submissions (user_id, world, text_he, correct, wrongs)
  values (v_uid, p_world, btrim(p_text), btrim(p_correct), v_w);
  return jsonb_build_object('ok', true);
end $$;

create function public.my_submissions() returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_agg(jsonb_build_object('id', id, 'world', world, 'text', text_he, 'status', status, 'created_at', created_at)
           order by created_at desc), '[]'::jsonb)
    from public.question_submissions where user_id = public.require_user()
$$;

create function public.admin_submissions() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
begin
  perform public.require_admin();
  return coalesce((select jsonb_agg(jsonb_build_object('id', s.id, 'world', s.world, 'text', s.text_he, 'correct', s.correct,
            'wrongs', to_jsonb(s.wrongs), 'author', p.username, 'created_at', s.created_at) order by s.created_at)
     from public.question_submissions s join public.profiles p on p.id = s.user_id where s.status = 'pending'), '[]'::jsonb);
end $$;

create function public.admin_review_submission(p_id bigint, p_approve boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_s   public.question_submissions;
  v_qid text;
  v_author text;
begin
  perform public.require_admin();
  select * into v_s from public.question_submissions where id = p_id and status = 'pending' for update;
  if not found then raise exception 'invalid_state: submission' using errcode = 'P0001'; end if;
  if not p_approve then
    update public.question_submissions set status = 'rejected', reviewed_at = now() where id = p_id;
    return jsonb_build_object('ok', true);
  end if;
  select username into v_author from public.profiles where id = v_s.user_id;
  v_qid := 'q_' || substr(md5('community' || p_id::text || v_s.text_he), 1, 16);
  insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by,
                                generator, obscurity, author)
  values (v_qid, (select slug from public.question_categories where world = v_s.world order by sort limit 1), 'community', 'easy',
          v_s.text_he, 'שאלה שנשלחה על ידי ' || coalesce(v_author, 'שחקן'), 'community',
          array['community:' || p_id], 'admin', 'community', 0.3, v_author);
  insert into public.question_answers (question_id, position, text_he, is_correct)
  values (v_qid, 0, v_s.correct, true), (v_qid, 1, v_s.wrongs[1], false), (v_qid, 2, v_s.wrongs[2], false), (v_qid, 3, v_s.wrongs[3], false);
  update public.question_submissions set status = 'approved', reviewed_at = now(), question_id = v_qid where id = p_id;
  perform public.refresh_question_ranks();
  -- thank-you coins for the author
  perform public.ledger_apply(v_s.user_id, 'coins', 200, 'question_approved', 'submission', p_id::text, 'submission:' || p_id);
  return jsonb_build_object('ok', true, 'question_id', v_qid);
end $$;

revoke all on function public.submit_question(text, text, text, text[]), public.my_submissions(),
  public.admin_submissions(), public.admin_review_submission(bigint, boolean) from public, anon, authenticated;
grant execute on function public.submit_question(text, text, text, text[]), public.my_submissions(),
  public.admin_submissions(), public.admin_review_submission(bigint, boolean) to authenticated;

-- the author is shown on the question
create or replace function public.mode_question_json(p_qid text, p_perm jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', q.id, 'text', q.text_he, 'image', q.image, 'author', q.author,
           'category_name', (select name_he from public.question_categories where slug = q.category),
           'answers', (select jsonb_agg(jsonb_build_object('slot', s, 'text', a.text_he) order by s)
                         from generate_series(0, 3) s join public.question_answers a
                           on a.question_id = q.id and a.position = (p_perm ->> s)::int))
    from public.questions q where q.id = p_qid
$$;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.session_payload(uuid)'::regprocedure);
  d := replace(d, $x$'question_world', (select q.world from public.questions q where q.id = v_rq.question_id));$x$,
    $x$'question_world', (select q.world from public.questions q where q.id = v_rq.question_id),
    'question_author', (select q.author from public.questions q where q.id = v_rq.question_id));$x$);
  if position('question_author' in d) = 0 then raise exception 'session_payload patch failed'; end if;
  execute d;
end $$;

-- ---------------------------------------------------------------------------
-- 12. New players' first deal is in coins
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values
  ('deals.starter', '{"id": "starter", "title": "חבילת פתיחה למתחילים", "body": "חבילת כסף + 3 כרטיסים במחיר של מתחילים",
                      "was": 900, "price": {"amount": 300, "currency": "coins"},
                      "rewards": [{"kind": "pack", "pack": "silver", "amount": 1}, {"kind": "tickets", "amount": 3}]}'::jsonb, true)
on conflict (key) do update set value = excluded.value;

create function public.deal_for(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_cfg jsonb := (select value from public.app_config where key = 'deals');
  v_win bigint := public.deal_window();
begin
  if public.is_newbie(p_user) and not exists (select 1 from public.deal_purchases where user_id = p_user and deal_id = 'starter') then
    return jsonb_build_object('window', 0, 'deal', (select value from public.app_config where key = 'deals.starter'),
                              'ends_at', public.newbie_until(p_user));
  end if;
  return jsonb_build_object('window', v_win, 'deal', (v_cfg -> 'list') -> (v_win % jsonb_array_length(v_cfg -> 'list'))::int,
                            'ends_at', to_timestamp((v_win + 1) * (v_cfg ->> 'hours')::int * 3600));
end $$;
revoke all on function public.deal_for(uuid) from public, anon, authenticated;

create or replace function public.deals_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_d   jsonb := public.deal_for(v_uid);
begin
  return jsonb_build_object(
    'window', (v_d ->> 'window')::bigint,
    'ends_at', v_d -> 'ends_at',
    'deal', v_d -> 'deal',
    'bought', exists (select 1 from public.deal_purchases where user_id = v_uid and deal_id = v_d #>> '{deal,id}'
                        and win = (v_d ->> 'window')::bigint));
end $$;

create or replace function public.deal_buy(p_deal text, p_window bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_d    jsonb := public.deal_for(v_uid);
  v_deal jsonb := v_d -> 'deal';
  v_win  bigint := (v_d ->> 'window')::bigint;
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
