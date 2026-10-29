-- King of the hill, true or false, the sticker market, friend brings friend.
begin;

do $$
declare i int; qid text;
begin
  for i in 1 .. 80 loop
    qid := 'q_' || substr(md5('stm' || i), 1, 16);
    insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity)
    values (qid, 'geography', 't', 'easy', 'שאלת הגבעה גאוגרפיה ' || i, 'הסבר', 't', array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', i / 80.0);
    insert into public.question_answers (question_id, position, text_he, is_correct) values
      (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
  end loop;
  perform public.refresh_question_ranks();
  update public.app_config set value = (select jsonb_agg(case when x ->> 'slug' = 'geography'
                                                          then x || '{"levels": 6}' else x || '{"active": false}' end)
                                          from jsonb_array_elements(value) x) where key = 'worlds';
end $$;

create function test.sv_slot(p_run uuid) returns int language sql security definer set search_path = '' as $$
  select public.mode_correct_slot(current_qid, perm) from public.survival_runs where id = p_run $$;
create function test.tf_true(p_run uuid) returns boolean language sql security definer set search_path = '' as $$
  select is_true from public.tf_runs where id = p_run $$;
create function test.tf_end_now(p_run uuid) returns void language sql security definer set search_path = '' as $$
  update public.tf_runs set ends_at = now() - interval '2 seconds' where id = p_run $$;
create function test.tf_go(p_run uuid) returns void language sql security definer set search_path = '' as $$
  update public.tf_runs set started_at = now() - interval '1 second', ends_at = now() + interval '59 seconds' where id = p_run $$;
create function test.coins(p_user uuid) returns bigint language sql security definer set search_path = '' as $$
  select coins from public.wallets where user_id = p_user $$;
create function test.gems2(p_user uuid) returns bigint language sql security definer set search_path = '' as $$
  select gems from public.wallets where user_id = p_user $$;
create function test.add_gems(p_user uuid, n int) returns void language plpgsql security definer set search_path = '' as $$
begin perform public.ledger_apply(p_user, 'gems', n, 'test', 'test', 'x', 'test_gems:' || p_user); end $$;
create function test.give2(p_user uuid, p_item text, n int) returns void language sql security definer set search_path = '' as $$
  insert into public.user_collectibles (user_id, item_id, count) values (p_user, p_item, n)
  on conflict (user_id, item_id) do update set count = n $$;
create function test.cnt(p_user uuid, p_item text) returns int language sql security definer set search_path = '' as $$
  select coalesce((select count from public.user_collectibles where user_id = p_user and item_id = p_item), 0) $$;
create function test.item2(p_rarity text, n int) returns text language sql security definer set search_path = '' as $$
  select id from public.collectibles where rarity = p_rarity and active order by id offset n limit 1 $$;
create function test.last_week_survival(p_user uuid, n int) returns void language sql security definer set search_path = '' as $$
  insert into public.survival_runs (user_id, started_at, ended_at, correct, status)
  values (p_user, public.israel_week_start() - interval '2 days', public.israel_week_start() - interval '2 days', n, 'done') $$;
create function test.unsettle_week() returns void language sql security definer set search_path = '' as $$
  delete from public.survival_week_awards $$;
create function test.age_profile(p_user uuid) returns void language sql security definer set search_path = '' as $$
  update public.profiles set created_at = now() - interval '30 days' where id = p_user $$;
create function test.tokens(p_user uuid, p_pack text) returns int language sql security definer set search_path = '' as $$
  select coalesce((select count from public.user_pack_tokens where user_id = p_user and pack = p_pack), 0) $$;
create function test.fake_games(p_user uuid, n int) returns void language sql security definer set search_path = '' as $$
  insert into public.quiz_runs (user_id, status, correct, started_at, ended_at)
  select p_user, 'won', 6, now() - make_interval(days => g % 2), now() - make_interval(days => g % 2) from generate_series(1, n) g $$;
create function test.vip(p_user uuid) returns boolean language sql security definer set search_path = '' as $$
  select public.is_vip(p_user) $$;
grant execute on all functions in schema test to authenticated;

create temp table ids2 as select test.new_user() as a, test.new_user() as b, test.new_user() as c;
grant select on ids2 to authenticated;
create temp table extra as select array(select test.new_user() from generate_series(1, 9)) as us;
grant select on extra to authenticated;

set local role authenticated;
do $$
declare
  a uuid := (select ids2.a from ids2); b uuid := (select ids2.b from ids2); c uuid := (select ids2.c from ids2);
  p jsonb; r jsonb; run uuid; i int; g0 bigint; c0 bigint; s jsonb;
  c1 text := test.item2('common', 0); c2 text := test.item2('common', 1); c3 text := test.item2('common', 2);
  r1 text := test.item2('rare', 0);
  f uuid;
begin
  -- ---------------- king of the hill ----------------
  perform test.login(a);
  perform public.claim_welcome_bonus();
  p := public.survival_start(); run := (p ->> 'run_id')::uuid;
  perform test.assert(p -> 'question' is not null and (p ->> 'countdown')::int = 3, 'survival starts');
  for i in 1 .. 4 loop
    r := public.survival_answer(run, test.sv_slot(run));
    perform test.assert((r ->> 'was_correct')::boolean and (r ->> 'correct')::int = i, 'survival right answer ' || i);
  end loop;
  -- a mistake: down, a second chance on offer
  r := public.survival_answer(run, (test.sv_slot(run) + 1) % 4);
  perform test.assert(r ->> 'status' = 'down' and (r ->> 'can_revive')::boolean, 'mistake puts you down');
  perform test.assert_raises(format('select public.survival_revive(%L)', run), 'insufficient', 'revive needs gems');
  perform test.add_gems(a, 50);
  g0 := test.gems2(a);
  r := public.survival_revive(run);
  perform test.assert(r ->> 'status' = 'active' and r -> 'question' is not null and test.gems2(a) = g0 - 10, 'revived for 10 gems');
  r := public.survival_answer(run, test.sv_slot(run));
  perform test.assert((r ->> 'correct')::int = 5, 'keeps counting after revive');
  r := public.survival_answer(run, -1);  -- time ran out
  perform test.assert(r ->> 'status' = 'down' and not (r ->> 'can_revive')::boolean, 'only one second chance');
  c0 := test.coins(a);
  r := public.survival_finish(run);
  perform test.assert(r ->> 'status' = 'done' and (r ->> 'new_best')::boolean and (r ->> 'coins')::int = 30, 'survival paid');
  perform test.assert(test.coins(a) = c0 + 30, 'coins in the wallet');
  -- weekly table and last week's prizes
  perform test.unsettle_week();
  perform test.last_week_survival(b, 30);
  g0 := test.gems2(b);
  s := public.survival_info();
  perform test.assert((s -> 'me' ->> 'rank')::int = 1 and (s ->> 'week_best')::int = 5, 'week table');
  perform test.assert(test.gems2(b) = g0 + 40 and jsonb_array_length(s -> 'last_winners') = 1, 'last week winner paid');
  perform public.survival_info();
  perform test.assert(test.gems2(b) = g0 + 40, 'paid once');

  -- ---------------- true or false ----------------
  p := public.tf_start(); run := (p ->> 'run_id')::uuid;
  perform test.assert(p -> 'question' ->> 'claim' is not null, 'statement shown');
  perform test.tf_go(run);
  r := public.tf_answer(run, test.tf_true(run));
  perform test.assert((r ->> 'was_correct')::boolean and (r ->> 'correct')::int = 1, 'tf right');
  i := (r ->> 'seconds_left')::numeric::int;
  r := public.tf_answer(run, not test.tf_true(run));
  perform test.assert(not (r ->> 'was_correct')::boolean and (r ->> 'seconds_left')::numeric < i - 2, 'a wrong tap costs seconds');
  perform test.assert_raises(format('select public.tf_finish(%L)', run), 'still running', 'cannot finish early');
  perform test.tf_end_now(run);
  r := public.tf_finish(run);
  perform test.assert(r ->> 'status' = 'done' and (r ->> 'coins')::int = 6 and (r ->> 'best')::int = 1, 'tf paid');

  -- ---------------- market ----------------
  perform test.give2(a, c1, 3);
  perform test.give2(a, r1, 2);
  perform test.give2(b, c2, 2);
  perform test.assert_raises(format('select public.market_create(%L, %L)', r1, c2), 'rarity', 'same rarity only');
  perform test.assert_raises(format('select public.market_create(%L, %L)', c3, c2), 'not a duplicate', 'duplicates only');
  s := public.market_create(c1, c2);
  perform test.assert(jsonb_array_length(s -> 'mine') = 1, 'listed');
  perform test.assert_raises(format('select public.market_create(%L, %L)', c1, c2), 'already listed', 'no double listing');
  -- c has nothing to give: sees the listing but can't take it
  perform test.login(c);
  s := public.market_state();
  perform test.assert(jsonb_array_length(s -> 'listings') = 1 and not (s -> 'listings' -> 0 ->> 'can_take')::boolean
                      and (s -> 'listings' -> 0 ->> 'i_need')::boolean, 'c sees it');
  perform test.assert_raises(format('select public.market_take(%s)', s -> 'listings' -> 0 ->> 'id'), 'not a duplicate', 'c cannot take');
  -- b swaps instantly
  perform test.login(b);
  s := public.market_state();
  perform test.assert((s -> 'listings' -> 0 ->> 'can_take')::boolean, 'b can take');
  f := null;
  r := public.market_take((s -> 'listings' -> 0 ->> 'id')::bigint);
  perform test.assert(test.cnt(a, c1) = 2 and test.cnt(a, c2) = 1 and test.cnt(b, c1) = 1 and test.cnt(b, c2) = 1, 'swapped');
  perform test.assert_raises(format('select public.market_take(%s)', s -> 'listings' -> 0 ->> 'id'), 'gone', 'only once');
  perform test.login(a);
  s := public.market_state();
  perform test.assert((s ->> 'news')::int = 1 and s -> 'mine' -> 0 ->> 'taker' is not null, 'owner sees the swap');
  perform public.market_seen();
  perform test.assert((public.market_state() ->> 'news')::int = 0, 'seen');

  -- ---------------- friend brings friend ----------------
  s := public.referral_state();
  perform test.assert(length(s ->> 'code') = 6 and (s ->> 'qualified')::int = 0, 'a has a code');
  perform test.assert_raises(format('select public.referral_redeem(%L)', s ->> 'code'), 'own code', 'not your own');
  perform test.login(c);
  c0 := test.coins(c);
  r := public.referral_redeem(lower(s ->> 'code'));
  perform test.assert(r -> 'invited_by' ->> 'username' is not null and test.coins(c) = c0 + 300 and test.tokens(c, 'silver') >= 1, 'welcome gift');
  perform test.assert_raises(format('select public.referral_redeem(%L)', s ->> 'code'), 'already used', 'once');
  -- a's friend hasn't played yet: no prize
  perform test.login(a);
  c0 := test.coins(a);
  s := public.referral_state();
  perform test.assert(jsonb_array_length(s -> 'friends') = 1 and (s ->> 'qualified')::int = 0 and test.coins(a) = c0, 'not yet');
  perform test.fake_games(c, 3);
  s := public.referral_state();
  perform test.assert((s ->> 'qualified')::int = 1 and test.coins(a) = c0 + 300, 'friend qualified: prize');
  -- three more friends → first goal; old accounts can't join
  perform test.age_profile(b);
  perform test.login(b);
  perform test.assert_raises(format('select public.referral_redeem(%L)', s ->> 'code'), 'too late', 'old accounts');
  for i in 1 .. 9 loop
    f := (select extra.us[i] from extra);
    perform test.login(f);
    perform public.claim_welcome_bonus();
    perform public.referral_redeem(s ->> 'code');
    perform test.fake_games(f, 3);
  end loop;
  perform test.login(a);
  g0 := test.gems2(a);
  s := public.referral_state();
  perform test.assert((s ->> 'qualified')::int = 10 and test.gems2(a) = g0 + 30 + 75 + 200, 'all goals paid');
  perform test.assert(test.vip(a) and test.tokens(a, 'legendary') >= 3, 'vip and legendary packs');
  perform test.assert(exists (select 1 from jsonb_array_elements(public.my_flair() -> 'frames') x
                              where x ->> 'key' = 'ambassador' and (x ->> 'unlocked')::boolean), 'ambassador frame');
  g0 := test.gems2(a);
  perform public.referral_state();
  perform test.assert(test.gems2(a) = g0, 'goals paid once');
end $$;
rollback;
