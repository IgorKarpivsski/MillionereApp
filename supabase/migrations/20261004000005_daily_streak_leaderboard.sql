-- =============================================================================
-- Migration 0006 — Daily challenge, streaks, weekly leaderboard.
--
-- Daily challenge: the same 10 questions for everyone on an Israel calendar
-- day (8 Israeli + 2 world, easy → harder). One attempt per day; a wrong
-- answer doesn't end it. Each correct answer is a goal; coins scale with the
-- streak (+10% per consecutive day, up to ×2).
-- Leaderboard: prize points of runs finished this week (Sunday–Saturday, Israel).
-- =============================================================================

alter table public.quiz_runs drop constraint quiz_runs_mode;
alter table public.quiz_runs add constraint quiz_runs_mode check (mode in ('classic', 'daily'));
alter table public.quiz_runs add column day date;
create unique index quiz_runs_daily_once on public.quiz_runs (user_id, day) where mode = 'daily';
create index quiz_runs_week_idx on public.quiz_runs (ended_at) where status <> 'active';

create table public.daily_challenges (
  day          date primary key,
  question_ids text[] not null,
  created_at   timestamptz not null default now(),
  constraint daily_ten check (cardinality(question_ids) = 10)
);

create table public.user_streaks (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  current    integer not null default 0,
  best       integer not null default 0,
  last_day   date,
  updated_at timestamptz not null default now()
);

alter table public.daily_challenges enable row level security;
alter table public.user_streaks enable row level security;
create policy user_streaks_read_own on public.user_streaks for select to authenticated using (user_id = (select auth.uid()));
revoke all on public.daily_challenges from anon, authenticated;
revoke insert, update, delete, truncate on public.user_streaks from anon, authenticated;

insert into public.app_config (key, value, is_public) values
  ('daily.coins_per_correct', '15'::jsonb, true),
  ('daily.points_per_correct', '500'::jsonb, true),
  ('daily.windows', '[[0,0.10],[0,0.15],[0.05,0.25],[0.10,0.30],[0.15,0.40],[0.20,0.45],[0.30,0.55],[0.35,0.60],[0.45,0.70],[0.50,0.80]]'::jsonb, true)
on conflict (key) do nothing;

create function public.israel_today() returns date
language sql stable set search_path = '' as $$ select (now() at time zone 'Asia/Jerusalem')::date $$;

create function public.israel_week_start() returns timestamptz
language sql stable set search_path = '' as $$
  -- Sunday 00:00 Israel time of the current week.
  select ((public.israel_today() - extract(dow from public.israel_today())::int)::timestamp) at time zone 'Asia/Jerusalem'
$$;

/** Classic-only lock: daily runs can't be driven through the classic RPCs. */
create or replace function public.quiz_lock_run(p_user uuid, p_run uuid) returns public.quiz_runs
language plpgsql volatile security definer set search_path = '' as $$
declare v_run public.quiz_runs;
begin
  select * into v_run from public.quiz_runs where id = p_run and user_id = p_user and mode = 'classic' for update;
  if not found then
    raise exception 'invalid_input: run' using errcode = '22023';
  end if;
  return v_run;
end $$;

-- -----------------------------------------------------------------------------
-- Daily
-- -----------------------------------------------------------------------------

/** Builds (once) the day's 10 questions. */
create function public.daily_questions(p_day date) returns text[]
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ids  text[];
  v_win  jsonb;
  v_id   text;
  v_isr  boolean;
  i      integer;
  v_pad  real;
