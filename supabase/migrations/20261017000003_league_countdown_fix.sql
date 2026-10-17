-- The league countdown cast the week start (a timestamptz) to a date in UTC,
-- which is Saturday — so it ran out a day early, every Saturday.
do $$
declare d text;
begin
  d := pg_get_functiondef('public.league_state()'::regprocedure);
  d := replace(d,
    $x$extract(epoch from (((v_week + 7)::timestamp at time zone 'Asia/Jerusalem') - now()))$x$,
    $x$extract(epoch from (public.israel_week_start() + interval '7 days' - now()))$x$);
  if position('israel_week_start() + interval' in d) = 0 then raise exception 'league_state patch failed'; end if;
  execute d;
end $$;
