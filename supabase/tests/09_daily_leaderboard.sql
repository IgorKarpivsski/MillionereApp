-- Daily challenge, streaks and the weekly leaderboard.
begin;

do $$
declare i int; qid text;
begin
  for i in 1 .. 120 loop
    qid := 'q_' || substr(md5('daily' || i), 1, 16);
    insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity)
    values (qid, case when i % 3 = 0 then 'world_cup' else 'israeli_football' end, 't', 'easy', 'שאלה יומית ' || i, 'הסבר', 't',
            array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', (i % 50) / 50.0);
    insert into public.question_answers (question_id, position, text_he, is_correct) values
      (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
  end loop;
  perform public.refresh_question_ranks();
end $$;

create function test.cslot(p_run uuid) returns int language sql security definer set search_path = '' as $$
  select (s.slot - 1)::int from public.quiz_runs r
    join public.quiz_run_questions rq on rq.run_id = r.id and rq.rung = r.rung
    cross join lateral unnest(rq.perm) with ordinality as s(pos, slot)
   where r.id = p_run and s.pos = 0 $$;
create function test.yesterday_streak(p_user uuid, n int) returns void language sql security definer set search_path = '' as $$
  insert into public.user_streaks (user_id, current, best, last_day) values (p_user, n, n, public.israel_today() - 1) $$;
grant execute on function test.cslot(uuid), test.yesterday_streak(uuid, int) to authenticated;

create temp table ids as select test.new_user() as a, test.new_user() as b;
grant select on ids to authenticated;
select test.yesterday_streak((select a from ids), 4);

set local role authenticated;
do $$
declare
  a uuid := (select ids.a from ids);
  b uuid := (select ids.b from ids);
  p jsonb; r jsonb; run uuid; i int; lb jsonb; first_q text;
begin
  perform test.login(a);
  perform test.assert(public.daily_status() ->> 'state' = 'open', 'daily open');
  perform test.assert((public.daily_status() ->> 'streak')::int = 4, 'streak carried from yesterday');
  p := public.daily_start();
  run := (p ->> 'run_id')::uuid;
  first_q := p -> 'question' ->> 'id';
  perform test.assert((p ->> 'total')::int = 10 and p ->> 'mode' = 'daily', 'daily payload');
  perform test.assert(public.daily_start() -> 'question' ->> 'id' = first_q, 'restart resumes the same question');
  perform test.assert_raises(format($q$select public.quiz_answer(%L, 1, 0)$q$, run), 'invalid_input', 'classic RPCs refuse daily runs');
  perform test.assert_raises(format($q$select public.quiz_lifeline(%L, 'fifty')$q$, run), 'invalid_input', 'no lifelines in daily');

  -- 7 right, 3 wrong: wrong answers don't end the daily.
  for i in 1 .. 10 loop
    if i > 1 then p := public.daily_next(run); end if;
    r := public.daily_answer(run, i, case when i <= 7 then test.cslot(run) else (test.cslot(run) + 1) % 4 end);
    if i < 10 then perform test.assert(r -> 'summary' = 'null'::jsonb, 'continues after each answer'); end if;
  end loop;
  perform test.assert((r -> 'summary' ->> 'correct')::int = 7, '7 correct');
  perform test.assert((r -> 'summary' ->> 'streak')::int = 5, 'streak 4 → 5');
  perform test.assert((r -> 'summary' ->> 'coins')::int = floor(7 * 15 * 1.4), 'coins with streak bonus');
  perform test.assert((r -> 'summary' ->> 'prize_points')::int = 3500, 'points');
  perform test.assert(public.daily_status() ->> 'state' = 'done', 'done for today');
  perform test.assert_raises('select public.daily_start()', 'already played', 'one daily per day');

  -- B gets the same questions, and a classic run on top.
  perform test.login(b);
  p := public.daily_start();
  perform test.assert(p -> 'question' ->> 'id' = first_q, 'same daily questions for everyone');
  run := (p ->> 'run_id')::uuid;
  r := public.daily_answer(run, 1, test.cslot(run));
  p := public.quiz_start();    -- closes the open daily as it stands
  perform test.assert(public.daily_status() ->> 'state' = 'done', 'classic kickoff closes the daily');
  perform test.assert((public.daily_status() ->> 'streak')::int = 1, 'new streak starts at 1');

  lb := public.leaderboard_week(10);
  perform test.assert(jsonb_array_length(lb -> 'rows') = 2, 'two players on the board');
  perform test.assert((lb -> 'rows' -> 0 ->> 'points')::int = 3500, 'A leads with 3500');
  perform test.assert((lb -> 'me' ->> 'rank')::int = 2, 'B is second');
end $$;

rollback;
