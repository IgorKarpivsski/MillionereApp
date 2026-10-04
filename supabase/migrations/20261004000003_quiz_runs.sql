-- =============================================================================
-- Migration 0004 — The classic quiz run ("אתה מול האלוף").
--
-- Server-authoritative: the client never sees which answer is correct until it
-- has answered. Each served question gets a random slot order (perm) stored
-- here, so even the canonical answer positions never leave the server.
--
-- Flow:  quiz_start → quiz_next → (quiz_lifeline)* → quiz_answer → quiz_next …
--        quiz_cash_out at any time while the run is active.
-- Coins are paid once per run through ledger_apply (idempotency key per run).
-- =============================================================================

create type public.quiz_run_status as enum
  ('active', 'won', 'lost', 'cashed_out', 'timed_out', 'abandoned');

create table public.quiz_runs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users (id) on delete cascade,
  mode          text not null default 'classic',
  status        public.quiz_run_status not null default 'active',
  rung          smallint not null default 1,      -- the rung being played (1..12)
  correct       smallint not null default 0,      -- answered correctly so far
  lifelines     text[] not null default '{}',     -- used this run
  coins_awarded integer not null default 0,
  prize_points  integer not null default 0,
  xp_awarded    integer not null default 0,
  started_at    timestamptz not null default now(),
  ended_at      timestamptz,
  constraint quiz_runs_mode check (mode in ('classic')),
  constraint quiz_runs_rung check (rung between 1 and 12),
  constraint quiz_runs_correct check (correct between 0 and 12)
);
create unique index quiz_runs_one_active on public.quiz_runs (user_id) where status = 'active';
create index quiz_runs_user_idx on public.quiz_runs (user_id, started_at desc);

create table public.quiz_run_questions (
  run_id        uuid not null references public.quiz_runs (id) on delete cascade,
  rung          smallint not null,
  question_id   text not null references public.questions (id),
  perm          smallint[] not null,               -- perm[slot + 1] = canonical answer position
  served_at     timestamptz not null default now(),
  deadline      timestamptz not null,
  removed       smallint[] not null default '{}',  -- slots hidden by 50:50
  wrong_slots   smallint[] not null default '{}',  -- slots overturned by VAR
  var_armed     boolean not null default false,
  hints         jsonb not null default '{}'::jsonb, -- lifeline results, for resume
  answered_slot smallint,
  is_correct    boolean,
  answered_at   timestamptz,
  primary key (run_id, rung),
  constraint quiz_rq_perm check (cardinality(perm) = 4)
);

