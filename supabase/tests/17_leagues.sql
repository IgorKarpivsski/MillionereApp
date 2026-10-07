-- Weekly leagues: grouping, settlement (promote / stay / demote), rewards paid once.
begin;
update public.app_config set value = value || '{"group_size": 4, "promote": 2, "demote": 2}' where key = 'league';
create temp table u as select i, test.new_user() as id from generate_series(1, 10) i;
grant select on u to authenticated;

-- Last week: users 1..6 in Bronze group 1 with points 600,500,...,100 (user 6 = 100), users 7 in Gold with 0 points.
insert into public.league_members (week, tier, group_no, user_id, joined_at)
select (public.israel_week_start()::date - 7), 0, 1, id, now() - interval '8 days' + i * interval '1 minute' from u where i <= 6;
insert into public.league_members (week, tier, group_no, user_id)
select (public.israel_week_start()::date - 7), 2, 1, id from u where i = 7;
insert into public.user_leagues (user_id, tier) select id, 2 from u where i = 7;
insert into public.quiz_runs (user_id, status, prize_points, ended_at, started_at)
select id, 'won', (7 - i) * 100, public.israel_week_start() - interval '2 days', public.israel_week_start() - interval '2 days'
  from u where i <= 6;

set local role authenticated;
do $$
declare s jsonb; c0 bigint; c1 bigint;
begin
  -- Winner: promoted, paid 600 coins + 20 gems (Bronze, no tier bonus).
  perform test.login((select id from u where i = 1));
  c0 := coalesce((select w.coins from public.wallets w), 0);
  s := public.league_state();
  perform test.assert((s ->> 'tier')::int = 1, 'rank 1 promoted to Silver');
  perform test.assert((s #>> '{last_result,rank}')::int = 1 and (s #>> '{last_result,coins}')::int = 600, 'last result shown: ' || (s -> 'last_result')::text);
  c1 := (select w.coins from public.wallets w);
  perform test.assert(c1 - c0 = 600 and (select w.gems from public.wallets w) >= 20, 'reward paid');
  s := public.league_state();
  perform test.assert((select w.coins from public.wallets w) = c1, 'reward paid once');
  perform test.assert(s ->> 'tier_name' = 'כסף' and jsonb_array_length(s -> 'rows') = 1, 'joined a Silver group this week');

  -- Middle of the table: stays.
  perform test.login((select id from u where i = 3));
  s := public.league_state();
  perform test.assert((s ->> 'tier')::int = 0, 'rank 3 stays');
  perform test.assert((s #>> '{last_result,coins}')::int = 250, 'rank 3 reward');

  -- Last in Bronze can't drop lower.
  perform test.login((select id from u where i = 6));
  perform test.assert((public.league_state() ->> 'tier')::int = 0, 'Bronze floor');

  -- Gold player who scored nothing: demoted.
  perform test.login((select id from u where i = 7));
  s := public.league_state();
  perform test.assert((s ->> 'tier')::int = 1, 'zero points demotes: ' || (s ->> 'tier'));

  -- Grouping: group_size 4 → users 3,6 and 8,9,10 in Bronze this week fill group 1 then open group 2.
  perform test.login((select id from u where i = 8)); perform public.league_state();
  perform test.login((select id from u where i = 9)); perform public.league_state();
  perform test.login((select id from u where i = 10)); s := public.league_state();
  perform test.assert(jsonb_array_length(s -> 'rows') = 1, 'fifth Bronze player opens a new group');
  perform test.assert((s ->> 'seconds_left')::int between 1 and 7 * 86400, 'countdown to week end');
  perform test.assert(s -> 'rows' -> 0 ->> 'me' = 'true', 'me flag');
end $$;
rollback;
