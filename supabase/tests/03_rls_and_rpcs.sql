-- What a signed-in client can and cannot do.
begin;

create temp table ids as select test.new_user() as a, test.new_user() as b;
grant select on ids to authenticated, anon;

-- Give B some coins (server-side) so we can check isolation.
select public.ledger_apply((select b from ids), 'coins', 777, 'test_seed', null, null, 'seed');

set local role authenticated;
select test.login((select a from ids));

do $$
declare
  a uuid := (select ids.a from ids);
  b uuid := (select ids.b from ids);
  s jsonb;
begin
  -- Reads are scoped to the caller.
  perform test.assert((select count(*) from public.profiles) = 1, 'sees only own profile');
  perform test.assert((select count(*) from public.wallets) = 1, 'sees only own wallet');
  perform test.assert(not exists (select 1 from public.wallets where user_id = b), 'cannot see B wallet');
  perform test.assert((select count(*) from public.wallet_transactions) = 0, 'cannot see B ledger');

  -- No direct writes to economy or identity tables.
  perform test.assert_raises(
    format($q$update public.wallets set coins = 100000 where user_id = %L$q$, a),
    'permission denied', 'cannot write wallet');
  perform test.assert_raises(
    format($q$insert into public.wallet_transactions (user_id, currency, amount, balance_after, reason, idempotency_key)
              values (%L, 'coins', 100000, 100000, 'hack', 'h')$q$, a),
    'permission denied', 'cannot insert ledger rows');
  perform test.assert_raises(
    format($q$update public.profiles set xp = 999999 where id = %L$q$, a),
    'permission denied', 'cannot write xp');
  perform test.assert_raises(
    format($q$select public.ledger_apply(%L, 'coins', 100000, 'hack', null, null, 'x')$q$, a),
    'permission denied', 'cannot call ledger_apply');
  perform test.assert_raises(
    format($q$select public.check_rate_limit(%L, 'x', 1, 1)$q$, a),
    'permission denied', 'cannot call internal helpers');

  -- The RPC surface works.
  s := public.get_my_state();
  perform test.assert((s -> 'profile' ->> 'id')::uuid = a, 'get_my_state returns own profile');
  perform test.assert((s -> 'wallet' ->> 'coins')::int = 0, 'own wallet starts empty');
  perform test.assert(not (s ->> 'welcome_bonus_claimed')::boolean, 'bonus not yet claimed');

  -- Welcome bonus pays the server-configured amount exactly once.
  s := public.claim_welcome_bonus();
  perform test.assert((s ->> 'balance')::int = 500, 'bonus paid from config');
  s := public.claim_welcome_bonus();
  perform test.assert((s ->> 'balance')::int = 500, 'second claim pays nothing more');
  perform test.assert((public.get_my_state() ->> 'welcome_bonus_claimed')::boolean, 'bonus flagged');
  perform test.assert((select count(*) from public.wallet_transactions) = 1, 'one ledger row');

  -- Public config only.
  perform test.assert(exists (select 1 from public.app_config where key = 'economy.welcome_bonus_coins'),
    'public config visible');
  perform test.assert(not exists (select 1 from public.app_config where key = 'ops.anomaly_threshold_ms'),
    'private config hidden');
  perform test.assert((select count(*) from public.rate_limits) = 0, 'rate_limits not readable');
end $$;

-- Anonymous (signed-out) callers get nothing.
reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
do $$
begin
  perform test.assert((select count(*) from public.profiles) = 0, 'anon sees no profiles');
  perform test.assert_raises('select public.get_my_state()', 'permission denied', 'anon cannot call RPCs');
end $$;

rollback;
