-- Extended time (accessibility): deadlines stretch 1.5x, only for users who turned it on.
begin;
update public.app_config set value = value || '{"max":99}' where key = 'energy';
do $$
declare d text; i int; qid text;
begin
  foreach d in array array['easy', 'medium', 'hard', 'expert', 'legendary'] loop
    for i in 1 .. 4 loop
      qid := 'q_' || substr(md5('xt' || d || i), 1, 16);
      insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator)
      values (qid, 'israeli_football', 't', d::public.question_difficulty, 'שאלת זמן ' || d || ' ' || i, 'הסבר', 't',
              array['https://www.wikidata.org/wiki/Q1'], 'test', 'test');
      insert into public.question_answers (question_id, position, text_he, is_correct) values
        (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
    end loop;
  end loop;
end $$;
select public.refresh_question_ranks();
create temp table ids as select test.new_user() as a, test.new_user() as b;
grant select on ids to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); b uuid := (select ids.b from ids); p jsonb; s jsonb;
begin
  perform test.login(a);
  s := public.update_my_settings('{"extended_time": true}');
  perform test.assert((s -> 'settings' ->> 'extended_time')::boolean, 'setting saved');
  p := public.quiz_start();
  perform test.assert((p #>> '{question,seconds_left}')::int between 44 and 45, 'extended: 45s, got ' || (p #>> '{question,seconds_left}'));

  perform test.login(b);
  p := public.quiz_start();
  perform test.assert((p #>> '{question,seconds_left}')::int between 29 and 30, 'normal: 30s, got ' || (p #>> '{question,seconds_left}'));
  perform test.assert_raises($q$select public.update_my_settings('{"extra_lives": true}')$q$, 'invalid_input', 'unknown keys still rejected');
end $$;
rollback;

-- Picture questions: image travels in the quiz payload; bad shapes are rejected.
begin;
update public.app_config set value = value || '{"max":99}' where key = 'energy';
insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, image)
select 'q_' || substr(md5('img' || i || d), 1, 16), 'israeli_football', 't', d::public.question_difficulty, 'שאלת מפה ' || i || d, 'הסבר', 'map:t',
       array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', '{"kind":"map","map":"israel","lon":34.78,"lat":32.08}'
  from generate_series(1, 3) i, unnest(array['easy','medium','hard','expert','legendary']) d;
insert into public.question_answers (question_id, position, text_he, is_correct)
select q.id, p, case p when 0 then 'נכון' else 'לא ' || p end, p = 0 from public.questions q, generate_series(0, 3) p;
select public.refresh_question_ranks();
create temp table ids2 as select test.new_user() as a;
grant select on ids2 to authenticated;
set local role authenticated;
do $$
declare p jsonb;
begin
  perform test.login((select a from ids2));
  p := public.quiz_start();
  perform test.assert(p #>> '{question,image,map}' = 'israel' and (p #>> '{question,image,lat}')::numeric = 32.08, 'image in payload: ' || coalesce(p #>> '{question,image}', 'null'));
end $$;
reset role;
do $$
begin
  perform test.assert_raises($q$insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, image)
    values ('q_ffffffffffffffff', 'clubs', 't', 'easy', 'שאלה עם תמונה', 'x', 't', array['https://x'], 't', 't', '{"kind":"photo","url":"https://evil"}')$q$, 'questions_image_shape', 'only map images allowed');
end $$;
rollback;
