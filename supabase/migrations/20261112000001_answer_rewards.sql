-- 0.2.0: a right answer should feel like a reward the moment it lands.
-- session_answer now also returns:
--   coins      the coins this answer adds to the run (paid with the rest at the end, same math as session_finish)
--   mid_chest  a surprise chest the first time a run reaches 5 correct answers, paid right away
-- The chest's contents come from app_config 'session.rewards' -> mid_chest (weighted list of rewards).

alter table public.quiz_runs add column if not exists mid_chest jsonb;

update public.app_config
   set value = value || jsonb_build_object('mid_chest_at', 5, 'mid_chest', jsonb_build_array(
         jsonb_build_object('kind', 'coins', 'amount', 60, 'weight', 30),
         jsonb_build_object('kind', 'coins', 'amount', 120, 'weight', 18),
         jsonb_build_object('kind', 'coins', 'amount', 250, 'weight', 6),
         jsonb_build_object('kind', 'gems', 'amount', 2, 'weight', 16),
         jsonb_build_object('kind', 'gems', 'amount', 5, 'weight', 5),
         jsonb_build_object('kind', 'boost', 'boost', 'time', 'amount', 1, 'weight', 10),
         jsonb_build_object('kind', 'boost', 'boost', 'skip', 'amount', 1, 'weight', 8),
         jsonb_build_object('kind', 'pack', 'pack', 'bronze', 'amount', 1, 'weight', 7)))
 where key = 'session.rewards';

/** Picks one reward from a weighted list ([{..., "weight": n}, ...]); the weight is dropped from the result. */
create or replace function public.pick_weighted(p_list jsonb) returns jsonb
language plpgsql volatile set search_path = '' as $$
declare v_total numeric := 0; v_roll numeric; r jsonb;
begin
  select coalesce(sum(greatest(coalesce((x ->> 'weight')::numeric, 1), 0)), 0) into v_total from jsonb_array_elements(p_list) x;
  if v_total <= 0 then return null; end if;
  v_roll := random() * v_total;
  for r in select x from jsonb_array_elements(p_list) x loop
    v_roll := v_roll - greatest(coalesce((r ->> 'weight')::numeric, 1), 0);
    if v_roll < 0 then return r - 'weight'; end if;
  end loop;
  return (p_list -> -1) - 'weight';
end $$;
revoke all on function public.pick_weighted(jsonb) from public, anon, authenticated;

/** The coin multiplier of a run, exactly as session_finish computes it. */
create or replace function public.session_coin_mult(p_run public.quiz_runs) returns numeric
language plpgsql stable set search_path = '' as $$
declare v_mult numeric := 1; v_levels integer;
begin
  if p_run.world <> 'mix' then
    v_levels := coalesce((public.world_cfg(p_run.world) ->> 'levels')::int, 999);
    if p_run.level > v_levels then v_mult := 2; end if;
  end if;
  if p_run.doubled then v_mult := v_mult * 2; end if;
  if p_run.world = public.event_world() then
    v_mult := v_mult * coalesce(((select value from public.app_config where key = 'event') ->> 'coins_mult')::numeric, 2);
  end if;
  return v_mult;
end $$;
revoke all on function public.session_coin_mult(public.quiz_runs) from public, anon, authenticated;

