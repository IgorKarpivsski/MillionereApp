-- Boosts (time, freeze, shield, skip, double, heart), the "remove one wrong answer" hint,
-- the champion tier after a world's last level, and phone-a-friend.

-- ---------------------------------------------------------------------------
-- Config
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values
  ('boosts', '{
     "prices": {"time": 60, "freeze": 120, "shield": 150, "skip": 80, "double": 200, "heart": 150},
     "time_seconds": 10, "freeze_seconds": 90, "skips_per_run": 2,
     "hint_coins": 20, "call_seconds": 45, "continue_questions": 3,
     "welcome": {"time": 2, "skip": 1, "shield": 1}
   }'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

-- Two boost segments on the wheel (taken from the most common coin slice).
update public.app_config
   set value = jsonb_set(value, '{segments}',
     (select jsonb_agg(case when s ->> 'id' = 'c100' then jsonb_set(s, '{weight}', '14') else s end)
        from jsonb_array_elements(value -> 'segments') s)
     || '[{"id": "b_time", "kind": "boost", "boost": "time", "amount": 2, "weight": 6},
          {"id": "b_shield", "kind": "boost", "boost": "shield", "amount": 1, "weight": 4}]'::jsonb)
 where key = 'wheel' and not (value -> 'segments') @> '[{"id": "b_time"}]';

-- ---------------------------------------------------------------------------
-- Inventory
-- ---------------------------------------------------------------------------
create table if not exists public.user_boosts (
  user_id uuid not null references auth.users (id) on delete cascade,
  boost   text not null check (boost in ('time', 'freeze', 'shield', 'skip', 'double', 'heart')),
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, boost)
);
alter table public.user_boosts enable row level security;
create policy user_boosts_own on public.user_boosts for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.user_boosts from anon, authenticated;

alter table public.quiz_runs add column if not exists boosts text[] not null default '{}';
alter table public.quiz_runs add column if not exists shield_armed boolean not null default false;
alter table public.quiz_runs add column if not exists doubled boolean not null default false;
alter table public.quiz_runs add column if not exists carry smallint not null default 0;
alter table public.quiz_runs add column if not exists continued_from uuid;
create unique index if not exists quiz_runs_continued_from on public.quiz_runs (continued_from) where continued_from is not null;
alter table public.quiz_run_questions add column if not exists boosts text[] not null default '{}';
alter table public.quiz_run_questions add column if not exists frozen boolean not null default false;

create or replace function public.boost_add(p_user uuid, p_boost text, p_n integer) returns void
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.user_boosts as b (user_id, boost, count) values (p_user, p_boost, greatest(p_n, 0))
  on conflict (user_id, boost) do update set count = b.count + greatest(p_n, 0);
end $$;

