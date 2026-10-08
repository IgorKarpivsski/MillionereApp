-- General-knowledge trivia: knowledge worlds, short sessions and a level path.
--
--  * Every question category belongs to a "world" (geography, science, ...,
--    football). questions.world is kept in sync by a trigger.
--  * A session = 10 questions from one world at the difficulty of one level of
--    that world's path (or a mixed "quick play"). A wrong answer doesn't end it.
--  * Stars: 6+ correct = 1 star (level passed, next level unlocked), 8+ = 2, 10 = 3.
--  * Score (prize_points) = 100 + difficulty bonus + speed bonus per correct answer,
--    so weekly leagues and the leaderboard keep working unchanged.
--  * Photo questions: questions.image may now also be
--      {"kind":"photo","url":"https://…","credit":"…","license":"…","page":"https://…","fit":"cover"|"contain"}
--    (Wikimedia Commons images, shown with their credit).
--  * Daily challenge and friend matches now rotate through the worlds.

-- ---------------------------------------------------------------------------
-- Worlds
-- ---------------------------------------------------------------------------
alter table public.question_categories add column world text;
update public.question_categories set world = 'football';

insert into public.question_categories (slug, name_he, sort, world) values
  ('geography', 'גאוגרפיה', 101, 'geography'),
  ('history', 'היסטוריה', 102, 'history'),
  ('science', 'מדע', 103, 'science'),
  ('nature', 'טבע וחיות', 104, 'nature'),
  ('space', 'חלל', 105, 'space'),
  ('culture', 'אמנות וספרות', 106, 'culture'),
  ('music', 'מוזיקה', 107, 'music'),
  ('israel', 'ישראל', 108, 'israel'),
  ('sport', 'ספורט', 109, 'sport'),
  ('food', 'אוכל', 110, 'food'),
  ('people', 'אישים', 111, 'people'),
  ('screen', 'קולנוע וטלוויזיה', 112, 'screen')
on conflict (slug) do update set world = excluded.world, name_he = excluded.name_he;
alter table public.question_categories alter column world set not null;

insert into public.app_config (key, value, is_public) values
  ('worlds', '[
     {"slug": "geography", "name": "גאוגרפיה", "icon": "globe",   "color": "#22B07D", "levels": 40, "active": true},
     {"slug": "history",   "name": "היסטוריה", "icon": "scroll",  "color": "#C9853A", "levels": 30, "active": true},
     {"slug": "science",   "name": "מדע",      "icon": "atom",    "color": "#3E8EF7", "levels": 30, "active": true},
     {"slug": "nature",    "name": "טבע וחיות", "icon": "leaf",    "color": "#6CBF3B", "levels": 40, "active": true},
     {"slug": "space",     "name": "חלל",      "icon": "planet",  "color": "#7B5CF0", "levels": 20, "active": true},
     {"slug": "culture",   "name": "אמנות וספרות", "icon": "palette", "color": "#E2557B", "levels": 30, "active": true},
     {"slug": "screen",    "name": "קולנוע",    "icon": "film",    "color": "#F2694B", "levels": 30, "active": true},
     {"slug": "music",     "name": "מוזיקה",    "icon": "note",    "color": "#D84FD0", "levels": 20, "active": true},
     {"slug": "people",    "name": "אישים",     "icon": "person",  "color": "#F0A020", "levels": 30, "active": true},
     {"slug": "israel",    "name": "ישראל",     "icon": "star",    "color": "#2F7DE1", "levels": 30, "active": true},
     {"slug": "sport",     "name": "ספורט",     "icon": "medal",   "color": "#14A3B8", "levels": 20, "active": true},
     {"slug": "food",      "name": "אוכל",      "icon": "food",    "color": "#EE8A2E", "levels": 20, "active": true},
     {"slug": "football",  "name": "כדורגל",    "icon": "ball",    "color": "#1E9E4A", "levels": 60, "active": true}
   ]'::jsonb, true),
  ('session', '{
     "questions": 10, "seconds": 20, "stars_at": [6, 8, 10],
     "coins_per_correct": 4, "star_coins": [0, 20, 40, 70], "xp_per_correct": 10, "xp_per_star": 10,
     "points_base": 100, "points_difficulty": 100, "points_per_second": 5,
     "extra_5050_coins": 30, "chest_every": 5
   }'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

