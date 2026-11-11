-- 0.2.0: every right answer reports its coins, and 5 right answers open a surprise chest once per run.
begin;
-- one known prize, so the chest is checkable
update public.app_config set value = value || '{"mid_chest_at": 5, "mid_chest": [{"kind": "gems", "amount": 3, "weight": 1}]}'::jsonb
 where key = 'session.rewards';
update public.app_config set value = value || '{"enabled": false}'::jsonb where key = 'event';

do $$
declare i int; qid text;
begin
  for i in 1 .. 40 loop
    qid := 'q_' || substr(md5('rew' || i), 1, 16);
    insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity)
    values (qid, 'geography', 't', 'easy', 'שאלת פרס ' || i, 'הסבר', 't', array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', i / 40.0);
    insert into public.question_answers (question_id, position, text_he, is_correct) values
      (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
  end loop;
  perform public.refresh_question_ranks();
  update public.app_config set value = (select jsonb_agg(case when x ->> 'slug' = 'geography'
                                                          then x || '{"levels": 6}' else x || '{"active": false}' end)
                                          from jsonb_array_elements(value) x) where key = 'worlds';
end $$;

create function test.rslot(p_run uuid) returns int language sql security definer set search_path = '' as $$
  select (s.slot - 1)::int from public.quiz_runs r
    join public.quiz_run_questions rq on rq.run_id = r.id and rq.rung = r.rung
    cross join lateral unnest(rq.perm) with ordinality as s(pos, slot)
   where r.id = p_run and s.pos = 0 $$;
create function test.rgems(p_user uuid) returns bigint language sql security definer set search_path = '' as $$
  select gems from public.wallets where user_id = p_user $$;
grant execute on all functions in schema test to authenticated;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); p jsonb; r jsonb; run uuid; i int; g0 bigint; chests int := 0;
begin
  perform test.login(a);
  perform public.claim_welcome_bonus();
  p := public.session_start('geography', 1); run := (p ->> 'run_id')::uuid;
  g0 := test.rgems(a);
  for i in 1 .. 10 loop
    if i > 1 then p := public.session_next(run); end if;
    -- question 2 wrong, the rest right: the 5th right answer is question 6
    r := public.session_answer(run, i, case when i = 2 then (test.rslot(run) + 1) % 4 else test.rslot(run) end);
    if i = 2 then
      perform test.assert((r ->> 'coins')::int = 0, 'a wrong answer adds no coins');
    else
      perform test.assert((r ->> 'coins')::int = 12, 'a right answer reports its coins');
    end if;
    if r -> 'mid_chest' is not null and jsonb_typeof(r -> 'mid_chest') = 'object' then
      chests := chests + 1;
      perform test.assert(i = 6 and r -> 'mid_chest' ->> 'kind' = 'gems' and (r -> 'mid_chest' ->> 'amount')::int = 3, 'chest at the 5th right answer');
      perform test.assert(test.rgems(a) = g0 + 3, 'chest paid right away');
    end if;
  end loop;
  perform test.assert(chests = 1, 'one chest per run');
  perform test.assert((r -> 'summary' ->> 'coins')::int = 9 * 12 + 120, 'end-of-run coins unchanged (9 right, 2 stars)');
end $$;

rollback;
