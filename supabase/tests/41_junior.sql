-- Junior mode: runs are marked, every question stays open for an hour, the setting is allowed.
begin;
create function test.jdl(p_user uuid) returns interval language sql security definer set search_path = '' as $$
  select q.deadline - now() from public.quiz_run_questions q join public.quiz_runs r on r.id = q.run_id
   where r.user_id = p_user order by q.deadline desc limit 1 $$;
create function test.jrun(p_user uuid) returns boolean language sql security definer set search_path = '' as $$
  select junior from public.quiz_runs where user_id = p_user order by started_at desc limit 1 $$;
grant execute on all functions in schema test to authenticated;
do $$
declare i int; qid text;
begin
  for i in 1 .. 60 loop
    qid := 'q_' || substr(md5('jun' || i), 1, 16);
    insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity)
    values (qid, 'geography', 't', 'easy', 'שאלת ג׳וניור מספר ' || i, 'הסבר', 't', array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', i / 60.0);
    insert into public.question_answers (question_id, position, text_he, is_correct) values
      (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
  end loop;
  perform public.refresh_question_ranks();
  update public.app_config set value = (select jsonb_agg(case when x ->> 'slug' = 'geography' then x || '{"levels": 6}' else x || '{"active": false}' end)
                                          from jsonb_array_elements(value) x) where key = 'worlds';
end $$;
create temp table ids as select test.new_user() as a, test.new_user() as b;
grant select on ids to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); b uuid := (select ids.b from ids); s jsonb;
begin
  perform test.login(a);
  s := public.update_my_settings('{"junior": true}'::jsonb);
  perform test.assert((s -> 'settings' ->> 'junior')::boolean, 'junior saved');
  perform test.assert_raises($q$select public.update_my_settings('{"juniorx": true}'::jsonb)$q$, 'invalid_input', 'unknown setting');
  s := public.session_start('geography', 1);
  perform test.assert(test.jrun(a), 'run marked junior');
  perform test.assert(test.jdl(a) > interval '50 minutes', 'no clock for juniors');

  perform test.login(b);
  s := public.session_start('geography', 1);
  perform test.assert(not test.jrun(b), 'normal run');
  perform test.assert(test.jdl(b) < interval '1 minute', 'normal clock');
end $$;
rollback;
