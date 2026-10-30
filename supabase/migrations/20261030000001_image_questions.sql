-- =============================================================================
-- Picture questions were almost never served. ease_rank orders each world by obscurity, and
-- the photo questions (0.10–0.15) all sit just behind the easy text questions (0.05–0.10), so
-- they rank 0.6–0.9: quick play, early levels, first games and the daily challenge hardly
-- reach them. Each game now has fixed picture slots (questions 3 and 7 by default), filled
-- from the picture questions ranked among themselves, so the climb from easy to hard holds.
-- =============================================================================

alter table public.questions add column if not exists img_rank real;
create index if not exists questions_img_rank_idx on public.questions (world, img_rank) where img_rank is not null;

create or replace function public.refresh_question_ranks() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_n integer;
begin
  with ranked as (
    select id, percent_rank() over (
             partition by world
             order by coalesce(obscurity,
               case difficulty when 'easy' then 0.1 when 'medium' then 0.3 when 'hard' then 0.5
                               when 'expert' then 0.7 else 0.9 end), id) as r
      from public.questions where status = 'active')
  update public.questions q set ease_rank = ranked.r from ranked where q.id = ranked.id;
  get diagnostics v_n = row_count;
  -- picture questions ranked among themselves, for the picture slots
  with ranked as (
    select id, percent_rank() over (
             partition by world
             order by coalesce(obscurity,
               case difficulty when 'easy' then 0.1 when 'medium' then 0.3 when 'hard' then 0.5
                               when 'expert' then 0.7 else 0.9 end), id) as r
      from public.questions where status = 'active' and image is not null)
  update public.questions q set img_rank = ranked.r from ranked where q.id = ranked.id;
  update public.questions set ease_rank = null where status <> 'active' and ease_rank is not null;
  update public.questions set img_rank = null where (status <> 'active' or image is null) and img_rank is not null;
  return v_n;
end $$;
revoke all on function public.refresh_question_ranks() from public, anon, authenticated;

/** A picture question of this world near the wanted difficulty, one the player hasn't seen if possible. */
create or replace function public.pick_image_question(p_user uuid, p_world text, p_lo real, p_hi real, p_exclude text[])
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_id text; v_pad real := 0;
begin
  while v_pad <= 0.45 loop
    select q.id into v_id from public.questions q
     where q.status = 'active' and q.world = p_world and q.img_rank is not null
       and q.img_rank between p_lo - v_pad and p_hi + v_pad
       and not (q.id = any (p_exclude))
       and (p_user is null or not exists (select 1 from public.seen_questions s where s.user_id = p_user and s.question_id = q.id))
     order by random() limit 1;
    if v_id is not null then return v_id; end if;
    v_pad := v_pad + 0.15;
  end loop;
  return null;
end $$;
revoke all on function public.pick_image_question(uuid, text, real, real, text[]) from public, anon, authenticated;

update public.app_config set value = value || '{"image_rungs": [3, 7]}'::jsonb where key = 'session';

do $$
declare
  v_def text := pg_get_functiondef('public.session_next(uuid)'::regprocedure);
begin
  if position('pick_image_question' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$    v_qid := public.pick_world_question(v_uid, v_world, v_win[1], v_win[2], v_ex);$a$,
    $a$    -- picture slots: a picture question of the same difficulty step, when there is one
    if v_run.rung in (select (jsonb_array_elements_text(coalesce(v_cfg -> 'image_rungs', '[]'::jsonb)))::int) then
      v_qid := public.pick_image_question(v_uid, v_world, v_win[1], v_win[2], v_ex);
      if v_qid is null and v_run.world = 'mix' then
        v_qid := public.pick_image_question(v_uid, 'geography', v_win[1], v_win[2], v_ex);
      end if;
    end if;
    if v_qid is null then
      v_qid := public.pick_world_question(v_uid, v_world, v_win[1], v_win[2], v_ex);
    end if;$a$);
  if position('pick_image_question' in v_def) = 0 then raise exception 'session_next image patch did not apply'; end if;
  execute v_def;
end $$;

-- the daily challenge: picture questions in slots 3 and 7 of every set (from tomorrow's set on)
do $$
declare
  v_def text := pg_get_functiondef('public.daily_questions(date)'::regprocedure);
begin
  if position('img_rank' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$      v_id := null;
      v_pad := 0;$a$,
    $a$      v_id := null;
      v_pad := 0;
      if i in (3, 7) then
        select q.id into v_id from public.questions q
         where q.status = 'active' and q.world = public.world_rotation(i, p_day::text) and not q.volatile
           and q.img_rank is not null
           and q.img_rank between (v_win -> (i - 1) ->> 0)::real - 0.2 and (v_win -> (i - 1) ->> 1)::real + 0.2
           and not (q.id = any (v_ids))
           and not exists (select 1 from public.daily_challenges d where d.day > p_day - 90 and q.id = any (d.question_ids))
         order by hashtext(q.id || p_day::text) limit 1;
      end if;$a$);
  if position('img_rank' in v_def) = 0 then raise exception 'daily_questions image patch did not apply'; end if;
  execute v_def;
end $$;

select public.refresh_question_ranks();
