-- Testers' round: photos everywhere, online friends, sticker gifts, multi-sticker trades,
-- quicker head-to-head, family invites + "play again", combo points, a perfect-run prize,
-- all-time and monthly tables (top 3 of the month get a prize) and "double my points" ads.

-- ---------------------------------------------------------------------------
-- 1. Profile photos are visible to everyone: player lists also return 'photo'
-- ---------------------------------------------------------------------------
do $$
declare r record; d text; n text;
begin
  for r in select p.oid from pg_proc p join pg_namespace s on s.oid = p.pronamespace
            where s.nspname = 'public' and p.prokind = 'f'
              and p.proname in ('admin_find_players', 'call_candidates', 'event_state', 'family_state', 'friend_profile',
                                'leaderboard_friends', 'leaderboard_week', 'league_state', 'mode_profile', 'room_reactions')
  loop
    d := pg_get_functiondef(r.oid);
    n := regexp_replace(d, '''avatar_id'', *(([a-z_0-9]+\.)?)avatar_id', '''avatar_id'', \1avatar_id, ''photo'', \1photo_url', 'g');
    if n = d then raise exception 'photo patch found nothing in %', r.oid::regprocedure; end if;
    execute n;
  end loop;
end $$;

-- ---------------------------------------------------------------------------
-- 2. Trades with several stickers on each side
-- ---------------------------------------------------------------------------
alter table public.trade_offers add column give_items text[];
alter table public.trade_offers add column want_items text[];
update public.trade_offers set give_items = array[give_item],
       want_items = case when want_item is null then '{}'::text[] else array[want_item] end;
alter table public.trade_offers alter column give_items set not null;
alter table public.trade_offers alter column want_items set not null;
alter table public.trade_offers alter column want_items set default '{}';

create function public.trade_offer_multi(p_to uuid, p_give text[], p_want text[]) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_cfg  jsonb := (select value from public.app_config where key = 'social');
  v_give text[] := coalesce(p_give, '{}');
  v_want text[] := coalesce(p_want, '{}');
  v_id   uuid;
begin
  perform public.check_rate_limit(v_uid, 'trade_offer', 20, 3600);
  if not public.are_friends(v_uid, p_to) or public.is_blocked(v_uid, p_to) then
    raise exception 'invalid_state: not friends' using errcode = 'P0001';
  end if;
  if cardinality(v_give) not between 1 and 5 or cardinality(v_want) > 5
     or (select count(distinct x) from unnest(v_give) x) <> cardinality(v_give)
     or (select count(distinct x) from unnest(v_want) x) <> cardinality(v_want)
     or v_give && v_want then
    raise exception 'invalid_input: items' using errcode = '22023';
  end if;
  if (select count(*) from public.trade_offers where from_user = v_uid and status = 'pending') >= (v_cfg ->> 'trade_pending')::int then
    raise exception 'invalid_state: too many pending' using errcode = 'P0001';
  end if;
  if (select count(*) from public.trade_offers where from_user = v_uid and created_at > now() - interval '1 day') >= (v_cfg ->> 'trade_daily')::int then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  if exists (select 1 from unnest(v_give || v_want) x left join public.collectibles c on c.id = x
              where c.id is null or c.rarity = 'iconic' or not c.active) then
    raise exception 'invalid_input: iconic not tradeable' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_give) x
              where coalesce((select count from public.user_collectibles where user_id = v_uid and item_id = x), 0) < 2) then
    raise exception 'invalid_state: not a duplicate' using errcode = 'P0001';
  end if;
  insert into public.trade_offers (from_user, to_user, give_item, want_item, give_items, want_items)
  values (v_uid, p_to, v_give[1], v_want[1], v_give, v_want) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create or replace function public.trade_offer(p_to uuid, p_give text, p_want text default null) returns jsonb
language sql volatile security definer set search_path = '' as $$
  select public.trade_offer_multi(p_to, array[p_give], case when p_want is null then '{}'::text[] else array[p_want] end)
$$;

