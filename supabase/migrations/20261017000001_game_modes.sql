-- =============================================================================
-- New game modes
--
--  * Against the clock (blitz): 60 seconds, as many correct answers as you can.
--    One energy ticket, coins per correct answer (capped), personal best.
--  * Random opponent: the friend match engine with server matchmaking. If no
--    one is searching, the host can play "the sloth" — a clearly labelled
--    computer opponent with a pre-computed, human-like answer plan.
--  * Family room: up to 6 players on their own devices, same 15–20 questions,
--    host picks the topic (a world or a mix) and starts. An answer is final;
--    the next question comes as soon as everyone has answered (or 20 s pass).
--    Points = correct + speed. Highest total is the champion.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------

/** A question as players see it, answers shuffled by p_perm (slot → canonical position). */
create function public.mode_question_json(p_qid text, p_perm jsonb) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('id', q.id, 'text', q.text_he, 'image', q.image,
           'category_name', (select name_he from public.question_categories where slug = q.category),
           'answers', (select jsonb_agg(jsonb_build_object('slot', s, 'text', a.text_he) order by s)
                         from generate_series(0, 3) s join public.question_answers a
                           on a.question_id = q.id and a.position = (p_perm ->> s)::int))
    from public.questions q where q.id = p_qid
$$;

create function public.mode_correct_slot(p_qid text, p_perm jsonb) returns integer
language sql stable security definer set search_path = '' as $$
  select s from generate_series(0, 3) s join public.question_answers a
    on a.question_id = p_qid and a.position = (p_perm ->> s)::int and a.is_correct
$$;

create function public.mode_random_perm() returns jsonb
language sql volatile set search_path = '' as $$
  select to_jsonb((select array_agg(p order by random()) from generate_series(0, 3) p))
$$;

