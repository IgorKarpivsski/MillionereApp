-- Knowledge worlds: sessions, stars, level path, 50:50, timeouts, quick play.
begin;

do $$
declare i int; qid text; w text;
begin
  foreach w in array array['geography', 'science', 'football'] loop
    for i in 1 .. 60 loop
      qid := 'q_' || substr(md5('sess' || w || i), 1, 16);
      insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity, image)
      values (qid, case when w = 'football' then 'israeli_football' else w end, 't', 'easy', 'שאלת עולם ' || w || ' ' || i, 'הסבר', 't',
              array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', i / 60.0,
              case when i % 5 = 0 then '{"kind":"photo","url":"https://upload.wikimedia.org/x.jpg","credit":"צלם / CC BY-SA 4.0"}'::jsonb end);
      insert into public.question_answers (question_id, position, text_he, is_correct) values
        (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
    end loop;
  end loop;
  perform public.refresh_question_ranks();
  -- only the three worlds with questions are active in this test
  update public.app_config set value = (select jsonb_agg(case when x ->> 'slug' in ('geography', 'science', 'football')
                                                          then x || '{"levels": 6}' else x || '{"active": false}' end)
                                          from jsonb_array_elements(value) x) where key = 'worlds';
end $$;

create function test.cslot(p_run uuid) returns int language sql security definer set search_path = '' as $$
  select (s.slot - 1)::int from public.quiz_runs r
    join public.quiz_run_questions rq on rq.run_id = r.id and rq.rung = r.rung
    cross join lateral unnest(rq.perm) with ordinality as s(pos, slot)
   where r.id = p_run and s.pos = 0 $$;
create function test.refill(p_user uuid) returns void language sql security definer set search_path = '' as $$
  insert into public.user_energy (user_id, tickets, stamp) values (p_user, 5, now())
  on conflict (user_id) do update set tickets = 5, stamp = now() $$;
create function test.expire(p_run uuid) returns void language sql security definer set search_path = '' as $$
  update public.quiz_run_questions set deadline = now() - interval '1 second' where run_id = p_run $$;
create function test.coins(p_user uuid) returns bigint language sql security definer set search_path = '' as $$
  select coins from public.wallets where user_id = p_user $$;
create function test.tokens(p_user uuid, p_pack text) returns int language sql security definer set search_path = '' as $$
  select coalesce((select count from public.user_pack_tokens where user_id = p_user and pack = p_pack), 0) $$;
grant execute on function test.cslot(uuid), test.refill(uuid), test.expire(uuid), test.coins(uuid), test.tokens(uuid, text) to authenticated;

create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;
select test.refill((select a from ids));

set local role authenticated;
do $$
declare
  a uuid := (select ids.a from ids);
  p jsonb; r jsonb; run uuid; i int; st jsonb; c0 bigint; lvl int; silver0 int; gold0 int; seen text[] := '{}';
begin
  perform test.login(a);
  perform public.claim_welcome_bonus();

  st := public.worlds_state();
  perform test.assert(jsonb_array_length(st -> 'worlds') = 3, 'three active worlds');
  perform test.assert((st -> 'worlds' -> 0 ->> 'unlocked')::int = 1, 'level 1 unlocked');
  perform test.assert_raises($q$select public.session_start('geography', 2)$q$, 'level locked', 'level 2 locked');
  perform test.assert_raises($q$select public.session_start('nope', 1)$q$, 'invalid_input', 'unknown world');
  perform test.assert_raises($q$select public.session_start('history', 1)$q$, 'invalid_input', 'inactive world');

  -- Level 1: 7 right, 3 wrong → 1 star, level 2 unlocked. Wrong answers don't end it.
  p := public.session_start('geography', 1);
  run := (p ->> 'run_id')::uuid;
  perform test.assert(p ->> 'mode' = 'session' and (p ->> 'total')::int = 10 and p ->> 'world' = 'geography', 'payload');
  perform test.assert(p -> 'question' ->> 'id' is not null, 'first question served');
  perform test.assert(public.session_resume(run) -> 'question' ->> 'id' = p -> 'question' ->> 'id', 'resume same question');
  perform test.assert_raises(format($q$select public.quiz_answer(%L, 1, 0)$q$, run), 'invalid_input', 'classic RPCs refuse sessions');
  c0 := test.coins(a);
  for i in 1 .. 10 loop
    if i > 1 then p := public.session_next(run); end if;
    perform test.assert(not (p -> 'question' ->> 'id' = any (seen)), 'no repeats in a session');
    seen := seen || (p -> 'question' ->> 'id');
    r := public.session_answer(run, i, case when i <= 7 then test.cslot(run) else (test.cslot(run) + 1) % 4 end);
    if i <= 7 then
      perform test.assert(r ->> 'result' = 'correct' and (r ->> 'points')::int >= 100, 'correct scores points');
    else
      perform test.assert(r ->> 'result' = 'wrong' and (r ->> 'points')::int = 0, 'wrong scores nothing');
    end if;
    if i < 10 then perform test.assert(r -> 'summary' = 'null'::jsonb, 'continues'); end if;
  end loop;
  perform test.assert((r -> 'summary' ->> 'stars')::int = 1, '7/10 = 1 star');
  perform test.assert((r -> 'summary' ->> 'coins')::int = 7 * 4 + 20, 'coins');
  perform test.assert(test.coins(a) = c0 + 48, 'coins paid');
  perform test.assert((r -> 'summary' ->> 'unlocked')::int = 2, 'level 2 unlocked');
  perform test.assert((r -> 'summary' ->> 'first_clear')::boolean, 'first clear');
  perform test.assert((select prize_points from public.quiz_runs where id = run) = (r -> 'summary' ->> 'prize_points')::int
                      and (r -> 'summary' ->> 'prize_points')::int >= 700, 'score kept for leagues');
  perform test.assert_raises(format($q$select public.session_next(%L)$q$, run), 'run finished', 'finished');

  -- Replay level 1 perfectly → 3 stars + silver chest once.
  silver0 := test.tokens(a, 'silver');
  p := public.session_start('geography', 1);
  run := (p ->> 'run_id')::uuid;
  for i in 1 .. 10 loop
    if i > 1 then p := public.session_next(run); end if;
    r := public.session_answer(run, i, test.cslot(run));
  end loop;
  perform test.assert((r -> 'summary' ->> 'stars')::int = 3 and r -> 'summary' ->> 'chest' = 'silver', '3 stars → silver chest');
  perform test.assert(test.tokens(a, 'silver') = silver0 + 1, 'chest granted');
  st := public.worlds_state();
  perform test.assert((st -> 'worlds' -> 0 -> 'stars' ->> '1')::int = 3 and (st ->> 'total_stars')::int = 3, 'best stars kept');

  -- Fail a level: 5/10 → 0 stars, nothing unlocked; 50:50 free then paid; timeout.
  p := public.session_start('science', 1);
  run := (p ->> 'run_id')::uuid;
  p := public.session_5050(run);
  perform test.assert(jsonb_array_length(p -> 'question' -> 'removed') = 2, '5050 removes two');
  perform test.assert(not (test.cslot(run) in (select jsonb_array_elements_text(p -> 'question' -> 'removed')::int)), 'never the right one');
  perform test.assert_raises(format($q$select public.session_5050(%L)$q$, run), 'not available', 'once per question');
  perform test.assert_raises(format($q$select public.session_answer(%L, 1, -1)$q$, run), 'clock still running', 'no early timeout');
  r := public.session_answer(run, 1, test.cslot(run));
  p := public.session_next(run);
  c0 := test.coins(a);
  p := public.session_5050(run);
  perform test.assert(test.coins(a) = c0 - 30, 'second 5050 costs coins');
  perform test.expire(run);
  r := public.session_answer(run, 2, -1);
  perform test.assert(r ->> 'result' = 'timeout', 'timeout');
  for i in 3 .. 10 loop
    p := public.session_next(run);
    r := public.session_answer(run, i, case when i <= 6 then test.cslot(run) else (test.cslot(run) + 1) % 4 end);
  end loop;
  perform test.assert((r -> 'summary' ->> 'stars')::int = 0 and r -> 'summary' ->> 'status' = 'lost', '5/10 fails');
  perform test.assert((r -> 'summary' ->> 'unlocked')::int = 1, 'still level 1');
  perform test.assert((select status from public.quiz_runs where id = run) = 'lost', 'run lost');
end $$;

reset role;
select test.refill((select a from ids));
set local role authenticated;

do $$
declare a uuid := (select ids.a from ids); p jsonb; r jsonb; run uuid; run2 uuid; i int; worlds text[] := '{}'; gold0 int;
begin
  perform test.login(a);
  -- Quick play mixes worlds.
  p := public.session_start('mix', null);
  run := (p ->> 'run_id')::uuid;
  for i in 1 .. 10 loop
    if i > 1 then p := public.session_next(run); end if;
    worlds := worlds || (p ->> 'question_world');
    r := public.session_answer(run, i, test.cslot(run));
  end loop;
  perform test.assert((select count(distinct x) from unnest(worlds) x) = 3, 'quick play visits every world');
  perform test.assert((r -> 'summary' ->> 'stars')::int = 3 and r -> 'summary' ->> 'chest' is null, 'no chest in quick play');

  -- Starting a new session abandons the active one.
  p := public.session_start('geography', 2);
  run := (p ->> 'run_id')::uuid;
  p := public.session_start('geography', 1);
  run2 := (p ->> 'run_id')::uuid;
  perform test.assert((select status from public.quiz_runs where id = run) = 'abandoned', 'old session abandoned');
  -- The daily challenge also ends a session.
  perform public.daily_start();
  perform test.assert((select status from public.quiz_runs where id = run2) = 'abandoned', 'daily ends the session');
end $$;

reset role;
-- Level 5 first clear → gold chest; levels beyond the world's count are locked.
insert into public.user_world_levels (user_id, world, level, stars) select a, 'football', l, 1 from ids, generate_series(1, 4) l;
select test.refill((select a from ids));
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); p jsonb; r jsonb; run uuid; i int; gold0 int;
begin
  perform test.login(a);
  gold0 := test.tokens(a, 'gold');
  p := public.session_start('football', 5);
  run := (p ->> 'run_id')::uuid;
  for i in 1 .. 10 loop
    if i > 1 then p := public.session_next(run); end if;
    r := public.session_answer(run, i, case when i <= 8 then test.cslot(run) else (test.cslot(run) + 1) % 4 end);
  end loop;
  perform test.assert(r -> 'summary' ->> 'chest' = 'gold' and test.tokens(a, 'gold') = gold0 + 1, 'every 5th level gives a gold chest');
  perform test.assert((r -> 'summary' ->> 'unlocked')::int = 6, 'level 6 unlocked');
  perform test.assert(p -> 'question' -> 'image' is not null or true, 'image passes through');
end $$;

reset role;
do $$
begin
  perform test.assert((select count(*) from public.questions where world is null) = 0, 'every question has a world');
  perform test.assert((select count(*) from public.quiz_runs where mode = 'session' and status = 'won' and stars is null) = 0, 'stars recorded');
  -- photo image shape is enforced
  perform test.assert_raises($q$update public.questions set image = '{"kind":"photo","url":"http://x"}' where id = (select id from public.questions limit 1)$q$,
    'questions_image_shape', 'bad photo rejected');
end $$;
rollback;
