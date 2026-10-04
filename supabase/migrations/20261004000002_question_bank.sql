-- =============================================================================
-- Migration 0003 — Question bank.
--
-- Clients have NO direct access to questions or answers (no RLS policies):
-- the quiz RPCs (Phase 2) serve one question at a time without the correct
-- answer. This prevents scraping the bank and reading answers from the API.
--
-- Bulk loading goes through import_questions(), which requires a one-time
-- import token whose SHA-256 is stored in app_config (private). Remove the
-- config row to disable importing.
-- =============================================================================

create type public.question_difficulty as enum ('easy', 'medium', 'hard', 'expert', 'legendary');
create type public.question_status as enum ('active', 'review', 'retired');

create table public.question_categories (
  slug    text primary key,
  name_he text not null,
  sort    integer not null default 0,
  constraint question_categories_slug check (slug ~ '^[a-z0-9_]{2,40}$')
);

insert into public.question_categories (slug, name_he, sort) values
  ('world_cup', 'מונדיאל', 1),
  ('champions_league', 'ליגת האלופות', 2),
  ('israeli_football', 'כדורגל ישראלי', 3),
  ('premier_league', 'כדורגל אנגלי', 4),
  ('la_liga', 'כדורגל ספרדי', 5),
  ('serie_a', 'כדורגל איטלקי', 6),
  ('bundesliga', 'כדורגל גרמני', 7),
  ('ligue_1', 'כדורגל צרפתי', 8),
  ('international', 'טורנירים בינלאומיים', 9),
  ('legends', 'אגדות', 10),
  ('players', 'שחקנים', 11),
  ('clubs', 'מועדונים', 12),
  ('stadiums', 'אצטדיונים', 13),
  ('records', 'שיאים', 14),
  ('history', 'היסטוריה', 15);

create table public.questions (
  id             text primary key,
  category       text not null references public.question_categories (slug),
  topic          text not null,
  difficulty     public.question_difficulty not null,
  text_he        text not null,
  explanation_he text not null,
  tags           jsonb not null default '{}'::jsonb,
  template       text not null,
  source_urls    text[] not null,
  verified_by    text not null,
  volatile       boolean not null default false,
  review_after   date,
  status         public.question_status not null default 'active',
  report_count   integer not null default 0,
  generator      text not null,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  constraint questions_id_format check (id ~ '^q_[0-9a-f]{16}$'),
  constraint questions_text_len check (char_length(text_he) between 8 and 200),
  constraint questions_has_source check (cardinality(source_urls) >= 1),
  constraint questions_volatile_review check (not volatile or review_after is not null)
);
create index questions_pick_idx on public.questions (status, difficulty, category);
create trigger questions_updated_at before update on public.questions
  for each row execute function public.set_updated_at();

create table public.question_answers (
  question_id text not null references public.questions (id) on delete cascade,
  position    smallint not null,
  text_he     text not null,
  is_correct  boolean not null,
  primary key (question_id, position),
  constraint question_answers_position check (position between 0 and 3),
  constraint question_answers_text_len check (char_length(text_he) between 1 and 80)
);
create unique index question_answers_one_correct on public.question_answers (question_id) where is_correct;

alter table public.question_categories enable row level security;
alter table public.questions enable row level security;
alter table public.question_answers enable row level security;
create policy question_categories_read on public.question_categories for select to anon, authenticated using (true);
revoke all on public.questions, public.question_answers from anon, authenticated;
revoke insert, update, delete, truncate on public.question_categories from anon, authenticated;

-- Bulk import (upsert). p_rows: array of generator rows (content/questions/questions.jsonl).
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
                                       source_urls, verified_by, volatile, review_after, generator)
    values (
      v_row ->> 'id', v_row ->> 'category', v_row ->> 'topic', (v_row ->> 'difficulty')::public.question_difficulty,
      v_row ->> 'text_he', v_row ->> 'explanation_he', coalesce(v_row -> 'tags', '{}'::jsonb), v_row ->> 'template',
      array(select jsonb_array_elements_text(v_row -> 'source_urls')), v_row ->> 'verified_by',
      coalesce((v_row ->> 'volatile')::boolean, false),
      case when coalesce((v_row ->> 'volatile')::boolean, false) then (now() + interval '6 months')::date end,
      v_row ->> 'generator')
    on conflict (id) do update set
      category = excluded.category, topic = excluded.topic, difficulty = excluded.difficulty,
      text_he = excluded.text_he, explanation_he = excluded.explanation_he, tags = excluded.tags,
      template = excluded.template, source_urls = excluded.source_urls, verified_by = excluded.verified_by,
      volatile = excluded.volatile, review_after = excluded.review_after, generator = excluded.generator
    where q.status <> 'retired';

    -- Clear the old correct flag first so the one-correct index never sees two.
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

revoke execute on function public.import_questions(text, jsonb) from public, authenticated;
grant execute on function public.import_questions(text, jsonb) to anon;
