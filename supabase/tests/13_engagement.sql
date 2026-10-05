-- Energy, daily wheel, rotating deals and the season pass.
begin;
create temp table ids as select test.new_user() as a, test.new_user() as b;
grant select on ids to authenticated;
-- Keep the season "now" no matter when the tests run.
update public.app_config
   set value = value || jsonb_build_object('starts', (current_date - 1)::text, 'ends', (current_date + 30)::text)
 where key = 'season.current';

-- ---------------------------------------------------------------- energy (owner)
do $$
declare a uuid := (select ids.a from ids); i int;
begin
  for i in 1 .. 5 loop perform public.energy_spend(a); end loop;
  perform test.assert((select tickets from public.user_energy where user_id = a) = 0, 'five runs spend five tickets');
  perform test.assert_raises(format('select public.energy_spend(%L)', a), 'no_energy', 'sixth run blocked');
  -- 45 minutes later two tickets came back.
  update public.user_energy set stamp = now() - interval '45 minutes' where user_id = a;
  perform public.energy_sync(a);
  perform test.assert((select tickets from public.user_energy where user_id = a) = 2, 'regenerates 1 per 20 min');
  perform test.assert((select stamp > now() - interval '6 minutes' from public.user_energy where user_id = a), 'remainder kept');
  -- VIP plays without limit.
  insert into public.user_entitlements (user_id, vip_until) values (a, now() + interval '1 day');
  update public.user_energy set tickets = 0 where user_id = a;
  perform public.energy_spend(a);
  perform test.assert((select tickets from public.user_energy where user_id = a) = 0, 'vip does not spend');
  delete from public.user_entitlements where user_id = a;
  perform public.ledger_apply(a, 'gems', 500, 'test', 'test', 't', 'test-gems');
  perform public.ledger_apply(a, 'coins', 10000, 'test', 'test', 't', 'test-coins');
end $$;

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); r jsonb; gems bigint; i int;
begin
  perform test.login(a);
  r := public.energy_state();
  perform test.assert((r ->> 'tickets')::int = 0 and (r ->> 'next_at') is not null, 'state shows empty + next ticket time');
  r := public.energy_refill('gems', gen_random_uuid());
  perform test.assert((r ->> 'tickets')::int = 5 and (select w.gems from public.wallets w) = 480, 'gem refill to full for 20');
  perform test.assert_raises($q$select public.energy_refill('gems', gen_random_uuid())$q$, 'already full', 'no refill when full');
  r := public.energy_refill('ad', gen_random_uuid());
  perform test.assert((r ->> 'tickets')::int = 6 and (r ->> 'ad_left')::int = 4, 'ad gives +1 above max');

  -- ------------------------------------------------------------- wheel
  r := public.wheel_state();
  perform test.assert((r ->> 'free_available')::boolean, 'free spin available');
  perform test.assert(abs((select sum((s ->> 'pct')::numeric) from jsonb_array_elements(r -> 'segments') s) - 100) < 0.5, 'odds sum to 100%');
  r := public.wheel_spin('free', '00000000-0000-0000-0000-0000000000aa');
  perform test.assert((r ->> 'index') is not null, 'free spin result');
  perform test.assert(public.wheel_spin('free', '00000000-0000-0000-0000-0000000000aa') = r, 'same request → same result');
  perform test.assert_raises($q$select public.wheel_spin('free', gen_random_uuid())$q$, 'free spin used', 'one free spin per 24h');
  gems := (select w.gems from public.wallets w);
  r := public.wheel_spin('gems', gen_random_uuid());
  perform test.assert((select w.gems from public.wallets w) = gems - 15 + case when r #>> '{segment,kind}' = 'gems' then (r #>> '{segment,amount}')::int else 0 end,
    'paid spin costs 15 gems');
  perform test.assert((public.wheel_state() ->> 'free_available')::boolean = false, 'free spin consumed');

  -- ------------------------------------------------------------- deals
  r := public.deals_state();
  perform test.assert(r -> 'deal' ->> 'id' is not null and (r ->> 'bought')::boolean = false, 'a deal is live');
  perform public.deal_buy(r -> 'deal' ->> 'id', (r ->> 'window')::bigint);
  perform test.assert((public.deals_state() ->> 'bought')::boolean, 'marked bought');
  perform test.assert_raises(format('select public.deal_buy(%L, %s)', r -> 'deal' ->> 'id', r ->> 'window'), 'already bought', 'once per window');
  perform test.assert_raises(format('select public.deal_buy(%L, %s)', r -> 'deal' ->> 'id', (r ->> 'window')::bigint - 1), 'deal expired', 'old window rejected');

  -- ------------------------------------------------------------- pass
  r := public.pass_state();
  perform test.assert((r ->> 'active')::boolean and (r ->> 'tier')::int = 0, 'season active, tier 0');
  perform test.assert_raises($q$select public.pass_claim(1, 'free')$q$, 'tier locked', 'locked before XP');
end $$;
reset role;

-- XP from any source fills the pass.
update public.profiles set xp = xp + 520 where id = (select ids.a from ids);

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); r jsonb; coins bigint;
begin
  perform test.login(a);
  r := public.pass_state();
  perform test.assert((r ->> 'xp')::int = 520 and (r ->> 'tier')::int = 2, 'xp → tier 2');
  coins := (select w.coins from public.wallets w);
  perform public.pass_claim(1, 'free');
  perform test.assert((select w.coins from public.wallets w) = coins + 150, 'tier 1 free reward');
  perform test.assert_raises($q$select public.pass_claim(1, 'free')$q$, 'already claimed', 'claim once');
  perform test.assert_raises($q$select public.pass_claim(1, 'premium')$q$, 'not premium', 'premium needs the pass');
  perform test.assert_raises($q$select public.pass_claim(3, 'free')$q$, 'tier locked', 'cannot skip ahead');
  r := public.pass_buy_premium();
  perform test.assert((r ->> 'premium')::boolean, 'premium bought with gems');
  perform public.pass_claim(1, 'premium');
  perform test.assert((select count(*) from public.user_pass where claimed_premium = '{1}') = 1, 'premium tier 1 claimed');
  perform test.assert_raises($q$select public.pass_buy_premium()$q$, 'already premium', 'buy once');
  -- Others' rows are invisible.
  perform test.assert((select count(*) from public.user_energy) = 1, 'rls: own energy only');
  perform test.assert_raises($q$select public.grant_reward(auth.uid(), '{"kind":"gems","amount":999}', 'x')$q$, 'permission denied', 'grant_reward is internal');
end $$;
reset role;

-- Classic runs cost a ticket; the daily challenge does not.
do $$
declare b uuid := (select ids.b from ids);
begin
  perform test.assert(not exists (select 1 from public.user_energy where user_id = b), 'no energy row until first use');
  update public.app_config set value = value || '{"max":1}' where key = 'energy';
  perform public.energy_spend(b);
  perform test.assert_raises(format('select public.energy_spend(%L)', b), 'no_energy', 'max respected');
end $$;
rollback;