create table public.seen_questions (
  user_id     uuid not null references auth.users (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  seen_at     timestamptz not null default now(),
  primary key (user_id, question_id)
);

create table public.question_reports (
  user_id     uuid not null references auth.users (id) on delete cascade,
  question_id text not null references public.questions (id) on delete cascade,
  reason      text not null,
  created_at  timestamptz not null default now(),
  primary key (user_id, question_id),
  constraint question_reports_reason check (reason in ('wrong_answer', 'typo', 'unclear', 'other'))
);

alter table public.quiz_runs enable row level security;
alter table public.quiz_run_questions enable row level security;
alter table public.seen_questions enable row level security;
alter table public.question_reports enable row level security;

-- Players may read their own run history; everything else goes through RPCs.
create policy quiz_runs_read_own on public.quiz_runs
  for select to authenticated using (user_id = (select auth.uid()));

revoke all on public.quiz_run_questions, public.seen_questions, public.question_reports from anon, authenticated;
revoke insert, update, truncate on public.quiz_runs from anon, authenticated;
revoke all on public.quiz_runs from anon;

-- Config (server is the source of truth; mirrors packages/economy-config LADDER).
insert into public.app_config (key, value, is_public) values
  ('quiz.seconds_per_question', '30'::jsonb, true),
  ('quiz.report_review_threshold', '5'::jsonb, false),
  ('quiz.ladder', '[
     {"rung":1,"difficulty":"easy","points":100,"coins":10,"checkpoint":false},
     {"rung":2,"difficulty":"easy","points":250,"coins":20,"checkpoint":false},
     {"rung":3,"difficulty":"easy","points":500,"coins":35,"checkpoint":false},
     {"rung":4,"difficulty":"medium","points":1000,"coins":60,"checkpoint":true},
     {"rung":5,"difficulty":"medium","points":2500,"coins":90,"checkpoint":false},
     {"rung":6,"difficulty":"medium","points":5000,"coins":130,"checkpoint":false},
     {"rung":7,"difficulty":"hard","points":10000,"coins":180,"checkpoint":false},
     {"rung":8,"difficulty":"hard","points":25000,"coins":250,"checkpoint":true},
     {"rung":9,"difficulty":"hard","points":50000,"coins":350,"checkpoint":false},
     {"rung":10,"difficulty":"expert","points":100000,"coins":500,"checkpoint":false},
     {"rung":11,"difficulty":"expert","points":250000,"coins":700,"checkpoint":false},
     {"rung":12,"difficulty":"legendary","points":500000,"coins":1000,"checkpoint":false}
   ]'::jsonb, true)
on conflict (key) do nothing;

-- -----------------------------------------------------------------------------
-- Internal helpers
-- -----------------------------------------------------------------------------

create function public.level_from_xp(p_xp bigint) returns integer
language plpgsql immutable set search_path = '' as $$
declare
  l    integer := 1;
  rem  bigint := greatest(p_xp, 0);
  need bigint;
begin
  loop
    need := round(100 * power(l::numeric, 1.5) + 50 * l);
    exit when rem < need;
    rem := rem - need;
    l := l + 1;
  end loop;
  return l;
end $$;

create function public.quiz_ladder_rung(p_rung integer) returns jsonb
language sql stable set search_path = '' as $$
  select r from public.app_config c, jsonb_array_elements(c.value) r
   where c.key = 'quiz.ladder' and (r ->> 'rung')::int = p_rung
$$;

/** Picks an unseen active question of the rung's difficulty (falls back to seen ones). */
create function public.quiz_pick_question(p_user uuid, p_run uuid, p_difficulty public.question_difficulty)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id   text;
  v_prev text;
begin
  -- Avoid two questions in a row from the same category.
  select q.category into v_prev
    from public.quiz_run_questions rq join public.questions q on q.id = rq.question_id
   where rq.run_id = p_run order by rq.rung desc limit 1;

  select q.id into v_id from public.questions q
   where q.status = 'active' and q.difficulty = p_difficulty
     and q.category is distinct from v_prev
     and not exists (select 1 from public.seen_questions s where s.user_id = p_user and s.question_id = q.id)
   order by random() limit 1;
  if v_id is null then
    select q.id into v_id from public.questions q
     where q.status = 'active' and q.difficulty = p_difficulty
       and not exists (select 1 from public.quiz_run_questions rq where rq.run_id = p_run and rq.question_id = q.id)
     order by random() limit 1;
  end if;
  if v_id is null then
    raise exception 'invalid_state: no questions available' using errcode = 'P0001';
  end if;
  return v_id;
end $$;

/** The client-safe view of the run's current question. Never includes correctness. */
create function public.quiz_payload(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_run public.quiz_runs;
  v_rq  public.quiz_run_questions;
  v_q   public.questions;
  v_answers jsonb;
begin
  select * into v_run from public.quiz_runs where id = p_run;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = v_run.rung;
  if not found then
    return jsonb_build_object('run_id', v_run.id, 'status', v_run.status, 'rung', v_run.rung,
      'correct', v_run.correct, 'lifelines_used', to_jsonb(v_run.lifelines), 'question', null);
  end if;
  select * into v_q from public.questions where id = v_rq.question_id;
  select jsonb_agg(jsonb_build_object('slot', s.slot, 'text', a.text_he) order by s.slot) into v_answers
    from generate_series(0, 3) as s(slot)
    join public.question_answers a on a.question_id = v_q.id and a.position = v_rq.perm[s.slot + 1];

  return jsonb_build_object(
    'run_id', v_run.id,
    'status', v_run.status,
    'rung', v_run.rung,
    'correct', v_run.correct,
    'lifelines_used', to_jsonb(v_run.lifelines),
    'question', jsonb_build_object(
      'id', v_q.id,
      'text', v_q.text_he,
      'category', v_q.category,
      'category_name', (select name_he from public.question_categories where slug = v_q.category),
      'difficulty', v_q.difficulty,
      'answers', v_answers,
      'removed', to_jsonb(v_rq.removed),
      'wrong_slots', to_jsonb(v_rq.wrong_slots),
      'var_armed', v_rq.var_armed,
      'hints', v_rq.hints,
      'answered', v_rq.answered_slot is not null,
      'seconds_left', greatest(0, ceil(extract(epoch from (v_rq.deadline - now()))))::int
    )
  );
end $$;

/** Ends a run, pays coins once, adds XP. Returns the summary. Caller holds the run lock. */
create function public.quiz_finish(p_run uuid, p_status public.quiz_run_status) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_run     public.quiz_runs;
  v_paid    integer := 0;
  v_points  integer := 0;
  v_xp      integer;
  v_rung    jsonb;
  v_old_lvl integer;
  v_new_lvl integer;
  v_new_xp  bigint;
  v_balance bigint;
begin
  select * into v_run from public.quiz_runs where id = p_run;
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run already finished' using errcode = 'P0001';
  end if;

  if v_run.correct > 0 then
    if p_status in ('won', 'cashed_out') then
      v_rung := public.quiz_ladder_rung(v_run.correct);
    else
      -- Wrong answer / timeout / abandon: fall back to the last checkpoint reached.
      select r into v_rung from public.app_config c, jsonb_array_elements(c.value) r
       where c.key = 'quiz.ladder' and (r ->> 'checkpoint')::boolean
         and (r ->> 'rung')::int <= v_run.correct
       order by (r ->> 'rung')::int desc limit 1;
    end if;
    v_paid   := coalesce((v_rung ->> 'coins')::int, 0);
    v_points := coalesce((v_rung ->> 'points')::int, 0);
  end if;

  v_xp := v_run.correct * 10 + case when p_status = 'won' then 50 else 0 end;

  if v_paid > 0 then
    perform public.ledger_apply(v_run.user_id, 'coins', v_paid, 'quiz_run', 'quiz_run',
      v_run.id::text, 'quiz_run:' || v_run.id::text);
  end if;

  select level into v_old_lvl from public.profiles where id = v_run.user_id;
  update public.profiles
     set xp = xp + v_xp, level = public.level_from_xp(xp + v_xp)
   where id = v_run.user_id
   returning xp, level into v_new_xp, v_new_lvl;

  update public.quiz_runs
     set status = p_status, ended_at = now(), coins_awarded = v_paid,
         prize_points = v_points, xp_awarded = v_xp
   where id = p_run;

  select coins into v_balance from public.wallets where user_id = v_run.user_id;

  return jsonb_build_object(
    'status', p_status, 'correct', v_run.correct, 'coins', v_paid, 'prize_points', v_points,
    'xp', v_xp, 'level', v_new_lvl, 'leveled_up', v_new_lvl > coalesce(v_old_lvl, 1),
    'balance', v_balance);
end $$;

/** Locks and returns the caller's run, or raises. */
create function public.quiz_lock_run(p_user uuid, p_run uuid) returns public.quiz_runs
language plpgsql volatile security definer set search_path = '' as $$
declare v_run public.quiz_runs;
begin
  select * into v_run from public.quiz_runs where id = p_run and user_id = p_user for update;
  if not found then
    raise exception 'invalid_input: run' using errcode = '22023';
  end if;
  return v_run;
end $$;

-- -----------------------------------------------------------------------------
-- Client RPCs
-- -----------------------------------------------------------------------------

create function public.quiz_start() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_old uuid;
  v_id  uuid;
begin
  perform public.check_rate_limit(v_uid, 'quiz_start', 60, 3600);
  -- One active run per player: a new kickoff forfeits the old one (checkpoint rules).
  for v_old in select id from public.quiz_runs where user_id = v_uid and status = 'active' for update loop
    perform public.quiz_finish(v_old, 'abandoned');
  end loop;
  insert into public.quiz_runs (user_id) values (v_uid) returning id into v_id;
  return public.quiz_next(v_id);
end $$;

/** Serves the question for the current rung (idempotent: re-returns it if already served). */
create function public.quiz_next(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_run  public.quiz_runs;
  v_qid  text;
  v_secs integer;
  v_diff public.question_difficulty;
begin
  perform public.check_rate_limit(v_uid, 'quiz_next', 60, 60);
  v_run := public.quiz_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run finished' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.quiz_run_questions where run_id = p_run and rung = v_run.rung) then
    v_diff := (public.quiz_ladder_rung(v_run.rung) ->> 'difficulty')::public.question_difficulty;
    v_qid  := public.quiz_pick_question(v_uid, p_run, v_diff);
    select (value #>> '{}')::int into v_secs from public.app_config where key = 'quiz.seconds_per_question';
    insert into public.quiz_run_questions (run_id, rung, question_id, perm, deadline)
    values (p_run, v_run.rung, v_qid,
            (select array_agg(p::smallint order by random()) from generate_series(0, 3) p),
            now() + make_interval(secs => coalesce(v_secs, 30)));
    insert into public.seen_questions (user_id, question_id) values (v_uid, v_qid)
      on conflict (user_id, question_id) do update set seen_at = now();
  end if;
  return public.quiz_payload(p_run);
end $$;

create function public.quiz_answer(p_run uuid, p_rung integer, p_slot integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid     uuid := public.require_user();
  v_run     public.quiz_runs;
  v_rq      public.quiz_run_questions;
  v_correct boolean;
  v_cslot   integer;
  v_expl    text;
  v_summary jsonb;
  v_grace   constant interval := interval '3 seconds';
begin
  perform public.check_rate_limit(v_uid, 'quiz_answer', 60, 60);
  if p_slot is null or p_slot not between 0 and 3 then
    raise exception 'invalid_input: slot' using errcode = '22023';
  end if;
  v_run := public.quiz_lock_run(v_uid, p_run);
  if v_run.status <> 'active' or v_run.rung <> p_rung then
    raise exception 'invalid_state: not the current question' using errcode = 'P0001';
  end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = p_rung;
  if not found or v_rq.answered_slot is not null then
    raise exception 'invalid_state: question not open' using errcode = 'P0001';
  end if;
  if p_slot = any (v_rq.removed) or p_slot = any (v_rq.wrong_slots) then
    raise exception 'invalid_input: slot removed' using errcode = '22023';
  end if;

  select s.slot - 1 into v_cslot
    from unnest(v_rq.perm) with ordinality as s(pos, slot)
    join public.question_answers a on a.question_id = v_rq.question_id and a.position = s.pos and a.is_correct;
  select explanation_he into v_expl from public.questions where id = v_rq.question_id;

  -- Too late: the whistle already went.
  if now() > v_rq.deadline + v_grace then
    update public.quiz_run_questions set answered_slot = -1, is_correct = false, answered_at = now()
     where run_id = p_run and rung = p_rung;
    v_summary := public.quiz_finish(p_run, 'timed_out');
    return jsonb_build_object('result', 'timeout', 'correct_slot', v_cslot, 'explanation', v_expl,
      'summary', v_summary);
  end if;

  v_correct := (p_slot = v_cslot);

  -- VAR: the first wrong answer is reviewed and overturned; play on.
  if not v_correct and v_rq.var_armed then
    update public.quiz_run_questions
       set var_armed = false, wrong_slots = wrong_slots || p_slot::smallint,
           deadline = greatest(deadline, now() + interval '15 seconds')
     where run_id = p_run and rung = p_rung;
    return jsonb_build_object('result', 'var_overturned', 'wrong_slot', p_slot,
      'payload', public.quiz_payload(p_run));
  end if;

  update public.quiz_run_questions
     set answered_slot = p_slot, is_correct = v_correct, answered_at = now(), var_armed = false
   where run_id = p_run and rung = p_rung;

  if not v_correct then
    v_summary := public.quiz_finish(p_run, 'lost');
    return jsonb_build_object('result', 'wrong', 'correct_slot', v_cslot, 'explanation', v_expl,
      'summary', v_summary);
  end if;

  update public.quiz_runs set correct = correct + 1 where id = p_run;
  if p_rung = 12 then
    v_summary := public.quiz_finish(p_run, 'won');
    return jsonb_build_object('result', 'correct', 'correct_slot', v_cslot, 'explanation', v_expl,
      'summary', v_summary);
  end if;
  update public.quiz_runs set rung = rung + 1 where id = p_run;
  return jsonb_build_object('result', 'correct', 'correct_slot', v_cslot, 'explanation', v_expl,
    'summary', null, 'correct_count', p_rung);
end $$;

create function public.quiz_cash_out(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_run public.quiz_runs;
begin
  perform public.check_rate_limit(v_uid, 'quiz_cash_out', 30, 60);
  v_run := public.quiz_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run finished' using errcode = 'P0001';
  end if;
  return jsonb_build_object('summary', public.quiz_finish(p_run, 'cashed_out'));
end $$;

/**
 * Lifelines, once each per run:
 *   fifty  — hides two wrong answers
 *   expert — "הפרשן" names an answer; reliable on easy questions, shakier on hard ones
 *   fans   — the crowd votes (percentages per slot)
 *   var    — the next wrong answer on this question is overturned
 */
create function public.quiz_lifeline(p_run uuid, p_kind text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid    uuid := public.require_user();
  v_run    public.quiz_runs;
  v_rq     public.quiz_run_questions;
  v_diff   public.question_difficulty;
  v_cslot  integer;
  v_open   integer[];
  v_wrong  integer[];
  v_result jsonb;
  v_acc    numeric;
  v_pick   integer;
  v_base   integer;
  v_left   integer;
  v_pct    integer[] := array[0, 0, 0, 0];
  v_w      integer;
  i        integer;
begin
  perform public.check_rate_limit(v_uid, 'quiz_lifeline', 30, 60);
  if p_kind is null or p_kind not in ('fifty', 'expert', 'fans', 'var') then
    raise exception 'invalid_input: lifeline' using errcode = '22023';
  end if;
  v_run := public.quiz_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run finished' using errcode = 'P0001';
  end if;
  if p_kind = any (v_run.lifelines) then
    raise exception 'invalid_state: lifeline used' using errcode = 'P0001';
  end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = v_run.rung;
  if not found or v_rq.answered_slot is not null or now() > v_rq.deadline then
    raise exception 'invalid_state: question not open' using errcode = 'P0001';
  end if;

  select difficulty into v_diff from public.questions where id = v_rq.question_id;
  select s.slot - 1 into v_cslot
    from unnest(v_rq.perm) with ordinality as s(pos, slot)
    join public.question_answers a on a.question_id = v_rq.question_id and a.position = s.pos and a.is_correct;
  select array_agg(s order by s) into v_open from generate_series(0, 3) s
   where not (s = any (v_rq.removed)) and not (s = any (v_rq.wrong_slots));
  select array_agg(s order by random()) into v_wrong from unnest(v_open) s where s <> v_cslot;

  if p_kind = 'fifty' then
    v_result := jsonb_build_object('removed', to_jsonb(v_wrong[1:greatest(cardinality(v_wrong) - 1, 0)]));
    update public.quiz_run_questions
       set removed = removed || (select coalesce(array_agg(x::smallint), '{}') from unnest(v_wrong[1:greatest(cardinality(v_wrong) - 1, 0)]) x)
     where run_id = p_run and rung = v_run.rung;

  elsif p_kind = 'expert' then
    v_acc := case v_diff when 'easy' then 0.95 when 'medium' then 0.85 when 'hard' then 0.75
                         when 'expert' then 0.65 else 0.55 end;
    v_pick := case when random() < v_acc or coalesce(cardinality(v_wrong), 0) = 0 then v_cslot else v_wrong[1] end;
    v_result := jsonb_build_object('slot', v_pick,
      'confidence', case when v_diff in ('easy', 'medium') then 'sure'
                         when v_diff = 'hard' then 'think' else 'guess' end);

  elsif p_kind = 'fans' then
    v_base := case v_diff when 'easy' then 72 when 'medium' then 60 when 'hard' then 48
                          when 'expert' then 40 else 34 end + floor(random() * 17)::int - 8;
    if cardinality(v_open) = 1 then v_base := 100; end if;
    v_pct[v_cslot + 1] := v_base;
    v_left := 100 - v_base;
    for i in 1 .. coalesce(cardinality(v_wrong), 0) loop
      v_w := case when i = cardinality(v_wrong) then v_left else floor(random() * (v_left + 1))::int end;
      v_pct[v_wrong[i] + 1] := v_w;
      v_left := v_left - v_w;
    end loop;
    v_result := jsonb_build_object('percents', to_jsonb(v_pct));

  else -- var
    update public.quiz_run_questions set var_armed = true where run_id = p_run and rung = v_run.rung;
    v_result := jsonb_build_object('armed', true);
  end if;

  update public.quiz_run_questions set hints = hints || jsonb_build_object(p_kind, v_result)
   where run_id = p_run and rung = v_run.rung;
  update public.quiz_runs set lifelines = lifelines || p_kind where id = p_run;
  return jsonb_build_object('kind', p_kind, 'result', v_result);
end $$;

/** The whistle: ends the run once the current question's deadline has passed. */
create function public.quiz_timeout(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_run   public.quiz_runs;
  v_rq    public.quiz_run_questions;
  v_cslot integer;
  v_expl  text;
begin
  perform public.check_rate_limit(v_uid, 'quiz_timeout', 30, 60);
  v_run := public.quiz_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run finished' using errcode = 'P0001';
  end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = v_run.rung;
  if not found or v_rq.answered_slot is not null or now() <= v_rq.deadline then
    raise exception 'invalid_state: clock still running' using errcode = 'P0001';
  end if;
  select s.slot - 1 into v_cslot
    from unnest(v_rq.perm) with ordinality as s(pos, slot)
    join public.question_answers a on a.question_id = v_rq.question_id and a.position = s.pos and a.is_correct;
  select explanation_he into v_expl from public.questions where id = v_rq.question_id;
  update public.quiz_run_questions set answered_slot = -1, is_correct = false, answered_at = now()
   where run_id = p_run and rung = v_run.rung;
  return jsonb_build_object('result', 'timeout', 'correct_slot', v_cslot, 'explanation', v_expl,
    'summary', public.quiz_finish(p_run, 'timed_out'));
end $$;

/** Report a question the player has actually been served. Enough reports pull it for review. */
create function public.report_question(p_question_id text, p_reason text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid       uuid := public.require_user();
  v_threshold integer;
  v_count     integer;
begin
  perform public.check_rate_limit(v_uid, 'report_question', 30, 3600);
  if p_reason is null or p_reason not in ('wrong_answer', 'typo', 'unclear', 'other') then
    raise exception 'invalid_input: reason' using errcode = '22023';
  end if;
  if not exists (select 1 from public.seen_questions where user_id = v_uid and question_id = p_question_id) then
    raise exception 'invalid_input: question' using errcode = '22023';
  end if;
  insert into public.question_reports (user_id, question_id, reason) values (v_uid, p_question_id, p_reason)
    on conflict (user_id, question_id) do nothing;
  if found then
    select (value #>> '{}')::int into v_threshold from public.app_config where key = 'quiz.report_review_threshold';
    update public.questions set report_count = report_count + 1,
      status = case when status = 'active' and report_count + 1 >= coalesce(v_threshold, 5) then 'review' else status end
     where id = p_question_id
     returning report_count into v_count;
  end if;
  return jsonb_build_object('ok', true);
end $$;

-- -----------------------------------------------------------------------------
-- Privileges
-- -----------------------------------------------------------------------------
revoke execute on function
  public.level_from_xp(bigint),
  public.quiz_ladder_rung(integer),
  public.quiz_pick_question(uuid, uuid, public.question_difficulty),
  public.quiz_payload(uuid),
  public.quiz_finish(uuid, public.quiz_run_status),
  public.quiz_lock_run(uuid, uuid),
  public.quiz_start(),
  public.quiz_next(uuid),
  public.quiz_answer(uuid, integer, integer),
  public.quiz_cash_out(uuid),
  public.quiz_lifeline(uuid, text),
  public.quiz_timeout(uuid),
  public.report_question(text, text)
from public, anon, authenticated;

grant execute on function
  public.quiz_start(),
  public.quiz_next(uuid),
  public.quiz_answer(uuid, integer, integer),
  public.quiz_cash_out(uuid),
  public.quiz_lifeline(uuid, text),
  public.quiz_timeout(uuid),
  public.report_question(text, text)
to authenticated;
