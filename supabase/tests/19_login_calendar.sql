-- Login calendar: claim once a day, advance on consecutive days, reset after a gap.
begin;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); s jsonb; r jsonb;
begin
  perform test.login(a);
  s := public.login_state();
  perform test.assert((s ->> 'day')::int = 0 and (s ->> 'claimable')::boolean, 'day 1 waiting');
  r := public.login_claim();
  perform test.assert((select w.coins from public.wallets w) = 100, 'day 1 paid');
  perform test.assert(not (public.login_state() ->> 'claimable')::boolean, 'claimed today');
  perform test.assert_raises($q$select public.login_claim()$q$, 'already claimed', 'once a day');
end $$;
reset role;
update public.user_login_calendar set last_claim = public.israel_today() - 1 where user_id = (select a from ids);
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); r jsonb;
begin
  perform test.login(a);
  r := public.login_claim();
  perform test.assert((r ->> 'day')::int = 1 and r #>> '{reward,kind}' = 'tickets', 'consecutive day advances');
end $$;
reset role;
update public.user_login_calendar set last_claim = public.israel_today() - 3 where user_id = (select a from ids);
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids);
begin
  perform test.login(a);
  perform test.assert((public.login_state() ->> 'day')::int = 0, 'gap resets to day 1');
end $$;
rollback;
