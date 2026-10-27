-- Names, free first week, missions, streak freeze, mistakes, reactions, friends,
-- flair, rematch invites, weekly event, community questions, starter deal.
begin;
do $$
declare i int; qid text; w text;
begin
  foreach w in array array['geography', 'science'] loop
    for i in 1 .. 40 loop
      qid := 'q_' || substr(md5('teen' || w || i), 1, 16);
      insert into public.questions (id, category, topic, difficulty, text_he, explanation_he, template, source_urls, verified_by, generator, obscurity)
      values (qid, w, 't', 'easy', 'שאלה ' || w || ' ' || i, 'הסבר', 't', array['https://www.wikidata.org/wiki/Q1'], 'test', 'test', i / 40.0);
      insert into public.question_answers (question_id, position, text_he, is_correct) values
        (qid, 0, 'נכון', true), (qid, 1, 'לא 1', false), (qid, 2, 'לא 2', false), (qid, 3, 'לא 3', false);
    end loop;
  end loop;
  perform public.refresh_question_ranks();
  update public.app_config set value = (select jsonb_agg(case when x ->> 'slug' in ('geography', 'science')
                                                          then x else x || '{"active": false}' end)
                                          from jsonb_array_elements(value) x) where key = 'worlds';
end $$;

create function test.age(p_user uuid, days int) returns void language sql security definer set search_path = '' as $$
  update public.profiles set created_at = now() - make_interval(days => days) where id = p_user $$;
create function test.streak(p_user uuid, cur int, last date, fr int) returns void language sql security definer set search_path = '' as $$
  insert into public.user_streaks (user_id, current, best, last_day, freezes) values (p_user, cur, cur, last, fr)
  on conflict (user_id) do update set current = cur, last_day = last, freezes = fr $$;
create function test.bshift(p_run uuid) returns void language sql security definer set search_path = '' as $$
  update public.blitz_runs set started_at = started_at - interval '70 seconds', ends_at = ends_at - interval '70 seconds' where id = p_run $$;
create function test.make_admin(p_user uuid) returns void language sql security definer set search_path = '' as $$
  insert into public.admin_users (user_id) values (p_user) on conflict do nothing $$;
create function test.befriend(p_a uuid, p_b uuid) returns void language sql security definer set search_path = '' as $$
  insert into public.friendships (user_a, user_b, status, requested_by) values (least(p_a, p_b), greatest(p_a, p_b), 'accepted', p_a) $$;
create function test.finish_match(p_room uuid) returns void language sql security definer set search_path = '' as $$
  update public.match_rooms set started_at = now() - interval '200 seconds' where id = p_room $$;
create function test.wrong(p_user uuid) returns void language plpgsql security definer set search_path = '' as $$
declare r uuid;
begin
  insert into public.quiz_runs (user_id, mode, world, level, status, ended_at) values (p_user, 'session', 'science', 1, 'won', now()) returning id into r;
  insert into public.quiz_run_questions (run_id, rung, question_id, perm, deadline, answered_slot, is_correct, answered_at)
  values (r, 1, 'q_' || substr(md5('teenscience3'), 1, 16), '{0,1,2,3}', now(), 1, false, now());
end $$;
create function test.coins_set(p_user uuid, n bigint) returns void language sql security definer set search_path = '' as $$ update public.wallets set coins = n where user_id = p_user $$;
create function test.today() returns date language sql security definer set search_path = '' as $$ select public.israel_today() $$;
grant execute on all functions in schema test to authenticated;
create temp table ids as select test.new_user() as a, test.new_user() as b, test.new_user() as c;
grant select on ids to authenticated;

set local role authenticated;
do $$
declare
  a uuid := (select ids.a from ids); b uuid := (select ids.b from ids); c uuid := (select ids.c from ids);
  s jsonb; r jsonb; k text; room uuid; inv bigint; n int; c0 bigint;
