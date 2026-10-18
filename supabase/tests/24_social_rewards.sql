-- Photos for everyone, online friends, gifts, multi-sticker trades, quick head-to-head,
-- family invites + play again, combo points, perfect prize, double points, monthly table.
begin;

do $$
declare i int; qid text;
begin
  for i in 1 .. 60 loop
    qid := 'q_' || substr(md5('soc' || i), 1, 16);
    insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity)
    values (qid, 'geography', 't', 'easy', 'שאלת עולם גאוגרפיה ' || i, 'הסבר', 't', array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', i / 60.0);
    insert into public.question_answers (question_id, position, text_he, is_correct) values
      (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
  end loop;
  perform public.refresh_question_ranks();
  update public.app_config set value = (select jsonb_agg(case when x ->> 'slug' = 'geography'
                                                          then x || '{"levels": 6}' else x || '{"active": false}' end)
                                          from jsonb_array_elements(value) x) where key = 'worlds';
end $$;

create function test.give(p_user uuid, p_item text, n int) returns void language sql security definer set search_path = '' as $$
  insert into public.user_collectibles (user_id, item_id, count) values (p_user, p_item, n)
  on conflict (user_id, item_id) do update set count = n $$;
create function test.count_of(p_user uuid, p_item text) returns int language sql security definer set search_path = '' as $$
  select coalesce((select count from public.user_collectibles where user_id = p_user and item_id = p_item), 0) $$;
create function test.item(p_rarity text, n int) returns text language sql security definer set search_path = '' as $$
  select id from public.collectibles where rarity = p_rarity and active order by id offset n limit 1 $$;
create function test.befriend2(p_a uuid, p_b uuid) returns void language sql security definer set search_path = '' as $$
  insert into public.friendships (user_a, user_b, status, requested_by) values (least(p_a, p_b), greatest(p_a, p_b), 'accepted', p_a) $$;
create function test.photo(p_user uuid) returns void language sql security definer set search_path = '' as $$
  update public.profiles set photo_url = 'https://lh3.googleusercontent.com/x' where id = p_user $$;
create function test.cslot2(p_run uuid) returns int language sql security definer set search_path = '' as $$
  select (s.slot - 1)::int from public.quiz_runs r
    join public.quiz_run_questions rq on rq.run_id = r.id and rq.rung = r.rung
    cross join lateral unnest(rq.perm) with ordinality as s(pos, slot)
   where r.id = p_run and s.pos = 0 $$;
create function test.gems(p_user uuid) returns bigint language sql security definer set search_path = '' as $$
  select gems from public.wallets where user_id = p_user $$;
create function test.points(p_run uuid) returns int language sql security definer set search_path = '' as $$
  select prize_points from public.quiz_runs where id = p_run $$;
create function test.last_month_run(p_user uuid) returns void language sql security definer set search_path = '' as $$
  insert into public.quiz_runs (user_id, mode, world, level, status, ended_at, prize_points)
  values (p_user, 'session', 'geography', 1, 'won', public.israel_month_start() - interval '3 days', 5000) $$;
create function test.family_done(p_room uuid) returns void language sql security definer set search_path = '' as $$
  update public.family_rooms set status = 'done', phase = 'done', finished_at = now() where id = p_room $$;
create function test.start_now(p_room uuid) returns void language sql security definer set search_path = '' as $$
  update public.match_rooms set started_at = now() - interval '1 second' where id = p_room $$;
grant execute on all functions in schema test to authenticated;
create temp table ids as select test.new_user() as a, test.new_user() as b, test.new_user() as c;
grant select on ids to authenticated;

set local role authenticated;
do $$
declare
  a uuid := (select ids.a from ids); b uuid := (select ids.b from ids); c uuid := (select ids.c from ids);
  s jsonb; r jsonb; room uuid; p jsonb; run uuid; i int; g0 bigint;
  c1 text := test.item('common', 0); c2 text := test.item('common', 1); u1 text := test.item('uncommon', 0);
  ep text := test.item('epic', 0);
begin
  perform test.befriend2(a, b);
  perform test.photo(b);

  -- photos are visible to everyone
  perform test.login(a);
  perform test.assert(public.friend_profile(b) -> 'profile' ->> 'photo' is not null, 'friend photo');
  perform test.assert(public.call_candidates() -> 0 ->> 'photo' is not null, 'call list photo');

  -- online status
  perform test.login(b); perform public.presence_ping();
  perform test.login(a);
  s := public.friends_state();
  perform test.assert((s -> 'friends' -> 0 ->> 'online')::boolean and s -> 'friends' -> 0 ->> 'photo' is not null, 'b online with photo');
  perform test.assert((s ->> 'gifts_left')::int = 3, 'three gifts a day');

  -- gifts: duplicates only, up to rare, 3 a day
  perform test.give(a, c1, 5); perform test.give(a, ep, 3); perform test.give(a, u1, 1);
  perform test.assert_raises(format('select public.sticker_gift(%L, %L)', b, ep), 'rarity', 'epic not giftable');
  perform test.assert_raises(format('select public.sticker_gift(%L, %L)', b, u1), 'not a duplicate', 'last copy stays');
  perform test.assert_raises(format('select public.sticker_gift(%L, %L)', c, c1), 'not friends', 'friends only');
  for i in 1 .. 3 loop r := public.sticker_gift(b, c1); end loop;
  perform test.assert((r ->> 'left')::int = 0 and test.count_of(a, c1) = 2 and test.count_of(b, c1) = 3, 'three gifts moved');
  perform test.assert_raises(format('select public.sticker_gift(%L, %L)', b, c1), 'rate_limited', 'fourth gift blocked');

  -- trades with several stickers
  perform test.give(a, c2, 2); perform test.give(b, u1, 2);
  r := public.trade_offer_multi(b, array[c1, c2], array[u1]);
  perform test.login(b);
  s := public.friends_state();
  perform test.assert(jsonb_array_length(s -> 'trades' -> 0 -> 'give_items') = 2, 'multi trade listed');
  perform public.trade_respond((s -> 'trades' -> 0 ->> 'id')::uuid, true);
  perform test.assert(test.count_of(b, c1) = 4 and test.count_of(b, c2) = 1 and test.count_of(a, u1) = 2, 'multi trade swapped');

  -- head to head: both answered → reveal right away
  perform test.login(a);
  r := public.match_create(); room := (r ->> 'room_id')::uuid;
  perform test.login(b); perform public.match_join(r ->> 'code');
  perform test.start_now(room);
  perform public.match_answer(room, 0, 0);
  perform test.assert(public.match_state(room) ->> 'phase' = 'question', 'waits for the other player');
  perform test.login(a); perform public.match_answer(room, 0, 1);
  perform test.assert(public.match_state(room) ->> 'phase' = 'reveal', 'both answered: reveal now');

  -- family: invite an online friend, play again with the same people
  r := public.family_create('mix', 15); room := (r ->> 'room_id')::uuid;
  perform public.family_invite(room, b);
  perform test.login(b);
  s := public.presence_ping();
  perform test.assert(jsonb_array_length(s -> 'family_invites') = 1, 'b sees the family invite');
  perform public.family_invite_answer((s -> 'family_invites' -> 0 ->> 'id')::bigint, true);
  perform test.assert(jsonb_array_length(public.family_state(room) -> 'players') = 2, 'b joined');
  perform test.family_done(room);
  perform test.login(a);
  r := public.family_again(room);
  perform test.login(b);
  perform test.assert(public.family_state(room) ->> 'next_code' = r ->> 'code', 'b sees the rematch room');

  -- session: combo points and the perfect prize
  perform test.login(c);
  perform public.claim_welcome_bonus();
  p := public.session_start('geography', 1); run := (p ->> 'run_id')::uuid;
  g0 := test.gems(c);
  for i in 1 .. 10 loop
    if i > 1 then p := public.session_next(run); end if;
    r := public.session_answer(run, i, test.cslot2(run));
    if i = 1 then perform test.assert((r ->> 'combo_bonus')::int = 0, 'no combo on the first'); end if;
    if i = 3 then perform test.assert((r ->> 'combo')::int = 3 and (r ->> 'combo_bonus')::int = 10, 'combo from the third'); end if;
    if i = 10 then perform test.assert((r ->> 'combo_bonus')::int = 50, 'combo capped'); end if;
  end loop;
  perform test.assert(r -> 'summary' -> 'perfect' is not null and test.gems(c) = g0 + 5, 'perfect run prize');

  -- double points for an ad
  i := test.points(run);
  perform public.claim_ad_reward('double_points', run::text);
  perform test.assert(test.points(run) = i * 2, 'points doubled');
  perform test.assert_raises(format('select public.claim_ad_reward(%L, %L)', 'double_points', run), 'already claimed', 'once');

  -- all-time and monthly tables; last month's winner is paid once
  perform test.last_month_run(b);
  g0 := test.gems(b);
  s := public.leaderboard_board('month');
  perform test.assert(jsonb_array_length(s -> 'prizes') = 3 and s ->> 'ends_at' is not null, 'monthly table');
  perform test.assert(test.gems(b) = g0 + 50 and jsonb_array_length(s -> 'last_winners') >= 1, 'last month winner paid');
  perform public.leaderboard_board('month');
  perform test.assert(test.gems(b) = g0 + 50, 'paid only once');
  s := public.leaderboard_board('all');
  perform test.assert(jsonb_array_length(s -> 'rows') >= 2, 'all-time table');
end $$;
rollback;
