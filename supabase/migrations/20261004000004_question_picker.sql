-- =============================================================================
-- Migration 0005 — Smarter question picking.
--
--  * 80% Israeli football / 20% world football (app_config 'quiz.israeli_share').
--  * A gentle difficulty curve: each rung draws from a window of "ease rank"
--    (0 = best known, 1 = only experts), computed separately for Israeli and
--    world questions so each pool has its own easy end.
--  * `obscurity` comes from the generator (fame + recency); `ease_rank` is its
--    percentile inside the pool, refreshed by refresh_question_ranks().
-- =============================================================================

alter table public.questions add column obscurity real;
alter table public.questions add column ease_rank real;
alter table public.questions add column is_israeli boolean
  generated always as (category = 'israeli_football' or coalesce(tags ->> 'country', '') = 'israel') stored;

create index questions_pool_idx on public.questions (status, is_israeli, ease_rank);

insert into public.app_config (key, value, is_public) values
  ('quiz.israeli_share', '0.8'::jsonb, true),
  -- [low, high] ease-rank window per rung (1..12)
  ('quiz.rung_windows', '[[0,0.06],[0,0.10],[0.03,0.16],[0.08,0.24],[0.14,0.32],[0.22,0.42],
                          [0.30,0.52],[0.40,0.62],[0.50,0.72],[0.60,0.82],[0.70,0.92],[0.80,1]]'::jsonb, true)
on conflict (key) do nothing;

/** Recomputes ease_rank for active questions (run after every import). */
create function public.refresh_question_ranks() returns integer
language plpgsql volatile security definer set search_path = '' as $$
declare v_n integer;
begin
  with ranked as (
    select id, percent_rank() over (
             partition by is_israeli
             order by coalesce(obscurity,
               case difficulty when 'easy' then 0.1 when 'medium' then 0.3 when 'hard' then 0.5
                               when 'expert' then 0.7 else 0.9 end), id) as r
      from public.questions where status = 'active')
  update public.questions q set ease_rank = ranked.r from ranked where q.id = ranked.id;
  get diagnostics v_n = row_count;
  update public.questions set ease_rank = null where status <> 'active' and ease_rank is not null;
  return v_n;
end $$;

/**
 * Picks the question for a rung: Israeli with probability israeli_share, inside
 * the rung's ease window, unseen by this player, not the previous category.
 * Widens step by step when a pool runs dry, so a run never gets stuck.
 */
create or replace function public.quiz_pick_question(p_user uuid, p_run uuid, p_difficulty public.question_difficulty)
returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_id    text;
  v_prev  text;
  v_rung  integer;
  v_lo    real;
  v_hi    real;
  v_share real;
  v_isr   boolean;
  v_pad   real;
  v_pool  boolean;
