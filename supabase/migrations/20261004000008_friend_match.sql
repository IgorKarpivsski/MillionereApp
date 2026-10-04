-- =============================================================================
-- Migration 0009 — Live match against a friend.
--
-- One player opens a room and shares a 6-digit code; the friend joins and both
-- get the same 7 questions on a shared server clock: 15 s to answer, 4 s to
-- see the result. Faster correct answers score more. Clients poll
-- match_state() (≈1/s); correct answers are only revealed after the window.
-- =============================================================================

create table public.match_rooms (
  id           uuid primary key default gen_random_uuid(),
  code         text not null,
  host         uuid not null references auth.users (id) on delete cascade,
  guest        uuid references auth.users (id) on delete cascade,
  status       text not null default 'waiting',
  question_ids text[],
  perms        jsonb,                      -- per question: slot → canonical position (same for both players)
  started_at   timestamptz,
  finished_at  timestamptz,
  created_at   timestamptz not null default now(),
  constraint match_status check (status in ('waiting', 'playing', 'done', 'expired')),
  constraint match_code check (code ~ '^[0-9]{6}$')
);
create unique index match_rooms_open_code on public.match_rooms (code) where status in ('waiting', 'playing');

create table public.match_answers (
  room_id     uuid not null references public.match_rooms (id) on delete cascade,
  user_id     uuid not null references auth.users (id) on delete cascade,
  idx         smallint not null,
  slot        smallint not null,
  is_correct  boolean not null,
  points      integer not null,
  answered_at timestamptz not null default now(),
  primary key (room_id, user_id, idx)
);

alter table public.match_rooms enable row level security;
alter table public.match_answers enable row level security;
revoke all on public.match_rooms, public.match_answers from anon, authenticated;

insert into public.app_config (key, value, is_public) values
  ('match.questions', '7'::jsonb, true),
  ('match.answer_seconds', '15'::jsonb, true),
  ('match.reveal_seconds', '4'::jsonb, true),
  ('match.countdown_seconds', '5'::jsonb, true),
  ('match.win_coins', '100'::jsonb, true),
  ('match.play_coins', '30'::jsonb, true)
on conflict (key) do nothing;

