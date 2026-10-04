-- The classic run: serving, answering, lifelines, payouts, cheating attempts.
begin;

-- 3 questions per difficulty on alternating categories (+ extras for repeats).
do $$
declare
  d text;
  i int;
  qid text;
  cats text[] := array['world_cup', 'israeli_football', 'clubs', 'players'];
begin
  foreach d in array array['easy', 'medium', 'hard', 'expert', 'legendary'] loop
    for i in 1 .. 4 loop
      qid := 'q_' || substr(md5(d || i), 1, 16);
      insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator)
      values (qid, cats[i], 't', d::public.question_difficulty, 'שאלת בדיקה ' || d || ' ' || i, 'הסבר', 't',
              array['https://www.wikidata.org/wiki/Q1'], 'test', 'test');
      insert into public.question_answers (question_id, position, text_he, is_correct) values
        (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
    end loop;
  end loop;
end $$;

-- Test-only oracle: which slot is correct for the current question (runs as owner).
create function test.correct_slot(p_run uuid) returns int
language sql security definer set search_path = '' as $$
  select (s.slot - 1)::int
    from public.quiz_runs r
    join public.quiz_run_questions rq on rq.run_id = r.id and rq.rung = r.rung
    cross join lateral unnest(rq.perm) with ordinality as s(pos, slot)
   where r.id = p_run and s.pos = 0
$$;
create function test.expire(p_run uuid) returns void
language sql security definer set search_path = '' as $$
  update public.quiz_run_questions rq set deadline = now() - interval '1 minute'
    from public.quiz_runs r where r.id = p_run and rq.run_id = r.id and rq.rung = r.rung
$$;
grant execute on function test.correct_slot(uuid), test.expire(uuid) to authenticated;

create temp table ids as select test.new_user() as a, test.new_user() as b;
grant select on ids to authenticated;

select test.assert(public.level_from_xp(0) = 1 and public.level_from_xp(149) = 1 and public.level_from_xp(150) = 2,
  'level curve matches economy-config');

set local role authenticated;
select test.login((select a from ids));

do $$
declare
  a    uuid := (select ids.a from ids);
  b    uuid := (select ids.b from ids);
  p    jsonb;
  r    jsonb;
  run  uuid;
  c    int;
  w    int;
  i    int;
begin
  ---------------------------------------------------------------- serving
  p := public.quiz_start();
  run := (p ->> 'run_id')::uuid;
  perform test.assert(p ->> 'status' = 'active' and (p ->> 'rung')::int = 1, 'run starts on rung 1');
  perform test.assert(jsonb_array_length(p -> 'question' -> 'answers') = 4, 'four answers served');
  perform test.assert(p::text not like '%is_correct%' and p::text not like '%perm%', 'payload hides correctness');
  perform test.assert(p -> 'question' ->> 'difficulty' = 'easy', 'rung 1 is easy');
  perform test.assert((p -> 'question' ->> 'seconds_left')::int between 1 and 30, 'timer served');
  perform test.assert(public.quiz_next(run) -> 'question' ->> 'id' = p -> 'question' ->> 'id', 'quiz_next is idempotent');
  perform test.assert_raises('select count(*) from public.quiz_run_questions', 'permission denied', 'cannot read served rows');
  perform test.assert_raises('select count(*) from public.seen_questions', 'permission denied', 'cannot read seen');
  perform test.assert_raises(format('select public.quiz_answer(%L, 2, 0)', run), 'invalid_state', 'cannot answer a future rung');

  ---------------------------------------------------------------- 4 right, cash out at the checkpoint
  for i in 1 .. 4 loop
    if i > 1 then p := public.quiz_next(run); end if;
    r := public.quiz_answer(run, i, test.correct_slot(run));
    perform test.assert(r ->> 'result' = 'correct', format('rung %s correct', i));
  end loop;
  perform test.assert(public.quiz_next(run) -> 'question' ->> 'difficulty' = 'medium', 'rung 5 is medium');
  r := public.quiz_cash_out(run);
  perform test.assert((r -> 'summary' ->> 'coins')::int = 60, 'cash out after 4 pays 60');
  perform test.assert((r -> 'summary' ->> 'xp')::int = 40, '10 xp per correct answer');
  perform test.assert((select coins from public.wallets) = 60, 'wallet credited');
  perform test.assert((select xp from public.profiles) = 40, 'xp credited');
  perform test.assert_raises(format('select public.quiz_cash_out(%L)', run), 'invalid_state', 'cannot cash out twice');
  perform test.assert((select count(*) from public.wallet_transactions where reason = 'quiz_run') = 1, 'paid once');

  ---------------------------------------------------------------- wrong answer falls back to checkpoint
  p := public.quiz_start();
  run := (p ->> 'run_id')::uuid;
  for i in 1 .. 5 loop
    if i > 1 then p := public.quiz_next(run); end if;
    r := public.quiz_answer(run, i, test.correct_slot(run));
  end loop;
  p := public.quiz_next(run);
  c := test.correct_slot(run);
  r := public.quiz_answer(run, 6, (c + 1) % 4);
  perform test.assert(r ->> 'result' = 'wrong' and (r ->> 'correct_slot')::int = c, 'wrong answer reveals the right one');
  perform test.assert((r -> 'summary' ->> 'status') = 'lost', 'run lost');
  perform test.assert((r -> 'summary' ->> 'coins')::int = 60, 'lost after 5 keeps checkpoint 4 (60)');
  perform test.assert((select coins from public.wallets) = 120, 'wallet now 120');

  ---------------------------------------------------------------- lifelines
  p := public.quiz_start();
  run := (p ->> 'run_id')::uuid;
  c := test.correct_slot(run);
  r := public.quiz_lifeline(run, 'fifty');
  perform test.assert(jsonb_array_length(r -> 'result' -> 'removed') = 2, '50:50 removes two');
  perform test.assert(not (r -> 'result' -> 'removed') @> to_jsonb(c), '50:50 never removes the right answer');
  perform test.assert_raises(format($q$select public.quiz_lifeline(%L, 'fifty')$q$, run), 'lifeline used', 'once per run');
  perform test.assert_raises(format('select public.quiz_answer(%L, 1, %s)', run, (r -> 'result' -> 'removed' ->> 0)),
    'slot removed', 'cannot answer a removed slot');
  r := public.quiz_lifeline(run, 'fans');
  perform test.assert((select sum(x::int) from jsonb_array_elements_text(r -> 'result' -> 'percents') x) = 100, 'crowd sums to 100');
  r := public.quiz_lifeline(run, 'var');
  -- the one remaining wrong slot:
  select s into w from generate_series(0, 3) s
   where s <> c and not ((public.quiz_next(run) -> 'question' -> 'removed') @> to_jsonb(s)) limit 1;
  r := public.quiz_answer(run, 1, w);
  perform test.assert(r ->> 'result' = 'var_overturned', 'VAR overturns the first wrong answer');
  r := public.quiz_answer(run, 1, c);
  perform test.assert(r ->> 'result' = 'correct', 'play on after VAR');
  p := public.quiz_next(run);
  r := public.quiz_lifeline(run, 'expert');
  perform test.assert((r -> 'result' ->> 'slot')::int between 0 and 3, 'expert names a slot');
  perform test.assert(jsonb_array_length(public.quiz_next(run) -> 'lifelines_used') = 4, 'all four marked used');

  ---------------------------------------------------------------- timeout
  perform test.assert_raises(format('select public.quiz_timeout(%L)', run), 'clock still running', 'no early whistle');
  perform test.expire(run);
  r := public.quiz_answer(run, 2, test.correct_slot(run));
  perform test.assert(r ->> 'result' = 'timeout' and r -> 'summary' ->> 'status' = 'timed_out', 'late answer times out');

  p := public.quiz_start();
  run := (p ->> 'run_id')::uuid;
  perform test.expire(run);
  r := public.quiz_timeout(run);
  perform test.assert(r ->> 'result' = 'timeout' and r -> 'summary' ->> 'status' = 'timed_out', 'whistle ends the run');

  ---------------------------------------------------------------- a full win
  p := public.quiz_start();
  run := (p ->> 'run_id')::uuid;
  for i in 1 .. 12 loop
    if i > 1 then p := public.quiz_next(run); end if;
    r := public.quiz_answer(run, i, test.correct_slot(run));
  end loop;
  perform test.assert(r -> 'summary' ->> 'status' = 'won', 'twelve right wins');
  perform test.assert((r -> 'summary' ->> 'coins')::int = 1000, 'win pays 1000');
  perform test.assert((r -> 'summary' ->> 'prize_points')::int = 500000, 'win scores 500,000');
  perform test.assert((select xp from public.profiles) = 40 + 50 + 10 + 170, 'xp adds up (incl. win bonus)');
  perform test.assert((select level from public.profiles) = 2, 'level follows xp (270 xp = level 2)');

  ---------------------------------------------------------------- new kickoff forfeits an open run
  p := public.quiz_start();
  run := (p ->> 'run_id')::uuid;
  p := public.quiz_start();
  perform test.assert((select status::text from public.quiz_runs where id = run) = 'abandoned', 'old run abandoned');
  perform test.assert((select count(*) from public.quiz_runs where status = 'active') = 1, 'one active run');

  ---------------------------------------------------------------- isolation
  perform test.login(b);
  perform test.assert((select count(*) from public.quiz_runs) = 0, 'B sees none of A runs');
  perform test.assert_raises(format('select public.quiz_answer(%L, 1, 0)', (p ->> 'run_id')), 'invalid_input', 'B cannot answer A run');
  perform test.assert_raises(format('select public.quiz_cash_out(%L)', (p ->> 'run_id')), 'invalid_input', 'B cannot cash out A run');

  ---------------------------------------------------------------- reports
  perform test.assert_raises(format($q$select public.report_question(%L, 'typo')$q$, p -> 'question' ->> 'id'),
    'invalid_input', 'cannot report an unseen question');
  perform test.login(a);
  perform test.assert(public.report_question(p -> 'question' ->> 'id', 'wrong_answer') ->> 'ok' = 'true', 'report accepted');
  perform public.report_question(p -> 'question' ->> 'id', 'wrong_answer'); -- duplicate is a no-op
end $$;

reset role;
do $$
begin
  perform test.assert((select report_count from public.questions q
                        join public.question_reports r on r.question_id = q.id limit 1) = 1, 'one report counted once');
end $$;

-- Five different players reporting pulls the question for review.
do $$
declare
  q text := 'q_' || substr(md5('easy1'), 1, 16);
  u uuid;
begin
  update public.questions set report_count = 0 where id = q;
  for i in 1 .. 5 loop
    u := test.new_user();
    insert into public.seen_questions (user_id, question_id) values (u, q);
    perform test.login(u);
    perform public.report_question(q, 'wrong_answer');
  end loop;
  perform test.assert((select status::text from public.questions where id = q) = 'review', 'auto-review after 5 reports');
end $$;

set local role anon;
do $$
begin
  perform test.assert_raises('select public.quiz_start()', 'permission denied', 'anon cannot play');
end $$;

rollback;
