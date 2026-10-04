-- Question bank: clients cannot read questions/answers; import needs the token.
begin;

insert into public.app_config (key, value) values
  ('ops.import_token_sha256', to_jsonb(encode(extensions.digest('test-token', 'sha256'), 'hex')));

do $$
declare n integer;
begin
  n := public.import_questions('test-token', '[{"id":"q_0123456789abcdef","category":"israeli_football","topic":"history",
    "difficulty":"easy","text_he":"מי זכתה באליפות ישראל בעונת 2011/12?","explanation_he":"קריית שמונה זכתה.",
    "answers_he":["עירוני קריית שמונה","מכבי חיפה","הפועל תל אביב","מכבי תל אביב"],"template":"winner:ISR",
    "source_urls":["https://www.wikidata.org/wiki/Q1"],"verified_by":"wikidata","volatile":false,"generator":"t"}]');
  perform test.assert(n = 1, 'one row imported');
  perform test.assert((select count(*) from public.question_answers where question_id = 'q_0123456789abcdef') = 4, 'four answers');
  perform test.assert((select text_he from public.question_answers where question_id = 'q_0123456789abcdef' and is_correct) = 'עירוני קריית שמונה', 'first answer is the correct one');
  -- re-import is idempotent
  n := public.import_questions('test-token', (select jsonb_agg(x) from (select '{"id":"q_0123456789abcdef","category":"israeli_football","topic":"history","difficulty":"medium","text_he":"מי זכתה באליפות ישראל בעונת 2011/12?","explanation_he":"קריית שמונה זכתה.","answers_he":["עירוני קריית שמונה","מכבי חיפה","הפועל תל אביב","מכבי תל אביב"],"template":"winner:ISR","source_urls":["https://www.wikidata.org/wiki/Q1"],"verified_by":"wikidata","volatile":true,"generator":"t"}'::jsonb as x) s));
  perform test.assert((select difficulty::text from public.questions where id = 'q_0123456789abcdef') = 'medium', 'upsert updates');
  perform test.assert((select review_after is not null from public.questions where id = 'q_0123456789abcdef'), 'volatile gets a review date');
  perform test.assert((select count(*) from public.question_answers where question_id = 'q_0123456789abcdef') = 4, 'still four answers');
  perform test.assert_raises($q$select public.import_questions('wrong', '[]')$q$, 'not_authorized', 'bad token rejected');
end $$;

set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  perform test.assert_raises('select count(*) from public.questions', 'permission denied', 'anon cannot read questions');
  perform test.assert_raises('select count(*) from public.question_answers', 'permission denied', 'anon cannot read answers');
  perform test.assert((select count(*) from public.question_categories) = 15, 'categories readable');
end $$;
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000009","role":"authenticated"}', true);
do $$
begin
  perform test.assert_raises('select count(*) from public.question_answers', 'permission denied', 'users cannot read answers');
  perform test.assert_raises($q$select public.import_questions('test-token', '[]')$q$, 'permission denied', 'users cannot import');
end $$;

rollback;