create or replace function public.session_answer(p_run uuid, p_rung integer, p_slot integer)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid     uuid := public.require_user();
  v_run     public.quiz_runs;
  v_rq      public.quiz_run_questions;
  v_cfg     jsonb := (select value from public.app_config where key = 'session');
  v_cslot   integer;
  v_q       public.questions;
  v_correct boolean;
  v_timeout boolean := false;
  v_shield  boolean := false;
  v_pts     integer := 0;
  v_speed   integer := 0;
  v_left    integer;
  v_summary jsonb;
  v_grace   constant interval := interval '3 seconds';
  v_rw      jsonb := (select value from public.app_config where key = 'session.rewards');
  v_combo   integer := 0;
  v_cbonus  integer := 0;
  v_coins   integer := 0;
  v_count   integer;
  v_chest   jsonb;
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
    v_left := case when v_rq.frozen then 0
                   else least(greatest(0, ceil(extract(epoch from (v_rq.deadline - now()))))::int, (v_cfg ->> 'seconds')::int) end;
    v_speed := v_left * (v_cfg ->> 'points_per_second')::int;
    v_pts := (v_cfg ->> 'points_base')::int
           + round(coalesce(v_q.ease_rank, 0.3) * (v_cfg ->> 'points_difficulty')::int)::int
           + v_speed;
    -- combo: correct answers in a row (this one included); from the 3rd on, +10 each, up to +50
    v_combo := 1 + (select count(*) from public.quiz_run_questions q
                     where q.run_id = p_run and q.rung < p_rung
                       and q.rung > coalesce((select max(w.rung) from public.quiz_run_questions w
                                               where w.run_id = p_run and w.rung < p_rung and w.is_correct is not true), 0));
    v_cbonus := least(greatest(v_combo - coalesce((v_rw ->> 'combo_from')::int, 3) + 1, 0) * coalesce((v_rw ->> 'combo_step')::int, 10),
                      coalesce((v_rw ->> 'combo_max')::int, 50));
    v_pts := v_pts + v_cbonus;
  elsif v_run.shield_armed then
    v_shield := true;
  end if;
  if v_correct or v_shield then
    v_coins := round((v_cfg ->> 'coins_per_correct')::int * public.session_coin_mult(v_run))::int;
  end if;
  v_count := v_run.correct + case when v_correct or v_shield then 1 else 0 end;
  update public.quiz_run_questions
     set answered_slot = case when v_timeout then -1 else p_slot end, is_correct = v_correct, answered_at = now()
   where run_id = p_run and rung = p_rung;
  update public.quiz_runs
     set correct = v_count,
         prize_points = prize_points + v_pts,
         shield_armed = shield_armed and not v_shield,
         rung = case when p_rung < (v_cfg ->> 'questions')::int then rung + 1 else rung end
   where id = p_run;
  -- the surprise chest: once per run, the moment it reaches N correct answers (not for continued runs)
  if (v_correct or v_shield) and v_run.mid_chest is null and v_run.continued_from is null
     and v_count = coalesce((v_rw ->> 'mid_chest_at')::int, 5) and jsonb_typeof(v_rw -> 'mid_chest') = 'array' then
    v_chest := public.pick_weighted(v_rw -> 'mid_chest');
    if v_chest is not null then
      perform public.grant_reward(v_uid, v_chest, 'midchest:' || p_run::text);
      update public.quiz_runs set mid_chest = v_chest where id = p_run;
    end if;
  end if;
  if p_rung >= (v_cfg ->> 'questions')::int then
    v_summary := public.session_finish(p_run);
    -- every question right: a champion's prize
    if (select count(*) from public.quiz_run_questions where run_id = p_run and is_correct) >= (v_cfg ->> 'questions')::int then
      perform public.ledger_apply(v_uid, 'coins', coalesce((v_rw ->> 'perfect_coins')::int, 100), 'perfect_run', 'quiz_run', p_run::text, 'perfect:c:' || p_run);
      perform public.ledger_apply(v_uid, 'gems', coalesce((v_rw ->> 'perfect_gems')::int, 5), 'perfect_run', 'quiz_run', p_run::text, 'perfect:g:' || p_run);
      v_summary := v_summary || jsonb_build_object('perfect', jsonb_build_object(
        'coins', coalesce((v_rw ->> 'perfect_coins')::int, 100), 'gems', coalesce((v_rw ->> 'perfect_gems')::int, 5)));
    end if;
  end if;
  return jsonb_build_object(
    'result', case when v_timeout then 'timeout' when v_correct then 'correct' else 'wrong' end,
    'shielded', v_shield,
    'correct_slot', v_cslot, 'explanation', v_q.explanation_he, 'points', v_pts, 'speed_bonus', v_speed, 'combo', v_combo, 'combo_bonus', v_cbonus,
    'score', v_run.prize_points + v_pts,
    'correct_count', v_count,
    'coins', v_coins,
    'mid_chest', v_chest,
    'summary', v_summary);
end $function$;