create or replace function public.trade_respond(p_offer uuid, p_accept boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_t   public.trade_offers;
  x     text;
begin
  perform public.check_rate_limit(v_uid, 'trade_respond', 30, 60);
  select * into v_t from public.trade_offers where id = p_offer for update;
  if not found or v_uid not in (v_t.to_user, v_t.from_user) then raise exception 'invalid_input: offer' using errcode = '22023'; end if;
  if v_t.status <> 'pending' then raise exception 'invalid_state: offer closed' using errcode = 'P0001'; end if;
  if v_uid = v_t.from_user then
    update public.trade_offers set status = 'cancelled', decided_at = now() where id = p_offer;
    return jsonb_build_object('status', 'cancelled');
  end if;
  if not p_accept then
    update public.trade_offers set status = 'declined', decided_at = now() where id = p_offer;
    return jsonb_build_object('status', 'declined');
  end if;
  if not public.are_friends(v_t.from_user, v_t.to_user) then raise exception 'invalid_state: not friends' using errcode = 'P0001'; end if;

  -- lock both players' sticker rows in a fixed order, then re-check ownership
  perform 1 from public.user_collectibles
   where (user_id = v_t.from_user and item_id = any (v_t.give_items)) or (user_id = v_t.to_user and item_id = any (v_t.want_items))
   order by user_id, item_id for update;
  if exists (select 1 from unnest(v_t.give_items) g
              where coalesce((select count from public.user_collectibles where user_id = v_t.from_user and item_id = g), 0) < 2)
     or exists (select 1 from unnest(v_t.want_items) w
              where coalesce((select count from public.user_collectibles where user_id = v_t.to_user and item_id = w), 0) < 2) then
    update public.trade_offers set status = 'failed', decided_at = now() where id = p_offer;
    raise exception 'invalid_state: no longer available' using errcode = 'P0001';
  end if;

  foreach x in array v_t.give_items loop
    update public.user_collectibles set count = count - 1 where user_id = v_t.from_user and item_id = x;
    insert into public.user_collectibles as u (user_id, item_id, count) values (v_t.to_user, x, 1)
    on conflict (user_id, item_id) do update set count = u.count + 1;
  end loop;
  foreach x in array v_t.want_items loop
    update public.user_collectibles set count = count - 1 where user_id = v_t.to_user and item_id = x;
    insert into public.user_collectibles as u (user_id, item_id, count) values (v_t.from_user, x, 1)
    on conflict (user_id, item_id) do update set count = u.count + 1;
  end loop;
  update public.trade_offers set status = 'accepted', decided_at = now() where id = p_offer;
  return jsonb_build_object('status', 'accepted');
end $$;

revoke all on function public.trade_offer_multi(uuid, text[], text[]) from public, anon, authenticated;
grant execute on function public.trade_offer_multi(uuid, text[], text[]) to authenticated;

-- ---------------------------------------------------------------------------
-- 3. Gifts: send a duplicate to a friend for free (3 a day, up to rare)
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values
  ('gifts', '{"per_day": 3, "rarities": ["common", "uncommon", "rare"]}'::jsonb, true)
on conflict (key) do update set value = excluded.value;

create table public.sticker_gifts (
  id         bigint generated always as identity primary key,
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  item_id    text not null references public.collectibles (id),
  created_at timestamptz not null default now()
);
create index sticker_gifts_from on public.sticker_gifts (from_user, created_at);
alter table public.sticker_gifts enable row level security;
revoke all on public.sticker_gifts from anon, authenticated;

create function public.gifts_left(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select greatest(0, coalesce(((select value from public.app_config where key = 'gifts') ->> 'per_day')::int, 3)
    - (select count(*) from public.sticker_gifts where from_user = p_user
        and created_at >= (public.israel_today()::timestamp at time zone 'Asia/Jerusalem'))::int)
$$;

create function public.sticker_gift(p_to uuid, p_item text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_cfg  jsonb := (select value from public.app_config where key = 'gifts');
  v_c    public.collectibles;
begin
  perform public.check_rate_limit(v_uid, 'sticker_gift', 20, 3600);
  if not public.are_friends(v_uid, p_to) or public.is_blocked(v_uid, p_to) then
    raise exception 'invalid_state: not friends' using errcode = 'P0001';
  end if;
  select * into v_c from public.collectibles where id = p_item and active;
  if not found or not (v_c.rarity in (select jsonb_array_elements_text(v_cfg -> 'rarities'))) then
    raise exception 'invalid_input: rarity' using errcode = '22023';
  end if;
  if public.gifts_left(v_uid) < 1 then raise exception 'rate_limited' using errcode = 'P0429'; end if;
  perform 1 from public.user_collectibles where user_id = v_uid and item_id = p_item for update;
  if coalesce((select count from public.user_collectibles where user_id = v_uid and item_id = p_item), 0) < 2 then
    raise exception 'invalid_state: not a duplicate' using errcode = 'P0001';
  end if;
  update public.user_collectibles set count = count - 1 where user_id = v_uid and item_id = p_item;
  insert into public.user_collectibles as u (user_id, item_id, count) values (p_to, p_item, 1)
  on conflict (user_id, item_id) do update set count = u.count + 1;
  insert into public.sticker_gifts (from_user, to_user, item_id) values (v_uid, p_to, p_item);
  -- tell the friend in their chat
  insert into public.chat_messages (sender, recipient, body) values (v_uid, p_to, '🎁 שלחתי לך מדבקה: ' || v_c.name_he);
  return jsonb_build_object('ok', true, 'left', public.gifts_left(v_uid));
end $$;

revoke all on function public.gifts_left(uuid), public.sticker_gift(uuid, text) from public, anon, authenticated;
grant execute on function public.sticker_gift(uuid, text) to authenticated;

-- ---------------------------------------------------------------------------
-- 4. Friends list: online status, photos, multi-sticker trades, gifts left
-- ---------------------------------------------------------------------------
create or replace function public.friends_state() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  perform public.my_friend_code();
  return jsonb_build_object(
    'code', (select friend_code from public.profiles where id = v_uid),
    'gifts_left', public.gifts_left(v_uid),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id, 'username', p.username, 'avatar_id', p.avatar_id, 'photo', p.photo_url, 'level', p.level,
          'status', f.status, 'incoming', f.status = 'pending' and f.requested_by <> v_uid,
          'online', f.status = 'accepted' and coalesce(p.last_active > now() - interval '40 seconds', false),
          'last_active', case when f.status = 'accepted' then p.last_active end,
          'unread', (select count(*) from public.chat_messages m
                      where m.sender = p.id and m.recipient = v_uid and not m.hidden
                        and m.id > coalesce((select last_read from public.chat_reads r where r.user_id = v_uid and r.peer = p.id), 0)),
          'last_at', (select max(m.created_at) from public.chat_messages m
                       where least(m.sender, m.recipient) = f.user_a and greatest(m.sender, m.recipient) = f.user_b))
        order by f.status desc, coalesce(p.last_active > now() - interval '40 seconds', false) desc, p.username)
      from public.friendships f
      join public.profiles p on p.id = case when f.user_a = v_uid then f.user_b else f.user_a end
      where v_uid in (f.user_a, f.user_b)), '[]'::jsonb),
    'trades', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id, 'incoming', t.to_user = v_uid,
          'peer', case when t.to_user = v_uid then t.from_user else t.to_user end,
          'peer_name', (select username from public.profiles where id = case when t.to_user = v_uid then t.from_user else t.to_user end),
          'give', t.give_item, 'want', t.want_item, 'give_items', t.give_items, 'want_items', t.want_items,
          'created_at', t.created_at) order by t.created_at desc)
      from public.trade_offers t where t.status = 'pending' and v_uid in (t.from_user, t.to_user)), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('id', b.blocked, 'username', p.username))
                          from public.blocks b join public.profiles p on p.id = b.blocked where b.blocker = v_uid), '[]'::jsonb));
