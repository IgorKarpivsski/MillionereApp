-- The login streak: grows a day at a time, restarts after a missed day, pays milestones (coins, gems, packs).
begin;
create function test.cal(p_user uuid, d date, s int, run date) returns void language sql security definer set search_path = '' as $$
  insert into public.user_login_calendar (user_id, day_index, last_claim, streak, best, run_start) values (p_user, 0, d, s, s, run)
  on conflict (user_id) do update set last_claim = d, streak = s, best = greatest(public.user_login_calendar.best, s), run_start = run, day_index = 0 $$;
create function test.gems(p_user uuid) returns bigint language sql security definer set search_path = '' as $$
  select gems from public.wallets where user_id = p_user $$;
grant execute on all functions in schema test to authenticated;
update public.app_config set value = jsonb_set(value, '{lucky,chance}', '0') where key = 'login.streak';
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); r jsonb; s jsonb;
begin
  perform test.login(a);
  r := public.login_claim();
  perform test.assert((r ->> 'streak')::int = 1 and jsonb_array_length(r -> 'milestone') = 0, 'first day: streak 1');
  s := public.streak_state();
  perform test.assert((s ->> 'streak')::int = 1 and (s ->> 'claimed_today')::boolean, 'state shows it');
end $$;

-- yesterday was day 6: today is day 7, a milestone
reset role;
select test.cal((select a from ids), public.israel_today() - 1, 6, public.israel_today() - 6);
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); r jsonb; g bigint;
begin
  perform test.login(a);
  g := test.gems(a);
  r := public.login_claim();
  perform test.assert((r ->> 'streak')::int = 7, 'streak 7');
  perform test.assert(jsonb_array_length(r -> 'milestone') = 2, 'two prizes');
  perform test.assert(test.gems(a) = g + 25, '25 gems');
end $$;

-- a missed day: back to 1
reset role;
select test.cal((select a from ids), public.israel_today() - 3, 9, public.israel_today() - 11);
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); r jsonb;
begin
  perform test.login(a);
  perform test.assert((public.streak_state() ->> 'streak')::int = 0, 'broken streak shows 0');
  r := public.login_claim();
  perform test.assert((r ->> 'streak')::int = 1, 'restarts at 1');
  perform test.assert((public.streak_state() ->> 'best')::int = 9, 'best kept');
end $$;

-- day 60: the 30-day prize again
reset role;
select test.cal((select a from ids), public.israel_today() - 1, 59, public.israel_today() - 59);
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); r jsonb; g bigint;
begin
  perform test.login(a);
  g := test.gems(a);
  r := public.login_claim();
  perform test.assert((r ->> 'streak')::int = 60 and r -> 'milestone' -> 0 ->> 'pack' = 'legendary', '30-day prize again');
  perform test.assert(test.gems(a) = g + 50, '50 gems');
end $$;
rollback;