alter table public.questions add column world text;
update public.questions q set world = c.world from public.question_categories c where c.slug = q.category;

create function public.questions_set_world() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  select world into new.world from public.question_categories where slug = new.category;
  return new;
end $$;
revoke all on function public.questions_set_world() from public, anon, authenticated;
create trigger questions_world before insert or update of category on public.questions
  for each row execute function public.questions_set_world();
create index questions_world_idx on public.questions (status, world, ease_rank);

-- ease_rank is now the difficulty percentile inside each world.
create or replace function public.refresh_question_ranks() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_n integer;
begin
  with ranked as (
    select id, percent_rank() over (
             partition by world
             order by coalesce(obscurity,
               case difficulty when 'easy' then 0.1 when 'medium' then 0.3 when 'hard' then 0.5
                               when 'expert' then 0.7 else 0.9 end), id) as r
      from public.questions where status = 'active')
  update public.questions q set ease_rank = ranked.r from ranked where q.id = ranked.id;
  get diagnostics v_n = row_count;
  update public.questions set ease_rank = null where status <> 'active' and ease_rank is not null;
  return v_n;
end $$;
revoke all on function public.refresh_question_ranks() from public, anon, authenticated;
select public.refresh_question_ranks();

/** The active world slugs, in config order. */
create function public.world_slugs() returns text[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(w ->> 'slug' order by o), '{}')
    from public.app_config c, jsonb_array_elements(c.value) with ordinality as t(w, o)
   where c.key = 'worlds' and coalesce((w ->> 'active')::boolean, true)
$$;

/** The world for slot i of a mixed set, rotated by a seed (daily: the date, match: the room). */
create function public.world_rotation(p_i integer, p_seed text) returns text
language plpgsql stable security definer set search_path = '' as $$
declare v_w text[] := public.world_slugs(); v_n integer;
begin
  v_n := cardinality(v_w);
  if v_n = 0 then return null; end if;
  return v_w[1 + ((abs(hashtext(p_seed)) + p_i) % v_n)];
end $$;
revoke all on function public.world_slugs(), public.world_rotation(integer, text) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Photo questions
-- ---------------------------------------------------------------------------
alter table public.questions drop constraint questions_image_shape;
alter table public.questions add constraint questions_image_shape check (
  image is null or (jsonb_typeof(image) = 'object' and (
    (image ->> 'kind' = 'map' and image ->> 'map' in ('israel', 'europe')
       and jsonb_typeof(image -> 'lon') = 'number' and jsonb_typeof(image -> 'lat') = 'number')
    or (image ->> 'kind' = 'photo' and image ->> 'url' ~ '^https://[^\s]+$'
       and char_length(coalesce(image ->> 'credit', '')) between 1 and 240))));

create or replace function public.import_questions(p_token text, p_rows jsonb)
returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_row  jsonb;
  v_n    integer := 0;
  v_i    integer;
