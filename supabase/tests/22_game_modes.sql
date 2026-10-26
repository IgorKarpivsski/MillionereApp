-- New modes: against the clock, random opponent (+ sloth bot), family room.
begin;
do $$
declare i int; qid text; w text;
begin
  foreach w in array array['geography', 'science'] loop
    for i in 1 .. 60 loop
      qid := 'q_' || substr(md5('modes' || w || i), 1, 16);
      insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity)
      values (qid, w, 't', 'easy', 'שאלה ' || w || ' ' || i, 'הסבר', 't', array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', i / 60.0);
      insert into public.question_answers (question_id, position, text_he, is_correct) values
        (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
    end loop;
  end loop;
  perform public.refresh_question_ranks();
  update public.app_config set value = (select jsonb_agg(case when x ->> 'slug' in ('geography', 'science')
                                                          then x else x || '{"active": false}' end)
                                          from jsonb_array_elements(value) x) where key = 'worlds';
end $$;

create function test.bslot(p_run uuid) returns int language sql security definer set search_path = '' as $$
  select public.mode_correct_slot(current_qid, perm) from public.blitz_runs where id = p_run $$;
create function test.bshift(p_run uuid, secs numeric) returns void language sql security definer set search_path = '' as $$
  update public.blitz_runs set started_at = started_at - make_interval(secs => secs), ends_at = ends_at - make_interval(secs => secs)
   where id = p_run $$;
create function test.mshift(p_room uuid, secs numeric) returns void language sql security definer set search_path = '' as $$
  update public.match_rooms set started_at = now() - make_interval(secs => secs), created_at = now() - interval '10 seconds'
   where id = p_room $$;
create function test.mage(p_room uuid) returns void language sql security definer set search_path = '' as $$
  update public.match_rooms set created_at = now() - interval '10 seconds' where id = p_room $$;
create function test.fshift(p_room uuid, secs numeric) returns void language sql security definer set search_path = '' as $$
  update public.family_rooms set phase_at = phase_at - make_interval(secs => secs) where id = p_room $$;
create function test.fslot(p_room uuid) returns int language sql security definer set search_path = '' as $$
  select public.mode_correct_slot(question_ids[idx + 1], perms -> idx::int) from public.family_rooms where id = p_room $$;
create function test.coins(p_user uuid) returns bigint language sql security definer set search_path = '' as $$
  select coalesce((select coins from public.wallets where user_id = p_user), 0) $$;
grant execute on function test.bslot(uuid), test.bshift(uuid, numeric), test.mshift(uuid, numeric), test.mage(uuid),
  test.fshift(uuid, numeric), test.fslot(uuid), test.coins(uuid) to authenticated;
create temp table ids as select test.new_user() as a, test.new_user() as b, test.new_user() as c,
  test.new_user() as d, test.new_user() as e, test.new_user() as f, test.new_user() as g;
grant select on ids to authenticated;

set local role authenticated;

-- ---------------------------------------------------------------- blitz
do $$
declare
  a uuid := (select ids.a from ids);
  r jsonb; run uuid; c0 bigint;
begin
  perform test.login(a);
  c0 := test.coins(a);
  r := public.blitz_start(); run := (r ->> 'run_id')::uuid;
  perform test.assert(r -> 'question' ->> 'text' is not null and r::text not like '%is_correct%', 'first question, no leak');
  perform test.assert_raises(format('select public.blitz_answer(%L, 0)', run), 'not started', 'clock not started yet');
  perform test.bshift(run, 5);
  r := public.blitz_answer(run, test.bslot(run));
  perform test.assert((r ->> 'was_correct')::boolean and (r ->> 'correct')::int = 1, 'right answer counts');
  r := public.blitz_answer(run, (test.bslot(run) + 1) % 4);
  perform test.assert(not (r ->> 'was_correct')::boolean and (r ->> 'answered')::int = 2 and (r ->> 'correct')::int = 1, 'wrong answer');
  r := public.blitz_answer(run, test.bslot(run));
  perform test.assert_raises(format('select public.blitz_finish(%L)', run), 'still running', 'cannot end early');
  perform test.bshift(run, 60);
  r := public.blitz_answer(run, test.bslot(run));
  perform test.assert(r ->> 'status' = 'done' and r ->> 'was_correct' is null, 'late answer closes the run');
  r := public.blitz_finish(run);
  perform test.assert((r ->> 'correct')::int = 2 and (r ->> 'coins')::int = 18 and (r ->> 'new_best')::boolean, 'pays 9/correct, new best');
  perform test.assert(test.coins(a) = c0 + 18, 'coins paid once');
  r := public.blitz_finish(run);
  perform test.assert(test.coins(a) = c0 + 18, 'finish is idempotent');
  perform test.assert((public.blitz_info() ->> 'best')::int = 2, 'best score');
end $$;

-- ------------------------------------------------- random opponent + bot
do $$
declare
  b uuid := (select ids.b from ids); c uuid := (select ids.c from ids); d uuid := (select ids.d from ids);
  r jsonb; s jsonb; room uuid; room2 uuid;
begin
  -- b searches, c finds b
  perform test.login(b);
  r := public.match_find(); room := (r ->> 'room_id')::uuid;
  perform test.assert(not (r ->> 'matched')::boolean, 'b waits');
  perform test.assert(public.match_state(room) ->> 'phase' = 'waiting', 'waiting');
  perform test.login(c);
  r := public.match_find();
  perform test.assert((r ->> 'matched')::boolean and (r ->> 'room_id')::uuid = room, 'c matched with b');
  s := public.match_state(room);
  perform test.assert(s ->> 'phase' = 'countdown' and s ->> 'kind' = 'random' and not (s ->> 'is_bot')::boolean, 'random match starts');
  perform test.assert_raises(format('select public.match_join(%L)', s ->> 'code'), 'invalid_input', 'random rooms are not joinable by code');

  -- d searches, nobody comes: the sloth
  perform test.login(d);
  r := public.match_find(); room2 := (r ->> 'room_id')::uuid;
  perform test.assert(not (r ->> 'matched')::boolean, 'd waits');
  perform test.assert_raises(format('select public.match_bot(%L)', room2), 'still searching', 'bot only after a while');
  perform test.mage(room2);
  r := public.match_bot(room2);
  s := public.match_state(room2);
  perform test.assert((s ->> 'is_bot')::boolean and s -> 'opponent' ->> 'avatar_id' = 'bot_sloth', 'labelled bot opponent');
  perform test.assert(s::text not like '%"pts"%' and s::text not like '%"at"%', 'bot plan not leaked');
  perform test.mshift(room2, 7 * 19 + 1);
  s := public.match_state(room2);
  perform test.assert(s ->> 'phase' = 'done' and (s -> 'result' ->> 'coins')::int in (30, 100), 'bot match pays the human');
end $$;

-- ------------------------------------------------------------ family room
do $$
declare
  a uuid := (select ids.a from ids); b uuid := (select ids.b from ids); c uuid := (select ids.c from ids);
  d uuid := (select ids.d from ids); e uuid := (select ids.e from ids); f uuid := (select ids.f from ids);
  g uuid := (select ids.g from ids);
  r jsonb; s jsonb; room uuid; code text; i int; ca bigint; cb bigint;
begin
  perform test.login(a);
  perform test.assert_raises($q$select public.family_create('nope', 15)$q$, 'invalid_input', 'unknown world');
  r := public.family_create('science', 99); room := (r ->> 'room_id')::uuid; code := r ->> 'code';
  s := public.family_state(room);
  perform test.assert(s ->> 'phase' = 'lobby' and (s ->> 'total')::int = 20 and s ->> 'world' = 'science', 'clamped to 20, science');
  perform test.assert_raises(format('select public.family_start(%L)', room), 'need players', 'needs 2 players');
  perform public.family_configure(room, 'mix', 15);

  perform test.login(b); perform public.family_join(code);
  perform test.assert_raises(format('select public.family_configure(%L, %L, 15)', room, 'mix'), 'not host', 'only host configures');
  perform test.assert_raises(format('select public.family_start(%L)', room), 'not host', 'only host starts');
  perform test.login(c); perform public.family_join(code);
  perform test.login(d); perform public.family_join(code);
  perform test.login(e); perform public.family_join(code);
  perform test.login(f); perform public.family_join(code);
  perform test.login(g);
  perform test.assert_raises(format('select public.family_join(%L)', code), 'room full', 'max 6');

  -- c, d, e, f leave; a and b play
  perform test.login(c); perform public.family_leave(room);
  perform test.login(d); perform public.family_leave(room);
  perform test.login(e); perform public.family_leave(room);
  perform test.login(f); perform public.family_leave(room);
  perform test.login(a);
  s := public.family_state(room);
  perform test.assert(jsonb_array_length(s -> 'players') = 2 and (s ->> 'total')::int = 15, 'two players in lobby');
  perform public.family_start(room);
  perform test.assert(public.family_state(room) ->> 'phase' = 'countdown', 'countdown');
  perform test.fshift(room, 5);
  s := public.family_state(room);
  perform test.assert(s ->> 'phase' = 'question' and (s ->> 'idx')::int = 0 and s::text not like '%is_correct%', 'question 1');
  perform test.login(b); perform public.family_state(room);  -- b is online

  ca := test.coins(a); cb := test.coins(b);
  for i in 0 .. 14 loop
    perform test.login(a);
    perform public.family_answer(room, i, test.fslot(room));
    if i = 0 then
      perform test.assert_raises(format('select public.family_answer(%L, 0, 1)', room), 'already answered', 'answer is final');
      s := public.family_state(room);
      perform test.assert(s ->> 'phase' = 'question', 'still waiting for b');
      perform test.assert((select (p ->> 'score')::int from jsonb_array_elements(s -> 'players') p where (p ->> 'me')::boolean) = 0,
        'score hidden until reveal');
    end if;
    perform test.login(b);
    perform public.family_answer(room, i, (test.fslot(room) + case when i % 2 = 0 then 1 else 0 end) % 4);
    s := public.family_state(room);
    perform test.assert(s ->> 'phase' = 'reveal', 'everyone answered: reveal right away ' || i);
    perform test.assert((s -> 'reveal' ->> 'correct_slot') is not null, 'reveal has answer');
    perform test.fshift(room, 5);
    s := public.family_state(room);
    if i < 14 then
      perform test.assert(s ->> 'phase' = 'question' and (s ->> 'idx')::int = i + 1, 'next question ' || i);
    end if;
  end loop;
  perform test.assert(s ->> 'phase' = 'done' and s ->> 'status' = 'done', 'game over');
  perform test.assert((s -> 'players' -> 0 ->> 'username') is not null and (s -> 'players' -> 0 ->> 'me')::boolean = false, 'a leads');
  perform test.assert((s -> 'result' ->> 'coins')::int = 40, 'b gets 40');
  perform test.assert(test.coins(a) = ca + 150 and test.coins(b) = cb + 40, 'a champion 150');
  perform public.family_state(room);
  perform test.assert(test.coins(a) = ca + 150, 'paid once');

  -- timeout: nobody answers, the clock moves on
  perform test.login(a);
  r := public.family_create('mix', 15); room := (r ->> 'room_id')::uuid;
  perform test.login(b); perform public.family_join(r ->> 'code');
  perform test.login(a); perform public.family_start(room);
  perform test.fshift(room, 5 + 21);
  s := public.family_state(room);
  perform test.assert(s ->> 'phase' = 'reveal' and (s ->> 'idx')::int = 0, 'timeout reveals');

  -- a's statistics: one blitz (2/4), one family game won (15/15)
  s := public.my_stats();
  perform test.assert((s ->> 'family')::int = 1 and (s ->> 'family_wins')::int = 1, 'family stats: ' || s::text);
  perform test.assert((s ->> 'blitz_games')::int = 1 and (s ->> 'blitz_best')::int = 2, 'blitz stats');
  perform test.assert((s ->> 'answered')::int = 15 + 3 and (s ->> 'correct')::int = 15 + 2, 'answer totals: ' || s::text);
  perform test.assert(jsonb_array_length(s -> 'worlds') >= 1, 'per world');
end $$;
rollback;

-- Onboarding preferences + statistics
begin;
create temp table ids2 as select test.new_user() as a;
grant select on ids2 to authenticated;
set local role authenticated;
do $$
declare a uuid := (select ids2.a from ids2); s jsonb;
begin
  perform test.login(a);
  s := public.save_preferences('female', array['science', 'nope', 'geography']);
  perform test.assert(s -> 'profile' ->> 'gender' = 'female', 'gender saved');
  perform test.assert(s -> 'profile' -> 'fav_worlds' = '["science", "geography"]'::jsonb, 'unknown worlds dropped: ' || (s -> 'profile' -> 'fav_worlds')::text);
  perform test.assert(s -> 'profile' ->> 'onboarded_at' is not null, 'onboarded');
  perform test.assert_raises($q$select public.save_preferences('x', null)$q$, 'invalid_input', 'bad gender');
  s := public.my_stats();
  perform test.assert((s ->> 'answered')::int = 0 and (s ->> 'levels')::int = 0 and s ->> 'joined_at' is not null, 'empty stats: ' || s::text);
end $$;
rollback;
