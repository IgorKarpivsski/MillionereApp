-- The sloth's house: buy room items with coins and hats with gems, wear a hat, a prize for the full room.
begin;
update public.app_config set value = value || '{"items": [{"id": "home_rug", "price": 100, "currency": "coins"}, {"id": "home_tv", "price": 200, "currency": "coins"}],
                                                "complete_prize": [{"kind": "gems", "amount": 7}]}'::jsonb
 where key = 'home';
create function test.hw(p_user uuid) returns table (coins bigint, gems bigint) language sql security definer set search_path = '' as $$
  select coins, gems from public.wallets where user_id = p_user $$;
create function test.hset(p_user uuid, c bigint, g bigint) returns void language sql security definer set search_path = '' as $$
  update public.wallets set coins = c, gems = g where user_id = p_user $$;
grant execute on all functions in schema test to authenticated;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;
select test.hset((select a from ids), 250, 30);

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); s jsonb; w record;
begin
  perform test.login(a);
  s := public.home_state();
  perform test.assert(jsonb_array_length(s -> 'owned') = 0 and s ->> 'hat' is null and not (s ->> 'completed')::boolean, 'empty house');
  perform test.assert_raises($q$select public.home_buy('home_nope')$q$, 'invalid_input', 'unknown item');

  s := public.home_buy('home_rug');
  select * into w from test.hw(a);
  perform test.assert(w.coins = 150 and s -> 'owned' ? 'home_rug' and not (s ->> 'just_completed')::boolean, 'rug bought for coins');
  perform test.assert_raises($q$select public.home_buy('home_rug')$q$, 'already_owned', 'only once');

  -- 150 coins can't buy a 200 tv
  perform test.assert_raises($q$select public.home_buy('home_tv')$q$, 'insufficient', 'not enough coins');

  s := public.home_buy('hat_party');
  select * into w from test.hw(a);
  perform test.assert(w.gems = 10 and s ->> 'hat' = 'hat_party', 'hat bought with gems and worn');
  perform test.assert_raises($q$select public.home_wear('hat_crown')$q$, 'invalid_input', 'cannot wear what you do not own');
  s := public.home_wear(null);
  perform test.assert(s ->> 'hat' is null, 'hat off');
  s := public.home_wear('hat_party');
  perform test.assert(s ->> 'hat' = 'hat_party', 'hat on');
end $$;

reset role;
select test.hset((select a from ids), 1000, 10);
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); s jsonb; w record;
begin
  perform test.login(a);
  s := public.home_buy('home_tv');
  select * into w from test.hw(a);
  perform test.assert((s ->> 'just_completed')::boolean and (s ->> 'completed')::boolean and w.gems = 17, 'full room pays the prize');
end $$;

rollback;
