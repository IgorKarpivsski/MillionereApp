-- =============================================================================
-- Picture answers: "Find the right picture: <answer>" with four photos to choose from.
-- Built from the reviewed picture questions: each one whose question text is shared by at
-- least four different answers (all the "which instrument is in the picture?" questions,
-- say) becomes a picture-answer question, with three photos of the same kind as distractors.
-- They are served only in sessions (quick play and worlds), in fixed slots (question 5), and
-- ranked by difficulty among themselves.
-- =============================================================================

alter table public.question_answers add column if not exists image jsonb;
alter table public.questions add column if not exists pa_rank real;

create or replace function public.refresh_question_ranks() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_n integer;
begin
  -- picture-answer questions are kept out of the general pools (ease_rank stays null)
  with ranked as (
    select id, percent_rank() over (
             partition by world
             order by coalesce(obscurity,
               case difficulty when 'easy' then 0.1 when 'medium' then 0.3 when 'hard' then 0.5
                               when 'expert' then 0.7 else 0.9 end), id) as r
      from public.questions where status = 'active' and template <> 'pic_answers')
  update public.questions q set ease_rank = ranked.r from ranked where q.id = ranked.id;
  get diagnostics v_n = row_count;
  with ranked as (
    select id, percent_rank() over (
             partition by world
             order by coalesce(obscurity,
               case difficulty when 'easy' then 0.1 when 'medium' then 0.3 when 'hard' then 0.5
                               when 'expert' then 0.7 else 0.9 end), id) as r
      from public.questions where status = 'active' and image is not null)
  update public.questions q set img_rank = ranked.r from ranked where q.id = ranked.id;
  with ranked as (
    select id, percent_rank() over (partition by world order by coalesce(obscurity, 0.1), id) as r
      from public.questions where status = 'active' and template = 'pic_answers')
  update public.questions q set pa_rank = ranked.r from ranked where q.id = ranked.id;
  update public.questions set ease_rank = null where (status <> 'active' or template = 'pic_answers') and ease_rank is not null;
  update public.questions set img_rank = null where (status <> 'active' or image is null) and img_rank is not null;
  update public.questions set pa_rank = null where (status <> 'active' or template <> 'pic_answers') and pa_rank is not null;
  return v_n;
end $$;
revoke all on function public.refresh_question_ranks() from public, anon, authenticated;

/** A picture-answer question of this world near the wanted difficulty, unseen if possible. */
create or replace function public.pick_pic_answer_question(p_user uuid, p_world text, p_lo real, p_hi real, p_exclude text[])
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_id text; v_pad real := 0;
begin
  while v_pad <= 0.6 loop
    select q.id into v_id from public.questions q
     where q.status = 'active' and q.world = p_world and q.pa_rank is not null
       and q.pa_rank between p_lo - v_pad and p_hi + v_pad
       and not (q.id = any (p_exclude))
       and (p_user is null or not exists (select 1 from public.seen_questions s where s.user_id = p_user and s.question_id = q.id))
     order by random() limit 1;
    if v_id is not null then return v_id; end if;
    v_pad := v_pad + 0.2;
  end loop;
  return null;
end $$;
revoke all on function public.pick_pic_answer_question(uuid, text, real, real, text[]) from public, anon, authenticated;

update public.app_config set value = value || '{"pic_answer_rungs": [5]}'::jsonb where key = 'session';

do $$
declare
  v_def text := pg_get_functiondef('public.session_next(uuid)'::regprocedure);