create function public.mode_profile(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('username', username, 'avatar_id', avatar_id, 'level', level)
    from public.profiles where id = p_user
$$;

revoke all on function public.mode_question_json(text, jsonb), public.mode_correct_slot(text, jsonb),
  public.mode_random_perm(), public.mode_profile(uuid) from public, anon, authenticated;

-- ---------------------------------------------------------------------------
-- Against the clock
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values
  ('blitz', '{"seconds": 60, "coins_per_correct": 3, "max_coins": 60, "xp_per_correct": 5}'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

create table public.blitz_runs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users (id) on delete cascade,
  started_at  timestamptz not null default now(),
  ends_at     timestamptz not null,
  correct     integer not null default 0,
  answered    integer not null default 0,
  current_qid text,
  perm        jsonb,
  seen        text[] not null default '{}',
  status      text not null default 'active',
  coins       integer,
  constraint blitz_status check (status in ('active', 'done'))
);
create index blitz_runs_user on public.blitz_runs (user_id, status, correct desc);
alter table public.blitz_runs enable row level security;
revoke all on public.blitz_runs from anon, authenticated;

create function public.blitz_best(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select coalesce(max(correct), 0) from public.blitz_runs where user_id = p_user and status = 'done'
$$;

/** Puts the next question on the run (caller holds the lock). */
create function public.blitz_pick(p_run uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_run public.blitz_runs;
  v_win real[];
  v_qid text;
begin
  select * into v_run from public.blitz_runs where id = p_run;
  -- difficulty climbs with every answer, worlds rotate
  v_win := public.session_window(0, 1, least(1 + v_run.answered / 2, 12));
  v_qid := public.pick_world_question(v_run.user_id, public.world_rotation(v_run.answered, p_run::text), v_win[1], v_win[2], v_run.seen);
  if v_qid is null then
    v_qid := public.pick_world_question(v_run.user_id, 'geography', 0, 1, v_run.seen);
  end if;
  if v_qid is null then raise exception 'invalid_state: no questions available' using errcode = 'P0001'; end if;
  update public.blitz_runs set current_qid = v_qid, perm = public.mode_random_perm(), seen = seen || v_qid
   where id = p_run;
  insert into public.seen_questions (user_id, question_id) values (v_run.user_id, v_qid)
    on conflict (user_id, question_id) do update set seen_at = now();
end $$;

/** Ends the run once and pays out (caller holds the lock). */
create function public.blitz_close(p_run uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_run   public.blitz_runs;
  v_cfg   jsonb := (select value from public.app_config where key = 'blitz');
  v_coins integer;
begin
  select * into v_run from public.blitz_runs where id = p_run;
  if v_run.status <> 'active' then return; end if;
  v_coins := least(v_run.correct * coalesce((v_cfg ->> 'coins_per_correct')::int, 3), coalesce((v_cfg ->> 'max_coins')::int, 60));
  update public.blitz_runs set status = 'done', coins = v_coins, current_qid = null where id = p_run;
  if v_coins > 0 then
    perform public.ledger_apply(v_run.user_id, 'coins', v_coins, 'blitz', 'blitz', p_run::text, 'blitz:' || p_run::text);
  end if;
  if v_run.correct > 0 then
    update public.profiles
       set xp = xp + v_run.correct * coalesce((v_cfg ->> 'xp_per_correct')::int, 5),
           level = public.level_from_xp(xp + v_run.correct * coalesce((v_cfg ->> 'xp_per_correct')::int, 5))
     where id = v_run.user_id;
  end if;
end $$;

create function public.blitz_payload(p_run uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_run public.blitz_runs;
begin
  select * into v_run from public.blitz_runs where id = p_run;
  return jsonb_build_object(
    'run_id', v_run.id, 'status', v_run.status,
    'seconds_left', round(greatest(0, extract(epoch from v_run.ends_at - now()))::numeric, 2),
    'total_seconds', round(extract(epoch from v_run.ends_at - v_run.started_at)::numeric),
    'correct', v_run.correct, 'answered', v_run.answered,
    'best', public.blitz_best(v_run.user_id),
    'coins', v_run.coins,
    'question', case when v_run.status = 'active' and v_run.current_qid is not null
                     then public.mode_question_json(v_run.current_qid, v_run.perm) end);
end $$;

create function public.blitz_start() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_sec integer := coalesce(((select value from public.app_config where key = 'blitz') ->> 'seconds')::int, 60);
  v_id  uuid;
  r     record;
begin
  perform public.check_rate_limit(v_uid, 'blitz_start', 40, 3600);
  for r in select id from public.blitz_runs where user_id = v_uid and status = 'active' for update loop
    perform public.blitz_close(r.id);
  end loop;
  perform public.energy_spend(v_uid);
  -- the clock starts after a short "3-2-1" on the device
  insert into public.blitz_runs (user_id, started_at, ends_at)
  values (v_uid, now() + interval '3 seconds', now() + interval '3 seconds' + make_interval(secs => v_sec))
  returning id into v_id;
  perform public.blitz_pick(v_id);
  return public.blitz_payload(v_id) || jsonb_build_object('countdown', 3);
end $$;

create function public.blitz_answer(p_run uuid, p_slot integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_run  public.blitz_runs;
  v_cs   integer;
  v_ok   boolean := false;
begin
  perform public.check_rate_limit(v_uid, 'blitz_answer', 240, 60);
  if p_slot is null or p_slot not between 0 and 3 then raise exception 'invalid_input: slot' using errcode = '22023'; end if;
  select * into v_run from public.blitz_runs where id = p_run and user_id = v_uid for update;
  if not found then raise exception 'invalid_input: run' using errcode = '22023'; end if;
  if v_run.status <> 'active' then return public.blitz_payload(p_run) || jsonb_build_object('was_correct', null); end if;
  if now() < v_run.started_at - interval '0.5 seconds' then
    raise exception 'invalid_state: not started' using errcode = 'P0001';
  end if;
  -- 1.5 s grace for the network; after that the answer doesn't count
  if now() > v_run.ends_at + interval '1.5 seconds' then
    perform public.blitz_close(p_run);
    return public.blitz_payload(p_run) || jsonb_build_object('was_correct', null);
  end if;
  v_cs := public.mode_correct_slot(v_run.current_qid, v_run.perm);
  v_ok := v_cs = p_slot;
  update public.blitz_runs set answered = answered + 1, correct = correct + (case when v_ok then 1 else 0 end) where id = p_run;
  if now() >= v_run.ends_at then
    perform public.blitz_close(p_run);
  else
    perform public.blitz_pick(p_run);
  end if;
  return public.blitz_payload(p_run) || jsonb_build_object('was_correct', v_ok, 'correct_slot', v_cs);
end $$;

create function public.blitz_finish(p_run uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_run  public.blitz_runs;
  v_prev integer;
begin
  perform public.check_rate_limit(v_uid, 'blitz_finish', 60, 60);
  select * into v_run from public.blitz_runs where id = p_run and user_id = v_uid for update;
  if not found then raise exception 'invalid_input: run' using errcode = '22023'; end if;
  select coalesce(max(correct), 0) into v_prev from public.blitz_runs where user_id = v_uid and status = 'done' and id <> p_run;
  if v_run.status = 'active' then
    if now() < v_run.ends_at - interval '1 second' then
      raise exception 'invalid_state: still running' using errcode = 'P0001';
    end if;
    perform public.blitz_close(p_run);
  end if;
  select * into v_run from public.blitz_runs where id = p_run;
  return public.blitz_payload(p_run) || jsonb_build_object('new_best', v_run.correct > v_prev and v_run.correct > 0, 'previous_best', v_prev);
end $$;

create function public.blitz_info() returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object('best', public.blitz_best(public.require_user()),
    'seconds', coalesce(((select value from public.app_config where key = 'blitz') ->> 'seconds')::int, 60))
$$;

revoke all on function public.blitz_best(uuid), public.blitz_pick(uuid), public.blitz_close(uuid), public.blitz_payload(uuid),
  public.blitz_start(), public.blitz_answer(uuid, integer), public.blitz_finish(uuid), public.blitz_info()
from public, anon, authenticated;
grant execute on function public.blitz_start(), public.blitz_answer(uuid, integer), public.blitz_finish(uuid), public.blitz_info()
to authenticated;

-- ---------------------------------------------------------------------------
-- Random opponent (matchmaking + the sloth bot)
-- ---------------------------------------------------------------------------
alter table public.match_rooms add column kind text not null default 'friend';
alter table public.match_rooms add column bot jsonb;
alter table public.match_rooms add column host_seen timestamptz;
alter table public.match_rooms add constraint match_kind check (kind in ('friend', 'random'));
create index match_rooms_random_wait on public.match_rooms (created_at) where kind = 'random' and status = 'waiting';

/** Picks the questions and starts the match (caller holds the room lock). */
create function public.match_fill(p_room uuid, p_guest uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_room  public.match_rooms;
  v_n     integer := public.match_cfg('questions', 7);
  v_ids   text[] := '{}';
  v_perms jsonb := '[]'::jsonb;
  v_id    text;
  i       integer;
begin
  select * into v_room from public.match_rooms where id = p_room;
  for i in 1 .. v_n loop
    select q.id into v_id from public.questions q
     where q.status = 'active' and q.world = public.world_rotation(i, v_room.code)
       and q.ease_rank between 0.02 + i * 0.04 and 0.30 + i * 0.05
       and not (q.id = any (v_ids))
     order by random() limit 1;
    if v_id is null then
      select q.id into v_id from public.questions q where q.status = 'active' and not (q.id = any (v_ids)) order by random() limit 1;
    end if;
    v_ids := v_ids || v_id;
    v_perms := v_perms || jsonb_build_array(public.mode_random_perm());
  end loop;
  update public.match_rooms
     set guest = p_guest, status = 'playing', question_ids = v_ids, perms = v_perms,
         started_at = now() + make_interval(secs => public.match_cfg('countdown_seconds', 5))
   where id = p_room;
end $$;
revoke all on function public.match_fill(uuid, uuid) from public, anon, authenticated;

create or replace function public.match_join(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_room  public.match_rooms;
begin
  perform public.check_rate_limit(v_uid, 'match_join', 30, 3600);
  select * into v_room from public.match_rooms
   where code = btrim(p_code) and kind = 'friend' and status in ('waiting', 'playing') for update;
  if not found then raise exception 'invalid_input: room' using errcode = '22023'; end if;
  if v_room.host = v_uid or v_room.guest = v_uid then
    return jsonb_build_object('room_id', v_room.id, 'code', v_room.code);
  end if;
  if v_room.status <> 'waiting' or v_room.created_at < now() - interval '30 minutes' then
    raise exception 'invalid_state: room closed' using errcode = 'P0001';
  end if;
  perform public.match_fill(v_room.id, v_uid);
  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code);
end $$;

/** Find someone who is searching right now, or start searching. */
create function public.match_find() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_room public.match_rooms;
  v_code text;
  v_id   uuid;
begin
  perform public.check_rate_limit(v_uid, 'match_find', 60, 3600);
  -- stop my own old searches
  update public.match_rooms set status = 'expired'
   where host = v_uid and kind = 'random' and status = 'waiting';
  -- someone else searching (and still on the screen)
  select * into v_room from public.match_rooms
   where kind = 'random' and status = 'waiting' and host <> v_uid
     and created_at > now() - interval '2 minutes' and host_seen > now() - interval '5 seconds'
   order by created_at limit 1
   for update skip locked;
  if found then
    perform public.match_fill(v_room.id, v_uid);
    return jsonb_build_object('room_id', v_room.id, 'code', v_room.code, 'matched', true);
  end if;
  for i in 1 .. 20 loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    begin
      insert into public.match_rooms (code, host, kind, host_seen) values (v_code, v_uid, 'random', now()) returning id into v_id;
      exit;
    exception when unique_violation then
      v_id := null;
    end;
  end loop;
  if v_id is null then raise exception 'invalid_state: no free code' using errcode = 'P0001'; end if;
  return jsonb_build_object('room_id', v_id, 'code', v_code, 'matched', false);
end $$;

/** No one found: play the sloth. The bot's answers are decided now, from each question's difficulty. */
create function public.match_bot(p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_room  public.match_rooms;
  v_ans   integer := public.match_cfg('answer_seconds', 15);
  v_plan  jsonb := '[]'::jsonb;
  v_level integer;
  v_ease  real;
  v_cs    integer;
  v_ok    boolean;
  v_at    numeric;
  v_slot  integer;
  i       integer;
begin
  perform public.check_rate_limit(v_uid, 'match_bot', 30, 3600);
  select * into v_room from public.match_rooms where id = p_room and host = v_uid for update;
  if not found then raise exception 'invalid_input: room' using errcode = '22023'; end if;
  if v_room.kind <> 'random' or v_room.status <> 'waiting' then
    raise exception 'invalid_state: room closed' using errcode = 'P0001';
  end if;
  if v_room.created_at > now() - interval '6 seconds' then
    raise exception 'invalid_state: still searching' using errcode = 'P0001';
  end if;
  perform public.match_fill(p_room, null);
  select * into v_room from public.match_rooms where id = p_room;
  select level into v_level from public.profiles where id = v_uid;
  for i in 0 .. cardinality(v_room.question_ids) - 1 loop
    select coalesce(ease_rank, 0.4) into v_ease from public.questions where id = v_room.question_ids[i + 1];
    v_cs := public.mode_correct_slot(v_room.question_ids[i + 1], v_room.perms -> i);
    -- about 80% on easy questions down to ~45% on hard ones
    v_ok := random() < 0.82 - 0.4 * v_ease;
    v_slot := case when v_ok then v_cs else (v_cs + 1 + floor(random() * 3)::int) % 4 end;
    v_at := round((2.5 + random() * 8 + v_ease * 3)::numeric, 1);
    v_plan := v_plan || jsonb_build_array(jsonb_build_object('slot', v_slot, 'at', v_at,
      'pts', case when v_ok then 100 + greatest(0, floor((v_ans - v_at) * 10))::int else 0 end));
  end loop;
  update public.match_rooms
     set bot = jsonb_build_object('username', 'העצלן 🤖', 'avatar_id', 'bot_sloth',
                                  'level', greatest(1, coalesce(v_level, 1) + floor(random() * 3)::int - 1), 'answers', v_plan)
   where id = p_room;
  return jsonb_build_object('room_id', p_room, 'code', v_room.code, 'bot', true);
end $$;

create function public.match_cancel(p_room uuid) returns void
language sql volatile security definer set search_path = '' as $$
  update public.match_rooms set status = 'expired'
   where id = p_room and host = public.require_user() and status = 'waiting'
$$;

/** Pays out once when the last reveal has passed. Caller holds the room lock. */
create or replace function public.match_finish(p_room uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_room public.match_rooms;
  v_h    integer;
  v_g    integer;
  v_win  integer; -- 1 host, 2 guest/bot, 0 draw
begin
  select * into v_room from public.match_rooms where id = p_room;
  if v_room.status <> 'playing' then return; end if;
  select coalesce(sum(points), 0) into v_h from public.match_answers where room_id = p_room and user_id = v_room.host;
  if v_room.bot is not null then
    select coalesce(sum((a ->> 'pts')::int), 0) into v_g from jsonb_array_elements(v_room.bot -> 'answers') a;
  else
    select coalesce(sum(points), 0) into v_g from public.match_answers where room_id = p_room and user_id = v_room.guest;
  end if;
  v_win := case when v_h > v_g then 1 when v_g > v_h then 2 else 0 end;
  update public.match_rooms set status = 'done', finished_at = now() where id = p_room;
  perform public.ledger_apply(v_room.host, 'coins',
    case when v_win = 1 then public.match_cfg('win_coins', 100) else public.match_cfg('play_coins', 30) end,
    'friend_match', 'match', p_room::text, 'match:' || p_room::text);
  if v_room.guest is not null then
    perform public.ledger_apply(v_room.guest, 'coins',
      case when v_win = 2 then public.match_cfg('win_coins', 100) else public.match_cfg('play_coins', 30) end,
      'friend_match', 'match', p_room::text, 'match:' || p_room::text);
  end if;
end $$;

create or replace function public.match_state(p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid    uuid := public.require_user();
  v_room   public.match_rooms;
  v_n      integer := public.match_cfg('questions', 7);
  v_ans    integer := public.match_cfg('answer_seconds', 15);
  v_rev    integer := public.match_cfg('reveal_seconds', 4);
  v_el     numeric;
  v_qel    numeric;
  v_idx    integer;
  v_phase  text;
  v_left   numeric;
  v_opp    uuid;
  v_q      jsonb;
  v_qid    text;
  v_perm   jsonb;
  v_reveal jsonb;
  v_bot    jsonb;
  v_oppsc  integer;
  v_oppans boolean;
  v_oslot  integer;
begin
  perform public.check_rate_limit(v_uid, 'match_state', 240, 60);
  select * into v_room from public.match_rooms where id = p_room and (host = v_uid or guest = v_uid) for update;
  if not found then raise exception 'invalid_input: room' using errcode = '22023'; end if;
  v_opp := case when v_room.host = v_uid then v_room.guest else v_room.host end;
  v_bot := v_room.bot;

  if v_room.status = 'waiting' then
    v_phase := case when v_room.created_at < now() - interval '30 minutes' then 'expired' else 'waiting' end;
    if v_room.host = v_uid then update public.match_rooms set host_seen = now() where id = p_room; end if;
  elsif v_room.status = 'expired' then
    v_phase := 'expired';
  else
    v_el := extract(epoch from now() - v_room.started_at);
    if v_el < 0 then
      v_phase := 'countdown';
      v_idx := 0;
      v_left := -v_el;
    else
      v_idx := floor(v_el / (v_ans + v_rev))::int;
      if v_idx >= v_n then
        perform public.match_finish(p_room);
        v_phase := 'done';
        v_idx := v_n - 1;
      else
        v_qel := v_el - v_idx * (v_ans + v_rev);
        if v_qel < v_ans then
          v_phase := 'question';
          v_left := v_ans - v_qel;
        else
          v_phase := 'reveal';
          v_left := v_ans + v_rev - v_qel;
        end if;
      end if;
    end if;
  end if;

  if v_bot is not null then
    select coalesce(sum((a ->> 'pts')::int), 0) into v_oppsc
      from jsonb_array_elements(v_bot -> 'answers') with ordinality t(a, o)
     where o - 1 < coalesce(v_idx, 0) or (o - 1 = v_idx and v_phase in ('reveal', 'done'));
    v_oppans := v_phase = 'question' and v_qel >= ((v_bot -> 'answers' -> v_idx) ->> 'at')::numeric;
    v_oslot := ((v_bot -> 'answers' -> v_idx) ->> 'slot')::int;
  else
    -- the opponent's score only counts finished questions, so it can't leak the current answer
    select coalesce(sum(points), 0) into v_oppsc from public.match_answers where room_id = p_room and user_id = v_opp
       and (idx < coalesce(v_idx, 0) or v_phase in ('reveal', 'done'));
    v_oppans := exists (select 1 from public.match_answers where room_id = p_room and user_id = v_opp and idx = v_idx);
    select slot into v_oslot from public.match_answers where room_id = p_room and user_id = v_opp and idx = v_idx;
  end if;

  if v_phase in ('question', 'reveal') then
    v_qid := v_room.question_ids[v_idx + 1];
    v_perm := v_room.perms -> v_idx;
    v_q := public.mode_question_json(v_qid, v_perm);
    if v_phase = 'reveal' then
      v_reveal := jsonb_build_object('correct_slot', public.mode_correct_slot(v_qid, v_perm),
        'explanation', (select explanation_he from public.questions where id = v_qid),
        'opp_slot', v_oslot);
    end if;
  end if;

  return jsonb_build_object(
    'room_id', v_room.id, 'code', v_room.code, 'kind', v_room.kind, 'phase', v_phase, 'idx', v_idx, 'total', v_n,
    'seconds_left', round(coalesce(v_left, 0), 2), 'server_now', extract(epoch from now()) * 1000,
    'is_host', v_room.host = v_uid, 'is_bot', v_bot is not null,
    'me', public.mode_profile(v_uid),
    'opponent', case when v_bot is not null then v_bot - 'answers' else public.mode_profile(v_opp) end,
    'my_score', (select coalesce(sum(points), 0) from public.match_answers where room_id = p_room and user_id = v_uid),
    'opp_score', v_oppsc,
    'my_answer', (select slot from public.match_answers where room_id = p_room and user_id = v_uid and idx = v_idx),
    'opp_answered', coalesce(v_oppans, false),
    'question', v_q, 'reveal', v_reveal,
    'result', case when v_phase = 'done' then jsonb_build_object(
      'coins', (select amount from public.wallet_transactions where user_id = v_uid and idempotency_key = 'match:' || p_room::text))
      end);
end $$;

revoke all on function public.match_find(), public.match_bot(uuid), public.match_cancel(uuid) from public, anon, authenticated;
grant execute on function public.match_find(), public.match_bot(uuid), public.match_cancel(uuid) to authenticated;

-- ---------------------------------------------------------------------------
-- Family room
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values
  ('family', '{"max_players": 6, "min_questions": 15, "max_questions": 20, "answer_seconds": 20,
               "reveal_seconds": 4, "countdown_seconds": 4, "win_coins": 150, "play_coins": 40,
               "points_base": 100, "points_per_second": 5}'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

create table public.family_rooms (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  host         uuid not null references auth.users (id) on delete cascade,
  world        text not null default 'mix',
  total        smallint not null default 15,
  status       text not null default 'waiting',
  question_ids text[],
  perms        jsonb,
  idx          smallint not null default 0,
  phase        text not null default 'lobby',
  phase_at     timestamptz,
  created_at   timestamptz not null default now(),
  finished_at  timestamptz,
  constraint family_status check (status in ('waiting', 'playing', 'done', 'expired')),
  constraint family_phase check (phase in ('lobby', 'countdown', 'question', 'reveal', 'done')),
  constraint family_code check (code ~ '^[0-9]{6}$'),
  constraint family_total check (total between 5 and 30)
);
create unique index family_rooms_open_code on public.family_rooms (code) where status in ('waiting', 'playing');

create table public.family_players (
  room_id   uuid not null references public.family_rooms (id) on delete cascade,
  user_id   uuid not null references auth.users (id) on delete cascade,
  seat      smallint not null,
  joined_at timestamptz not null default now(),
  last_seen timestamptz not null default now(),
  left_at   timestamptz,
  primary key (room_id, user_id)
);

create table public.family_answers (
  room_id     uuid not null references public.family_rooms (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  idx         smallint not null,
  slot        smallint not null,
  is_correct  boolean not null,
  points      integer not null,
  answered_at timestamptz not null default now(),
  primary key (room_id, user_id, idx)
);

alter table public.family_rooms enable row level security;
alter table public.family_players enable row level security;
alter table public.family_answers enable row level security;
revoke all on public.family_rooms, public.family_players, public.family_answers from anon, authenticated;

create function public.family_cfg(p_key text, p_default integer) returns integer
language sql stable set search_path = '' as $$
  select coalesce(((select value from public.app_config where key = 'family') ->> p_key)::int, p_default)
$$;

create function public.family_check_world(p_world text) returns text
language plpgsql stable security definer set search_path = '' as $$
begin
  if p_world is null or p_world = 'mix' then return 'mix'; end if;
  if public.world_cfg(p_world) is null then raise exception 'invalid_input: world' using errcode = '22023'; end if;
  return p_world;
end $$;

create function public.family_clamp_total(p_total integer) returns integer
language sql stable set search_path = '' as $$
  select least(greatest(coalesce(p_total, 15), public.family_cfg('min_questions', 15)), public.family_cfg('max_questions', 20))
$$;

create function public.family_create(p_world text, p_total integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_w    text := public.family_check_world(p_world);
  v_code text;
  v_id   uuid;
begin
  perform public.check_rate_limit(v_uid, 'family_create', 20, 3600);
  update public.family_rooms set status = 'expired' where host = v_uid and status = 'waiting';
  for i in 1 .. 20 loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    begin
      insert into public.family_rooms (code, host, world, total)
      values (v_code, v_uid, v_w, public.family_clamp_total(p_total)) returning id into v_id;
      exit;
    exception when unique_violation then
      v_id := null;
    end;
  end loop;
  if v_id is null then raise exception 'invalid_state: no free code' using errcode = 'P0001'; end if;
  insert into public.family_players (room_id, user_id, seat) values (v_id, v_uid, 1);
  return jsonb_build_object('room_id', v_id, 'code', v_code);
end $$;

create function public.family_join(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_room public.family_rooms;
  v_n    integer;
begin
  perform public.check_rate_limit(v_uid, 'family_join', 40, 3600);
  select * into v_room from public.family_rooms where code = btrim(p_code) and status in ('waiting', 'playing') for update;
  if not found then raise exception 'invalid_input: room' using errcode = '22023'; end if;
  if exists (select 1 from public.family_players where room_id = v_room.id and user_id = v_uid) then
    update public.family_players set left_at = null, last_seen = now() where room_id = v_room.id and user_id = v_uid;
    return jsonb_build_object('room_id', v_room.id, 'code', v_room.code);
  end if;
  if v_room.status <> 'waiting' or v_room.created_at < now() - interval '60 minutes' then
    raise exception 'invalid_state: room closed' using errcode = 'P0001';
  end if;
  select count(*) into v_n from public.family_players where room_id = v_room.id and left_at is null;
  if v_n >= public.family_cfg('max_players', 6) then
    raise exception 'invalid_state: room full' using errcode = 'P0001';
  end if;
  insert into public.family_players (room_id, user_id, seat)
  values (v_room.id, v_uid, (select coalesce(max(seat), 0) + 1 from public.family_players where room_id = v_room.id));
  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code);
end $$;

create function public.family_configure(p_room uuid, p_world text, p_total integer) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  perform public.check_rate_limit(v_uid, 'family_configure', 120, 3600);
  update public.family_rooms set world = public.family_check_world(p_world), total = public.family_clamp_total(p_total)
   where id = p_room and host = v_uid and status = 'waiting';
  if not found then raise exception 'invalid_state: not host' using errcode = 'P0001'; end if;
end $$;

create function public.family_start(p_room uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_room  public.family_rooms;
  v_ids   text[] := '{}';
  v_perms jsonb := '[]'::jsonb;
  v_world text;
  v_win   real[];
  v_id    text;
  i       integer;
begin
  perform public.check_rate_limit(v_uid, 'family_start', 30, 3600);
  select * into v_room from public.family_rooms where id = p_room and host = v_uid for update;
  if not found or v_room.status <> 'waiting' then raise exception 'invalid_state: not host' using errcode = 'P0001'; end if;
  if (select count(*) from public.family_players where room_id = p_room and left_at is null) < 2 then
    raise exception 'invalid_state: need players' using errcode = 'P0001';
  end if;
  for i in 1 .. v_room.total loop
    v_world := case when v_room.world = 'mix' then public.world_rotation(i, p_room::text) else v_room.world end;
    -- from easy to medium-hard across the game
    v_win := public.session_window(0, 1, 1 + ((i - 1) * 9) / greatest(v_room.total - 1, 1));
    v_id := public.pick_world_question(null, v_world, v_win[1], v_win[2], v_ids);
    if v_id is null then
      select q.id into v_id from public.questions q where q.status = 'active' and not (q.id = any (v_ids)) order by random() limit 1;
    end if;
    if v_id is null then raise exception 'invalid_state: no questions available' using errcode = 'P0001'; end if;
    v_ids := v_ids || v_id;
    v_perms := v_perms || jsonb_build_array(public.mode_random_perm());
  end loop;
  update public.family_rooms
     set status = 'playing', question_ids = v_ids, perms = v_perms, idx = 0, phase = 'countdown', phase_at = now()
   where id = p_room;
end $$;

/** Pays out once. Caller holds the room lock. */
create function public.family_finish(p_room uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_room public.family_rooms;
  v_top  integer;
  v_n    integer;
  r      record;
begin
  select * into v_room from public.family_rooms where id = p_room;
  if v_room.status <> 'playing' then return; end if;
  update public.family_rooms set status = 'done', phase = 'done', phase_at = now(), finished_at = now() where id = p_room;
  -- only players who actually played get coins; the room needs at least two of them
  select count(distinct user_id) into v_n from public.family_answers where room_id = p_room;
  if v_n < 2 then return; end if;
  select max(s) into v_top from (select sum(points) s from public.family_answers where room_id = p_room group by user_id) x;
  for r in select user_id, sum(points) as s from public.family_answers where room_id = p_room group by user_id loop
    perform public.ledger_apply(r.user_id, 'coins',
      case when r.s = v_top and v_top > 0 then public.family_cfg('win_coins', 150) else public.family_cfg('play_coins', 40) end,
      'family_match', 'family', p_room::text, 'family:' || p_room::text);
  end loop;
end $$;

/** Moves the room along its timeline. Caller holds the room lock. */
create function public.family_tick(p_room uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_room   public.family_rooms;
  v_ans    integer := public.family_cfg('answer_seconds', 20);
  v_rev    integer := public.family_cfg('reveal_seconds', 4);
  v_cd     integer := public.family_cfg('countdown_seconds', 4);
  v_active integer;
  v_done   integer;
begin
  for step in 1 .. 80 loop
    select * into v_room from public.family_rooms where id = p_room;
    if v_room.status = 'waiting' and v_room.created_at < now() - interval '60 minutes' then
      update public.family_rooms set status = 'expired' where id = p_room;
      return;
    end if;
    if v_room.status <> 'playing' then return; end if;
    if v_room.phase = 'countdown' then
      exit when now() < v_room.phase_at + make_interval(secs => v_cd);
      update public.family_rooms set phase = 'question', phase_at = phase_at + make_interval(secs => v_cd) where id = p_room;
    elsif v_room.phase = 'question' then
      select count(*) into v_active from public.family_players
       where room_id = p_room and left_at is null and last_seen > now() - interval '12 seconds';
      select count(*) into v_done from public.family_answers a join public.family_players p
          on p.room_id = a.room_id and p.user_id = a.user_id
       where a.room_id = p_room and a.idx = v_room.idx and p.left_at is null and p.last_seen > now() - interval '12 seconds';
      if now() >= v_room.phase_at + make_interval(secs => v_ans) then
        update public.family_rooms set phase = 'reveal', phase_at = phase_at + make_interval(secs => v_ans) where id = p_room;
      elsif v_active > 0 and v_done >= v_active then
        update public.family_rooms set phase = 'reveal', phase_at = now() where id = p_room;
      else
        exit;
      end if;
    elsif v_room.phase = 'reveal' then
      exit when now() < v_room.phase_at + make_interval(secs => v_rev);
      if v_room.idx + 1 >= v_room.total then
        perform public.family_finish(p_room);
        return;
      end if;
      update public.family_rooms set idx = idx + 1, phase = 'question', phase_at = phase_at + make_interval(secs => v_rev)
       where id = p_room;
      -- a room nobody polled for a while restarts its clock instead of racing through the backlog
      update public.family_rooms set phase_at = now() where id = p_room and phase_at < now() - make_interval(secs => v_ans);
    else
      exit;
    end if;
  end loop;
end $$;

create function public.family_state(p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid    uuid := public.require_user();
  v_room   public.family_rooms;
  v_ans    integer := public.family_cfg('answer_seconds', 20);
  v_rev    integer := public.family_cfg('reveal_seconds', 4);
  v_cd     integer := public.family_cfg('countdown_seconds', 4);
  v_left   numeric := 0;
  v_q      jsonb;
  v_qid    text;
  v_perm   jsonb;
  v_reveal jsonb;
  v_show   boolean;
  v_players jsonb;
  v_result jsonb;
begin
  perform public.check_rate_limit(v_uid, 'family_state', 300, 60);
  select * into v_room from public.family_rooms where id = p_room for update;
  if not found or not exists (select 1 from public.family_players where room_id = p_room and user_id = v_uid) then
    raise exception 'invalid_input: room' using errcode = '22023';
  end if;
  update public.family_players set last_seen = now() where room_id = p_room and user_id = v_uid and left_at is null;
  perform public.family_tick(p_room);
  select * into v_room from public.family_rooms where id = p_room;

  v_left := case v_room.phase
    when 'countdown' then extract(epoch from v_room.phase_at + make_interval(secs => v_cd) - now())
    when 'question' then extract(epoch from v_room.phase_at + make_interval(secs => v_ans) - now())
    when 'reveal' then extract(epoch from v_room.phase_at + make_interval(secs => v_rev) - now())
    else 0 end;
  -- scores include the current question only once it is revealed
  v_show := v_room.phase in ('reveal', 'done');

  select coalesce(jsonb_agg(x order by (x ->> 'score')::int desc, (x ->> 'seat')::int), '[]'::jsonb) into v_players from (
    select jsonb_build_object(
      'seat', p.seat, 'username', pr.username, 'avatar_id', pr.avatar_id, 'level', pr.level,
      'me', p.user_id = v_uid, 'host', p.user_id = v_room.host,
      'online', p.left_at is null and p.last_seen > now() - interval '12 seconds',
      'left', p.left_at is not null,
      'score', (select coalesce(sum(a.points), 0) from public.family_answers a
                 where a.room_id = p_room and a.user_id = p.user_id and (a.idx < v_room.idx or v_show)),
      'correct', (select count(*) from public.family_answers a
                   where a.room_id = p_room and a.user_id = p.user_id and a.is_correct and (a.idx < v_room.idx or v_show)),
      'answered', exists (select 1 from public.family_answers a where a.room_id = p_room and a.user_id = p.user_id and a.idx = v_room.idx),
      'slot', case when v_room.phase = 'reveal' then
                (select a.slot from public.family_answers a where a.room_id = p_room and a.user_id = p.user_id and a.idx = v_room.idx) end,
      'points', case when v_room.phase = 'reveal' then
                (select a.points from public.family_answers a where a.room_id = p_room and a.user_id = p.user_id and a.idx = v_room.idx) end
    ) as x
    from public.family_players p join public.profiles pr on pr.id = p.user_id
   where p.room_id = p_room and (p.left_at is null or v_room.status <> 'waiting')
  ) t;

  if v_room.phase in ('question', 'reveal') then
    v_qid := v_room.question_ids[v_room.idx + 1];
    v_perm := v_room.perms -> v_room.idx::int;
    v_q := public.mode_question_json(v_qid, v_perm);
    if v_room.phase = 'reveal' then
      v_reveal := jsonb_build_object('correct_slot', public.mode_correct_slot(v_qid, v_perm),
        'explanation', (select explanation_he from public.questions where id = v_qid));
    end if;
  end if;

  if v_room.status = 'done' then
    v_result := jsonb_build_object(
      'coins', (select amount from public.wallet_transactions where user_id = v_uid and idempotency_key = 'family:' || p_room::text));
  end if;

  return jsonb_build_object(
    'room_id', v_room.id, 'code', v_room.code, 'status', v_room.status, 'phase', v_room.phase,
    'world', v_room.world,
    'world_name', case when v_room.world = 'mix' then null else public.world_cfg(v_room.world) ->> 'name' end,
    'idx', v_room.idx, 'total', v_room.total,
    'seconds_left', round(greatest(0, coalesce(v_left, 0))::numeric, 2),
    'answer_seconds', v_ans,
    'max_players', public.family_cfg('max_players', 6),
    'is_host', v_room.host = v_uid,
    'players', v_players,
    'question', v_q,
    'my_answer', (select slot from public.family_answers where room_id = p_room and user_id = v_uid and idx = v_room.idx),
    'reveal', v_reveal,
    'result', v_result);
end $$;

create function public.family_answer(p_room uuid, p_idx integer, p_slot integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_room public.family_rooms;
  v_ans  integer := public.family_cfg('answer_seconds', 20);
  v_el   numeric;
  v_ok   boolean;
  v_pts  integer;
  v_qid  text;
begin
  perform public.check_rate_limit(v_uid, 'family_answer', 60, 60);
  if p_slot is null or p_slot not between 0 and 3 then raise exception 'invalid_input: slot' using errcode = '22023'; end if;
  select * into v_room from public.family_rooms where id = p_room for update;
  if not found or not exists (select 1 from public.family_players where room_id = p_room and user_id = v_uid and left_at is null) then
    raise exception 'invalid_input: room' using errcode = '22023';
  end if;
  perform public.family_tick(p_room);
  select * into v_room from public.family_rooms where id = p_room;
  v_el := extract(epoch from now() - v_room.phase_at);
  if v_room.status <> 'playing' or v_room.phase <> 'question' or v_room.idx <> p_idx or v_el > v_ans + 1 then
    raise exception 'invalid_state: not open' using errcode = 'P0001';
  end if;
  v_qid := v_room.question_ids[p_idx + 1];
  v_ok := public.mode_correct_slot(v_qid, v_room.perms -> p_idx) = p_slot;
  v_pts := case when v_ok then public.family_cfg('points_base', 100)
                + greatest(0, floor((v_ans - v_el) * public.family_cfg('points_per_second', 5)))::int else 0 end;
  insert into public.family_answers (room_id, user_id, idx, slot, is_correct, points)
  values (p_room, v_uid, p_idx, p_slot, v_ok, v_pts)
  on conflict (room_id, user_id, idx) do nothing;
  if not found then raise exception 'invalid_state: already answered' using errcode = 'P0001'; end if;
  update public.family_players set last_seen = now() where room_id = p_room and user_id = v_uid;
  -- the last answer moves everyone on right away
  perform public.family_tick(p_room);
  return jsonb_build_object('ok', true);
end $$;

create function public.family_leave(p_room uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_room public.family_rooms;
begin
  select * into v_room from public.family_rooms where id = p_room for update;
  if not found then return; end if;
  update public.family_players set left_at = now() where room_id = p_room and user_id = v_uid and left_at is null;
  if v_room.host = v_uid and v_room.status = 'waiting' then
    update public.family_rooms set status = 'expired' where id = p_room;
  end if;
end $$;

revoke all on function public.family_cfg(text, integer), public.family_check_world(text), public.family_clamp_total(integer),
  public.family_create(text, integer), public.family_join(text), public.family_configure(uuid, text, integer),
  public.family_start(uuid), public.family_finish(uuid), public.family_tick(uuid), public.family_state(uuid),
  public.family_answer(uuid, integer, integer), public.family_leave(uuid)
from public, anon, authenticated;
grant execute on function public.family_create(text, integer), public.family_join(text), public.family_configure(uuid, text, integer),
  public.family_start(uuid), public.family_state(uuid), public.family_answer(uuid, integer, integer), public.family_leave(uuid)
to authenticated;