end $$;

-- friend_dupes: rarity too, so the app knows what can be gifted
create or replace function public.friend_dupes(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  if not public.are_friends(v_uid, p_user) then raise exception 'invalid_state: not friends' using errcode = 'P0001'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'count', u.count, 'rarity', c.rarity,
             'mine', coalesce((select x.count from public.user_collectibles x where x.user_id = v_uid and x.item_id = c.id), 0)) order by c.album, c.number)
      from public.user_collectibles u join public.collectibles c on c.id = u.item_id
     where u.user_id = p_user and u.count >= 2 and c.rarity <> 'iconic' and c.active), '[]'::jsonb);
end $$;

-- ---------------------------------------------------------------------------
-- 5. Head to head: once both players answered, reveal right away
-- ---------------------------------------------------------------------------
do $$
declare d text;
begin
  d := pg_get_functiondef('public.match_state(uuid)'::regprocedure);
  d := replace(d, $x$  if v_bot is not null then
    select coalesce(sum((a ->> 'pts')::int), 0) into v_oppsc$x$,
$x$  -- both answered: skip the rest of the clock and reveal now (moves the room's clock for both players)
  if v_phase = 'question'
     and exists (select 1 from public.match_answers where room_id = p_room and user_id = v_uid and idx = v_idx)
     and ((v_bot is not null and v_qel >= ((v_bot -> 'answers' -> v_idx) ->> 'at')::numeric)
          or (v_bot is null and exists (select 1 from public.match_answers where room_id = p_room and user_id = v_opp and idx = v_idx))) then
    update public.match_rooms set started_at = started_at - make_interval(secs => (v_ans - v_qel)::double precision) where id = p_room;
    v_qel := v_ans;
    v_phase := 'reveal';
    v_left := v_rev;
  end if;

  if v_bot is not null then
    select coalesce(sum((a ->> 'pts')::int), 0) into v_oppsc$x$);
  if position('both answered' in d) = 0 then raise exception 'match_state patch failed'; end if;
  execute d;
end $$;

-- the sloth bot answers sooner once the player has answered, so a bot game also moves on quickly
do $$
declare d text;
begin
  d := pg_get_functiondef('public.match_state(uuid)'::regprocedure);
  d := replace(d, $x$and ((v_bot is not null and v_qel >= ((v_bot -> 'answers' -> v_idx) ->> 'at')::numeric)$x$,
                  $x$and ((v_bot is not null and v_qel >= least(((v_bot -> 'answers' -> v_idx) ->> 'at')::numeric,
                         extract(epoch from (select answered_at from public.match_answers where room_id = p_room and user_id = v_uid and idx = v_idx)
                                 - v_room.started_at) - v_idx * (v_ans + v_rev) + 1.5))$x$);
  if position('+ 1.5' in d) = 0 then raise exception 'match_state bot patch failed'; end if;
  execute d;
end $$;

-- ---------------------------------------------------------------------------
-- 6. Family room: invite online friends, "play again" with the same people
-- ---------------------------------------------------------------------------
alter table public.family_rooms add column next_code text;

create table public.family_invites (
  id         bigint generated always as identity primary key,
  room_id    uuid not null references public.family_rooms (id) on delete cascade,
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined')),
  created_at timestamptz not null default now()
);
create index family_invites_to on public.family_invites (to_user, status, created_at);
alter table public.family_invites enable row level security;
revoke all on public.family_invites from anon, authenticated;

create function public.family_invite(p_room uuid, p_friend uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  perform public.check_rate_limit(v_uid, 'family_invite', 40, 3600);
  if not exists (select 1 from public.family_players where room_id = p_room and user_id = v_uid and left_at is null)
     or not exists (select 1 from public.family_rooms where id = p_room and status = 'waiting') then
    raise exception 'invalid_state: room' using errcode = 'P0001';
  end if;
  if not public.are_friends(v_uid, p_friend) or public.is_blocked(v_uid, p_friend) then
    raise exception 'invalid_state: not friends' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.family_players where room_id = p_room and user_id = p_friend and left_at is null) then
    return jsonb_build_object('ok', true, 'already', true);
  end if;
  update public.family_invites set status = 'declined' where room_id = p_room and to_user = p_friend and status = 'pending';
  insert into public.family_invites (room_id, from_user, to_user) values (p_room, v_uid, p_friend);
  return jsonb_build_object('ok', true);
end $$;

create function public.family_invite_answer(p_invite bigint, p_accept boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_inv public.family_invites;
begin
  select * into v_inv from public.family_invites where id = p_invite and to_user = v_uid and status = 'pending' for update;
  if not found then raise exception 'invalid_state: invite' using errcode = 'P0001'; end if;
  update public.family_invites set status = case when p_accept then 'accepted' else 'declined' end where id = p_invite;
  if not p_accept then return jsonb_build_object('ok', true); end if;
  return public.family_join((select code from public.family_rooms where id = v_inv.room_id));
end $$;

-- host: a new room with the same topic and length; everyone in the old room sees "join the rematch"
create function public.family_again(p_room uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_old  public.family_rooms;
  v_new  jsonb;
  r      record;
begin
  select * into v_old from public.family_rooms where id = p_room for update;
  if not found or v_old.host <> v_uid or v_old.status <> 'done' then
    raise exception 'invalid_state: room' using errcode = 'P0001';
  end if;
  if v_old.next_code is not null and exists (select 1 from public.family_rooms where code = v_old.next_code and status = 'waiting') then
    return jsonb_build_object('room_id', (select id from public.family_rooms where code = v_old.next_code and status = 'waiting' limit 1),
                              'code', v_old.next_code);
  end if;
  v_new := public.family_create(v_old.world, v_old.total);
  update public.family_rooms set next_code = v_new ->> 'code' where id = p_room;
  -- also pop an invite on the other players' phones
  for r in select user_id from public.family_players where room_id = p_room and user_id <> v_uid and left_at is null loop
    insert into public.family_invites (room_id, from_user, to_user) values ((v_new ->> 'room_id')::uuid, v_uid, r.user_id);
  end loop;
  return v_new;
end $$;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.family_state(uuid)'::regprocedure);
  d := replace(d, $x$'reveal', v_reveal,
    'result', v_result);$x$, $x$'reveal', v_reveal,
    'next_code', case when v_room.next_code is not null
                       and exists (select 1 from public.family_rooms n where n.code = v_room.next_code and n.status = 'waiting')
                      then v_room.next_code end,
    'result', v_result);$x$);
  if position('next_code' in d) = 0 then raise exception 'family_state patch failed'; end if;
  execute d;
end $$;

revoke all on function public.family_invite(uuid, uuid), public.family_invite_answer(bigint, boolean), public.family_again(uuid)
  from public, anon, authenticated;
grant execute on function public.family_invite(uuid, uuid), public.family_invite_answer(bigint, boolean), public.family_again(uuid)
  to authenticated;

create or replace function public.presence_ping() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  update public.profiles set last_active = now() where id = v_uid and (last_active is null or last_active < now() - interval '5 seconds');
  return jsonb_build_object(
    'calls', coalesce((
      select jsonb_agg(jsonb_build_object('id', c.id, 'from', p.username, 'avatar_id', p.avatar_id, 'photo', p.photo_url,
                                          'question', c.question,
                                          'seconds_left', greatest(0, ceil(extract(epoch from (c.expires_at - now()))))::int)
                       order by c.created_at)
        from public.friend_calls c join public.profiles p on p.id = c.caller
       where c.friend = v_uid and c.answer_slot is null and c.expires_at > now()), '[]'::jsonb),
    'invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'from', p.username, 'avatar_id', p.avatar_id, 'photo', p.photo_url) order by i.created_at)
        from public.match_invites i join public.profiles p on p.id = i.from_user
        join public.match_rooms r on r.id = i.room_id
       where i.to_user = v_uid and i.status = 'pending' and i.created_at > now() - interval '90 seconds'
         and r.status = 'waiting'), '[]'::jsonb),
    'family_invites', coalesce((
      select jsonb_agg(jsonb_build_object('id', i.id, 'from', p.username, 'avatar_id', p.avatar_id, 'photo', p.photo_url,
                                          'world', r.world) order by i.created_at)
        from public.family_invites i join public.profiles p on p.id = i.from_user
        join public.family_rooms r on r.id = i.room_id
       where i.to_user = v_uid and i.status = 'pending' and i.created_at > now() - interval '3 minutes'
         and r.status = 'waiting'), '[]'::jsonb));
end $$;

-- ---------------------------------------------------------------------------
-- 7. Sessions: combo points for answers in a row, a prize for a perfect run
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values
  ('session.rewards', '{"combo_from": 3, "combo_step": 10, "combo_max": 50, "perfect_coins": 100, "perfect_gems": 5}'::jsonb, true)
on conflict (key) do update set value = excluded.value;

do $$
declare d text;
begin
  d := pg_get_functiondef('public.session_answer(uuid,integer,integer)'::regprocedure);
  d := replace(d, $x$  v_grace   constant interval := interval '3 seconds';$x$,
$x$  v_grace   constant interval := interval '3 seconds';
  v_rw      jsonb := (select value from public.app_config where key = 'session.rewards');
  v_combo   integer := 0;
  v_cbonus  integer := 0;$x$);
  d := replace(d, $x$           + v_speed;
  elsif v_run.shield_armed then$x$,
$x$           + v_speed;
    -- combo: correct answers in a row (this one included); from the 3rd on, +10 each, up to +50
    v_combo := 1 + (select count(*) from public.quiz_run_questions q
                     where q.run_id = p_run and q.rung < p_rung
                       and q.rung > coalesce((select max(w.rung) from public.quiz_run_questions w
                                               where w.run_id = p_run and w.rung < p_rung and w.is_correct is not true), 0));
    v_cbonus := least(greatest(v_combo - coalesce((v_rw ->> 'combo_from')::int, 3) + 1, 0) * coalesce((v_rw ->> 'combo_step')::int, 10),
                      coalesce((v_rw ->> 'combo_max')::int, 50));
    v_pts := v_pts + v_cbonus;
  elsif v_run.shield_armed then$x$);
  d := replace(d, $x$    v_summary := public.session_finish(p_run);
  end if;$x$,
$x$    v_summary := public.session_finish(p_run);
    -- every question right: a champion's prize
    if (select count(*) from public.quiz_run_questions where run_id = p_run and is_correct) >= (v_cfg ->> 'questions')::int then
      perform public.ledger_apply(v_uid, 'coins', coalesce((v_rw ->> 'perfect_coins')::int, 100), 'perfect_run', 'quiz_run', p_run::text, 'perfect:c:' || p_run);
      perform public.ledger_apply(v_uid, 'gems', coalesce((v_rw ->> 'perfect_gems')::int, 5), 'perfect_run', 'quiz_run', p_run::text, 'perfect:g:' || p_run);
      v_summary := v_summary || jsonb_build_object('perfect', jsonb_build_object(
        'coins', coalesce((v_rw ->> 'perfect_coins')::int, 100), 'gems', coalesce((v_rw ->> 'perfect_gems')::int, 5)));
    end if;
  end if;$x$);
  d := replace(d, $x$'speed_bonus', v_speed,$x$, $x$'speed_bonus', v_speed, 'combo', v_combo, 'combo_bonus', v_cbonus,$x$);
  if position('combo_bonus' in d) = 0 or position('v_cbonus := least' in d) = 0 or position('perfect:g:' in d) = 0 then
    raise exception 'session_answer patch failed';
  end if;
  execute d;
end $$;

-- ---------------------------------------------------------------------------
-- 8. "Double my points" for watching an ad (once per game)
-- ---------------------------------------------------------------------------
alter table public.ad_claims drop constraint ad_claims_kind;
alter table public.ad_claims add constraint ad_claims_kind check (kind = any (array['double_run', 'free_pack', 'vip_daily', 'energy', 'hint', 'double_points']));

do $$
declare d text;
begin
  d := pg_get_functiondef('public.claim_ad_reward(text,text)'::regprocedure);
  d := replace(d, $x$  elsif p_kind = 'free_pack' then$x$,
$x$  elsif p_kind = 'double_points' then
    select * into v_run from public.quiz_runs where id = p_ref::uuid and user_id = v_uid for update;
    if not found or v_run.status = 'active' or v_run.prize_points <= 0 or v_run.ended_at < now() - interval '30 minutes' then
      raise exception 'invalid_state: nothing to double' using errcode = 'P0001';
    end if;
    insert into public.ad_claims (user_id, kind, ref) values (v_uid, p_kind, p_ref) on conflict do nothing;
    if not found then raise exception 'invalid_state: already claimed' using errcode = 'P0001'; end if;
    update public.quiz_runs set prize_points = prize_points * 2 where id = v_run.id;
    return jsonb_build_object('points', v_run.prize_points * 2);
  elsif p_kind = 'free_pack' then$x$);
  if position('double_points' in d) = 0 then raise exception 'claim_ad_reward patch failed'; end if;
  execute d;
end $$;

-- ---------------------------------------------------------------------------
-- 9. All-time and monthly tables; the month's top 3 get a prize
-- ---------------------------------------------------------------------------
insert into public.app_config (key, value, is_public) values
  ('boards', '{"month_prizes": [{"coins": 1000, "gems": 50}, {"coins": 600, "gems": 30}, {"coins": 300, "gems": 15}]}'::jsonb, true)
on conflict (key) do update set value = excluded.value;

create table public.month_awards (
  month      date primary key,
  winners    jsonb not null default '[]',
  created_at timestamptz not null default now()
);
alter table public.month_awards enable row level security;
revoke all on public.month_awards from anon, authenticated;

create function public.israel_month_start(p_at timestamptz default now()) returns timestamptz
language sql stable set search_path = '' as $$
  select date_trunc('month', p_at at time zone 'Asia/Jerusalem') at time zone 'Asia/Jerusalem'
$$;

/** Pays last month's top 3 once (the first time anyone opens the monthly table). */
create function public.month_settle() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_to     timestamptz := public.israel_month_start();
  v_from   timestamptz := public.israel_month_start(v_to - interval '1 day');
  v_month  date := (v_from at time zone 'Asia/Jerusalem')::date;
  v_prizes jsonb := (select value -> 'month_prizes' from public.app_config where key = 'boards');
  v_win    jsonb := '[]';
  r        record;
begin
  insert into public.month_awards (month) values (v_month) on conflict do nothing;
  if not found then return; end if;
  for r in
    select t.user_id, t.points, row_number() over (order by t.points desc, t.user_id) as rank
      from (select user_id, sum(prize_points)::bigint as points from public.quiz_runs
             where status <> 'active' and ended_at >= v_from and ended_at < v_to
             group by user_id having sum(prize_points) > 0) t
     order by t.points desc, t.user_id limit 3
  loop
    perform public.ledger_apply(r.user_id, 'coins', ((v_prizes -> (r.rank - 1)::int) ->> 'coins')::int, 'month_prize', 'month', v_month::text,
      'month:' || v_month || ':' || r.rank || ':c');
    perform public.ledger_apply(r.user_id, 'gems', ((v_prizes -> (r.rank - 1)::int) ->> 'gems')::int, 'month_prize', 'month', v_month::text,
      'month:' || v_month || ':' || r.rank || ':g');
    v_win := v_win || jsonb_build_array(jsonb_build_object('rank', r.rank, 'user_id', r.user_id, 'points', r.points));
  end loop;
  update public.month_awards set winners = v_win where month = v_month;
end $$;

create function public.leaderboard_board(p_kind text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_from  timestamptz;
  v_rows  jsonb;
  v_me    jsonb;
  v_last  jsonb;
begin
  perform public.check_rate_limit(v_uid, 'leaderboard_board', 60, 60);
  if p_kind = 'month' then
    perform public.month_settle();
    v_from := public.israel_month_start();
  elsif p_kind = 'all' then
    v_from := '-infinity';
  else
    raise exception 'invalid_input: kind' using errcode = '22023';
  end if;
  with totals as (
    select r.user_id, sum(r.prize_points)::bigint as points
      from public.quiz_runs r
     where r.ended_at >= v_from and r.status <> 'active'
     group by r.user_id having sum(r.prize_points) > 0),
  ranked as (select t.*, rank() over (order by t.points desc) as rank from totals t)
  select
    (select coalesce(jsonb_agg(jsonb_build_object('rank', k.rank, 'username', p.username, 'avatar_id', p.avatar_id, 'photo', p.photo_url,
              'frame', p.frame, 'level', p.level, 'points', k.points, 'me', k.user_id = v_uid) order by k.rank, p.username), '[]'::jsonb)
       from (select * from ranked order by rank limit 50) k join public.profiles p on p.id = k.user_id),
    (select jsonb_build_object('rank', k.rank, 'points', k.points) from ranked k where k.user_id = v_uid)
    into v_rows, v_me;
  if p_kind = 'month' then
    select coalesce(jsonb_agg(jsonb_build_object('rank', (w ->> 'rank')::int, 'username', p.username, 'avatar_id', p.avatar_id,
             'photo', p.photo_url, 'points', (w ->> 'points')::bigint, 'me', p.id = v_uid) order by (w ->> 'rank')::int), '[]'::jsonb)
      into v_last
      from public.month_awards a, jsonb_array_elements(a.winners) w join public.profiles p on p.id = (w ->> 'user_id')::uuid
     where a.month = (select max(month) from public.month_awards);
  end if;
  return jsonb_build_object('kind', p_kind, 'rows', v_rows, 'me', v_me,
    'ends_at', case when p_kind = 'month' then public.israel_month_start(public.israel_month_start() + interval '32 days') end,
    'prizes', case when p_kind = 'month' then (select value -> 'month_prizes' from public.app_config where key = 'boards') end,
    'last_winners', coalesce(v_last, '[]'::jsonb));
end $$;

revoke all on function public.month_settle(), public.leaderboard_board(text) from public, anon, authenticated;
grant execute on function public.leaderboard_board(text) to authenticated;
