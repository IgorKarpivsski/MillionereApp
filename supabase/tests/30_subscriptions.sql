-- Subscriptions: the purchase grants VIP + gems; a renewal (new order) extends VIP and pays the gems again;
-- account hold shows up in the shop; a repeated check of the same order pays nothing.
begin;
create temp table ids6 as select test.new_user() as a;
create function test.gems6(p uuid) returns bigint language sql security definer set search_path = '' as $$
  select gems from public.wallets where user_id = p $$;
grant execute on all functions in schema test to authenticated;
grant select on ids6 to authenticated;
do $$
declare a uuid := (select ids6.a from ids6); g0 bigint; s jsonb;
begin
  g0 := coalesce(test.gems6(a), 0);
  perform public.grant_purchase(a, 'vip_monthly', 'tok-sub', 'GPA.1', '{"subscriptionState":"SUBSCRIPTION_STATE_ACTIVE"}', now() + interval '30 days');
  perform test.assert(test.gems6(a) = g0 + 30, 'first month gems');
  perform public.sub_apply(a, 'vip_monthly', 'tok-sub', 'GPA.1..0', 'SUBSCRIPTION_STATE_ACTIVE', now() + interval '60 days', true);
  perform test.assert(test.gems6(a) = g0 + 60, 'renewal pays the month again');
  perform public.sub_apply(a, 'vip_monthly', 'tok-sub', 'GPA.1..0', 'SUBSCRIPTION_STATE_ACTIVE', now() + interval '60 days', true);
  perform test.assert(test.gems6(a) = g0 + 60, 'same order pays once');
  perform test.assert((select vip_until from public.user_entitlements where user_id = a) > now() + interval '59 days', 'vip extended');
  perform public.sub_apply(a, 'vip_monthly', 'tok-sub', 'GPA.1..0', 'SUBSCRIPTION_STATE_ON_HOLD', now() - interval '1 day', false);
end $$;
set local role authenticated;
do $$
declare s jsonb;
begin
  perform test.login((select ids6.a from ids6));
  s := public.store_state();
  perform test.assert(s -> 'sub' ->> 'state' = 'on_hold' and s -> 'sub' ->> 'sku' = 'vip_monthly', 'shop knows about the payment problem');
end $$;
rollback;
