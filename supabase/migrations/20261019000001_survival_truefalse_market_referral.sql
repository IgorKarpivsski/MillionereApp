-- =============================================================================
-- Four additions from the testers' round
--
--  * King of the hill (survival): endless questions that get harder, one mistake
--    ends the run (a single paid second chance). Weekly table, top 3 get prizes.
--  * True or false: 60 seconds of "question + suggested answer — true?".
--    A wrong tap costs 3 seconds, so guessing doesn't pay.
--  * Sticker market: post a duplicate and the sticker you want (same rarity).
--    Anyone holding that sticker twice swaps instantly with one tap.
--  * Friend brings friend: every player has a code / link. A new player who
--    joins with it gets a welcome gift; once they've played 3 games the inviter
--    gets a prize, and 3 / 5 / 10 friends unlock big goals.
-- =============================================================================

insert into public.app_config (key, value, is_public) values
  ('survival', '{"question_seconds": 15, "coins_per_correct": 2, "max_coins": 150, "xp_per_correct": 5, "revive_gems": 10,
                 "week_prizes": [{"coins": 800, "gems": 40}, {"coins": 500, "gems": 25}, {"coins": 300, "gems": 15}]}'::jsonb, true),
  ('truefalse', '{"seconds": 60, "penalty_seconds": 3, "coins_per_correct": 2, "max_coins": 60, "xp_per_correct": 3}'::jsonb, true),
  ('market', '{"max_open": 5, "days": 7}'::jsonb, true),
  ('referral', '{"qualify_games": 3, "max_age_days": 7,
                 "welcome": [{"kind": "coins", "amount": 300}, {"kind": "pack", "pack": "silver", "amount": 1}],
                 "per_friend": [{"kind": "coins", "amount": 300}, {"kind": "pack", "pack": "silver", "amount": 1}],
                 "goals": [
                   {"n": 3,  "rewards": [{"kind": "gems", "amount": 30}, {"kind": "pack", "pack": "gold", "amount": 1}]},
                   {"n": 5,  "rewards": [{"kind": "gems", "amount": 75}, {"kind": "pack", "pack": "legendary", "amount": 1}], "flair": true},
                   {"n": 10, "rewards": [{"kind": "gems", "amount": 200}, {"kind": "pack", "pack": "legendary", "amount": 2}, {"kind": "vip_days", "amount": 30}]}
                 ]}'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

-- ---------------------------------------------------------------------------
-- King of the hill
-- ---------------------------------------------------------------------------
create table public.survival_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  started_at  timestamptz not null default now(),
  q_deadline  timestamptz,
  correct     integer not null default 0,
  current_qid text,
  perm        jsonb,
  seen        text[] not null default '{}',
  status      text not null default 'active',
  revived     boolean not null default false,
  coins       integer,
  ended_at    timestamptz,
  constraint survival_status check (status in ('active', 'down', 'done'))
);
create index survival_runs_user on public.survival_runs (user_id, status);
create index survival_runs_week on public.survival_runs (started_at) where status = 'done';
alter table public.survival_runs enable row level security;
revoke all on public.survival_runs from anon, authenticated;

create table public.survival_week_awards (
  week    date primary key,
  winners jsonb not null default '[]'
);
alter table public.survival_week_awards enable row level security;
revoke all on public.survival_week_awards from anon, authenticated;

create function public.survival_best(p_user uuid, p_from timestamptz default '-infinity') returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(max(correct), 0) from public.survival_runs where user_id = p_user and status = 'done' and started_at >= p_from
$$;

/** Next question, a little harder every two answers (caller holds the lock). */
create function public.survival_pick(p_run uuid, p_delay numeric default 0) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_run public.survival_runs;
  v_win real[];
  v_qid text;
  v_sec integer := coalesce(((select value from public.app_config where key = 'survival') ->> 'question_seconds')::int, 15);
begin
  select * into v_run from public.survival_runs where id = p_run;
  v_win := public.session_window(0, 1, least(1 + v_run.correct / 2, 12));
  v_qid := public.pick_world_question(v_run.user_id, public.world_rotation(v_run.correct, p_run::text), v_win[1], v_win[2], v_run.seen);
  if v_qid is null then
    v_qid := public.pick_world_question(v_run.user_id, 'geography', 0, 1, v_run.seen);
  end if;
  if v_qid is null then raise exception 'invalid_state: no questions available' using errcode = 'P0001'; end if;
  update public.survival_runs
     set current_qid = v_qid, perm = public.mode_random_perm(), seen = seen || v_qid,
         q_deadline = now() + make_interval(secs => v_sec + p_delay)
   where id = p_run;
  insert into public.seen_questions (user_id, question_id) values (v_run.user_id, v_qid)
    on conflict (user_id, question_id) do update set seen_at = now();
end $$;

