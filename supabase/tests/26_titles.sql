-- Achievement titles: new titles unlock, can be chosen, and show in the tables.
begin;
create function test.surv_run(p_user uuid, n int) returns void language sql security definer set search_path = '' as $$
  insert into public.survival_runs (user_id, ended_at, correct, status) values (p_user, now(), n, 'done') $$;
grant execute on all functions in schema test to authenticated;
create temp table ids3 as select test.new_user() as a;
grant select on ids3 to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids3.a from ids3); s jsonb;
begin
  perform test.login(a);
  s := public.my_flair();
  perform test.assert(exists (select 1 from jsonb_array_elements(s -> 'titles') x where x ->> 'text' = 'שורד' and not (x ->> 'unlocked')::boolean
                              and x ->> 'hint' is not null), 'survivor locked with a hint');
  perform test.assert_raises($q$select public.set_flair(null, 'שורד')$q$, 'title', 'cannot pick a locked title');
  perform test.surv_run(a, 6);
  perform public.set_flair(null, 'שורד');
  s := public.survival_info();
  perform test.assert(s -> 'rows' -> 0 ->> 'title' = 'שורד', 'title in the week table');
  s := public.leaderboard_board('all');
  perform test.assert(s ? 'rows', 'all-time table still works');
end $$;
rollback;
