-- Friend match: create, join, shared clock, scoring, payout.
begin;
do $$
declare i int; qid text;
begin
  for i in 1 .. 60 loop
    qid := 'q_' || substr(md5('match' || i), 1, 16);
    insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity)
    values (qid, case when i % 3 = 0 then 'world_cup' else 'israeli_football' end, 't', 'easy', 'שאלת מוקדמות ' || i, 'הסבר', 't',
            array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', (i % 40) / 40.0);
    insert into public.question_answers (question_id, position, text_he, is_correct) values
      (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
  end loop;
  perform public.refresh_question_ranks();
end $$;
create function test.shift(p_room uuid, secs numeric) returns void language sql security definer set search_path = '' as $$
  update public.match_rooms set started_at = now() - make_interval(secs => secs) where id = p_room $$;
create function test.mslot(p_room uuid, i int) returns int language sql security definer set search_path = '' as $$
  select s from public.match_rooms r, generate_series(0, 3) s
   where r.id = p_room and (r.perms -> i ->> s)::int = 0 $$;
grant execute on function test.shift(uuid, numeric), test.mslot(uuid, int) to authenticated;
create temp table ids as select test.new_user() as a, test.new_user() as b, test.new_user() as c;
grant select on ids to authenticated;

set local role authenticated;
do $$
declare
  a uuid := (select ids.a from ids); b uuid := (select ids.b from ids); c uuid := (select ids.c from ids);
  r jsonb; s jsonb; room uuid; code text; i int;
begin
  perform test.login(a);
  r := public.match_create(); room := (r ->> 'room_id')::uuid; code := r ->> 'code';
  perform test.assert(public.match_state(room) ->> 'phase' = 'waiting', 'waiting for friend');

  perform test.login(b);
  perform test.assert_raises($q$select public.match_join('999999x')$q$, 'invalid_input', 'bad code');
  r := public.match_join(code);
  s := public.match_state(room);
  perform test.assert(s ->> 'phase' = 'countdown' and s -> 'opponent' ->> 'username' is not null, 'countdown with opponent');

  perform test.login(c);
  perform test.assert_raises(format('select public.match_join(%L)', code), 'room closed', 'third player cannot join');
  perform test.assert_raises(format('select public.match_state(%L)', room), 'invalid_input', 'outsider cannot watch');

  -- Question 1: A answers right fast, B wrong.
  perform test.shift(room, 2);
  perform test.login(a);
  s := public.match_state(room);
  perform test.assert(s ->> 'phase' = 'question' and (s ->> 'idx')::int = 0, 'question 1 live');
  perform test.assert(s::text not like '%is_correct%' and s -> 'reveal' = 'null'::jsonb, 'no answer leak during question');
  perform public.match_answer(room, 0, test.mslot(room, 0));
  perform test.assert_raises(format('select public.match_answer(%L, 0, 1)', room), 'already answered', 'one answer');
  perform test.login(b);
  perform test.assert((public.match_state(room) ->> 'opp_answered')::boolean, 'B sees A answered');
  perform test.assert((public.match_state(room) ->> 'opp_score')::int = 0, 'but not A score yet');
  perform public.match_answer(room, 0, (test.mslot(room, 0) + 1) % 4);
  perform test.assert_raises(format('select public.match_answer(%L, 1, 0)', room), 'not open', 'future question closed');

  perform test.shift(room, 16);
  s := public.match_state(room);
  perform test.assert(s ->> 'phase' = 'reveal' and (s -> 'reveal' ->> 'correct_slot')::int = test.mslot(room, 0), 'reveal shows the answer');
  perform test.assert((s ->> 'opp_score')::int >= 100 and (s ->> 'my_score')::int = 0, 'scores after reveal');

  -- Fast-forward to the end.
  perform test.shift(room, 7 * 19 + 1);
  s := public.match_state(room);
  perform test.assert(s ->> 'phase' = 'done', 'done');
  perform test.assert((s -> 'result' ->> 'coins')::int = 30, 'loser gets 30');
  perform test.login(a);
  perform test.assert((public.match_state(room) -> 'result' ->> 'coins')::int = 100, 'winner gets 100');
  perform test.assert((select coins from public.wallets) = 100, 'paid once');
end $$;
rollback;
