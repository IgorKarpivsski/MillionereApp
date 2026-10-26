-- =============================================================================
-- First games that build confidence: a player's first two finished games are
-- easy (the easiest band of questions) with 15 more seconds per question, and
-- the very first win gives a silver pack, so the first visit ends with stickers.
-- Data from the testers' round: 42% of first games ended without a win, and
-- most early quits came in the first questions.
-- =============================================================================

alter table public.quiz_runs add column if not exists newbie boolean not null default false;

-- session_start: mark the run as a "first games" run.
do $$
declare
  v_def text := pg_get_functiondef('public.session_start(text, integer)'::regprocedure);
begin
  if position('newbie' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$  insert into public.quiz_runs (user_id, mode, world, level) values (v_uid, 'session', p_world, v_lvl)$a$,
    $a$  insert into public.quiz_runs (user_id, mode, world, level, newbie)
  values (v_uid, 'session', p_world, v_lvl,
          (select count(*) from public.quiz_runs r where r.user_id = v_uid and r.mode = 'session' and r.status in ('won', 'lost')) < 2)$a$);
  if position('newbie' in v_def) = 0 then raise exception 'session_start patch did not apply'; end if;
  execute v_def;
end $$;

-- session_next: easiest questions and more time on those runs.
do $$
declare
  v_def text := pg_get_functiondef('public.session_next(uuid)'::regprocedure);
begin
  if position('newbie' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$      v_win := public.session_window(0, 1, v_run.rung);$a$,
    $a$      v_win := case when v_run.newbie then array[0, 0.15]::real[] else public.session_window(0, 1, v_run.rung) end;$a$);
  v_def := replace(v_def,
    $a$      v_win := public.session_window(v_run.level, (v_wcfg ->> 'levels')::int, v_run.rung);$a$,
    $a$      v_win := case when v_run.newbie and v_run.level <= 2 then array[0, 0.15]::real[]
                    else public.session_window(v_run.level, (v_wcfg ->> 'levels')::int, v_run.rung) end;$a$);
  v_def := replace(v_def,
    $a$coalesce((v_cfg ->> 'seconds')::int, 20)$a$,
    $a$coalesce((v_cfg ->> 'seconds')::int, 20) + case when v_run.newbie then 15 else 0 end$a$);
  if (length(v_def) - length(replace(v_def, 'newbie', ''))) / length('newbie') <> 3 then
    raise exception 'session_next patch did not apply';
  end if;
  execute v_def;
end $$;

-- session_finish: the first win ever gives a silver pack (shown on the result screen).
do $$
declare
  v_def text := pg_get_functiondef('public.session_finish(uuid, boolean)'::regprocedure);
begin
  if position('first_win' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$  if v_coins > 0 then
    perform public.ledger_apply(v_run.user_id, 'coins', v_coins, 'quiz_run'$a$,
    $a$  if not p_abandon and v_stars >= 1 and v_run.newbie and v_chest is null
     and not exists (select 1 from public.quiz_runs r where r.user_id = v_run.user_id and r.mode = 'session'
                      and r.status = 'won' and r.id <> p_run) then
    v_chest := 'silver';
    v_first_win := true;
    perform public.grant_pack_token(v_run.user_id, v_chest, 1);
  end if;
  if v_coins > 0 then
    perform public.ledger_apply(v_run.user_id, 'coins', v_coins, 'quiz_run'$a$);
  v_def := replace(v_def,
    $a$  v_chest text;$a$,
    $a$  v_chest text;
  v_first_win boolean := false;$a$);
  v_def := replace(v_def,
    $a$'doubled', v_run.doubled,$a$,
    $a$'doubled', v_run.doubled, 'first_win', v_first_win,$a$);
  if (length(v_def) - length(replace(v_def, 'v_first_win', ''))) / length('v_first_win') <> 3 then
    raise exception 'session_finish patch did not apply';
  end if;
  execute v_def;
end $$;