begin
  select value #>> '{}' into v_hash from public.app_config where key = 'ops.import_token_sha256';
  if v_hash is null or v_hash <> encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'invalid_input: rows' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    if jsonb_array_length(v_row -> 'answers_he') <> 4 then
      raise exception 'invalid_input: % must have 4 answers', v_row ->> 'id' using errcode = '22023';
    end if;
    insert into public.questions as q (id, category, topic, difficulty, text_he, explanation_he, tags, template,
                                       source_urls, verified_by, volatile, review_after, generator, obscurity, image)
    values (
      v_row ->> 'id', v_row ->> 'category', v_row ->> 'topic', (v_row ->> 'difficulty')::public.question_difficulty,
      v_row ->> 'text_he', v_row ->> 'explanation_he', coalesce(v_row -> 'tags', '{}'::jsonb), v_row ->> 'template',
      array(select jsonb_array_elements_text(v_row -> 'source_urls')), v_row ->> 'verified_by',
      coalesce((v_row ->> 'volatile')::boolean, false),
      case when coalesce((v_row ->> 'volatile')::boolean, false) then (now() + interval '6 months')::date end,
      v_row ->> 'generator', (v_row ->> 'obscurity')::real, nullif(v_row -> 'image', 'null'::jsonb))
    on conflict (id) do update set
      category = excluded.category, topic = excluded.topic, difficulty = excluded.difficulty,
      text_he = excluded.text_he, explanation_he = excluded.explanation_he, tags = excluded.tags,
      template = excluded.template, source_urls = excluded.source_urls, verified_by = excluded.verified_by,
      volatile = excluded.volatile, review_after = excluded.review_after, generator = excluded.generator,
      obscurity = excluded.obscurity, image = coalesce(excluded.image, q.image)
    where q.status <> 'retired';

    update public.question_answers set is_correct = false where question_id = v_row ->> 'id' and is_correct;
    for v_i in 0..3 loop
      insert into public.question_answers as a (question_id, position, text_he, is_correct)
      values (v_row ->> 'id', v_i, v_row -> 'answers_he' ->> v_i, v_i = 0)
      on conflict (question_id, position) do update set text_he = excluded.text_he, is_correct = excluded.is_correct;
    end loop;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.import_questions(text, jsonb) from public, authenticated;
grant execute on function public.import_questions(text, jsonb) to anon;

-- ---------------------------------------------------------------------------
-- Level path progress
-- ---------------------------------------------------------------------------
create table public.user_world_levels (
  user_id      uuid not null references auth.users (id) on delete cascade,
  world        text not null,
  level        smallint not null check (level between 1 and 200),
  stars        smallint not null default 0 check (stars between 0 and 3),
  best_correct smallint not null default 0,
  plays        integer not null default 0,
  updated_at   timestamptz not null default now(),
  primary key (user_id, world, level)
);
alter table public.user_world_levels enable row level security;
create policy user_world_levels_own on public.user_world_levels for select to authenticated
  using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.user_world_levels from anon, authenticated;

alter table public.quiz_runs drop constraint quiz_runs_mode;
alter table public.quiz_runs add constraint quiz_runs_mode check (mode in ('classic', 'daily', 'session'));
alter table public.quiz_runs add column world text;
alter table public.quiz_runs add column level smallint;
alter table public.quiz_runs add column stars smallint;

/** The world's config row (null if unknown or inactive). */
create function public.world_cfg(p_world text) returns jsonb
language sql stable security definer set search_path = '' as $$
  select w from public.app_config c, jsonb_array_elements(c.value) w
   where c.key = 'worlds' and w ->> 'slug' = p_world and coalesce((w ->> 'active')::boolean, true)
$$;

/** Highest level the player may play in a world (1 + highest passed level). */
create function public.world_unlocked(p_user uuid, p_world text) returns integer
language sql stable security definer set search_path = '' as $$
  select least(coalesce((select max(level) from public.user_world_levels
                          where user_id = p_user and world = p_world and stars >= 1), 0) + 1,
               coalesce((public.world_cfg(p_world) ->> 'levels')::int, 1))
$$;
revoke all on function public.world_cfg(text), public.world_unlocked(uuid, text) from public, anon, authenticated;