create function public.survival_close(p_run uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_run   public.survival_runs;
  v_cfg   jsonb := (select value from public.app_config where key = 'survival');
  v_coins integer;
  v_xp    integer;
begin
  select * into v_run from public.survival_runs where id = p_run;
  if v_run.status = 'done' then return; end if;
  v_coins := least(v_run.correct * coalesce((v_cfg ->> 'coins_per_correct')::int, 2), coalesce((v_cfg ->> 'max_coins')::int, 150));
  update public.survival_runs set status = 'done', coins = v_coins, current_qid = null, ended_at = now() where id = p_run;
  if v_coins > 0 then
    perform public.ledger_apply(v_run.user_id, 'coins', v_coins, 'survival', 'survival', p_run::text, 'survival:' || p_run::text);
  end if;
  if v_run.correct > 0 then
    v_xp := v_run.correct * coalesce((v_cfg ->> 'xp_per_correct')::int, 5);
    update public.profiles set xp = xp + v_xp, level = public.level_from_xp(xp + v_xp) where id = v_run.user_id;
  end if;
end $$;

create function public.survival_payload(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_run public.survival_runs;
  v_cfg jsonb := (select value from public.app_config where key = 'survival');
begin
  select * into v_run from public.survival_runs where id = p_run;
  return jsonb_build_object(
    'run_id', v_run.id, 'status', v_run.status, 'correct', v_run.correct,
    'seconds_left', case when v_run.status = 'active' then round(greatest(0, extract(epoch from v_run.q_deadline - now()))::numeric, 2) else 0 end,
    'question_seconds', coalesce((v_cfg ->> 'question_seconds')::int, 15),
    'best', public.survival_best(v_run.user_id),
    'week_best', public.survival_best(v_run.user_id, public.israel_week_start()),
    'can_revive', v_run.status = 'down' and not v_run.revived,
    'revive_gems', coalesce((v_cfg ->> 'revive_gems')::int, 10),
    'coins', v_run.coins,
    'question', case when v_run.status = 'active' and v_run.current_qid is not null
                     then public.mode_question_json(v_run.current_qid, v_run.perm) end);
end $$;

create function public.survival_start() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_id  uuid;
  r     record;
begin
  perform public.check_rate_limit(v_uid, 'survival_start', 40, 3600);
  for r in select id from public.survival_runs where user_id = v_uid and status <> 'done' for update loop
    perform public.survival_close(r.id);
  end loop;
  perform public.energy_spend(v_uid);
  insert into public.survival_runs (user_id) values (v_uid) returning id into v_id;
  -- "3-2-1" on the device before the first question
  perform public.survival_pick(v_id, 3);
  return public.survival_payload(v_id) || jsonb_build_object('countdown', 3);
end $$;

/** p_slot -1 = the time ran out on the device. */
create function public.survival_answer(p_run uuid, p_slot integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_run public.survival_runs;
  v_cs  integer;
  v_ok  boolean;
begin
  perform public.check_rate_limit(v_uid, 'survival_answer', 120, 60);
  if p_slot is null or p_slot not between -1 and 3 then raise exception 'invalid_input: slot' using errcode = '22023'; end if;
  select * into v_run from public.survival_runs where id = p_run and user_id = v_uid for update;
  if not found then raise exception 'invalid_input: run' using errcode = '22023'; end if;
  if v_run.status <> 'active' then return public.survival_payload(p_run) || jsonb_build_object('was_correct', null); end if;
  v_cs := public.mode_correct_slot(v_run.current_qid, v_run.perm);
  -- 1.5 s grace for the network
  v_ok := p_slot = v_cs and now() <= v_run.q_deadline + interval '1.5 seconds';
  if v_ok then
    update public.survival_runs set correct = correct + 1 where id = p_run;
    perform public.survival_pick(p_run, 1);  -- a beat to see the green answer
  else
    update public.survival_runs set status = 'down', current_qid = null where id = p_run;
  end if;
  return public.survival_payload(p_run) || jsonb_build_object('was_correct', v_ok, 'correct_slot', v_cs);
end $$;

/** One second chance per run, paid in gems. */
create function public.survival_revive(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_run  public.survival_runs;
  v_cost integer := coalesce(((select value from public.app_config where key = 'survival') ->> 'revive_gems')::int, 10);
begin
  perform public.check_rate_limit(v_uid, 'survival_revive', 20, 60);
  select * into v_run from public.survival_runs where id = p_run and user_id = v_uid for update;
  if not found then raise exception 'invalid_input: run' using errcode = '22023'; end if;
  if v_run.status <> 'down' or v_run.revived then raise exception 'invalid_state: cannot revive' using errcode = 'P0001'; end if;
  perform public.ledger_apply(v_uid, 'gems', -v_cost, 'survival_revive', 'survival', p_run::text, 'survival_revive:' || p_run::text);
  update public.survival_runs set status = 'active', revived = true where id = p_run;
  perform public.survival_pick(p_run, 1);
  return public.survival_payload(p_run);
end $$;

create function public.survival_finish(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_run  public.survival_runs;
  v_prev integer;
  v_wk   integer;
begin
  perform public.check_rate_limit(v_uid, 'survival_finish', 60, 60);
  select * into v_run from public.survival_runs where id = p_run and user_id = v_uid for update;
  if not found then raise exception 'invalid_input: run' using errcode = '22023'; end if;
  select coalesce(max(correct), 0) into v_prev from public.survival_runs where user_id = v_uid and status = 'done' and id <> p_run;
  select coalesce(max(correct), 0) into v_wk from public.survival_runs
   where user_id = v_uid and status = 'done' and id <> p_run and started_at >= public.israel_week_start();
  perform public.survival_close(p_run);
  select * into v_run from public.survival_runs where id = p_run;
  return public.survival_payload(p_run) || jsonb_build_object(
    'new_best', v_run.correct > v_prev and v_run.correct > 0, 'previous_best', v_prev,
    'new_week_best', v_run.correct > v_wk and v_run.correct > 0);
end $$;

/** Pays last week's top 3 once, the first time anyone looks after the week turns. */
create function public.survival_settle() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_to     timestamptz := public.israel_week_start();
  v_from   timestamptz := v_to - interval '7 days';
  v_week   date := (v_from at time zone 'Asia/Jerusalem')::date;
  v_prizes jsonb := (select value -> 'week_prizes' from public.app_config where key = 'survival');
  v_win    jsonb := '[]';
  r        record;
begin
  insert into public.survival_week_awards (week) values (v_week) on conflict do nothing;
  if not found then return; end if;
  for r in
    select t.user_id, t.best, row_number() over (order by t.best desc, t.at, t.user_id) as rank
      from (select user_id, max(correct) as best, min(ended_at) filter (where true) as at
              from public.survival_runs
             where status = 'done' and started_at >= v_from and started_at < v_to and correct > 0
             group by user_id) t
     order by t.best desc, t.at, t.user_id limit 3
  loop
    perform public.ledger_apply(r.user_id, 'coins', ((v_prizes -> (r.rank - 1)::int) ->> 'coins')::int, 'survival_prize', 'survival_week',
      v_week::text, 'survival_week:' || v_week || ':' || r.rank || ':c');
    perform public.ledger_apply(r.user_id, 'gems', ((v_prizes -> (r.rank - 1)::int) ->> 'gems')::int, 'survival_prize', 'survival_week',
      v_week::text, 'survival_week:' || v_week || ':' || r.rank || ':g');
    v_win := v_win || jsonb_build_array(jsonb_build_object('rank', r.rank, 'user_id', r.user_id, 'best', r.best));
  end loop;
  update public.survival_week_awards set winners = v_win where week = v_week;
end $$;

/** Intro screen: my bests, this week's table, prizes, when the week ends, last week's winners. */
create function public.survival_info() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_from timestamptz := public.israel_week_start();
  v_rows jsonb;
  v_me   jsonb;
  v_last jsonb;
begin
  perform public.check_rate_limit(v_uid, 'survival_info', 60, 60);
  perform public.survival_settle();
  with best as (
    select user_id, max(correct) as best, min(ended_at) as at from public.survival_runs
     where status = 'done' and started_at >= v_from and correct > 0 group by user_id),
  ranked as (select b.*, row_number() over (order by b.best desc, b.at, b.user_id) as rank from best b)
  select
    (select coalesce(jsonb_agg(jsonb_build_object('rank', k.rank, 'username', p.username, 'avatar_id', p.avatar_id, 'photo', p.photo_url,
              'frame', p.frame, 'level', p.level, 'points', k.best, 'me', k.user_id = v_uid) order by k.rank), '[]'::jsonb)
       from (select * from ranked order by rank limit 50) k join public.profiles p on p.id = k.user_id),
    (select jsonb_build_object('rank', k.rank, 'points', k.best) from ranked k where k.user_id = v_uid)
    into v_rows, v_me;
  select coalesce(jsonb_agg(jsonb_build_object('rank', (w ->> 'rank')::int, 'username', p.username, 'avatar_id', p.avatar_id,
           'photo', p.photo_url, 'points', (w ->> 'best')::int, 'me', p.id = v_uid) order by (w ->> 'rank')::int), '[]'::jsonb)
    into v_last
    from public.survival_week_awards a, jsonb_array_elements(a.winners) w join public.profiles p on p.id = (w ->> 'user_id')::uuid
   where a.week = (select max(week) from public.survival_week_awards);
  return jsonb_build_object(
    'best', public.survival_best(v_uid), 'week_best', public.survival_best(v_uid, v_from),
    'question_seconds', coalesce(((select value from public.app_config where key = 'survival') ->> 'question_seconds')::int, 15),
    'revive_gems', coalesce(((select value from public.app_config where key = 'survival') ->> 'revive_gems')::int, 10),
    'rows', v_rows, 'me', v_me, 'ends_at', v_from + interval '7 days',
    'prizes', (select value -> 'week_prizes' from public.app_config where key = 'survival'),
    'last_winners', coalesce(v_last, '[]'::jsonb));
end $$;

revoke all on function public.survival_best(uuid, timestamptz), public.survival_pick(uuid, numeric), public.survival_close(uuid),
  public.survival_payload(uuid), public.survival_start(), public.survival_answer(uuid, integer), public.survival_revive(uuid),
  public.survival_finish(uuid), public.survival_settle(), public.survival_info()
from public, anon, authenticated;
grant execute on function public.survival_start(), public.survival_answer(uuid, integer), public.survival_revive(uuid),
  public.survival_finish(uuid), public.survival_info()
to authenticated;

-- ---------------------------------------------------------------------------
-- True or false
-- ---------------------------------------------------------------------------
create table public.tf_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  started_at  timestamptz not null default now(),
  ends_at     timestamptz not null,
  correct     integer not null default 0,
  answered    integer not null default 0,
  current_qid text,
  shown_pos   integer,
  is_true     boolean,
  seen        text[] not null default '{}',
  status      text not null default 'active',
  coins       integer,
  constraint tf_status check (status in ('active', 'done'))
);
create index tf_runs_user on public.tf_runs (user_id, status, correct desc);
alter table public.tf_runs enable row level security;
revoke all on public.tf_runs from anon, authenticated;

create function public.tf_best(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(max(correct), 0) from public.tf_runs where user_id = p_user and status = 'done'
$$;

/** A question with one of its answers: half the time the right one. */
create function public.tf_pick(p_run uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_run  public.tf_runs;
  v_win  real[];
  v_qid  text;
  v_true boolean := random() < 0.5;
  v_pos  integer;
begin
  select * into v_run from public.tf_runs where id = p_run;
  -- easier questions than the other modes: it's about speed
  v_win := public.session_window(0, 1, least(1 + v_run.answered / 3, 8));
  v_qid := public.pick_world_question(v_run.user_id, public.world_rotation(v_run.answered, p_run::text), v_win[1], v_win[2], v_run.seen);
  if v_qid is null then
    v_qid := public.pick_world_question(v_run.user_id, 'geography', 0, 1, v_run.seen);
  end if;
  if v_qid is null then raise exception 'invalid_state: no questions available' using errcode = 'P0001'; end if;
  select position into v_pos from public.question_answers
   where question_id = v_qid and is_correct = v_true order by random() limit 1;
  update public.tf_runs set current_qid = v_qid, shown_pos = v_pos, is_true = v_true, seen = seen || v_qid where id = p_run;
  insert into public.seen_questions (user_id, question_id) values (v_run.user_id, v_qid)
    on conflict (user_id, question_id) do update set seen_at = now();
end $$;

create function public.tf_close(p_run uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_run   public.tf_runs;
  v_cfg   jsonb := (select value from public.app_config where key = 'truefalse');
  v_coins integer;
  v_xp    integer;
begin
  select * into v_run from public.tf_runs where id = p_run;
  if v_run.status <> 'active' then return; end if;
  v_coins := least(v_run.correct * coalesce((v_cfg ->> 'coins_per_correct')::int, 2), coalesce((v_cfg ->> 'max_coins')::int, 60));
  update public.tf_runs set status = 'done', coins = v_coins, current_qid = null where id = p_run;
  if v_coins > 0 then
    perform public.ledger_apply(v_run.user_id, 'coins', v_coins, 'truefalse', 'truefalse', p_run::text, 'truefalse:' || p_run::text);
  end if;
  if v_run.correct > 0 then
    v_xp := v_run.correct * coalesce((v_cfg ->> 'xp_per_correct')::int, 3);
    update public.profiles set xp = xp + v_xp, level = public.level_from_xp(xp + v_xp) where id = v_run.user_id;
  end if;
end $$;

create function public.tf_payload(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_run public.tf_runs;
begin
  select * into v_run from public.tf_runs where id = p_run;
  return jsonb_build_object(
    'run_id', v_run.id, 'status', v_run.status,
    'seconds_left', round(greatest(0, extract(epoch from v_run.ends_at - now()))::numeric, 2),
    'total_seconds', coalesce(((select value from public.app_config where key = 'truefalse') ->> 'seconds')::int, 60),
    'correct', v_run.correct, 'answered', v_run.answered,
    'best', public.tf_best(v_run.user_id), 'coins', v_run.coins,
    'question', case when v_run.status = 'active' and v_run.current_qid is not null then
      (select jsonb_build_object('id', q.id, 'text', q.text_he, 'image', q.image,
                'category_name', (select name_he from public.question_categories where slug = q.category),
                'claim', (select a.text_he from public.question_answers a where a.question_id = q.id and a.position = v_run.shown_pos))
         from public.questions q where q.id = v_run.current_qid) end);
end $$;

create function public.tf_start() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_sec integer := coalesce(((select value from public.app_config where key = 'truefalse') ->> 'seconds')::int, 60);
  v_id  uuid;
  r     record;
begin
  perform public.check_rate_limit(v_uid, 'tf_start', 40, 3600);
  for r in select id from public.tf_runs where user_id = v_uid and status = 'active' for update loop
    perform public.tf_close(r.id);
  end loop;
  perform public.energy_spend(v_uid);
  insert into public.tf_runs (user_id, started_at, ends_at)
  values (v_uid, now() + interval '3 seconds', now() + interval '3 seconds' + make_interval(secs => v_sec))
  returning id into v_id;
  perform public.tf_pick(v_id);
  return public.tf_payload(v_id) || jsonb_build_object('countdown', 3);
end $$;

create function public.tf_answer(p_run uuid, p_true boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_run public.tf_runs;
  v_ok  boolean;
  v_pen integer := coalesce(((select value from public.app_config where key = 'truefalse') ->> 'penalty_seconds')::int, 3);
begin
  perform public.check_rate_limit(v_uid, 'tf_answer', 300, 60);
  if p_true is null then raise exception 'invalid_input: answer' using errcode = '22023'; end if;
  select * into v_run from public.tf_runs where id = p_run and user_id = v_uid for update;
  if not found then raise exception 'invalid_input: run' using errcode = '22023'; end if;
  if v_run.status <> 'active' then return public.tf_payload(p_run) || jsonb_build_object('was_correct', null); end if;
  if now() < v_run.started_at - interval '0.5 seconds' then
    raise exception 'invalid_state: not started' using errcode = 'P0001';
  end if;
  if now() > v_run.ends_at + interval '1.5 seconds' then
    perform public.tf_close(p_run);
    return public.tf_payload(p_run) || jsonb_build_object('was_correct', null);
  end if;
  v_ok := p_true = v_run.is_true;
  update public.tf_runs
     set answered = answered + 1, correct = correct + (case when v_ok then 1 else 0 end),
         ends_at = case when v_ok then ends_at else ends_at - make_interval(secs => v_pen) end
   where id = p_run;
  if now() >= (select ends_at from public.tf_runs where id = p_run) then
    perform public.tf_close(p_run);
  else
    perform public.tf_pick(p_run);
  end if;
  return public.tf_payload(p_run) || jsonb_build_object('was_correct', v_ok, 'was_true', v_run.is_true,
    'right_answer', case when v_run.is_true then null else
      (select a.text_he from public.question_answers a where a.question_id = v_run.current_qid and a.is_correct limit 1) end);
end $$;

create function public.tf_finish(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_run  public.tf_runs;
  v_prev integer;
begin
  perform public.check_rate_limit(v_uid, 'tf_finish', 60, 60);
  select * into v_run from public.tf_runs where id = p_run and user_id = v_uid for update;
  if not found then raise exception 'invalid_input: run' using errcode = '22023'; end if;
  select coalesce(max(correct), 0) into v_prev from public.tf_runs where user_id = v_uid and status = 'done' and id <> p_run;
  if v_run.status = 'active' then
    if now() < v_run.ends_at - interval '1 second' then
      raise exception 'invalid_state: still running' using errcode = 'P0001';
    end if;
    perform public.tf_close(p_run);
  end if;
  select * into v_run from public.tf_runs where id = p_run;
  return public.tf_payload(p_run) || jsonb_build_object('new_best', v_run.correct > v_prev and v_run.correct > 0, 'previous_best', v_prev);
end $$;

create function public.tf_info() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('best', public.tf_best(public.require_user()),
    'seconds', coalesce(((select value from public.app_config where key = 'truefalse') ->> 'seconds')::int, 60),
    'penalty_seconds', coalesce(((select value from public.app_config where key = 'truefalse') ->> 'penalty_seconds')::int, 3))
$$;

revoke all on function public.tf_best(uuid), public.tf_pick(uuid), public.tf_close(uuid), public.tf_payload(uuid),
  public.tf_start(), public.tf_answer(uuid, boolean), public.tf_finish(uuid), public.tf_info()
from public, anon, authenticated;
grant execute on function public.tf_start(), public.tf_answer(uuid, boolean), public.tf_finish(uuid), public.tf_info()
to authenticated;

-- ---------------------------------------------------------------------------
-- Sticker market
-- ---------------------------------------------------------------------------
create table public.market_listings (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  give_item  text not null references public.collectibles (id),
  want_item  text not null references public.collectibles (id),
  status     text not null default 'open',
  taker      uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  done_at    timestamptz,
  seen       boolean not null default false,
  constraint market_status check (status in ('open', 'done', 'cancelled')),
  constraint market_distinct check (give_item <> want_item)
);
create index market_open on public.market_listings (created_at desc) where status = 'open';
create index market_user on public.market_listings (user_id, status);
alter table public.market_listings enable row level security;
revoke all on public.market_listings from anon, authenticated;

create function public.market_count(p_user uuid, p_item text) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce((select count from public.user_collectibles where user_id = p_user and item_id = p_item), 0)
$$;

create function public.market_row(p_id bigint, p_me uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', l.id, 'status', l.status, 'created_at', l.created_at, 'done_at', l.done_at,
    'give', jsonb_build_object('id', g.id, 'name', g.name_he, 'rarity', g.rarity),
    'want', jsonb_build_object('id', w.id, 'name', w.name_he, 'rarity', w.rarity),
    'mine', l.user_id = p_me,
    'owner', jsonb_build_object('username', p.username, 'avatar_id', p.avatar_id, 'photo', p.photo_url, 'level', p.level),
    'taker', (select tp.username from public.profiles tp where tp.id = l.taker),
    -- for the viewer: do I have their wanted sticker to spare, and do I still need what they give?
    'can_take', l.user_id <> p_me and public.market_count(p_me, l.want_item) >= 2,
    'i_need', public.market_count(p_me, l.give_item) = 0)
  from public.market_listings l, public.collectibles g, public.collectibles w, public.profiles p
  where l.id = p_id and g.id = l.give_item and w.id = l.want_item and p.id = l.user_id
$$;

create function public.market_state() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_days integer := coalesce(((select value from public.app_config where key = 'market') ->> 'days')::int, 7);
  v_all  jsonb;
  v_mine jsonb;
begin
  perform public.check_rate_limit(v_uid, 'market_state', 60, 60);
  update public.market_listings set status = 'cancelled'
   where status = 'open' and created_at < now() - make_interval(days => v_days);
  select coalesce(jsonb_agg(public.market_row(l.id, v_uid) order by
           (public.market_count(v_uid, l.want_item) >= 2 and public.market_count(v_uid, l.give_item) = 0) desc,
           (public.market_count(v_uid, l.give_item) = 0) desc, l.created_at desc), '[]'::jsonb)
    into v_all
    from (select * from public.market_listings m
           where m.status = 'open' and m.user_id <> v_uid
             and not public.is_blocked(v_uid, m.user_id)
           order by m.created_at desc limit 80) l;
  select coalesce(jsonb_agg(public.market_row(l.id, v_uid) order by l.status = 'open' desc, coalesce(l.done_at, l.created_at) desc), '[]'::jsonb)
    into v_mine
    from (select * from public.market_listings m
           where m.user_id = v_uid and (m.status = 'open' or (m.status = 'done' and m.done_at > now() - interval '14 days'))
           order by m.created_at desc limit 30) l;
  return jsonb_build_object('listings', v_all, 'mine', v_mine,
    'news', (select count(*) from public.market_listings where user_id = v_uid and status = 'done' and not seen),
    'max_open', coalesce(((select value from public.app_config where key = 'market') ->> 'max_open')::int, 5));
end $$;

create function public.market_create(p_give text, p_want text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_max integer := coalesce(((select value from public.app_config where key = 'market') ->> 'max_open')::int, 5);
  v_g   public.collectibles;
  v_w   public.collectibles;
begin
  perform public.check_rate_limit(v_uid, 'market_create', 20, 3600);
  select * into v_g from public.collectibles where id = p_give;
  select * into v_w from public.collectibles where id = p_want;
  if v_g.id is null or v_w.id is null or p_give = p_want then raise exception 'invalid_input: item' using errcode = '22023'; end if;
  if not v_g.active or not v_w.active or v_g.rarity = 'iconic' or v_w.rarity = 'iconic' then
    raise exception 'invalid_input: not tradable' using errcode = '22023';
  end if;
  if v_g.rarity <> v_w.rarity then raise exception 'invalid_input: rarity must match' using errcode = '22023'; end if;
  if public.market_count(v_uid, p_give) < 2 then raise exception 'invalid_input: not a duplicate' using errcode = '22023'; end if;
  if (select count(*) from public.market_listings where user_id = v_uid and status = 'open') >= v_max then
    raise exception 'invalid_state: too many listings' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.market_listings where user_id = v_uid and status = 'open' and give_item = p_give and want_item = p_want) then
    raise exception 'invalid_state: already listed' using errcode = 'P0001';
  end if;
  insert into public.market_listings (user_id, give_item, want_item) values (v_uid, p_give, p_want);
  return public.market_state();
end $$;

create function public.market_cancel(p_id bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  perform public.check_rate_limit(v_uid, 'market_cancel', 30, 60);
  update public.market_listings set status = 'cancelled' where id = p_id and user_id = v_uid and status = 'open';
  return public.market_state();
end $$;

/** Swap now: my spare copy of what they want ↔ their spare copy of what they give. */
create function public.market_take(p_id bigint) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_l   public.market_listings;
begin
  perform public.check_rate_limit(v_uid, 'market_take', 30, 3600);
  select * into v_l from public.market_listings where id = p_id for update;
  if not found or v_l.status <> 'open' then raise exception 'invalid_state: gone' using errcode = 'P0001'; end if;
  if v_l.user_id = v_uid then raise exception 'invalid_input: own listing' using errcode = '22023'; end if;
  if public.is_blocked(v_uid, v_l.user_id) then raise exception 'forbidden: blocked' using errcode = '42501'; end if;
  -- lock both rows of both players in a fixed order
  perform 1 from public.user_collectibles
   where (user_id, item_id) in ((v_l.user_id, v_l.give_item), (v_l.user_id, v_l.want_item), (v_uid, v_l.give_item), (v_uid, v_l.want_item))
   order by user_id, item_id for update;
  if public.market_count(v_l.user_id, v_l.give_item) < 2 then
    update public.market_listings set status = 'cancelled' where id = p_id;
    raise exception 'invalid_state: gone' using errcode = 'P0001';
  end if;
  if public.market_count(v_uid, v_l.want_item) < 2 then raise exception 'invalid_input: not a duplicate' using errcode = '22023'; end if;
  update public.user_collectibles set count = count - 1 where user_id = v_l.user_id and item_id = v_l.give_item;
  update public.user_collectibles set count = count - 1 where user_id = v_uid and item_id = v_l.want_item;
  insert into public.user_collectibles as u (user_id, item_id, count) values (v_l.user_id, v_l.want_item, 1)
    on conflict (user_id, item_id) do update set count = u.count + 1;
  insert into public.user_collectibles as u (user_id, item_id, count) values (v_uid, v_l.give_item, 1)
    on conflict (user_id, item_id) do update set count = u.count + 1;
  update public.market_listings set status = 'done', taker = v_uid, done_at = now() where id = p_id;
  return public.market_state() || jsonb_build_object('got', v_l.give_item);
end $$;

create function public.market_seen() returns void
language sql volatile security definer set search_path = '' as $$
  update public.market_listings set seen = true where user_id = public.require_user() and status = 'done' and not seen
$$;

revoke all on function public.market_count(uuid, text), public.market_row(bigint, uuid), public.market_state(),
  public.market_create(text, text), public.market_cancel(bigint), public.market_take(bigint), public.market_seen()
from public, anon, authenticated;
grant execute on function public.market_state(), public.market_create(text, text), public.market_cancel(bigint),
  public.market_take(bigint), public.market_seen()
to authenticated;

-- ---------------------------------------------------------------------------
-- Friend brings friend
-- ---------------------------------------------------------------------------
alter table public.profiles add column ref_code text;
create unique index profiles_ref_code on public.profiles (ref_code) where ref_code is not null;

create table public.referrals (
  referred     uuid primary key references auth.users (id) on delete cascade,
  referrer     uuid not null references auth.users (id) on delete cascade,
  created_at   timestamptz not null default now(),
  qualified_at timestamptz,
  constraint referrals_self check (referred <> referrer)
);
create index referrals_referrer on public.referrals (referrer);
alter table public.referrals enable row level security;
revoke all on public.referrals from anon, authenticated;

create table public.referral_goals_paid (
  user_id uuid not null references auth.users (id) on delete cascade,
  goal    integer not null,
  paid_at timestamptz not null default now(),
  primary key (user_id, goal)
);
alter table public.referral_goals_paid enable row level security;
revoke all on public.referral_goals_paid from anon, authenticated;

/** A short code without look-alike letters, made once per player. */
create function public.referral_code(p_user uuid) returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_code text := (select ref_code from public.profiles where id = p_user);
  v_abc  text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
  i      integer;
begin
  while v_code is null loop
    v_code := '';
    for i in 1 .. 6 loop v_code := v_code || substr(v_abc, 1 + floor(random() * length(v_abc))::int, 1); end loop;
    begin
      update public.profiles set ref_code = v_code where id = p_user;
    exception when unique_violation then v_code := null;
    end;
  end loop;
  return v_code;
end $$;

create function public.referral_games(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select ((select count(*) from public.quiz_runs where user_id = p_user and status <> 'active')
        + (select count(*) from public.blitz_runs where user_id = p_user and status = 'done')
        + (select count(*) from public.survival_runs where user_id = p_user and status = 'done')
        + (select count(*) from public.tf_runs where user_id = p_user and status = 'done'))::int
$$;

create function public.referral_grant(p_user uuid, p_rewards jsonb, p_key text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare r jsonb; i integer := 0;
begin
  for r in select * from jsonb_array_elements(p_rewards) loop
    i := i + 1;
    if r ->> 'kind' = 'vip_days' then
      insert into public.user_entitlements as e (user_id, vip_until) values (p_user, now() + make_interval(days => (r ->> 'amount')::int))
        on conflict (user_id) do update
          set vip_until = greatest(coalesce(e.vip_until, now()), now()) + make_interval(days => (r ->> 'amount')::int), updated_at = now();
    else
      perform public.grant_reward(p_user, r, p_key || ':' || i);
    end if;
  end loop;
end $$;

/** Pays the inviter for friends who've now played enough, and for goals reached. */
create function public.referral_settle(p_user uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_cfg  jsonb := (select value from public.app_config where key = 'referral');
  v_need integer := coalesce((v_cfg ->> 'qualify_games')::int, 3);
  v_n    integer;
  r      record;
  g      jsonb;
begin
  for r in select referred from public.referrals where referrer = p_user and qualified_at is null for update loop
    if public.referral_games(r.referred) >= v_need then
      update public.referrals set qualified_at = now() where referred = r.referred;
      perform public.referral_grant(p_user, v_cfg -> 'per_friend', 'ref_friend:' || r.referred);
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

create function public.referral_state() returns jsonb
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
                  'games', least(public.referral_games(r.referred), v_need), 'qualified', r.qualified_at is not null)
                  order by r.qualified_at is null, r.created_at desc), '[]'::jsonb)
                  from public.referrals r join public.profiles p on p.id = r.referred where r.referrer = v_uid),
    'per_friend', v_cfg -> 'per_friend',
    'welcome', v_cfg -> 'welcome',
    'goals', (select jsonb_agg(g || jsonb_build_object('reached', v_n >= (g ->> 'n')::int)) from jsonb_array_elements(v_cfg -> 'goals') g),
    'invited_by', v_by,
    'can_redeem', v_by is null
      and (select created_at from public.profiles where id = v_uid) > now() - make_interval(days => coalesce((v_cfg ->> 'max_age_days')::int, 7)));
end $$;

/** A new player enters a friend's code (or the app reads it from the store link). */
create function public.referral_redeem(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_cfg jsonb := (select value from public.app_config where key = 'referral');
  v_ref uuid;
begin
  perform public.check_rate_limit(v_uid, 'referral_redeem', 10, 3600);
  select id into v_ref from public.profiles where ref_code = upper(btrim(coalesce(p_code, '')));
  if v_ref is null then raise exception 'invalid_input: unknown code' using errcode = '22023'; end if;
  if v_ref = v_uid then raise exception 'invalid_input: own code' using errcode = '22023'; end if;
  if exists (select 1 from public.referrals where referred = v_uid) then raise exception 'invalid_state: already used' using errcode = 'P0001'; end if;
  if (select created_at from public.profiles where id = v_uid) <= now() - make_interval(days => coalesce((v_cfg ->> 'max_age_days')::int, 7)) then
    raise exception 'invalid_state: too late' using errcode = 'P0001';
  end if;
  -- no swapping codes back and forth
  if exists (select 1 from public.referrals where referred = v_ref and referrer = v_uid) then
    raise exception 'invalid_input: own code' using errcode = '22023';
  end if;
  insert into public.referrals (referred, referrer) values (v_uid, v_ref);
  perform public.referral_grant(v_uid, v_cfg -> 'welcome', 'ref_welcome:' || v_uid);
  return public.referral_state();
end $$;

revoke all on function public.referral_code(uuid), public.referral_games(uuid), public.referral_grant(uuid, jsonb, text),
  public.referral_settle(uuid), public.referral_state(), public.referral_redeem(text)
from public, anon, authenticated;
grant execute on function public.referral_state(), public.referral_redeem(text) to authenticated;

-- The ambassador frame and title, unlocked by 5 friends who joined and played.
do $$
declare
  v_def text := pg_get_functiondef('public.flair_options(uuid)'::regprocedure);
begin
  if position('ambassador' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$jsonb_build_object('key', 'rainbow', 'need', 6, 'unlocked', coalesce(v_all, false)));$a$,
    $a$jsonb_build_object('key', 'rainbow', 'need', 6, 'unlocked', coalesce(v_all, false)),
    jsonb_build_object('key', 'ambassador', 'need', 5, 'unlocked',
      (select count(*) from public.referrals where referrer = p_uid and qualified_at is not null) >= 5));$a$);
  v_def := replace(v_def,
    $a$('streak', 'מתמיד'), ('blitz', 'זריז כמו ברק'), ('stickers', 'אספן מדבקות')) t(k, title)$a$,
    $a$('streak', 'מתמיד'), ('blitz', 'זריז כמו ברק'), ('stickers', 'אספן מדבקות')) t(k, title)
    union all
    select jsonb_build_object('text', case when v_g = 'female' then 'שגרירת האלוף' else 'שגריר האלוף' end,
             'unlocked', (select count(*) from public.referrals where referrer = p_uid and qualified_at is not null) >= 5, 'badge', 'ambassador')$a$);
  if position('ambassador' in v_def) = 0 or position('שגריר האלוף' in v_def) = 0 then
    raise exception 'flair_options patch did not apply';
  end if;
  execute v_def;
end $$;
