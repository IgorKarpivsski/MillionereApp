-- With verification on, an ad reward needs a view Google confirmed; one view, one reward.
begin;
update public.app_config set value = 'true'::jsonb where key = 'ads.require_ssv';
create function test.ad_view(p_user uuid, p_tx text) returns void language sql security definer set search_path = '' as $$
  select public.ad_ssv_record(p_tx, p_user, 'unit', '') $$;
grant execute on all functions in schema test to authenticated;
create temp table ids5 as select test.new_user() as a;
grant select on ids5 to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids5.a from ids5);
begin
  perform test.login(a);
  perform test.assert_raises($q$select public.claim_ad_reward('free_pack')$q$, 'not verified', 'no view, no reward');
  perform test.ad_view(a, 'tx-1');
  perform public.claim_ad_reward('free_pack');
  perform test.assert_raises($q$select public.claim_ad_reward('free_pack')$q$, 'not verified', 'a view pays once');
end $$;
rollback;