/** Ease-rank window for question `rung` of a session at `level` of `levels` (level 0 = quick play). */
create function public.session_window(p_level integer, p_levels integer, p_rung integer) returns real[]
language plpgsql immutable set search_path = '' as $$
declare c real; w real := 0.14;
begin
  if p_level = 0 then
    c := 0.06 + 0.07 * (p_rung - 1);       -- quick play: easy → medium-hard within the session
  else
    -- the level sets the centre; inside a session the last questions are a bit harder
    c := 0.04 + 0.88 * (p_level - 1)::real / greatest(p_levels - 1, 1) + 0.012 * (p_rung - 5);
  end if;
  return array[greatest(c - w, 0), least(c + w, 1)];
end $$;

/** An unseen active question of a world inside an ease window (widens, then allows seen ones). */
create function public.pick_world_question(p_user uuid, p_world text, p_lo real, p_hi real, p_exclude text[])
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare v_id text; v_pad real := 0;
begin
  while v_pad <= 0.45 loop
    select q.id into v_id from public.questions q
     where q.status = 'active' and q.world = p_world
       and q.ease_rank between p_lo - v_pad and p_hi + v_pad
       and not (q.id = any (p_exclude))
       and (p_user is null or not exists (select 1 from public.seen_questions s where s.user_id = p_user and s.question_id = q.id))
     order by random() limit 1;
    if v_id is not null then return v_id; end if;
    v_pad := v_pad + 0.15;
  end loop;
  -- Everything seen: take the one seen longest ago in the window.
  select q.id into v_id from public.questions q
    left join public.seen_questions s on s.user_id = p_user and s.question_id = q.id
   where q.status = 'active' and q.world = p_world
     and q.ease_rank between p_lo - 0.2 and p_hi + 0.2 and not (q.id = any (p_exclude))
   order by s.seen_at nulls first, random() limit 1;
  return v_id;
end $$;
revoke all on function public.session_window(integer, integer, integer),
  public.pick_world_question(uuid, text, real, real, text[]) from public, anon, authenticated;

create function public.session_lock_run(p_user uuid, p_run uuid) returns public.quiz_runs
language plpgsql security definer set search_path = '' as $$
declare v_run public.quiz_runs;
begin
  select * into v_run from public.quiz_runs where id = p_run and user_id = p_user and mode = 'session' for update;
  if not found then raise exception 'invalid_input: run' using errcode = '22023'; end if;
  return v_run;
end $$;

