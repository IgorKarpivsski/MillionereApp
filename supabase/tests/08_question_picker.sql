-- Picker: 80/20 Israeli share and an easy start.
begin;

do $$
declare i int; qid text;
begin
  for i in 1 .. 400 loop
    qid := 'q_' || substr(md5('pick' || i), 1, 16);
    insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity)
    values (qid, case when i % 2 = 0 then 'israeli_football' else (array['world_cup','clubs','players','la_liga'])[1 + (i / 2) % 4] end,
            't', 'easy', 'שאלת בדיקה מספר ' || i, 'הסבר', 't', array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', (i % 100) / 100.0);
    insert into public.question_answers (question_id, position, text_he, is_correct) values
      (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
  end loop;
  perform public.refresh_question_ranks();
end $$;

select test.assert((select count(*) from public.questions where ease_rank is null and status = 'active') = 0, 'every active question ranked');
select test.assert((select count(*) from public.questions where is_israeli) = 200, 'israeli flag from category');

create temp table picks (rung int, isr boolean, rank real);
grant all on picks to authenticated;
create temp table u as select test.new_user() as id;
grant select on u to authenticated;

set local role authenticated;
do $$
declare p jsonb; run uuid; k int;
begin
  perform test.login((select id from u));
  for k in 1 .. 50 loop
    p := public.quiz_start();
  end loop;
end $$;
reset role;

-- Read what was served (as owner).
insert into picks
select rq.rung, q.is_israeli, q.ease_rank
  from public.quiz_run_questions rq join public.questions q on q.id = rq.question_id;

select test.assert((select count(*) from picks) = 50, '50 first questions served');
select test.assert((select avg(case when isr then 1 else 0 end) from picks) between 0.6 and 0.95, 'about 80% Israeli');
select test.assert((select max(rank) from picks) <= 0.31, 'rung 1 stays at the easy end (window + widening)');
select test.assert((select percentile_cont(0.5) within group (order by rank) from picks) <= 0.12, 'rung 1 is mostly the easiest');

rollback;
