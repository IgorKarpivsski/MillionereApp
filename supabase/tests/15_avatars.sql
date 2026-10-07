-- Custom avatars: format + slot ranges validated, premium accessories need the cosmetic.
begin;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); s jsonb;
begin
  perform test.login(a);
  s := public.update_my_profile(p_avatar_id => 'av1_1324531a2b30');
  perform test.assert(s -> 'profile' ->> 'avatar_id' = 'av1_1324531a2b30', 'custom avatar saved');
  s := public.update_my_profile(p_avatar_id => 'avatar_03');
  perform test.assert(s -> 'profile' ->> 'avatar_id' = 'avatar_03', 'legacy avatar still allowed');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_c324531a2b30')$q$, 'invalid_input', 'species out of range');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_13245z1a2b30')$q$, 'invalid_input', 'hair out of range');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_1324531a2b3')$q$, 'invalid_input', 'too short');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_1324531a2b39')$q$, 'invalid_input', 'crown needs cosmetic');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_1324531a2b38')$q$, 'invalid_input', 'shades need cosmetic');
  perform test.assert_raises($q$select public.avatar_is_allowed(gen_random_uuid(), 'av1_000000000000')$q$, 'permission denied', 'helper not callable by clients');
end $$;

reset role;
insert into public.user_cosmetics (user_id, item, source) select a, 'avatar_crown', 'test' from ids;
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); s jsonb;
begin
  perform test.login(a);
  s := public.update_my_profile(p_avatar_id => 'av1_1324531a2b39');
  perform test.assert(s -> 'profile' ->> 'avatar_id' = 'av1_1324531a2b39', 'crown allowed once owned');
end $$;
rollback;

-- Avatar shop: buy with coins, ownership unlocks the slot, can't buy twice or for free.
begin;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;
reset role;
select public.ledger_apply((select a from ids), 'coins', 2000, 'test', 'test', 't', 'shop-test-coins');
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); r jsonb; c0 bigint;
begin
  perform test.login(a);
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_1324531a2b3a')$q$, 'invalid_input', 'headphones locked before buying');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_1324531a2bb0')$q$, 'invalid_input', 'galaxy background locked');
  c0 := (select w.coins from public.wallets w);
  r := public.avatar_shop_buy('avatar_acc_a');
  perform test.assert((select w.coins from public.wallets w) = c0 - 1200, 'charged 1200 coins');
  perform test.assert(r -> 'owned' ? 'avatar_acc_a', 'owned list returned');
  perform public.update_my_profile(p_avatar_id => 'av1_1324531a2b3a');
  perform test.assert_raises($q$select public.avatar_shop_buy('avatar_acc_a')$q$, 'already_owned', 'buy once');
  perform test.assert_raises($q$select public.avatar_shop_buy('avatar_crown')$q$, 'invalid_input', 'pass items are not for sale');
  perform test.assert_raises($q$select public.avatar_shop_buy('avatar_bg_b')$q$, 'insufficient_funds', 'gems needed for galaxy');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_1324531a2b3i')$q$, 'invalid_input', 'accessory out of range');
end $$;
rollback;