begin
  if position('pick_pic_answer_question' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$    -- picture slots: a picture question of the same difficulty step, when there is one$a$,
    $a$    -- a "find the right picture" question in its slot (any world, when this one has none)
    if v_run.rung in (select (jsonb_array_elements_text(coalesce(v_cfg -> 'pic_answer_rungs', '[]'::jsonb)))::int) then
      v_qid := public.pick_pic_answer_question(v_uid, v_world, v_win[1], v_win[2], v_ex);
      if v_qid is null and v_run.world = 'mix' then
        v_qid := public.pick_pic_answer_question(v_uid,
                   (select q.world from public.questions q where q.pa_rank is not null and q.status = 'active'
                     order by random() limit 1), v_win[1], v_win[2], v_ex);
      end if;
    end if;
    -- picture slots: a picture question of the same difficulty step, when there is one$a$);
  v_def := replace(v_def,
    $a$    if v_run.rung in (select (jsonb_array_elements_text(coalesce(v_cfg -> 'image_rungs', '[]'::jsonb)))::int) then$a$,
    $a$    if v_qid is null and v_run.rung in (select (jsonb_array_elements_text(coalesce(v_cfg -> 'image_rungs', '[]'::jsonb)))::int) then$a$);
  if position('pick_pic_answer_question' in v_def) = 0 or position('if v_qid is null and v_run.rung in' in v_def) = 0 then
    raise exception 'session_next picture-answer patch did not apply';
  end if;
  execute v_def;
end $$;

-- the answers carry their photo
do $$
declare
  v_def text := pg_get_functiondef('public.quiz_payload(uuid)'::regprocedure);
begin
  if position('a.image' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$jsonb_build_object('slot', s.slot, 'text', a.text_he)$a$,
    $a$jsonb_build_object('slot', s.slot, 'text', a.text_he)
           || case when a.image is not null then jsonb_build_object('image', a.image) else '{}'::jsonb end$a$);
  if position('a.image' in v_def) = 0 then raise exception 'quiz_payload picture-answer patch did not apply'; end if;
  execute v_def;
end $$;

-- build them from the reviewed picture questions ------------------------------------------
create or replace function public.build_pic_answer_questions() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_n integer := 0;
begin
  drop table if exists pa_src, pa_new;
  create temp table pa_src on commit drop as
    select q.id, q.world, q.category, q.topic, q.difficulty, q.text_he, q.explanation_he, q.source_urls,
           q.obscurity, q.is_israeli, q.image, a.text_he as ans
      from public.questions q
      join public.question_answers a on a.question_id = q.id and a.is_correct
     where q.status = 'active' and q.template <> 'pic_answers' and q.image ->> 'kind' = 'photo'
       and q.text_he not like 'מי %' and char_length(a.text_he) <= 22;
  -- only question texts asked about at least four different things
  delete from pa_src s where (select count(distinct x.ans) from pa_src x where x.text_he = s.text_he) < 4;

  create temp table pa_new on commit drop as
    select s.*, 'q_' || substr(md5('pic_answers:' || s.id), 1, 16) as new_id,
           (select array_agg(d.id order by hashtext(s.id || d.id))
              from (select distinct on (x.ans) x.id from pa_src x
                     where x.text_he = s.text_he and x.ans <> s.ans
                     order by x.ans, hashtext(s.id || x.id)) d) as others
      from pa_src s
     where not exists (select 1 from public.questions q where q.id = 'q_' || substr(md5('pic_answers:' || s.id), 1, 16));

  insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls,
                                verified_by, generator, obscurity, world, status)
  select n.new_id, n.category, n.topic, n.difficulty, 'מצאו את התמונה הנכונה: ' || n.ans, n.explanation_he, 'pic_answers',
         n.source_urls, 'photo-review-2026-10-30', 'pic_answers', n.obscurity, n.world, 'active'
    from pa_new n where cardinality(n.others) >= 3;
  get diagnostics v_n = row_count;

  insert into public.question_answers (question_id, position, text_he, is_correct, image)
  select n.new_id, 0, n.ans, true, n.image from pa_new n where cardinality(n.others) >= 3
  union all
  select n.new_id, k, d.ans, false, d.image
    from pa_new n cross join generate_series(1, 3) k join pa_src d on d.id = n.others[k]
   where cardinality(n.others) >= 3;
  perform public.refresh_question_ranks();
  return v_n;
end $$;
revoke all on function public.build_pic_answer_questions() from public, anon, authenticated;

select public.build_pic_answer_questions();
