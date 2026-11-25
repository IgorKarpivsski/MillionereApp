-- The sloth's wardrobe: buy items with coins/gems, wear one per slot, the classic glasses are free.
begin;
create function test.ww(p_user uuid) returns table (coins bigint, gems bigint) language sql security definer set search_path = '' as $$
  select coins, gems from public.wallets where user_id = p_user $$;
create function test.wset(p_user uuid, c bigint, g bigint) returns void language sql security definer set search_path = '' as $$
  update public.wallets set coins = c, gems = g where user_id = p_user $$;
grant execute on all functions in schema test to authenticated;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;
select test.wset((select a from ids), 1000, 200);

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); s jsonb; w record;
begin
  perform test.login(a);
  s := public.wardrobe_state();
  perform test.assert(jsonb_array_length(s -> 'items') = 105, '105 items');
  perform test.assert(s -> 'owned' ? 'w_glasses_classic' and s -> 'outfit' ->> 'glasses' = 'w_glasses_classic', 'starts with the classic glasses on');
  perform test.assert_raises($q$select public.wardrobe_buy('w_nope')$q$, 'invalid_input', 'unknown item');
  perform test.assert_raises($q$select public.wardrobe_buy('w_glasses_classic')$q$, 'invalid_input', 'free item is not sold');

  s := public.wardrobe_buy('w_hat_cap_red');
  select * into w from test.ww(a);
  perform test.assert(w.coins = 600 and s -> 'outfit' ->> 'hat' = 'w_hat_cap_red', 'cap bought for 400 coins and worn');
  perform test.assert_raises($q$select public.wardrobe_buy('w_hat_cap_red')$q$, 'already_owned', 'only once');

  s := public.wardrobe_buy('w_hat_crown');
  select * into w from test.ww(a);
  perform test.assert(w.gems = 50 and s -> 'outfit' ->> 'hat' = 'w_hat_crown', 'crown bought for 150 gems, replaces the cap');
  perform test.assert_raises($q$select public.wardrobe_buy('w_outfit_armor')$q$, 'insufficient', 'not enough gems');

  perform test.assert_raises($q$select public.wardrobe_wear('hat', 'w_hat_wizard')$q$, 'invalid_input', 'cannot wear what you do not own');
  perform test.assert_raises($q$select public.wardrobe_wear('shoes', 'w_hat_cap_red')$q$, 'invalid_input', 'item in the wrong slot');
  perform test.assert_raises($q$select public.wardrobe_wear('wings', null)$q$, 'invalid_input', 'unknown slot');
  s := public.wardrobe_wear('hat', 'w_hat_cap_red');
  perform test.assert(s -> 'outfit' ->> 'hat' = 'w_hat_cap_red', 'back to the cap');
  s := public.wardrobe_wear('glasses', null);
  perform test.assert(not (s -> 'outfit') ? 'glasses', 'glasses off');
  s := public.wardrobe_wear('glasses', 'w_glasses_classic');
  perform test.assert(s -> 'outfit' ->> 'glasses' = 'w_glasses_classic', 'free glasses back on');
end $$;
rollback;