begin
  select question_ids into v_ids from public.daily_challenges where day = p_day;
  if found then return v_ids; end if;
  perform pg_advisory_xact_lock(hashtext('daily:' || p_day::text));
  select question_ids into v_ids from public.daily_challenges where day = p_day;
  if found then return v_ids; end if;

  select value into v_win from public.app_config where key = 'daily.windows';
  v_ids := '{}';
  for i in 1 .. 10 loop
    v_isr := i not in (4, 7);
    v_id := null;
    v_pad := 0;
    while v_id is null and v_pad <= 0.5 loop
      select q.id into v_id from public.questions q
       where q.status = 'active' and q.is_israeli = v_isr and not q.volatile
         and q.ease_rank between (v_win -> (i - 1) ->> 0)::real - v_pad and (v_win -> (i - 1) ->> 1)::real + v_pad
         and not (q.id = any (v_ids))
         and not exists (select 1 from public.daily_challenges d where d.day > p_day - 90 and q.id = any (d.question_ids))
       order by hashtext(q.id || p_day::text) limit 1;
      v_pad := v_pad + 0.1;
    end loop;
    if v_id is null then
      select q.id into v_id from public.questions q
       where q.status = 'active' and not (q.id = any (v_ids)) order by random() limit 1;
    end if;
    v_ids := v_ids || v_id;
  end loop;
  insert into public.daily_challenges (day, question_ids) values (p_day, v_ids);
  return v_ids;
end $$;

create function public.daily_lock_run(p_user uuid, p_run uuid) returns public.quiz_runs
language plpgsql volatile security definer set search_path = '' as $$
declare v_run public.quiz_runs;
begin
  select * into v_run from public.quiz_runs where id = p_run and user_id = p_user and mode = 'daily' for update;
  if not found then
    raise exception 'invalid_input: run' using errcode = '22023';
  end if;
  return v_run;
end $$;

