-- Brain games: matchstick puzzle solves, rewards, hints.
begin;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); r jsonb; c0 bigint; ans text;
begin
  perform test.login(a);
  perform public.claim_welcome_bonus();
  perform test.assert((public.puzzles_state() ->> 'total')::int > 500, 'puzzles seeded');
  perform test.assert_raises($q$select public.puzzle_solve(1, '1+1=3')$q$, 'wrong answer', 'wrong answer refused');
  r := public.puzzle_hint(1);
  ans := r ->> 'answer';
  perform test.assert(ans is not null, 'hint gives the answer');
  r := public.puzzle_hint(1);
  perform test.assert(jsonb_array_length(public.puzzles_state() -> 'hinted') = 1, 'hint recorded');
  r := public.puzzle_solve(1, ans);
  perform test.assert((r ->> 'first')::boolean and (r ->> 'coins')::int > 0, 'first solve pays');
  r := public.puzzle_solve(1, ans);
  perform test.assert(not (r ->> 'first')::boolean and (r ->> 'coins')::int = 0, 'second solve pays nothing');
  perform test.assert(jsonb_array_length(public.puzzles_state() -> 'solved') = 1, 'solved list');
  perform test.assert_raises($q$select public.puzzle_solve(999999, 'x')$q$, 'invalid_input', 'unknown puzzle');
end $$;
reset role;
do $$ begin
  perform test.assert((select count(*) from public.wallet_transactions where reason = 'puzzle_hint') = 1, 'hint charged once');
end $$;
rollback;