begin
  select rung into v_rung from public.quiz_runs where id = p_run;
  select (c.value -> (v_rung - 1) ->> 0)::real, (c.value -> (v_rung - 1) ->> 1)::real
    into v_lo, v_hi from public.app_config c where c.key = 'quiz.rung_windows';
  select (value #>> '{}')::real into v_share from public.app_config where key = 'quiz.israeli_share';
  v_isr := random() < coalesce(v_share, 0.8);

  select q.category into v_prev
    from public.quiz_run_questions rq join public.questions q on q.id = rq.question_id
   where rq.run_id = p_run order by rq.rung desc limit 1;

  -- Try: preferred pool, then the other pool; window widens by 0.1 each pass.
  foreach v_pool in array array[v_isr, not v_isr] loop
    v_pad := 0;
    while v_pad <= 0.3 loop
      select q.id into v_id from public.questions q
       where q.status = 'active' and q.is_israeli = v_pool
         and q.ease_rank between coalesce(v_lo, 0) - v_pad and coalesce(v_hi, 1) + v_pad
         and (v_pool or q.category is distinct from v_prev)  -- Israeli pool is one category by design
         and not exists (select 1 from public.seen_questions s where s.user_id = p_user and s.question_id = q.id)
       order by random() limit 1;
      if v_id is not null then return v_id; end if;
      v_pad := v_pad + 0.1;
    end loop;
  end loop;

  -- Everything nearby was seen: allow repeats (never inside the same run).
  select q.id into v_id from public.questions q
   where q.status = 'active' and q.is_israeli = v_isr
     and q.ease_rank between coalesce(v_lo, 0) - 0.1 and coalesce(v_hi, 1) + 0.1
     and not exists (select 1 from public.quiz_run_questions rq where rq.run_id = p_run and rq.question_id = q.id)
   order by random() limit 1;
  if v_id is null then
    select q.id into v_id from public.questions q
     where q.status = 'active' and q.difficulty = p_difficulty
       and not exists (select 1 from public.quiz_run_questions rq where rq.run_id = p_run and rq.question_id = q.id)
     order by random() limit 1;
  end if;
  if v_id is null then
    raise exception 'invalid_state: no questions available' using errcode = 'P0001';
  end if;
  return v_id;
end $$;

-- The import now carries the generator's obscurity score.
create or replace function public.import_questions(p_token text, p_rows jsonb) returns integer
language plpgsql security definer set search_path = '' as $$
declare
  v_hash text;
  v_row  jsonb;
  v_n    integer := 0;
  v_i    integer;
begin
  select value #>> '{}' into v_hash from public.app_config where key = 'ops.import_token_sha256';
  if v_hash is null or v_hash <> encode(extensions.digest(coalesce(p_token, ''), 'sha256'), 'hex') then
    raise exception 'not_authorized' using errcode = '42501';
  end if;
  if jsonb_typeof(p_rows) <> 'array' or jsonb_array_length(p_rows) > 1000 then
    raise exception 'invalid_input: rows' using errcode = '22023';
  end if;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    if jsonb_array_length(v_row -> 'answers_he') <> 4 then
      raise exception 'invalid_input: % must have 4 answers', v_row ->> 'id' using errcode = '22023';
    end if;
    insert into public.questions as q (id, category, topic, difficulty, text_he, explanation_he, tags, template,
                                       source_urls, verified_by, volatile, review_after, generator, obscurity)
    values (
      v_row ->> 'id', v_row ->> 'category', v_row ->> 'topic', (v_row ->> 'difficulty')::public.question_difficulty,
      v_row ->> 'text_he', v_row ->> 'explanation_he', coalesce(v_row -> 'tags', '{}'::jsonb), v_row ->> 'template',
      array(select jsonb_array_elements_text(v_row -> 'source_urls')), v_row ->> 'verified_by',
      coalesce((v_row ->> 'volatile')::boolean, false),
      case when coalesce((v_row ->> 'volatile')::boolean, false) then (now() + interval '6 months')::date end,
      v_row ->> 'generator', (v_row ->> 'obscurity')::real)
    on conflict (id) do update set
      category = excluded.category, topic = excluded.topic, difficulty = excluded.difficulty,
      text_he = excluded.text_he, explanation_he = excluded.explanation_he, tags = excluded.tags,
      template = excluded.template, source_urls = excluded.source_urls, verified_by = excluded.verified_by,
      volatile = excluded.volatile, review_after = excluded.review_after, generator = excluded.generator,
      obscurity = excluded.obscurity
    where q.status <> 'retired';

    update public.question_answers set is_correct = false where question_id = v_row ->> 'id' and is_correct;
    for v_i in 0..3 loop
      insert into public.question_answers as a (question_id, position, text_he, is_correct)
      values (v_row ->> 'id', v_i, v_row -> 'answers_he' ->> v_i, v_i = 0)
      on conflict (question_id, position) do update set text_he = excluded.text_he, is_correct = excluded.is_correct;
    end loop;
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;

revoke execute on function public.refresh_question_ranks() from public, anon, authenticated;
revoke execute on function public.quiz_pick_question(uuid, uuid, public.question_difficulty) from public, anon, authenticated;
revoke execute on function public.import_questions(text, jsonb) from public, authenticated;
grant execute on function public.import_questions(text, jsonb) to anon;

select public.refresh_question_ranks();
