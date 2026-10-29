-- Pre-launch QA: children's chat and photo limits, fair trades, league week and tiny groups,
-- daily sets, referral games.
begin;
create temp table ids as select test.new_user() as kid, test.new_user() as teen, test.new_user() as late;
grant select on ids to authenticated;
update public.profiles set age_band = '16plus' where id = (select teen from ids);
insert into public.friendships (user_a, user_b, status, requested_by)
select least(kid, teen), greatest(kid, teen), 'accepted', kid from ids;

set local role authenticated;
do $$
declare
  kid uuid := (select kid from ids);
  teen uuid := (select teen from ids);
begin
  perform test.login(kid);
  perform test.assert_raises(format('select public.chat_send(%L, %L)', teen, 'בוא לבית שלי ברחוב הרצל'), 'kids_quick_only', 'kid: no free text');
  perform public.chat_send(teen, 'משחק מולי?');
  perform test.assert_raises($q$select public.set_profile_photo('https://lh3.googleusercontent.com/a/x')$q$, 'kids_no_photo', 'kid: no photo');
  perform public.set_profile_photo(null);
  perform test.login(teen);
  perform test.assert_raises(format('select public.chat_send(%L, %L)', kid, 'מה שלומך היום'), 'kids_quick_only', 'to a kid: ready phrases only');
  perform public.chat_send(kid, 'כל הכבוד! 🏆');
end $$;
reset role;

-- fair trades
do $$
declare
  kid uuid := (select kid from ids);
  teen uuid := (select teen from ids);
  leg text := (select id from public.collectibles where active and rarity = 'legendary' order by id limit 1);
  com text := (select id from public.collectibles where active and rarity = 'common' order by id limit 1);
  epi text := (select id from public.collectibles where active and rarity = 'epic' order by id limit 1);
begin
  insert into public.user_collectibles (user_id, item_id, count) values (kid, leg, 2), (kid, com, 2);
  perform test.login(kid);
  perform test.assert_raises(format('select public.trade_offer_multi(%L, %L, %L)', teen, array[leg], '{}'::text[]), 'invalid_input', 'must ask for something');
  perform test.assert_raises(format('select public.trade_offer_multi(%L, %L, %L)', teen, array[leg], array[com]), 'unfair', 'legendary for a common');
  perform public.trade_offer_multi(teen, array[leg], array[epi]);
  perform public.trade_offer_multi(teen, array[com], array[epi]);
end $$;

-- league: weeks start on Sunday; a group of three moves nobody and pays only its winner
do $$
declare
  w date := public.israel_week_of(public.israel_today());
  u uuid[];
  i int;
begin
  perform test.assert(extract(dow from w) = 0, 'league week starts on Sunday');
  select array_agg(test.new_user()) into u from generate_series(1, 3);
  for i in 1 .. 3 loop
    insert into public.league_members (week, tier, group_no, user_id, joined_at) values (w - 7, 1, 1, u[i], now() - interval '8 days' + i * interval '1 minute');
    insert into public.user_leagues (user_id, tier) values (u[i], 1);
    insert into public.quiz_runs (user_id, status, prize_points, ended_at, started_at)
    values (u[i], 'won', (4 - i) * 100, (w - 3)::timestamp at time zone 'Asia/Jerusalem', (w - 3)::timestamp at time zone 'Asia/Jerusalem');
  end loop;
  for i in 1 .. 3 loop
    perform test.assert(public.league_settle(u[i]) = 1, 'tiny group: no one moves');
  end loop;
  perform test.assert((select (last_result ->> 'coins')::int > 0 from public.user_leagues where user_id = u[1]), 'winner paid');
  perform test.assert((select (last_result ->> 'coins')::int = 0 from public.user_leagues where user_id = u[2]), 'second not paid');
end $$;

-- league: when every group is full, a late player joins the emptiest group
do $$
declare
  late uuid := (select late from ids);
  w date := public.israel_week_of(public.israel_today());
  s jsonb;
begin
  update public.app_config set value = value || '{"group_size": 2}' where key = 'league';
  insert into public.league_members (week, tier, group_no, user_id)
  select w, 0, 1, test.new_user() from generate_series(1, 2);
  insert into public.quiz_runs (user_id, status, prize_points, ended_at, started_at) values (late, 'won', 10, now(), now());
  perform test.login(late);
  s := public.league_state();
  perform test.assert(jsonb_array_length(s -> 'rows') = 3, 'late player joins the full group: ' || jsonb_array_length(s -> 'rows'));
end $$;

-- daily: the player's set is fixed for the day
do $$
begin
  perform test.assert(public.daily_set((select kid from ids), '2026-10-29', 30) = public.daily_set((select kid from ids), '2026-10-29', 30), 'stable set');
  perform test.assert(public.daily_set((select kid from ids), '2026-10-29', 10) = 0, 'old 10-question days: the only set');
  perform test.assert((select count(distinct public.daily_set(test.new_user(), '2026-10-29', 30)) from generate_series(1, 40)) = 3, 'all three sets used');
end $$;

-- referral counts real games only
do $$
declare
  kid uuid := (select kid from ids);
begin
  insert into public.blitz_runs (user_id, ends_at, status, correct) values (kid, now(), 'done', 9);
  perform test.assert(public.referral_games(kid) = 0, 'blitz sprints do not count');
  insert into public.quiz_runs (user_id, status, correct, started_at, ended_at) values (kid, 'won', 6, now(), now());
  perform test.assert(public.referral_games(kid) = 1, 'a real game counts');
end $$;

rollback;