create function public.session_payload(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_run public.quiz_runs; v_cfg jsonb := (select value from public.app_config where key = 'session');
begin
  select * into v_run from public.quiz_runs where id = p_run;
  return public.quiz_payload(p_run) || jsonb_build_object(
    'mode', 'session', 'world', v_run.world, 'level', v_run.level, 'score', v_run.prize_points,
    'total', (v_cfg ->> 'questions')::int,
    'question_world', (select q.world from public.quiz_run_questions rq join public.questions q on q.id = rq.question_id
                        where rq.run_id = p_run and rq.rung = v_run.rung));
end $$;
revoke all on function public.session_lock_run(uuid, uuid), public.session_payload(uuid) from public, anon, authenticated;

/** Ends a session: stars, coins, XP, level progress, chests. */
create function public.session_finish(p_run uuid, p_abandon boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_run   public.quiz_runs;
  v_cfg   jsonb := (select value from public.app_config where key = 'session');
  v_stars integer := 0;
  v_coins integer := 0;
  v_xp    integer;
  v_prev  public.user_world_levels;
  v_old   integer;
  v_lvl   integer;
  v_bal   bigint;
  v_chest text;
  v_first boolean := false;
  v_unl   integer;
begin
  select * into v_run from public.quiz_runs where id = p_run;
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run already finished' using errcode = 'P0001';
  end if;

  if not p_abandon then
    v_stars := case when v_run.correct >= (v_cfg -> 'stars_at' ->> 2)::int then 3
                    when v_run.correct >= (v_cfg -> 'stars_at' ->> 1)::int then 2
                    when v_run.correct >= (v_cfg -> 'stars_at' ->> 0)::int then 1 else 0 end;
  end if;
  v_coins := v_run.correct * (v_cfg ->> 'coins_per_correct')::int + coalesce((v_cfg -> 'star_coins' ->> v_stars)::int, 0);
  v_xp := v_run.correct * (v_cfg ->> 'xp_per_correct')::int + v_stars * (v_cfg ->> 'xp_per_star')::int;

  if v_run.world <> 'mix' and v_run.level >= 1 and not p_abandon then
    select * into v_prev from public.user_world_levels
     where user_id = v_run.user_id and world = v_run.world and level = v_run.level for update;
    insert into public.user_world_levels as u (user_id, world, level, stars, best_correct, plays)
    values (v_run.user_id, v_run.world, v_run.level, v_stars, v_run.correct, 1)
    on conflict (user_id, world, level) do update
      set stars = greatest(u.stars, excluded.stars), best_correct = greatest(u.best_correct, excluded.best_correct),
          plays = u.plays + 1, updated_at = now();
    v_first := v_stars >= 1 and coalesce(v_prev.stars, 0) = 0;
    if v_first and v_run.level % (v_cfg ->> 'chest_every')::int = 0 then
      v_chest := 'gold';
    elsif v_stars = 3 and coalesce(v_prev.stars, 0) < 3 then
      v_chest := 'silver';
    end if;
    if v_chest is not null then
      perform public.grant_pack_token(v_run.user_id, v_chest, 1);
    end if;
  end if;

  if v_coins > 0 then
    perform public.ledger_apply(v_run.user_id, 'coins', v_coins, 'quiz_run', 'quiz_run', v_run.id::text, 'quiz_run:' || v_run.id::text);
  end if;
  select level into v_old from public.profiles where id = v_run.user_id;
  update public.profiles set xp = xp + v_xp, level = public.level_from_xp(xp + v_xp)
   where id = v_run.user_id returning level into v_lvl;
  update public.quiz_runs
     set status = case when p_abandon then 'abandoned'::public.quiz_run_status
                       when v_stars >= 1 then 'won'::public.quiz_run_status else 'lost'::public.quiz_run_status end,
         ended_at = now(), coins_awarded = v_coins, xp_awarded = v_xp, stars = v_stars
   where id = p_run;
  select coins into v_bal from public.wallets where user_id = v_run.user_id;
  if v_run.world <> 'mix' then v_unl := public.world_unlocked(v_run.user_id, v_run.world); end if;

  return jsonb_build_object(
    'mode', 'session', 'status', case when v_stars >= 1 then 'won' else 'lost' end,
    'world', v_run.world, 'level', v_run.level, 'stars', v_stars, 'prev_stars', coalesce(v_prev.stars, 0),
    'correct', v_run.correct, 'total', (v_cfg ->> 'questions')::int,
    'coins', v_coins, 'prize_points', v_run.prize_points, 'xp', v_xp, 'level_up', v_lvl > coalesce(v_old, 1),
    'player_level', v_lvl, 'leveled_up', v_lvl > coalesce(v_old, 1), 'balance', v_bal,
    'chest', v_chest, 'first_clear', v_first, 'unlocked', v_unl);
end $$;
revoke all on function public.session_finish(uuid, boolean) from public, anon, authenticated;

/** Ends any active run of the player (all modes). */
create function public.abandon_active_runs(p_user uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare v_r public.quiz_runs;
begin
  for v_r in select * from public.quiz_runs where user_id = p_user and status = 'active' for update loop
    if v_r.mode = 'classic' then perform public.quiz_finish(v_r.id, 'abandoned');
    elsif v_r.mode = 'daily' then perform public.daily_finish(v_r.id);
    else perform public.session_finish(v_r.id, true);
    end if;
  end loop;
end $$;
revoke all on function public.abandon_active_runs(uuid) from public, anon, authenticated;

create function public.session_next(p_run uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_run  public.quiz_runs;
  v_cfg  jsonb := (select value from public.app_config where key = 'session');
  v_wcfg jsonb;
  v_win  real[];
  v_qid  text;
  v_world text;
  v_ex   text[];
begin
  perform public.check_rate_limit(v_uid, 'session_next', 90, 60);
  v_run := public.session_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run finished' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.quiz_run_questions where run_id = p_run and rung = v_run.rung) then
    select coalesce(array_agg(question_id), '{}') into v_ex from public.quiz_run_questions where run_id = p_run;
    if v_run.world = 'mix' then
      v_world := public.world_rotation(v_run.rung, p_run::text);
      v_win := public.session_window(0, 1, v_run.rung);
    else
      v_world := v_run.world;
      v_wcfg := public.world_cfg(v_world);
      v_win := public.session_window(v_run.level, (v_wcfg ->> 'levels')::int, v_run.rung);
    end if;
    v_qid := public.pick_world_question(v_uid, v_world, v_win[1], v_win[2], v_ex);
    if v_qid is null and v_run.world = 'mix' then
      v_qid := public.pick_world_question(v_uid, 'geography', v_win[1], v_win[2], v_ex);
    end if;
    if v_qid is null then
      raise exception 'invalid_state: no questions available' using errcode = 'P0001';
    end if;
    insert into public.quiz_run_questions (run_id, rung, question_id, perm, deadline)
    values (p_run, v_run.rung, v_qid,
            (select array_agg(p::smallint order by random()) from generate_series(0, 3) p),
            now() + make_interval(secs => coalesce((v_cfg ->> 'seconds')::int, 20)));
    insert into public.seen_questions (user_id, question_id) values (v_uid, v_qid)
      on conflict (user_id, question_id) do update set seen_at = now();
  end if;
  return public.session_payload(p_run);
end $$;

create function public.session_start(p_world text, p_level integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_id  uuid;
  v_lvl integer := coalesce(p_level, 0);
begin
  perform public.check_rate_limit(v_uid, 'session_start', 80, 3600);
  if p_world is distinct from 'mix' then
    if public.world_cfg(p_world) is null then
      raise exception 'invalid_input: world' using errcode = '22023';
    end if;
    if v_lvl < 1 or v_lvl > public.world_unlocked(v_uid, p_world) then
      raise exception 'invalid_state: level locked' using errcode = 'P0001';
    end if;
  else
    v_lvl := 0;
  end if;
  perform public.energy_spend(v_uid);
  perform public.abandon_active_runs(v_uid);
  insert into public.quiz_runs (user_id, mode, world, level) values (v_uid, 'session', p_world, v_lvl)
  returning id into v_id;
  return public.session_next(v_id);
end $$;

create function public.session_answer(p_run uuid, p_rung integer, p_slot integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid     uuid := public.require_user();
  v_run     public.quiz_runs;
  v_rq      public.quiz_run_questions;
  v_cfg     jsonb := (select value from public.app_config where key = 'session');
  v_cslot   integer;
  v_q       public.questions;
  v_correct boolean;
  v_timeout boolean := false;
  v_pts     integer := 0;
  v_left    integer;
  v_summary jsonb;
  v_grace   constant interval := interval '3 seconds';
begin
  perform public.check_rate_limit(v_uid, 'session_answer', 90, 60);
  if p_slot is null or p_slot not between -1 and 3 then
    raise exception 'invalid_input: slot' using errcode = '22023';
  end if;
  v_run := public.session_lock_run(v_uid, p_run);
  if v_run.status <> 'active' or v_run.rung <> p_rung then
    raise exception 'invalid_state: not the current question' using errcode = 'P0001';
  end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = p_rung;
  if not found or v_rq.answered_slot is not null then
    raise exception 'invalid_state: question not open' using errcode = 'P0001';
  end if;
  if p_slot >= 0 and p_slot = any (v_rq.removed) then
    raise exception 'invalid_input: slot removed' using errcode = '22023';
  end if;
  if p_slot = -1 and now() <= v_rq.deadline then
    raise exception 'invalid_state: clock still running' using errcode = 'P0001';
  end if;

  select s.slot - 1 into v_cslot
    from unnest(v_rq.perm) with ordinality as s(pos, slot)
    join public.question_answers a on a.question_id = v_rq.question_id and a.position = s.pos and a.is_correct;
  select * into v_q from public.questions where id = v_rq.question_id;

  v_timeout := p_slot = -1 or now() > v_rq.deadline + v_grace;
  v_correct := not v_timeout and p_slot = v_cslot;
  if v_correct then
    v_left := greatest(0, ceil(extract(epoch from (v_rq.deadline - now()))))::int;
    v_pts := (v_cfg ->> 'points_base')::int
           + round(coalesce(v_q.ease_rank, 0.3) * (v_cfg ->> 'points_difficulty')::int)::int
           + v_left * (v_cfg ->> 'points_per_second')::int;
  end if;

  update public.quiz_run_questions
     set answered_slot = case when v_timeout then -1 else p_slot end, is_correct = v_correct, answered_at = now()
   where run_id = p_run and rung = p_rung;
  update public.quiz_runs
     set correct = correct + case when v_correct then 1 else 0 end,
         prize_points = prize_points + v_pts,
         rung = case when p_rung < (v_cfg ->> 'questions')::int then rung + 1 else rung end
   where id = p_run;

  if p_rung >= (v_cfg ->> 'questions')::int then
    v_summary := public.session_finish(p_run);
  end if;
  return jsonb_build_object(
    'result', case when v_timeout then 'timeout' when v_correct then 'correct' else 'wrong' end,
    'correct_slot', v_cslot, 'explanation', v_q.explanation_he, 'points', v_pts,
    'score', v_run.prize_points + v_pts, 'correct_count', v_run.correct + case when v_correct then 1 else 0 end,
    'summary', v_summary);
end $$;

/** 50:50 — the first one in a session is free, later ones cost coins. */
create function public.session_5050(p_run uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_run  public.quiz_runs;
  v_rq   public.quiz_run_questions;
  v_cfg  jsonb := (select value from public.app_config where key = 'session');
  v_cpos integer;
  v_rm   smallint[];
  v_used integer;
begin
  perform public.check_rate_limit(v_uid, 'session_5050', 30, 60);
  v_run := public.session_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then raise exception 'invalid_state: run finished' using errcode = 'P0001'; end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = v_run.rung;
  if not found or v_rq.answered_slot is not null or cardinality(v_rq.removed) > 0 or now() > v_rq.deadline then
    raise exception 'invalid_state: lifeline not available' using errcode = 'P0001';
  end if;
  v_used := (select count(*) from unnest(v_run.lifelines) l where l = '5050');
  if v_used >= 1 then
    perform public.ledger_apply(v_uid, 'coins', -((v_cfg ->> 'extra_5050_coins')::bigint), 'lifeline', 'quiz_run',
      p_run::text, 'session5050:' || p_run || ':' || v_run.rung);
  end if;
  select s.slot - 1 into v_cpos
    from unnest(v_rq.perm) with ordinality as s(pos, slot)
    join public.question_answers a on a.question_id = v_rq.question_id and a.position = s.pos and a.is_correct;
  select array_agg(x::smallint) into v_rm
    from (select x from generate_series(0, 3) x where x <> v_cpos order by random() limit 2) t;
  update public.quiz_run_questions set removed = v_rm where run_id = p_run and rung = v_run.rung;
  update public.quiz_runs set lifelines = lifelines || '5050'::text where id = p_run;
  return public.session_payload(p_run);
end $$;

/** The level path of every world: stars per played level and the unlocked level. */
create function public.worlds_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  return jsonb_build_object(
    'worlds', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'slug', w ->> 'slug',
               'unlocked', public.world_unlocked(v_uid, w ->> 'slug'),
               'stars', coalesce((select jsonb_object_agg(level, stars) from public.user_world_levels u
                                   where u.user_id = v_uid and u.world = w ->> 'slug'), '{}'::jsonb),
               'total_stars', coalesce((select sum(stars) from public.user_world_levels u
                                         where u.user_id = v_uid and u.world = w ->> 'slug'), 0)
             ) order by o), '[]'::jsonb)
        from public.app_config c, jsonb_array_elements(c.value) with ordinality as t(w, o)
       where c.key = 'worlds' and coalesce((w ->> 'active')::boolean, true)),
    'total_stars', coalesce((select sum(stars) from public.user_world_levels where user_id = v_uid), 0),
    'active_run', (select jsonb_build_object('run_id', id, 'world', world, 'level', level)
                     from public.quiz_runs where user_id = v_uid and status = 'active' and mode = 'session'
                      and started_at > now() - interval '30 minutes' limit 1));
end $$;

/** Resume an active session (e.g. after the app was closed). */
create function public.session_resume(p_run uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_user(); v_run public.quiz_runs;
begin
  v_run := public.session_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then raise exception 'invalid_state: run finished' using errcode = 'P0001'; end if;
  return public.session_next(p_run);
end $$;

revoke all on function public.session_start(text, integer), public.session_next(uuid), public.session_answer(uuid, integer, integer),
  public.session_5050(uuid), public.worlds_state(), public.session_resume(uuid) from public, anon;
grant execute on function public.session_start(text, integer), public.session_next(uuid), public.session_answer(uuid, integer, integer),
  public.session_5050(uuid), public.worlds_state(), public.session_resume(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Existing flows: one active run across all modes; packs; daily & match mix.
-- ---------------------------------------------------------------------------
create or replace function public.on_run_finished_pack() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'active' and new.status <> 'active' and new.mode <> 'session' then
    if new.mode = 'daily' then
      perform public.grant_pack_token(new.user_id, 'bronze', 1);
    elsif new.status = 'won' then
      perform public.grant_pack_token(new.user_id, 'gold', 1);
    elsif new.correct >= 8 then
      perform public.grant_pack_token(new.user_id, 'silver', 1);
    end if;
  end if;
  return new;
end $$;

do $$
declare d text;
begin
  -- quiz_start / daily_start: also end an active session before starting.
  foreach d in array array['public.quiz_start()', 'public.daily_start()'] loop
    d := pg_get_functiondef(d::regprocedure);
    d := replace(d, $x$  for v_old in select id from public.quiz_runs where user_id = v_uid and status = 'active' and mode = 'classic' for update loop$x$,
                    $x$  for v_old in select id from public.quiz_runs where user_id = v_uid and status = 'active' and mode = 'session' for update loop
    perform public.session_finish(v_old, true);
  end loop;
  for v_old in select id from public.quiz_runs where user_id = v_uid and status = 'active' and mode = 'classic' for update loop$x$);
    if position('session_finish' in d) = 0 then raise exception 'start patch failed'; end if;
    execute d;
  end loop;

  -- Daily challenge: one question per world (rotating), easy → hard.
  d := pg_get_functiondef('public.daily_questions(date)'::regprocedure);
  d := replace(d, 'q.is_israeli = v_isr', 'q.world = public.world_rotation(i, p_day::text)');
  if position('world_rotation' in d) = 0 then raise exception 'daily patch failed'; end if;
  execute d;

  -- Friend match: mixed worlds too.
  d := pg_get_functiondef('public.match_join(text)'::regprocedure);
  d := replace(d, 'q.is_israeli = (i not in (3, 6))', 'q.world = public.world_rotation(i, v_room.code)');
  if position('world_rotation' in d) = 0 then raise exception 'match patch failed'; end if;
  execute d;
end $$;
