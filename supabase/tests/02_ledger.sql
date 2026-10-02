-- The ledger: balances only move through ledger_apply, idempotently.
begin;

do $$
declare
  u  uuid := test.new_user();
  t1 public.wallet_transactions;
  t2 public.wallet_transactions;
begin
  t1 := public.ledger_apply(u, 'coins', 100, 'quiz_reward', 'quiz_session', 's1', 'k1');
  perform test.assert(t1.balance_after = 100, 'credit applied');

  -- Retry with the same key: same row back, no second credit.
  t2 := public.ledger_apply(u, 'coins', 100, 'quiz_reward', 'quiz_session', 's1', 'k1');
  perform test.assert(t2.id = t1.id, 'retry returns the original transaction');
  perform test.assert((select coins from public.wallets where user_id = u) = 100, 'no double credit');

  -- Same key with different parameters is a conflict, not a silent success.
  perform test.assert_raises(
    format($q$select public.ledger_apply(%L, 'coins', 999, 'quiz_reward', null, null, 'k1')$q$, u),
    'idempotency_conflict', 'key reuse with different amount');

  -- Spending more than you have fails and changes nothing.
  perform test.assert_raises(
    format($q$select public.ledger_apply(%L, 'coins', -101, 'pack_purchase', null, null, 'k2')$q$, u),
    'insufficient_funds', 'overspend rejected');
  perform test.assert((select coins from public.wallets where user_id = u) = 100, 'balance unchanged');
  perform test.assert((select count(*) from public.wallet_transactions where user_id = u) = 1,
    'no ledger row for failed spend');

  -- Currencies are independent.
  perform public.ledger_apply(u, 'gems', 50, 'purchase', 'store', 'tx1', 'k3');
  perform public.ledger_apply(u, 'coins', -40, 'pack_purchase', null, null, 'k4');
  perform test.assert(
    (select coins = 60 and gems = 50 and dust = 0 from public.wallets where user_id = u),
    'per-currency balances');
  perform test.assert(
    (select version from public.wallets where user_id = u) = 3, 'version bumps once per movement');

  -- Ledger rows are immutable.
  perform test.assert_raises(
    format($q$update public.wallet_transactions set amount = 1 where user_id = %L$q$, u),
    'append-only', 'ledger is append-only');

  -- Guard rails on input.
  perform test.assert_raises(
    format($q$select public.ledger_apply(%L, 'coins', 0, 'x_reason', null, null, 'k5')$q$, u),
    'invalid_input', 'zero amount rejected');
  perform test.assert_raises(
    format($q$select public.ledger_apply(%L, 'coins', 5, 'Bad Reason!', null, null, 'k6')$q$, u),
    'wallet_tx_reason_format', 'reason format enforced');
  -- Note: a failed insert after the wallet update rolls back the whole call.
end $$;

rollback;
