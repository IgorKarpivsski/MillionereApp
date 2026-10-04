-- Opt-in ad rewards and verified purchases.
begin;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;
create function test.finished_run(p_user uuid, coins int) returns uuid language sql security definer set search_path = '' as $$
  insert into public.quiz_runs (user_id, status, coins_awarded, ended_at) values (p_user, 'cashed_out', coins, now()) returning id $$;
grant execute on function test.finished_run(uuid, int) to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); run uuid; r jsonb;
begin
  perform test.login(a);
  run := test.finished_run(a, 60);
  r := public.claim_ad_reward('double_run', run::text);
  perform test.assert((r ->> 'coins')::int = 60 and (select coins from public.wallets) = 60, 'double coins');
  perform test.assert_raises(format($q$select public.claim_ad_reward('double_run', %L)$q$, run), 'already claimed', 'once per run');
  r := public.claim_ad_reward('free_pack');
  perform test.assert((select count from public.user_pack_tokens where pack = 'bronze') = 1, 'free pack');
  perform test.assert_raises($q$select public.claim_ad_reward('free_pack')$q$, 'already claimed', 'once a day');
  perform test.assert_raises($q$select public.claim_ad_reward('vip_daily')$q$, 'not vip', 'vip only');
  perform test.assert((public.store_state() ->> 'ad_free')::boolean = false, 'not ad free');
  perform test.assert_raises($q$select public.grant_purchase(auth.uid(), 'coins_2000', 't', 'o', '{}')$q$, 'permission denied', 'clients cannot grant purchases');
end $$;
reset role;

-- As the Edge Function (owner/service role):
do $$
declare a uuid := (select ids.a from ids); r jsonb;
begin
  r := public.grant_purchase(a, 'coins_6000', 'tok-1', 'GPA.1', '{}');
  perform test.assert((select coins from public.wallets where user_id = a) = 6060, 'coins purchase');
  r := public.grant_purchase(a, 'coins_6000', 'tok-1', 'GPA.1', '{}');
  perform test.assert((r ->> 'duplicate')::boolean and (select coins from public.wallets where user_id = a) = 6060, 'token granted once');
  r := public.grant_purchase(a, 'vip_monthly', 'tok-2', 'GPA.2', '{}', now() + interval '30 days');
  perform test.assert((select vip_until > now() + interval '29 days' from public.user_entitlements where user_id = a), 'vip active');
  perform test.assert((select gems from public.wallets where user_id = a) = 30, 'vip bonus gems');
  perform test.assert(public.has_ad_free(a), 'vip is ad free');
  perform test.assert_raises($q$select public.grant_purchase(test.new_user(), 'coins_6000', 'tok-1', 'x', '{}')$q$, 'not_authorized', 'token bound to its buyer');
end $$;
rollback;
