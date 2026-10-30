-- =============================================================================
-- More picture questions everywhere (2026-10-30). On top of the fixed picture slots
-- (questions 3 and 7 of a session), every question picked for any mode is a picture
-- question with probability 'questions.image_share' (0.4), same difficulty step; when no
-- unseen picture fits, it falls back to a text question. Head-to-head and the daily
-- challenge get pictures too (daily: 4 of every 10).
-- =============================================================================

insert into public.app_config (key, value, is_public) values ('questions.image_share', '0.4'::jsonb, false)
on conflict (key) do update set value = excluded.value;

create or replace function public.image_share() returns real
language sql stable set search_path = '' as $$
  select coalesce((select (value #>> '{}')::real from public.app_config where key = 'questions.image_share'), 0)
$$;

create or replace function public.pick_world_question(p_user uuid, p_world text, p_lo real, p_hi real, p_exclude text[])
returns text language plpgsql volatile security definer set search_path = '' as $$
declare v_id text; v_pad real := 0;
begin
  -- a share of all questions are picture questions (ranked among pictures, same step)
  if random() < public.image_share() then
    v_id := public.pick_image_question(p_user, p_world, p_lo, p_hi, p_exclude);
    if v_id is not null then return v_id; end if;
  end if;
  while v_pad <= 0.45 loop
    select q.id into v_id from public.questions q
     where q.status = 'active' and q.world = p_world
       and q.ease_rank between p_lo - v_pad and p_hi + v_pad
       and not (q.id = any (p_exclude))
       and (p_user is null or not exists (select 1 from public.seen_questions s where s.user_id = p_user and s.question_id = q.id))
     order by random() limit 1;
    if v_id is not null then return v_id; end if;
    v_pad := v_pad + 0.15;
  end loop;
  select q.id into v_id from public.questions q
    left join public.seen_questions s on s.user_id = p_user and s.question_id = q.id
   where q.status = 'active' and q.world = p_world
     and q.ease_rank between p_lo - 0.2 and p_hi + 0.2 and not (q.id = any (p_exclude))
   order by s.seen_at nulls first, random() limit 1;
  return v_id;
end $$;
revoke all on function public.pick_world_question(uuid, text, real, real, text[]) from public, anon, authenticated;

-- head to head: the same share of picture questions
do $$
declare
  v_def text := pg_get_functiondef('public.match_fill(uuid, uuid)'::regprocedure);
begin
  if position('img_rank' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$  for i in 1 .. v_n loop
    select q.id into v_id from public.questions q$a$,
    $a$  for i in 1 .. v_n loop
    v_id := null;
    if random() < public.image_share() then
      select q.id into v_id from public.questions q
       where q.status = 'active' and q.world = public.world_rotation(i, v_room.code) and q.img_rank is not null
         and q.img_rank between 0.02 + i * 0.04 and 0.30 + i * 0.05
         and not (q.id = any (v_ids))
       order by random() limit 1;
    end if;
    if v_id is null then
    select q.id into v_id from public.questions q$a$);
  v_def := replace(v_def,
    $a$       and not (q.id = any (v_ids))
     order by random() limit 1;
    if v_id is null then
      select q.id into v_id from public.questions q where$a$,
    $a$       and not (q.id = any (v_ids))
     order by random() limit 1;
    end if;
    if v_id is null then
      select q.id into v_id from public.questions q where$a$);
  if position('img_rank' in v_def) = 0 then raise exception 'match_fill picture patch did not apply'; end if;
  execute v_def;
end $$;

-- daily: picture questions in slots 2, 4, 7 and 9 of every set
do $$
declare
  v_def text := pg_get_functiondef('public.daily_questions(date)'::regprocedure);
begin
  if position('if i in (2, 4, 7, 9) then' in v_def) > 0 then return; end if;
  v_def := replace(v_def, 'if i in (3, 7) then', 'if i in (2, 4, 7, 9) then');
  if position('if i in (2, 4, 7, 9) then' in v_def) = 0 then raise exception 'daily picture slots patch did not apply'; end if;
  execute v_def;
end $$;
