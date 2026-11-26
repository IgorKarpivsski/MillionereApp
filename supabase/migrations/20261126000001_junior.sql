-- "האלוף ג'וניור": a setting for young kids. Enforced on the server:
--  * no clock: every question in classic, daily and world runs stays open for an hour
--  * world levels draw only from the easiest part of each level's difficulty band
--  * the speed bonus is a fixed half (no rush, but still points)
-- Timed arcade modes (blitz, survival) keep their own clocks.

alter table public.user_settings add column junior boolean not null default false;
alter table public.quiz_runs add column junior boolean not null default false;

create or replace function public.mark_junior_run() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.junior := coalesce((select s.junior from public.user_settings s where s.user_id = new.user_id), false);
  return new;
end $$;
revoke all on function public.mark_junior_run() from public, anon, authenticated;
create trigger quiz_runs_junior before insert on public.quiz_runs
  for each row execute function public.mark_junior_run();

create or replace function public.stretch_question_deadline() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_factor numeric;
  v_junior boolean;
  v_ext    boolean;
begin
  select r.junior, coalesce(s.extended_time, false) into v_junior, v_ext
    from public.quiz_runs r left join public.user_settings s on s.user_id = r.user_id
   where r.id = new.run_id;
  if v_junior then
    new.deadline := now() + interval '1 hour';
  elsif v_ext then
    select (value #>> '{}')::numeric into v_factor from public.app_config where key = 'quiz.extended_time_factor';
    new.deadline := now() + (new.deadline - now()) * coalesce(v_factor, 1.5);
  end if;
  return new;
end $$;
revoke all on function public.stretch_question_deadline() from public, anon, authenticated;

do $$
declare d text; n text;
begin
  -- easier questions: squeeze the level's difficulty window into the easiest 35% of the world
  d := pg_get_functiondef('public.session_next(uuid)'::regprocedure);
  n := replace(d, '    -- a "find the right picture" question',
                  '    if v_run.junior then
      v_win := array[v_win[1] * 0.35, v_win[2] * 0.35]::real[];
    end if;
    -- a "find the right picture" question');
  if n = d then raise exception 'junior patch failed: session_next'; end if;
  execute n;

  -- fixed half speed bonus (the clock is an hour long)
  d := pg_get_functiondef('public.session_answer(uuid,integer,integer)'::regprocedure);
  n := replace(d, 'v_left := case when v_rq.frozen then 0',
                  'v_left := case when v_rq.frozen then 0 when v_run.junior then (v_cfg ->> ''seconds'')::int / 2');
  if n = d then raise exception 'junior patch failed: session_answer'; end if;
  execute n;

  -- the new setting is allowed in update_my_settings
  d := pg_get_functiondef('public.update_my_settings(jsonb)'::regprocedure);
  n := replace(d, '''notif_prefs'', ''extended_time'')', '''notif_prefs'', ''extended_time'', ''junior'')');
  n := replace(n, 'extended_time  = coalesce((p_patch ->> ''extended_time'')::boolean, extended_time)',
                  'extended_time  = coalesce((p_patch ->> ''extended_time'')::boolean, extended_time),
    junior         = coalesce((p_patch ->> ''junior'')::boolean, junior)');
  if position('junior' in n) = 0 or position('''junior'')' in n) = 0 then raise exception 'junior patch failed: update_my_settings'; end if;
  execute n;
end $$;