/** Serves the current daily question (idempotent). */
create function public.daily_serve(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_run  public.quiz_runs;
  v_ids  text[];
  v_secs integer;
begin
  select * into v_run from public.quiz_runs where id = p_run;
  if not exists (select 1 from public.quiz_run_questions where run_id = p_run and rung = v_run.rung) then
    v_ids := public.daily_questions(v_run.day);
    select (value #>> '{}')::int into v_secs from public.app_config where key = 'quiz.seconds_per_question';
    insert into public.quiz_run_questions (run_id, rung, question_id, perm, deadline)
    values (p_run, v_run.rung, v_ids[v_run.rung],
            (select array_agg(p::smallint order by random()) from generate_series(0, 3) p),
            now() + make_interval(secs => coalesce(v_secs, 30)));
    insert into public.seen_questions (user_id, question_id) values (v_run.user_id, v_ids[v_run.rung])
      on conflict (user_id, question_id) do update set seen_at = now();
  end if;
  return public.quiz_payload(p_run) || jsonb_build_object('mode', 'daily', 'total', 10);
end $$;

/** Ends the daily: pays coins (streak bonus), updates the streak and XP. */
create function public.daily_finish(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_run    public.quiz_runs;
  v_st     public.user_streaks;
  v_cur    integer;
  v_mult   numeric;
  v_coins  integer;
  v_points integer;
  v_xp     integer;
  v_old    integer;
  v_lvl    integer;
  v_bal    bigint;
begin
  select * into v_run from public.quiz_runs where id = p_run;
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run already finished' using errcode = 'P0001';
  end if;

  insert into public.user_streaks (user_id) values (v_run.user_id) on conflict (user_id) do nothing;
  select * into v_st from public.user_streaks where user_id = v_run.user_id for update;
  v_cur := case when v_st.last_day = v_run.day then v_st.current
                when v_st.last_day = v_run.day - 1 then v_st.current + 1
                else 1 end;
  update public.user_streaks set current = v_cur, best = greatest(best, v_cur), last_day = v_run.day, updated_at = now()
   where user_id = v_run.user_id;

  v_mult := least(2.0, 1 + 0.1 * (v_cur - 1));
  v_coins := floor(v_run.correct * coalesce((select (value #>> '{}')::int from public.app_config where key = 'daily.coins_per_correct'), 15) * v_mult);
  v_points := v_run.correct * coalesce((select (value #>> '{}')::int from public.app_config where key = 'daily.points_per_correct'), 500);
  v_xp := v_run.correct * 10 + 20;

  if v_coins > 0 then
    perform public.ledger_apply(v_run.user_id, 'coins', v_coins, 'daily_challenge', 'quiz_run', v_run.id::text, 'daily:' || v_run.id::text);
  end if;
  select level into v_old from public.profiles where id = v_run.user_id;
  update public.profiles set xp = xp + v_xp, level = public.level_from_xp(xp + v_xp)
   where id = v_run.user_id returning level into v_lvl;
  update public.quiz_runs set status = 'won', ended_at = now(), coins_awarded = v_coins, prize_points = v_points, xp_awarded = v_xp
   where id = p_run;
  select coins into v_bal from public.wallets where user_id = v_run.user_id;

  return jsonb_build_object('status', 'won', 'correct', v_run.correct, 'coins', v_coins, 'prize_points', v_points,
    'xp', v_xp, 'level', v_lvl, 'leveled_up', v_lvl > coalesce(v_old, 1), 'balance', v_bal,
    'streak', v_cur, 'streak_best', greatest(v_st.best, v_cur), 'mode', 'daily', 'total', 10);
end $$;

create function public.daily_status() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_day date := public.israel_today();
  v_run public.quiz_runs;
  v_st  public.user_streaks;
begin
  select * into v_run from public.quiz_runs where user_id = v_uid and mode = 'daily' and day = v_day;
  select * into v_st from public.user_streaks where user_id = v_uid;
  return jsonb_build_object(
    'day', v_day,
    'state', case when v_run.id is null then 'open' when v_run.status = 'active' then 'in_progress' else 'done' end,
    'correct', v_run.correct,
    'coins', v_run.coins_awarded,
    'streak', case when v_st.last_day >= v_day - 1 then v_st.current else 0 end,
    'streak_best', coalesce(v_st.best, 0),
    'seconds_to_reset', extract(epoch from ((v_day + 1)::timestamp at time zone 'Asia/Jerusalem') - now())::int);
end $$;

create function public.daily_start() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_day date := public.israel_today();
  v_run public.quiz_runs;
  v_old uuid;
begin
  perform public.check_rate_limit(v_uid, 'daily_start', 30, 3600);
  select * into v_run from public.quiz_runs where user_id = v_uid and mode = 'daily' and day = v_day for update;
  if found then
    if v_run.status <> 'active' then
      raise exception 'invalid_state: daily already played' using errcode = 'P0001';
    end if;
    return public.daily_serve(v_run.id);
  end if;
  -- Only one active run at a time: an open classic run is closed by checkpoint rules,
  -- an unfinished daily from an earlier day is scored as it stands.
  for v_old in select id from public.quiz_runs where user_id = v_uid and status = 'active' and mode = 'classic' for update loop
    perform public.quiz_finish(v_old, 'abandoned');
  end loop;
  for v_old in select id from public.quiz_runs where user_id = v_uid and status = 'active' and mode = 'daily' for update loop
    perform public.daily_finish(v_old);
  end loop;
  insert into public.quiz_runs (user_id, mode, day) values (v_uid, 'daily', v_day) returning * into v_run;
  return public.daily_serve(v_run.id);
end $$;

create function public.daily_next(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_run public.quiz_runs;
begin
  perform public.check_rate_limit(v_uid, 'daily_next', 60, 60);
  v_run := public.daily_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run finished' using errcode = 'P0001';
  end if;
  return public.daily_serve(p_run);
end $$;

/** Shared by answer and timeout: records the result, advances, finishes after 10. */
create function public.daily_record(p_run uuid, p_slot integer, p_timeout boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_run     public.quiz_runs;
  v_rq      public.quiz_run_questions;
  v_cslot   integer;
  v_expl    text;
  v_correct boolean;
  v_summary jsonb;
begin
  select * into v_run from public.quiz_runs where id = p_run;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = v_run.rung;
  select s.slot - 1 into v_cslot
    from unnest(v_rq.perm) with ordinality as s(pos, slot)
    join public.question_answers a on a.question_id = v_rq.question_id and a.position = s.pos and a.is_correct;
  select explanation_he into v_expl from public.questions where id = v_rq.question_id;
  v_correct := not p_timeout and p_slot = v_cslot;
  update public.quiz_run_questions set answered_slot = case when p_timeout then -1 else p_slot end,
         is_correct = v_correct, answered_at = now()
   where run_id = p_run and rung = v_run.rung;
  if v_correct then
    update public.quiz_runs set correct = correct + 1 where id = p_run;
  end if;
  if v_run.rung >= 10 then
    v_summary := public.daily_finish(p_run);
  else
    update public.quiz_runs set rung = rung + 1 where id = p_run;
  end if;
  return jsonb_build_object(
    'result', case when p_timeout then 'timeout' when v_correct then 'correct' else 'wrong' end,
    'correct_slot', v_cslot, 'explanation', v_expl, 'summary', v_summary);
end $$;

create function public.daily_answer(p_run uuid, p_rung integer, p_slot integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_run public.quiz_runs;
  v_rq  public.quiz_run_questions;
begin
  perform public.check_rate_limit(v_uid, 'daily_answer', 60, 60);
  if p_slot is null or p_slot not between 0 and 3 then
    raise exception 'invalid_input: slot' using errcode = '22023';
  end if;
  v_run := public.daily_lock_run(v_uid, p_run);
  if v_run.status <> 'active' or v_run.rung <> p_rung then
    raise exception 'invalid_state: not the current question' using errcode = 'P0001';
  end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = p_rung;
  if not found or v_rq.answered_slot is not null then
    raise exception 'invalid_state: question not open' using errcode = 'P0001';
  end if;
  return public.daily_record(p_run, p_slot, now() > v_rq.deadline + interval '3 seconds');
end $$;

create function public.daily_timeout(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_run public.quiz_runs;
  v_rq  public.quiz_run_questions;
begin
  perform public.check_rate_limit(v_uid, 'daily_timeout', 30, 60);
  v_run := public.daily_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run finished' using errcode = 'P0001';
  end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = v_run.rung;
  if not found or v_rq.answered_slot is not null or now() <= v_rq.deadline then
    raise exception 'invalid_state: clock still running' using errcode = 'P0001';
  end if;
  return public.daily_record(p_run, null, true);
end $$;

-- Starting a classic run now also closes an open daily (scored as it stands).
create or replace function public.quiz_start() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_old uuid;
  v_id  uuid;
begin
  perform public.check_rate_limit(v_uid, 'quiz_start', 60, 3600);
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
-- Leaderboard
-- -----------------------------------------------------------------------------
create function public.leaderboard_week(p_limit integer default 50) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_from  timestamptz := public.israel_week_start();
  v_rows  jsonb;
  v_me    jsonb;
begin
  with totals as (
    select r.user_id, sum(r.prize_points)::bigint as points, count(*) as games
      from public.quiz_runs r
     where r.ended_at >= v_from and r.status <> 'active'
     group by r.user_id
     having sum(r.prize_points) > 0),
  ranked as (
    select t.*, rank() over (order by t.points desc) as rank from totals t)
  select
    (select coalesce(jsonb_agg(jsonb_build_object('rank', k.rank, 'username', p.username, 'avatar_id', p.avatar_id,
              'level', p.level, 'points', k.points, 'me', k.user_id = v_uid) order by k.rank, p.username), '[]'::jsonb)
       from (select * from ranked order by rank limit least(greatest(coalesce(p_limit, 50), 1), 100)) k
       join public.profiles p on p.id = k.user_id),
    (select jsonb_build_object('rank', k.rank, 'points', k.points, 'games', k.games) from ranked k where k.user_id = v_uid)
    into v_rows, v_me;
  return jsonb_build_object('week_start', v_from, 'rows', v_rows,
    'me', coalesce(v_me, jsonb_build_object('rank', null, 'points', 0, 'games', 0)));
end $$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke execute on function
  public.israel_today(), public.israel_week_start(),
  public.quiz_lock_run(uuid, uuid), public.daily_lock_run(uuid, uuid),
  public.daily_questions(date), public.daily_serve(uuid), public.daily_finish(uuid),
  public.daily_record(uuid, integer, boolean),
  public.daily_status(), public.daily_start(), public.daily_next(uuid),
  public.daily_answer(uuid, integer, integer), public.daily_timeout(uuid),
  public.quiz_start(), public.leaderboard_week(integer)
from public, anon, authenticated;

grant execute on function
  public.daily_status(), public.daily_start(), public.daily_next(uuid),
  public.daily_answer(uuid, integer, integer), public.daily_timeout(uuid),
  public.quiz_start(), public.leaderboard_week(integer)
to authenticated;