begin
  perform test.login(a);
  s := public.get_my_state();
  perform test.assert(s -> 'profile' ->> 'username' ~ '^[^_]+_[^_]+([0-9]{2})?$', 'fun default name: ' || (s -> 'profile' ->> 'username'));

  -- free first week: 7 games in a row without spending a ticket
  s := public.energy_state();
  perform test.assert((s ->> 'unlimited')::boolean and s ->> 'newbie_until' is not null, 'newbie unlimited');
  for n in 1 .. 7 loop perform public.blitz_start(); end loop;
  perform test.age(a, 10);
  s := public.energy_state();
  perform test.assert(not (s ->> 'unlimited')::boolean and s ->> 'newbie_until' is null, 'after a week: normal tickets');

  -- missions
  s := public.missions_state();
  perform test.assert(jsonb_array_length(s -> 'missions') = 5 and jsonb_array_length(s -> 'week' -> 'missions') = 6, 'five daily and six weekly missions');
  -- the blitz games above may already complete a mission: pick one still open
  select m ->> 'key' into k from jsonb_array_elements(s -> 'missions') m
   where (m ->> 'progress')::int < (m ->> 'target')::int limit 1;
  perform test.assert_raises(format('select public.mission_claim(%L)', k), 'not done', 'cannot claim unfinished');
  perform test.assert_raises($q$select public.mission_claim('nope')$q$, 'invalid_input', 'unknown mission');
  perform test.assert_raises($q$select public.mission_claim('w:nope')$q$, 'invalid_input', 'unknown weekly mission');
  select m ->> 'key' into k from jsonb_array_elements(s -> 'week' -> 'missions') m
   where (m ->> 'progress')::int < (m ->> 'target')::int limit 1;
  perform test.assert(k like 'w:%', 'weekly keys are prefixed');
  perform test.assert_raises(format('select public.mission_claim(%L)', k), 'not done', 'cannot claim an unfinished weekly mission');

  -- streak freeze: one missed day is covered
  perform test.streak(a, 5, test.today() - 2, 1);
  s := public.daily_status();
  perform test.assert((s ->> 'streak')::int = 5 and (s ->> 'freezes')::int = 1, 'streak kept by freeze: ' || s::text);
  perform test.streak(a, 5, test.today() - 3, 1);
  perform test.assert((public.daily_status() ->> 'streak')::int = 0, 'two missed days with one freeze: lost');
  perform test.coins_set(a, 1000);
  perform test.assert((public.streak_freeze_buy() ->> 'freezes')::int = 2, 'bought a freeze');
  perform test.assert_raises('select public.streak_freeze_buy()', 'max freezes', 'max two');

  -- mistakes
  perform test.wrong(a);
  s := public.my_mistakes(10);
  perform test.assert(jsonb_array_length(s) = 1 and jsonb_array_length(s -> 0 -> 'answers') = 4, 'one mistake with 4 answers');

  -- friend profile only for friends
  perform test.assert_raises(format('select public.friend_profile(%L)', b), 'not friends', 'strangers hidden');
  perform test.befriend(a, b);
  s := public.friend_profile(b);
  perform test.assert(s -> 'profile' ->> 'username' is not null and s -> 'stats' ? 'answered', 'friend profile');
  s := public.leaderboard_friends();
  perform test.assert(jsonb_array_length(s -> 'rows') = 2, 'me + friend in the table');

  -- flair: nothing unlocked yet
  s := public.my_flair();
  perform test.assert(jsonb_array_length(s -> 'frames') = 7 and jsonb_array_length(s -> 'titles') >= 8, 'flair options');
  perform test.assert_raises($q$select public.set_flair('gold', null)$q$, 'invalid_input', 'locked frame');
  perform test.assert(public.set_flair(null, null) -> 'profile' ->> 'frame' is null, 'clear flair');

  -- reactions + rematch: a vs b in a friend match
  r := public.match_create(); room := (r ->> 'room_id')::uuid;
  perform test.login(b); perform public.match_join(r ->> 'code');
  perform public.send_reaction('match', room, '🔥');
  perform test.assert_raises(format('select public.send_reaction(%L, %L, %L)', 'match', room, 'hi'), 'invalid_input', 'only fixed emojis');
  perform test.login(a);
  s := public.room_reactions('match', room, 0);
  perform test.assert(jsonb_array_length(s) = 1 and s -> 0 ->> 'emoji' = '🔥' and not (s -> 0 ->> 'me')::boolean, 'reaction seen');
  perform test.login(c);
  perform test.assert_raises(format('select public.room_reactions(%L, %L, 0)', 'match', room), 'invalid_input', 'outsider');
  perform test.login(a);
  perform test.finish_match(room);
  perform public.match_state(room);
  r := public.match_rematch(room);
  perform test.login(b);
  s := public.presence_ping();
  perform test.assert(jsonb_array_length(s -> 'invites') = 1, 'b sees the rematch invite');
  inv := (s -> 'invites' -> 0 ->> 'id')::bigint;
  r := public.match_invite_answer(inv, true);
  perform test.assert((public.match_state((r ->> 'room_id')::uuid)) ->> 'phase' = 'countdown', 'rematch starts');

  -- challenge a friend from their profile; strangers can't be challenged
  perform test.assert_raises(format('select public.match_challenge(%L)', c), 'not friends', 'no challenge to strangers');
  r := public.match_challenge(a);
  perform test.login(a);
  perform test.assert(jsonb_array_length(public.presence_ping() -> 'invites') = 1, 'a sees the challenge');
  perform test.login(b);

  -- weekly event
  s := public.event_state();
  perform test.assert((s ->> 'active')::boolean and s ->> 'world' in ('geography', 'science'), 'event world: ' || s::text);

  -- community question: c sends, admin a approves, c is paid
  perform test.login(c);
  perform test.assert_raises($q$select public.submit_question('science', 'קצר', 'א', array['ב','ג','ד'])$q$, 'invalid_input', 'too short');
  perform public.submit_question('science', 'מה הצבע של השמיים ביום בהיר?', 'כחול', array['ירוק', 'אדום', 'צהוב']);
  perform test.assert(jsonb_array_length(public.my_submissions()) = 1, 'my submission listed');
  perform test.login(a);
  perform test.assert_raises('select public.admin_submissions()', 'not_admin', 'admins only');
  perform test.make_admin(a);
  s := public.admin_submissions();
  r := public.admin_review_submission((s -> 0 ->> 'id')::bigint, true);
  perform test.assert(r ->> 'question_id' is not null, 'approved into the bank');

  -- starter deal in coins for newbies (c is new)
  perform test.login(c);
  s := public.deals_state();
  perform test.assert(s -> 'deal' ->> 'id' = 'starter' and s #>> '{deal,price,currency}' = 'coins', 'starter deal');
  perform test.coins_set(c, 1000);
  perform public.deal_buy('starter', 0);
  perform test.assert(public.deals_state() -> 'deal' ->> 'id' <> 'starter', 'starter bought once, then normal deals');
end $$;
rollback;