create or replace function public.boost_take(p_user uuid, p_boost text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.user_boosts set count = count - 1 where user_id = p_user and boost = p_boost and count > 0;
  if not found then raise exception 'invalid_state: no boost' using errcode = 'P0001'; end if;
end $$;
revoke all on function public.boost_add(uuid, text, integer), public.boost_take(uuid, text) from public, anon, authenticated;

create or replace function public.boost_counts(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select coalesce(jsonb_object_agg(boost, count), '{}'::jsonb) from public.user_boosts where user_id = p_user
$$;
revoke all on function public.boost_counts(uuid) from public, anon, authenticated;

/** Wheel / calendar rewards learn a new kind: {"kind": "boost", "boost": "time", "amount": 2}. */
create or replace function public.grant_reward(p_user uuid, p_r jsonb, p_key text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_amt integer := coalesce((p_r ->> 'amount')::int, 1);
begin
  case p_r ->> 'kind'
    when 'coins' then perform public.ledger_apply(p_user, 'coins', v_amt, 'reward', 'reward', p_key, p_key || ':c');
    when 'gems'  then perform public.ledger_apply(p_user, 'gems', v_amt, 'reward', 'reward', p_key, p_key || ':g');
    when 'dust'  then perform public.ledger_apply(p_user, 'dust', v_amt, 'reward', 'reward', p_key, p_key || ':d');
    when 'pack'  then perform public.grant_pack_token(p_user, p_r ->> 'pack', v_amt);
    when 'tickets' then perform public.energy_add(p_user, v_amt);
    when 'boost' then perform public.boost_add(p_user, p_r ->> 'boost', v_amt);
    when 'cosmetic' then
      insert into public.user_cosmetics (user_id, item, source) values (p_user, p_r ->> 'item', p_key) on conflict do nothing;
    else raise exception 'invalid_input: reward kind' using errcode = '22023';
  end case;
end $$;

/** Inventory + prices. New players get a small welcome set once. */
create or replace function public.boosts_state() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user(); v_cfg jsonb := (select value from public.app_config where key = 'boosts'); k text;
begin
  if not exists (select 1 from public.user_boosts where user_id = v_uid) then
    for k in select jsonb_object_keys(v_cfg -> 'welcome') loop
      perform public.boost_add(v_uid, k, (v_cfg -> 'welcome' ->> k)::int);
    end loop;
  end if;
  return jsonb_build_object('counts', public.boost_counts(v_uid), 'prices', v_cfg -> 'prices', 'hint_coins', v_cfg -> 'hint_coins');
end $$;

create or replace function public.boost_buy(p_boost text, p_request uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_user(); v_price bigint; v_tx public.wallet_transactions; v_key text;
begin
  perform public.check_rate_limit(v_uid, 'boost_buy', 30, 60);
  v_price := ((select value from public.app_config where key = 'boosts') -> 'prices' ->> p_boost)::bigint;
  if v_price is null or p_request is null then raise exception 'invalid_input: boost' using errcode = '22023'; end if;
  v_key := 'boost:' || p_request::text;
  if exists (select 1 from public.wallet_transactions where user_id = v_uid and idempotency_key = v_key) then
    return jsonb_build_object('counts', public.boost_counts(v_uid));
  end if;
  v_tx := public.ledger_apply(v_uid, 'coins', -v_price, 'boost', 'boost', p_boost, v_key);
  perform public.boost_add(v_uid, p_boost, 1);
  return jsonb_build_object('counts', public.boost_counts(v_uid), 'balance', v_tx.balance_after);
end $$;

-- ---------------------------------------------------------------------------
-- Champion tier: after the last level of a world, extra levels with the hardest questions.
-- ---------------------------------------------------------------------------
create or replace function public.champion_levels(p_levels integer) returns integer
language sql immutable set search_path = '' as $$ select greatest(5, ceil(p_levels / 3.0)::int) $$;

create or replace function public.world_unlocked(p_user uuid, p_world text) returns integer
language sql stable security definer set search_path = '' as $$
  select least(coalesce((select max(level) from public.user_world_levels
                          where user_id = p_user and world = p_world and stars >= 1), 0) + 1,
               coalesce((public.world_cfg(p_world) ->> 'levels')::int, 1)
                 + public.champion_levels(coalesce((public.world_cfg(p_world) ->> 'levels')::int, 1)))
$$;

create or replace function public.session_window(p_level integer, p_levels integer, p_rung integer) returns real[]
language plpgsql immutable set search_path = '' as $$
declare c real; w real := 0.14; v_ch integer;
begin
  if p_level = 0 then
    c := 0.06 + 0.07 * (p_rung - 1);
  elsif p_level > p_levels then
    -- champion tier: the hardest slice of the world, getting harder level by level
    v_ch := public.champion_levels(p_levels);
    c := 0.80 + 0.16 * (p_level - p_levels - 1)::real / greatest(v_ch - 1, 1) + 0.01 * (p_rung - 5);
    w := 0.10;
  else
    c := 0.04 + 0.88 * (p_level - 1)::real / greatest(p_levels - 1, 1) + 0.012 * (p_rung - 5);
  end if;
  return array[greatest(c - w, 0), least(c + w, 1)];
end $$;

create or replace function public.worlds_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  return jsonb_build_object(
    'worlds', (
      select coalesce(jsonb_agg(jsonb_build_object(
               'slug', w ->> 'slug',
               'unlocked', public.world_unlocked(v_uid, w ->> 'slug'),
               'champion_levels', public.champion_levels((w ->> 'levels')::int),
               'stars', coalesce((select jsonb_object_agg(level, stars) from public.user_world_levels u
                                   where u.user_id = v_uid and u.world = w ->> 'slug'), '{}'::jsonb),
               'total_stars', coalesce((select sum(stars) from public.user_world_levels u
                                         where u.user_id = v_uid and u.world = w ->> 'slug'), 0)
             ) order by o), '[]'::jsonb)
        from public.app_config c, jsonb_array_elements(c.value) with ordinality as t(w, o)
       where c.key = 'worlds' and coalesce((w ->> 'active')::boolean, true)),
    'total_stars', coalesce((select sum(stars) from public.user_world_levels where user_id = v_uid), 0),
    'active_run', (select jsonb_build_object('run_id', id, 'world', world, 'level', level)
                     from public.quiz_runs where user_id = v_uid and status = 'active' and mode = 'session'
                      and started_at > now() - interval '30 minutes' limit 1));
end $$;

-- ---------------------------------------------------------------------------
-- Session: payload, answer and finish learn boosts, carry-over and the champion tier.
-- ---------------------------------------------------------------------------
create or replace function public.session_payload(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_run public.quiz_runs; v_cfg jsonb := (select value from public.app_config where key = 'session');
        v_rq public.quiz_run_questions;
begin
  select * into v_run from public.quiz_runs where id = p_run;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = v_run.rung;
  return public.quiz_payload(p_run) || jsonb_build_object(
    'mode', 'session', 'world', v_run.world, 'level', v_run.level, 'score', v_run.prize_points,
    'total', (v_cfg ->> 'questions')::int,
    'champion', v_run.world <> 'mix' and v_run.level > coalesce((public.world_cfg(v_run.world) ->> 'levels')::int, 999),
    'boosts', public.boost_counts(v_run.user_id),
    'run_boosts', to_jsonb(v_run.boosts),
    'question_boosts', to_jsonb(coalesce(v_rq.boosts, '{}')),
    'frozen', coalesce(v_rq.frozen, false),
    'shield', v_run.shield_armed, 'doubled', v_run.doubled,
    'question_world', (select q.world from public.questions q where q.id = v_rq.question_id));
end $$;

create or replace function public.session_answer(p_run uuid, p_rung integer, p_slot integer) returns jsonb
language plpgsql security definer set search_path = '' as $$
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
    -- Speed bonus: seconds left of the normal clock. A frozen clock (freeze / phone a friend) earns none.
    v_left := case when v_rq.frozen then 0
                   else least(greatest(0, ceil(extract(epoch from (v_rq.deadline - now()))))::int, (v_cfg ->> 'seconds')::int) end;
    v_speed := v_left * (v_cfg ->> 'points_per_second')::int;
    v_pts := (v_cfg ->> 'points_base')::int
           + round(coalesce(v_q.ease_rank, 0.3) * (v_cfg ->> 'points_difficulty')::int)::int
           + v_speed;
  elsif v_run.shield_armed then
    -- Shield: this mistake still counts toward the level (no points).
    v_shield := true;
  end if;
  update public.quiz_run_questions
     set answered_slot = case when v_timeout then -1 else p_slot end, is_correct = v_correct, answered_at = now()
   where run_id = p_run and rung = p_rung;
  update public.quiz_runs
     set correct = correct + case when v_correct or v_shield then 1 else 0 end,
         prize_points = prize_points + v_pts,
         shield_armed = shield_armed and not v_shield,
         rung = case when p_rung < (v_cfg ->> 'questions')::int then rung + 1 else rung end
   where id = p_run;
  if p_rung >= (v_cfg ->> 'questions')::int then
    v_summary := public.session_finish(p_run);
  end if;
  return jsonb_build_object(
    'result', case when v_timeout then 'timeout' when v_correct then 'correct' else 'wrong' end,
    'shielded', v_shield,
    'correct_slot', v_cslot, 'explanation', v_q.explanation_he, 'points', v_pts, 'speed_bonus', v_speed,
    'score', v_run.prize_points + v_pts,
    'correct_count', v_run.correct + case when v_correct or v_shield then 1 else 0 end,
    'summary', v_summary);
end $$;

create or replace function public.session_finish(p_run uuid, p_abandon boolean default false) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_run   public.quiz_runs;
  v_cfg   jsonb := (select value from public.app_config where key = 'session');
  v_stars integer := 0;
  v_coins integer := 0;
  v_xp    integer;
  v_new   integer;
  v_mult  integer := 1;
  v_prev  public.user_world_levels;
  v_old   integer;
  v_lvl   integer;
  v_bal   bigint;
  v_chest text;
  v_first boolean := false;
  v_unl   integer;
  v_levels integer;
begin
  select * into v_run from public.quiz_runs where id = p_run;
  if v_run.status <> 'active' then
    raise exception 'invalid_state: run already finished' using errcode = 'P0001';
  end if;
  if not p_abandon then
    v_stars := case when v_run.correct >= (v_cfg -> 'stars_at' ->> 2)::int then 3
                    when v_run.correct >= (v_cfg -> 'stars_at' ->> 1)::int then 2
                    when v_run.correct >= (v_cfg -> 'stars_at' ->> 0)::int then 1 else 0 end;
  end if;
  if v_run.world <> 'mix' then v_levels := coalesce((public.world_cfg(v_run.world) ->> 'levels')::int, 999); end if;
  if v_run.world <> 'mix' and v_run.level > v_levels then v_mult := 2; end if;  -- champion tier pays double
  if v_run.doubled then v_mult := v_mult * 2; end if;
  -- A continued run only pays for what was answered after the continue.
  v_new := greatest(v_run.correct - v_run.carry, 0);
  v_coins := (v_new * (v_cfg ->> 'coins_per_correct')::int + coalesce((v_cfg -> 'star_coins' ->> v_stars)::int, 0)) * v_mult;
  v_xp := (v_new * (v_cfg ->> 'xp_per_correct')::int + v_stars * (v_cfg ->> 'xp_per_star')::int) * least(v_mult, 2);
  if v_run.world <> 'mix' and v_run.level >= 1 and not p_abandon then
    select * into v_prev from public.user_world_levels
     where user_id = v_run.user_id and world = v_run.world and level = v_run.level for update;
    insert into public.user_world_levels as u (user_id, world, level, stars, best_correct, plays)
    values (v_run.user_id, v_run.world, v_run.level, v_stars, v_run.correct, 1)
    on conflict (user_id, world, level) do update
      set stars = greatest(u.stars, excluded.stars), best_correct = greatest(u.best_correct, excluded.best_correct),
          plays = u.plays + 1, updated_at = now();
    v_first := v_stars >= 1 and coalesce(v_prev.stars, 0) = 0;
    if v_first and (v_run.level % (v_cfg ->> 'chest_every')::int = 0 or v_run.level > v_levels) then
      v_chest := 'gold';
    elsif v_stars = 3 and coalesce(v_prev.stars, 0) < 3 then
      v_chest := 'silver';
    end if;
    if v_chest is not null then
      perform public.grant_pack_token(v_run.user_id, v_chest, 1);
    end if;
  end if;
  if v_coins > 0 then
    perform public.ledger_apply(v_run.user_id, 'coins', v_coins, 'quiz_run', 'quiz_run', v_run.id::text, 'quiz_run:' || v_run.id::text);
  end if;
  select level into v_old from public.profiles where id = v_run.user_id;
  update public.profiles set xp = xp + v_xp, level = public.level_from_xp(xp + v_xp)
   where id = v_run.user_id returning level into v_lvl;
  update public.quiz_runs
     set status = case when p_abandon then 'abandoned'::public.quiz_run_status
                       when v_stars >= 1 then 'won'::public.quiz_run_status else 'lost'::public.quiz_run_status end,
         ended_at = now(), coins_awarded = v_coins, xp_awarded = v_xp, stars = v_stars
   where id = p_run;
  select coins into v_bal from public.wallets where user_id = v_run.user_id;
  if v_run.world <> 'mix' then v_unl := public.world_unlocked(v_run.user_id, v_run.world); end if;
  return jsonb_build_object(
    'mode', 'session', 'status', case when v_stars >= 1 then 'won' else 'lost' end,
    'world', v_run.world, 'level', v_run.level, 'stars', v_stars, 'prev_stars', coalesce(v_prev.stars, 0),
    'correct', v_run.correct, 'total', (v_cfg ->> 'questions')::int,
    'coins', v_coins, 'prize_points', v_run.prize_points, 'xp', v_xp, 'level_up', v_lvl > coalesce(v_old, 1),
    'player_level', v_lvl, 'leveled_up', v_lvl > coalesce(v_old, 1), 'balance', v_bal,
    'chest', v_chest, 'first_clear', v_first, 'unlocked', v_unl,
    'doubled', v_run.doubled, 'champion', coalesce(v_run.world <> 'mix' and v_run.level > v_levels, false),
    'champion_opened', v_run.world <> 'mix' and v_first and v_run.level = v_levels,
    'can_continue', not p_abandon and v_stars = 0 and v_run.world <> 'mix' and v_run.continued_from is null,
    'hearts', coalesce((select count from public.user_boosts where user_id = v_run.user_id and boost = 'heart'), 0));
end $$;

/** Uses a boost on the current run / question. */
create or replace function public.session_boost(p_run uuid, p_boost text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_run public.quiz_runs;
  v_rq  public.quiz_run_questions;
  v_b   jsonb := (select value from public.app_config where key = 'boosts');
begin
  perform public.check_rate_limit(v_uid, 'session_boost', 30, 60);
  v_run := public.session_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then raise exception 'invalid_state: run finished' using errcode = 'P0001'; end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = v_run.rung for update;

  if p_boost in ('time', 'freeze', 'skip') then
    if not found or v_rq.answered_slot is not null or now() > v_rq.deadline then
      raise exception 'invalid_state: question not open' using errcode = 'P0001';
    end if;
    if p_boost = any (v_rq.boosts) or (p_boost <> 'skip' and v_rq.frozen) then
      raise exception 'invalid_state: already used' using errcode = 'P0001';
    end if;
  end if;
  if p_boost in ('shield', 'double') and p_boost = any (v_run.boosts) then
    raise exception 'invalid_state: already used' using errcode = 'P0001';
  end if;
  if p_boost = 'skip' and (select count(*) from unnest(v_run.boosts) b where b = 'skip') >= (v_b ->> 'skips_per_run')::int then
    raise exception 'invalid_state: no more skips' using errcode = 'P0001';
  end if;
  if p_boost not in ('time', 'freeze', 'skip', 'shield', 'double') then
    raise exception 'invalid_input: boost' using errcode = '22023';
  end if;

  perform public.boost_take(v_uid, p_boost);
  update public.quiz_runs set boosts = boosts || p_boost,
         shield_armed = shield_armed or p_boost = 'shield',
         doubled = doubled or p_boost = 'double'
   where id = p_run;

  if p_boost = 'time' then
    update public.quiz_run_questions
       set deadline = deadline + make_interval(secs => (v_b ->> 'time_seconds')::int), boosts = boosts || p_boost
     where run_id = p_run and rung = v_run.rung;
  elsif p_boost = 'freeze' then
    update public.quiz_run_questions
       set deadline = now() + make_interval(secs => (v_b ->> 'freeze_seconds')::int), frozen = true, boosts = boosts || p_boost
     where run_id = p_run and rung = v_run.rung;
  elsif p_boost = 'skip' then
    delete from public.quiz_run_questions where run_id = p_run and rung = v_run.rung;
    return public.session_next(p_run);
  end if;
  return public.session_payload(p_run);
end $$;

/** Hint: hides one wrong answer. Paid with coins, or free after a rewarded ad (daily ad cap applies). */
create or replace function public.session_hint(p_run uuid, p_pay text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_run  public.quiz_runs;
  v_rq   public.quiz_run_questions;
  v_b    jsonb := (select value from public.app_config where key = 'boosts');
  v_cpos integer;
  v_pick smallint;
  v_cap  integer;
begin
  perform public.check_rate_limit(v_uid, 'session_hint', 20, 60);
  v_run := public.session_lock_run(v_uid, p_run);
  if v_run.status <> 'active' then raise exception 'invalid_state: run finished' using errcode = 'P0001'; end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = v_run.rung for update;
  if not found or v_rq.answered_slot is not null or now() > v_rq.deadline or cardinality(v_rq.removed) >= 2
     or 'hint' = any (v_rq.boosts) then
    raise exception 'invalid_state: hint not available' using errcode = 'P0001';
  end if;
  if p_pay = 'coins' then
    perform public.ledger_apply(v_uid, 'coins', -((v_b ->> 'hint_coins')::bigint), 'hint', 'quiz_run',
      p_run::text, 'hint:' || p_run || ':' || v_run.rung);
  elsif p_pay = 'ad' then
    select (value #>> '{}')::int into v_cap from public.app_config where key = 'ads.daily_cap';
    if (select count(*) from public.ad_claims where user_id = v_uid and created_at > now() - interval '1 day') >= coalesce(v_cap, 15) then
      raise exception 'rate_limited' using errcode = 'P0429';
    end if;
    insert into public.ad_claims (user_id, kind, ref) values (v_uid, 'hint', p_run || ':' || v_run.rung) on conflict do nothing;
  else
    raise exception 'invalid_input: pay' using errcode = '22023';
  end if;
  select s.slot - 1 into v_cpos
    from unnest(v_rq.perm) with ordinality as s(pos, slot)
    join public.question_answers a on a.question_id = v_rq.question_id and a.position = s.pos and a.is_correct;
  select x::smallint into v_pick from generate_series(0, 3) x
   where x <> v_cpos and not (x::smallint = any (v_rq.removed)) order by random() limit 1;
  update public.quiz_run_questions set removed = removed || v_pick, boosts = boosts || 'hint'::text
   where run_id = p_run and rung = v_run.rung;
  return public.session_payload(p_run);
end $$;

/** Heart: a failed level gets a few more questions instead of starting over (no ticket spent). */
create or replace function public.session_continue(p_run uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_prev public.quiz_runs;
  v_cfg  jsonb := (select value from public.app_config where key = 'session');
  v_more integer := ((select value from public.app_config where key = 'boosts') ->> 'continue_questions')::int;
  v_id   uuid;
begin
  perform public.check_rate_limit(v_uid, 'session_continue', 10, 60);
  select * into v_prev from public.quiz_runs where id = p_run and user_id = v_uid and mode = 'session' for update;
  if not found or v_prev.status <> 'lost' or v_prev.world = 'mix' or v_prev.continued_from is not null
     or v_prev.ended_at < now() - interval '15 minutes' then
    raise exception 'invalid_state: cannot continue' using errcode = 'P0001';
  end if;
  perform public.boost_take(v_uid, 'heart');
  perform public.abandon_active_runs(v_uid);
  insert into public.quiz_runs (user_id, mode, world, level, rung, correct, carry, prize_points, boosts, continued_from)
  values (v_uid, 'session', v_prev.world, v_prev.level, (v_cfg ->> 'questions')::int - v_more + 1,
          v_prev.correct, v_prev.correct, v_prev.prize_points, '{heart}', p_run)
  returning id into v_id;
  return public.session_next(v_id);
end $$;

alter table public.ad_claims drop constraint ad_claims_kind;
alter table public.ad_claims add constraint ad_claims_kind check (kind = any (array['double_run', 'free_pack', 'vip_daily', 'energy', 'hint']));

-- ---------------------------------------------------------------------------
-- Phone a friend
-- ---------------------------------------------------------------------------
alter table public.profiles add column if not exists last_active timestamptz;

create table if not exists public.friend_calls (
  id          uuid primary key default gen_random_uuid(),
  caller      uuid not null references auth.users (id) on delete cascade,
  friend      uuid not null references auth.users (id) on delete cascade,
  run_id      uuid not null,
  rung        smallint not null,
  question    jsonb not null,
  created_at  timestamptz not null default now(),
  expires_at  timestamptz not null,
  answer_slot smallint,
  answered_at timestamptz
);
create index if not exists friend_calls_friend on public.friend_calls (friend, expires_at);
create unique index if not exists friend_calls_run on public.friend_calls (run_id);
alter table public.friend_calls enable row level security;
revoke all on public.friend_calls from anon, authenticated;

/** Heartbeat while the app is open: marks the player online and returns calls waiting for them. */
create or replace function public.presence_ping() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  update public.profiles set last_active = now() where id = v_uid and (last_active is null or last_active < now() - interval '5 seconds');
  return jsonb_build_object('calls', coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'from', p.username, 'avatar_id', p.avatar_id, 'question', c.question,
                                        'seconds_left', greatest(0, ceil(extract(epoch from (c.expires_at - now()))))::int)
                     order by c.created_at)
      from public.friend_calls c join public.profiles p on p.id = c.caller
     where c.friend = v_uid and c.answer_slot is null and c.expires_at > now()), '[]'::jsonb));
end $$;

/** Friends who can take a call right now (app open in the last 40 seconds). */
create or replace function public.call_candidates() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', p.id, 'username', p.username, 'avatar_id', p.avatar_id, 'level', p.level,
                                        'online', coalesce(p.last_active > now() - interval '40 seconds', false))
                     order by coalesce(p.last_active > now() - interval '40 seconds', false) desc, p.username)
      from public.friendships f
      join public.profiles p on p.id = case when f.user_a = v_uid then f.user_b else f.user_a end
     where v_uid in (f.user_a, f.user_b) and f.status = 'accepted' and not public.is_blocked(v_uid, p.id)), '[]'::jsonb);
end $$;

/** Calls a friend about the current question: the clock pauses while they think. Once per run. */
create or replace function public.session_call_friend(p_run uuid, p_friend uuid) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_run public.quiz_runs;
  v_rq  public.quiz_run_questions;
  v_secs integer := ((select value from public.app_config where key = 'boosts') ->> 'call_seconds')::int;
  v_pl  jsonb;
  v_id  uuid;
begin
  perform public.check_rate_limit(v_uid, 'session_call_friend', 10, 60);
  v_run := public.session_lock_run(v_uid, p_run);
  if v_run.status <> 'active' or 'call' = any (v_run.boosts) then
    raise exception 'invalid_state: lifeline not available' using errcode = 'P0001';
  end if;
  if not public.are_friends(v_uid, p_friend) or public.is_blocked(v_uid, p_friend) then
    raise exception 'invalid_input: friend' using errcode = '22023';
  end if;
  if not exists (select 1 from public.profiles where id = p_friend and last_active > now() - interval '40 seconds') then
    raise exception 'invalid_state: friend offline' using errcode = 'P0001';
  end if;
  select * into v_rq from public.quiz_run_questions where run_id = p_run and rung = v_run.rung for update;
  if not found or v_rq.answered_slot is not null or now() > v_rq.deadline then
    raise exception 'invalid_state: question not open' using errcode = 'P0001';
  end if;
  v_pl := public.quiz_payload(p_run) -> 'question';
  insert into public.friend_calls (caller, friend, run_id, rung, question, expires_at)
  values (v_uid, p_friend, p_run, v_run.rung,
          jsonb_build_object('text', v_pl ->> 'text', 'image', v_pl -> 'image', 'answers', v_pl -> 'answers', 'removed', v_pl -> 'removed'),
          now() + make_interval(secs => v_secs))
  returning id into v_id;
  update public.quiz_runs set boosts = boosts || 'call'::text where id = p_run;
  update public.quiz_run_questions set deadline = greatest(deadline, now() + make_interval(secs => v_secs + 10)), frozen = true
   where run_id = p_run and rung = v_run.rung;
  return public.session_payload(p_run) || jsonb_build_object('call_id', v_id);
end $$;

create or replace function public.friend_call_answer(p_call uuid, p_slot integer) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  if p_slot not between 0 and 3 then raise exception 'invalid_input: slot' using errcode = '22023'; end if;
  update public.friend_calls set answer_slot = p_slot, answered_at = now()
   where id = p_call and friend = v_uid and answer_slot is null and expires_at > now();
  if not found then raise exception 'invalid_state: call over' using errcode = 'P0001'; end if;
end $$;

create or replace function public.friend_call_state(p_call uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user(); v_c public.friend_calls;
begin
  select * into v_c from public.friend_calls where id = p_call and caller = v_uid;
  if not found then raise exception 'invalid_input: call' using errcode = '22023'; end if;
  return jsonb_build_object('answer_slot', v_c.answer_slot, 'expired', v_c.expires_at <= now() and v_c.answer_slot is null,
    'seconds_left', greatest(0, ceil(extract(epoch from (v_c.expires_at - now()))))::int,
    'friend', (select username from public.profiles where id = v_c.friend));
end $$;

revoke all on function public.boosts_state(), public.boost_buy(text, uuid), public.session_boost(uuid, text),
  public.session_hint(uuid, text), public.session_continue(uuid), public.presence_ping(), public.call_candidates(),
  public.session_call_friend(uuid, uuid), public.friend_call_answer(uuid, integer), public.friend_call_state(uuid)
  from public, anon;
grant execute on function public.boosts_state(), public.boost_buy(text, uuid), public.session_boost(uuid, text),
  public.session_hint(uuid, text), public.session_continue(uuid), public.presence_ping(), public.call_candidates(),
  public.session_call_friend(uuid, uuid), public.friend_call_answer(uuid, integer), public.friend_call_state(uuid)
  to authenticated;
revoke all on function public.champion_levels(integer) from public, anon;
grant execute on function public.champion_levels(integer) to authenticated;
