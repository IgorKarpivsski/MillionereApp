-- Faster answers earn more, and the client is told how much of the score was speed.
update public.app_config set value = jsonb_set(value, '{points_per_second}', '10') where key = 'session';

CREATE OR REPLACE FUNCTION public.session_answer(p_run uuid, p_rung integer, p_slot integer)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  v_uid     uuid := public.require_user();
  v_run     public.quiz_runs;
  v_rq      public.quiz_run_questions;
  v_cfg     jsonb := (select value from public.app_config where key = 'session');
  v_cslot   integer;
  v_q       public.questions;
  v_correct boolean;
  v_timeout boolean := false;
  v_pts     integer := 0;
  v_speed   integer := 0;
  v_left    integer;
  v_summary jsonb;
  v_grace   constant interval := interval '3 seconds';
begin
  perform public.check_rate_limit(v_uid, 'session_answer', 90, 60);
  if p_slot is null or p_slot not between -1 and 3 then
    raise exception 'invalid_input: slot' using errcode = '22023';
  end if;
  v_run := public.session_lock_run(v_uid, p_run);
  if v_run.status <> 'active' or v_run.rung <> p_rung then
    raise exception 'invalid_state: not the current question' using errcode = 'P0001';
  end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = p_rung;
  if not found or v_rq.answered_slot is not null then
    raise exception 'invalid_state: question not open' using errcode = 'P0001';
  end if;
  if p_slot >= 0 and p_slot = any (v_rq.removed) then
    raise exception 'invalid_input: slot removed' using errcode = '22023';
  end if;
  if p_slot = -1 and now() <= v_rq.deadline then
    raise exception 'invalid_state: clock still running' using errcode = 'P0001';
  end if;
  select s.slot - 1 into v_cslot
    from unnest(v_rq.perm) with ordinality as s(pos, slot)
    join public.question_answers a on a.question_id = v_rq.question_id and a.position = s.pos and a.is_correct;
  select * into v_q from public.questions where id = v_rq.question_id;
  v_timeout := p_slot = -1 or now() > v_rq.deadline + v_grace;
  v_correct := not v_timeout and p_slot = v_cslot;
  if v_correct then
    v_left := greatest(0, ceil(extract(epoch from (v_rq.deadline - now()))))::int;
    v_speed := v_left * (v_cfg ->> 'points_per_second')::int;
    v_pts := (v_cfg ->> 'points_base')::int
           + round(coalesce(v_q.ease_rank, 0.3) * (v_cfg ->> 'points_difficulty')::int)::int
           + v_speed;
  end if;
  update public.quiz_run_questions
     set answered_slot = case when v_timeout then -1 else p_slot end, is_correct = v_correct, answered_at = now()
   where run_id = p_run and rung = p_rung;
  update public.quiz_runs
     set correct = correct + case when v_correct then 1 else 0 end,
         prize_points = prize_points + v_pts,
         rung = case when p_rung < (v_cfg ->> 'questions')::int then rung + 1 else rung end
   where id = p_run;
  if p_rung >= (v_cfg ->> 'questions')::int then
    v_summary := public.session_finish(p_run);
  end if;
  return jsonb_build_object(
    'result', case when v_timeout then 'timeout' when v_correct then 'correct' else 'wrong' end,
    'correct_slot', v_cslot, 'explanation', v_q.explanation_he, 'points', v_pts, 'speed_bonus', v_speed,
    'score', v_run.prize_points + v_pts, 'correct_count', v_run.correct + case when v_correct then 1 else 0 end,
    'summary', v_summary);
end $function$;