create function public.match_cfg(p_key text, p_default integer) returns integer
language sql stable set search_path = '' as $$
  select coalesce((select (value #>> '{}')::int from public.app_config where key = 'match.' || p_key), p_default)
$$;

create function public.match_create() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_code text;
  v_id   uuid;
begin
  perform public.check_rate_limit(v_uid, 'match_create', 20, 3600);
  update public.match_rooms set status = 'expired' where host = v_uid and status = 'waiting';
  for i in 1 .. 20 loop
    v_code := lpad((floor(random() * 1000000))::int::text, 6, '0');
    begin
      insert into public.match_rooms (code, host) values (v_code, v_uid) returning id into v_id;
      exit;
    exception when unique_violation then
      v_id := null;
    end;
  end loop;
  if v_id is null then raise exception 'invalid_state: no free code' using errcode = 'P0001'; end if;
  return jsonb_build_object('room_id', v_id, 'code', v_code);
end $$;

create function public.match_join(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_room  public.match_rooms;
  v_n     integer := public.match_cfg('questions', 7);
  v_ids   text[] := '{}';
  v_perms jsonb := '[]'::jsonb;
  v_id    text;
  i       integer;
begin
  perform public.check_rate_limit(v_uid, 'match_join', 30, 3600);
  select * into v_room from public.match_rooms where code = btrim(p_code) and status in ('waiting', 'playing') for update;
  if not found then raise exception 'invalid_input: room' using errcode = '22023'; end if;
  if v_room.host = v_uid or v_room.guest = v_uid then
    return jsonb_build_object('room_id', v_room.id, 'code', v_room.code);
  end if;
  if v_room.status <> 'waiting' or v_room.created_at < now() - interval '30 minutes' then
    raise exception 'invalid_state: room closed' using errcode = 'P0001';
  end if;
  -- 5 Israeli + 2 world questions from the easy-to-medium band.
  for i in 1 .. v_n loop
    select q.id into v_id from public.questions q
     where q.status = 'active' and q.is_israeli = (i not in (3, 6))
       and q.ease_rank between 0.02 + i * 0.04 and 0.30 + i * 0.05
       and not (q.id = any (v_ids))
     order by random() limit 1;
    if v_id is null then
      select q.id into v_id from public.questions q where q.status = 'active' and not (q.id = any (v_ids)) order by random() limit 1;
    end if;
    v_ids := v_ids || v_id;
    v_perms := v_perms || jsonb_build_array(to_jsonb((select array_agg(p order by random()) from generate_series(0, 3) p)));
  end loop;
  update public.match_rooms
     set guest = v_uid, status = 'playing', question_ids = v_ids, perms = v_perms,
         started_at = now() + make_interval(secs => public.match_cfg('countdown_seconds', 5))
   where id = v_room.id;
  return jsonb_build_object('room_id', v_room.id, 'code', v_room.code);
end $$;

/** Pays out once when the last reveal has passed. Caller holds the room lock. */
create function public.match_finish(p_room uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_room public.match_rooms;
  v_h    integer;
  v_g    integer;
  v_win  uuid;
begin
  select * into v_room from public.match_rooms where id = p_room;
  if v_room.status <> 'playing' then return; end if;
  select coalesce(sum(points), 0) into v_h from public.match_answers where room_id = p_room and user_id = v_room.host;
  select coalesce(sum(points), 0) into v_g from public.match_answers where room_id = p_room and user_id = v_room.guest;
  v_win := case when v_h > v_g then v_room.host when v_g > v_h then v_room.guest end;
  update public.match_rooms set status = 'done', finished_at = now() where id = p_room;
  perform public.ledger_apply(v_room.host, 'coins',
    case when v_win = v_room.host then public.match_cfg('win_coins', 100) else public.match_cfg('play_coins', 30) end,
    'friend_match', 'match', p_room::text, 'match:' || p_room::text);
  perform public.ledger_apply(v_room.guest, 'coins',
    case when v_win = v_room.guest then public.match_cfg('win_coins', 100) else public.match_cfg('play_coins', 30) end,
    'friend_match', 'match', p_room::text, 'match:' || p_room::text);
end $$;

create function public.match_state(p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid    uuid := public.require_user();
  v_room   public.match_rooms;
  v_n      integer := public.match_cfg('questions', 7);
  v_ans    integer := public.match_cfg('answer_seconds', 15);
  v_rev    integer := public.match_cfg('reveal_seconds', 4);
  v_el     numeric;
  v_idx    integer;
  v_phase  text;
  v_left   numeric;
  v_opp    uuid;
  v_q      jsonb;
  v_qid    text;
  v_perm   jsonb;
  v_reveal jsonb;
  v_cslot  integer;
begin
  perform public.check_rate_limit(v_uid, 'match_state', 240, 60);
  select * into v_room from public.match_rooms where id = p_room and (host = v_uid or guest = v_uid) for update;
  if not found then raise exception 'invalid_input: room' using errcode = '22023'; end if;
  v_opp := case when v_room.host = v_uid then v_room.guest else v_room.host end;

  if v_room.status = 'waiting' then
    v_phase := case when v_room.created_at < now() - interval '30 minutes' then 'expired' else 'waiting' end;
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
        v_left := v_el - v_idx * (v_ans + v_rev);
        if v_left < v_ans then
          v_phase := 'question';
          v_left := v_ans - v_left;
        else
          v_phase := 'reveal';
          v_left := v_ans + v_rev - v_left;
        end if;
      end if;
    end if;
  end if;

  if v_phase in ('question', 'reveal') then
    v_qid := v_room.question_ids[v_idx + 1];
    v_perm := v_room.perms -> v_idx;
    select jsonb_build_object('id', q.id, 'text', q.text_he,
             'category_name', (select name_he from public.question_categories where slug = q.category),
             'answers', (select jsonb_agg(jsonb_build_object('slot', s, 'text', a.text_he) order by s)
                           from generate_series(0, 3) s join public.question_answers a
                             on a.question_id = q.id and a.position = (v_perm ->> s)::int))
      into v_q from public.questions q where q.id = v_qid;
    if v_phase = 'reveal' then
      select s into v_cslot from generate_series(0, 3) s join public.question_answers a
        on a.question_id = v_qid and a.position = (v_perm ->> s)::int and a.is_correct;
      v_reveal := jsonb_build_object('correct_slot', v_cslot,
        'explanation', (select explanation_he from public.questions where id = v_qid),
        'opp_slot', (select slot from public.match_answers where room_id = p_room and user_id = v_opp and idx = v_idx));
    end if;
  end if;

  return jsonb_build_object(
    'room_id', v_room.id, 'code', v_room.code, 'phase', v_phase, 'idx', v_idx, 'total', v_n,
    'seconds_left', round(coalesce(v_left, 0), 2), 'server_now', extract(epoch from now()) * 1000,
    'is_host', v_room.host = v_uid,
    'me', (select jsonb_build_object('username', username, 'avatar_id', avatar_id, 'level', level) from public.profiles where id = v_uid),
    'opponent', (select jsonb_build_object('username', username, 'avatar_id', avatar_id, 'level', level) from public.profiles where id = v_opp),
    'my_score', (select coalesce(sum(points), 0) from public.match_answers where room_id = p_room and user_id = v_uid),
    -- the opponent's score only counts finished questions, so it can't leak the current answer
    'opp_score', (select coalesce(sum(points), 0) from public.match_answers where room_id = p_room and user_id = v_opp
                    and (idx < coalesce(v_idx, 0) or v_phase in ('reveal', 'done'))),
    'my_answer', (select slot from public.match_answers where room_id = p_room and user_id = v_uid and idx = v_idx),
    'opp_answered', exists (select 1 from public.match_answers where room_id = p_room and user_id = v_opp and idx = v_idx),
    'question', v_q, 'reveal', v_reveal,
    'result', case when v_phase = 'done' then jsonb_build_object(
      'coins', (select amount from public.wallet_transactions where user_id = v_uid and idempotency_key = 'match:' || p_room::text))
      end);
end $$;

create function public.match_answer(p_room uuid, p_idx integer, p_slot integer) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_room  public.match_rooms;
  v_ans   integer := public.match_cfg('answer_seconds', 15);
  v_rev   integer := public.match_cfg('reveal_seconds', 4);
  v_el    numeric;
  v_ok    boolean;
  v_pts   integer;
  v_qid   text;
begin
  perform public.check_rate_limit(v_uid, 'match_answer', 60, 60);
  if p_slot is null or p_slot not between 0 and 3 then raise exception 'invalid_input: slot' using errcode = '22023'; end if;
  select * into v_room from public.match_rooms where id = p_room and (host = v_uid or guest = v_uid);
  if not found or v_room.status <> 'playing' then raise exception 'invalid_input: room' using errcode = '22023'; end if;
  v_el := extract(epoch from now() - v_room.started_at) - p_idx * (v_ans + v_rev);
  if p_idx < 0 or p_idx >= coalesce(array_length(v_room.question_ids, 1), 0) or v_el < 0 or v_el > v_ans + 1 then
    raise exception 'invalid_state: not open' using errcode = 'P0001';
  end if;
  v_qid := v_room.question_ids[p_idx + 1];
  select a.is_correct into v_ok from public.question_answers a
   where a.question_id = v_qid and a.position = (v_room.perms -> p_idx ->> p_slot)::int;
  v_pts := case when v_ok then 100 + greatest(0, floor((v_ans - v_el) * 10))::int else 0 end;
  insert into public.match_answers (room_id, user_id, idx, slot, is_correct, points)
  values (p_room, v_uid, p_idx, p_slot, v_ok, v_pts)
  on conflict (room_id, user_id, idx) do nothing;
  if not found then raise exception 'invalid_state: already answered' using errcode = 'P0001'; end if;
  return jsonb_build_object('ok', true);
end $$;

revoke execute on function public.match_cfg(text, integer), public.match_create(), public.match_join(text),
  public.match_finish(uuid), public.match_state(uuid), public.match_answer(uuid, integer, integer)
from public, anon, authenticated;
grant execute on function public.match_create(), public.match_join(text), public.match_state(uuid),
  public.match_answer(uuid, integer, integer) to authenticated;
