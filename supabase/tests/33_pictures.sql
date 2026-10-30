-- Picture questions: the random share mixes pictures into every mode's picks.
begin;
do $$
declare i int; qid text;
begin
  for i in 1 .. 40 loop
    qid := 'q_' || substr(md5('pic' || i), 1, 16);
    insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity, image)
    values (qid, 'nature', 't', 'easy', 'שאלת תמונה מספר ' || i, 'הסבר', 'pic', array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', i / 40.0,
            case when i % 2 = 0 then '{"kind":"photo","url":"https://upload.wikimedia.org/x.jpg","credit":"x"}'::jsonb end);
    insert into public.question_answers (question_id, position, text_he, is_correct) values
      (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
  end loop;
  perform public.refresh_question_ranks();
end $$;

do $$
declare n int := 0; k int; v text; w text := (select world from public.questions where template = 'pic' limit 1);
begin
  perform test.assert((select count(*) from public.questions where template = 'pic' and img_rank is not null) = 20, 'pictures ranked among pictures');
  update public.app_config set value = '1'::jsonb where key = 'questions.image_share';
  for k in 1 .. 10 loop
    v := public.pick_world_question(null, w, 0, 1, '{}');
    if (select image from public.questions where id = v) is not null then n := n + 1; end if;
  end loop;
  perform test.assert(n = 10, 'share 1: always a picture (' || n || ')');
  update public.app_config set value = '0'::jsonb where key = 'questions.image_share';
  perform test.assert(public.pick_world_question(null, w, 0, 0.05, '{}') is not null, 'share 0: still picks');
end $$;

-- picture answers: built from picture questions that share a question text
do $$
declare i int; qid text; n int;
begin
  for i in 1 .. 6 loop
    qid := 'q_' || substr(md5('inst' || i), 1, 16);
    insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity, image)
    values (qid, 'nature', 't', 'easy', 'איזה כלי נגינה רואים בתמונה?', 'הסבר', 'kids_photo:music', array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', 0.1,
            jsonb_build_object('kind', 'photo', 'url', 'https://upload.wikimedia.org/i' || i || '.jpg', 'credit', 'x'));
    insert into public.question_answers (question_id, position, text_he, is_correct) values
      (qid, 0, 'כלי ' || i, true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
  end loop;
  n := public.build_pic_answer_questions();
  perform test.assert(n = 6, 'six picture-answer questions built (' || n || ')');
  perform test.assert((select count(*) from public.question_answers a join public.questions q on q.id = a.question_id
                        where q.template = 'pic_answers' and a.image is not null) = 24, 'every answer has a photo');
  perform test.assert((select count(distinct a.text_he) from public.question_answers a join public.questions q on q.id = a.question_id
                        where q.template = 'pic_answers' and q.text_he like '%כלי 1') = 4, 'four different answers');
  perform test.assert(not exists (select 1 from public.questions where template = 'pic_answers' and ease_rank is not null), 'kept out of the general pools');
  perform test.assert((select count(*) from public.questions where template = 'pic_answers' and pa_rank is not null) = 6, 'ranked among themselves');
  perform test.assert(public.build_pic_answer_questions() = 0, 'built once');
end $$;

rollback;
