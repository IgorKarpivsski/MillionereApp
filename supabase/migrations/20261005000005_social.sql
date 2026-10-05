-- =============================================================================
-- Migration 0015 — Friends, sticker trading and friends-only chat.
--
-- Friends: each player has a short friend code; a request must be accepted.
-- Trading: 1-for-1 swaps (or gifts) of DUPLICATE stickers between friends.
--   "מיתי" (iconic) stickers can't be traded — they must be earned.
-- Chat: free text between accepted friends only. The server masks profanity,
--   links and phone numbers before storing, rate-limits, and supports report
--   and block. Blocking ends the friendship and stops messages both ways.
-- =============================================================================

alter table public.profiles add column friend_code text;
create unique index profiles_friend_code_key on public.profiles (friend_code);

create table public.friendships (
  user_a       uuid not null references auth.users (id) on delete cascade,
  user_b       uuid not null references auth.users (id) on delete cascade,
  status       text not null default 'pending' check (status in ('pending', 'accepted')),
  requested_by uuid not null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  primary key (user_a, user_b),
  constraint friendships_order check (user_a < user_b)
);
create index friendships_b_idx on public.friendships (user_b);

create table public.blocks (
  blocker    uuid not null references auth.users (id) on delete cascade,
  blocked    uuid not null references auth.users (id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker, blocked)
);

create table public.chat_messages (
  id         bigint generated always as identity primary key,
  sender     uuid not null references auth.users (id) on delete cascade,
  recipient  uuid not null references auth.users (id) on delete cascade,
  body       text not null check (char_length(body) between 1 and 300),
  flagged    boolean not null default false,
  hidden     boolean not null default false,
  created_at timestamptz not null default now()
);
create index chat_pair_idx on public.chat_messages (least(sender, recipient), greatest(sender, recipient), id desc);
create index chat_recipient_idx on public.chat_messages (recipient, id desc);

create table public.chat_reads (
  user_id   uuid not null references auth.users (id) on delete cascade,
  peer      uuid not null references auth.users (id) on delete cascade,
  last_read bigint not null default 0,
  primary key (user_id, peer)
);

create table public.chat_reports (
  id         bigint generated always as identity primary key,
  message_id bigint not null references public.chat_messages (id) on delete cascade,
  reporter   uuid not null references auth.users (id) on delete cascade,
  reason     text not null check (reason in ('rude', 'bullying', 'personal_info', 'spam', 'other')),
  created_at timestamptz not null default now(),
  unique (message_id, reporter)
);

create table public.trade_offers (
  id         uuid primary key default gen_random_uuid(),
  from_user  uuid not null references auth.users (id) on delete cascade,
  to_user    uuid not null references auth.users (id) on delete cascade,
  give_item  text not null references public.collectibles (id),
  want_item  text references public.collectibles (id),
  status     text not null default 'pending' check (status in ('pending', 'accepted', 'declined', 'cancelled', 'failed')),
  created_at timestamptz not null default now(),
  decided_at timestamptz
);
create index trade_to_idx on public.trade_offers (to_user, status);
create index trade_from_idx on public.trade_offers (from_user, status);

alter table public.friendships enable row level security;
alter table public.blocks enable row level security;
alter table public.chat_messages enable row level security;
alter table public.chat_reads enable row level security;
alter table public.chat_reports enable row level security;
alter table public.trade_offers enable row level security;
create policy friendships_own on public.friendships for select to authenticated
  using ((select auth.uid()) in (user_a, user_b));
create policy blocks_own on public.blocks for select to authenticated using (blocker = (select auth.uid()));
create policy chat_own on public.chat_messages for select to authenticated
  using ((select auth.uid()) in (sender, recipient) and not hidden);
create policy trade_own on public.trade_offers for select to authenticated
  using ((select auth.uid()) in (from_user, to_user));
revoke insert, update, delete, truncate on public.friendships, public.blocks, public.chat_messages, public.chat_reads,
  public.chat_reports, public.trade_offers from anon, authenticated;
revoke all on public.chat_reports, public.chat_reads from anon, authenticated;

insert into public.app_config (key, value, is_public) values
  ('social', '{"max_friends":100,"trade_daily":10,"trade_pending":5,"chat_per_minute":15,"report_hide":3}'::jsonb, false),
  ('chat.blocklist', '["זונה","זונות","שרמוטה","שרמוטות","מניאק","מניאקים","בן זונה","בת זונה","כוס אמק","כוסאמק","כוס אמא שלך","כוסית","זין","זיין","מזדיין","לך תזדיין","תזדיין","זיון","חרא","חארה","מטומטם","מטומטמת","דביל","דבילית","אידיוט","אידיוטית","מפגר","מפגרת","סתום","סתמי","סתום ת׳פה","מכוער","מכוערת","טמבל","הומו","קוקסינל","ערס","פרחה","נאצי","מחבל","תמות","תמותי","fuck","fucking","fucker","shit","bitch","bastard","asshole","dick","cunt","whore","slut","retard","nigger","faggot","porn","sex"]'::jsonb, false)
on conflict (key) do update set value = excluded.value, updated_at = now();

-- -----------------------------------------------------------------------------
-- Helpers
-- -----------------------------------------------------------------------------
create function public.are_friends(p_x uuid, p_y uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.friendships
                  where user_a = least(p_x, p_y) and user_b = greatest(p_x, p_y) and status = 'accepted')
$$;

create function public.is_blocked(p_x uuid, p_y uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (select 1 from public.blocks where (blocker = p_x and blocked = p_y) or (blocker = p_y and blocked = p_x))
$$;

/** Masks blocked words, links and phone numbers. Returns (clean text, was anything masked). */
create function public.chat_clean(p_body text, out body text, out flagged boolean)
language plpgsql stable security definer set search_path = '' as $$
declare
  w text;
  v text := regexp_replace(btrim(p_body), '\s+', ' ', 'g');
  v_orig text;
begin
  v_orig := v;
  -- links / emails / handles
  v := regexp_replace(v, '(https?://|www\.)\S+', '***', 'gi');
  v := regexp_replace(v, '\S+\.(com|net|org|co\.il|io|me|ly|gg|tv)(/\S*)?', '***', 'gi');
  v := regexp_replace(v, '\S+@\S+', '***', 'g');
  -- phone-number-like runs of 7+ digits (spaces / dashes allowed)
  v := regexp_replace(v, '(\+?\d[\d\s\-]{6,}\d)', '***', 'g');
  for w in select jsonb_array_elements_text(value) from public.app_config where key = 'chat.blocklist' loop
    v := regexp_replace(v, '(^|[^[:alnum:]א-ת])' || w || '($|[^[:alnum:]א-ת])', '\1***\2', 'gi');
  end loop;
  body := v;
  flagged := v <> v_orig;
end $$;

-- -----------------------------------------------------------------------------
-- Friend codes and requests
-- -----------------------------------------------------------------------------
create function public.my_friend_code() returns text
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_code text;
  i      integer := 0;
begin
  select friend_code into v_code from public.profiles where id = v_uid;
  while v_code is null loop
    i := i + 1;
    -- 6 chars from an unambiguous alphabet (no 0/O/1/I)
    v_code := (select string_agg(substr('ABCDEFGHJKLMNPQRSTUVWXYZ23456789', 1 + floor(random() * 32)::int, 1), '')
                 from generate_series(1, 6));
    begin
      update public.profiles set friend_code = v_code where id = v_uid and friend_code is null;
    exception when unique_violation then
      v_code := null;
      if i > 10 then raise; end if;
    end;
  end loop;
  return v_code;
end $$;

create function public.friend_request(p_code text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_other uuid;
  v_f     public.friendships;
  v_max   integer := coalesce(((select value from public.app_config where key = 'social') ->> 'max_friends')::int, 100);
begin
  perform public.check_rate_limit(v_uid, 'friend_request', 20, 3600);
  select id into v_other from public.profiles where friend_code = upper(btrim(p_code));
  if v_other is null then raise exception 'invalid_input: code' using errcode = '22023'; end if;
  if v_other = v_uid then raise exception 'invalid_input: self' using errcode = '22023'; end if;
  if public.is_blocked(v_uid, v_other) then raise exception 'invalid_state: blocked' using errcode = 'P0001'; end if;
  if (select count(*) from public.friendships where v_uid in (user_a, user_b)) >= v_max then
    raise exception 'invalid_state: too many friends' using errcode = 'P0001';
  end if;
  select * into v_f from public.friendships where user_a = least(v_uid, v_other) and user_b = greatest(v_uid, v_other) for update;
  if found then
    if v_f.status = 'pending' and v_f.requested_by <> v_uid then
      -- They already asked us: accept.
      update public.friendships set status = 'accepted', updated_at = now()
       where user_a = v_f.user_a and user_b = v_f.user_b;
      return jsonb_build_object('status', 'accepted');
    end if;
    return jsonb_build_object('status', v_f.status);
  end if;
  insert into public.friendships (user_a, user_b, requested_by) values (least(v_uid, v_other), greatest(v_uid, v_other), v_uid);
  return jsonb_build_object('status', 'pending');
end $$;

create function public.friend_respond(p_user uuid, p_accept boolean) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  if p_accept then
    update public.friendships set status = 'accepted', updated_at = now()
     where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user) and status = 'pending' and requested_by = p_user;
    if not found then raise exception 'invalid_state: no request' using errcode = 'P0001'; end if;
  else
    delete from public.friendships
     where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user) and status = 'pending' and requested_by = p_user;
  end if;
end $$;

create function public.friend_remove(p_user uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  delete from public.friendships where user_a = least(v_uid, p_user) and user_b = greatest(v_uid, p_user);
  update public.trade_offers set status = 'cancelled', decided_at = now()
   where status = 'pending' and ((from_user = v_uid and to_user = p_user) or (from_user = p_user and to_user = v_uid));
end $$;

create function public.block_user(p_user uuid) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  if p_user = v_uid then raise exception 'invalid_input: self' using errcode = '22023'; end if;
  perform public.friend_remove(p_user);
  insert into public.blocks (blocker, blocked) values (v_uid, p_user) on conflict do nothing;
end $$;

create function public.unblock_user(p_user uuid) returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.blocks where blocker = public.require_user() and blocked = p_user
$$;

/** Friends, requests both ways, unread counts and pending trades. */
create function public.friends_state() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  perform public.my_friend_code();
  return jsonb_build_object(
    'code', (select friend_code from public.profiles where id = v_uid),
    'friends', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', p.id, 'username', p.username, 'avatar_id', p.avatar_id, 'level', p.level,
          'status', f.status, 'incoming', f.status = 'pending' and f.requested_by <> v_uid,
          'unread', (select count(*) from public.chat_messages m
                      where m.sender = p.id and m.recipient = v_uid and not m.hidden
                        and m.id > coalesce((select last_read from public.chat_reads r where r.user_id = v_uid and r.peer = p.id), 0)),
          'last_at', (select max(m.created_at) from public.chat_messages m
                       where least(m.sender, m.recipient) = f.user_a and greatest(m.sender, m.recipient) = f.user_b))
        order by f.status desc, p.username)
      from public.friendships f
      join public.profiles p on p.id = case when f.user_a = v_uid then f.user_b else f.user_a end
      where v_uid in (f.user_a, f.user_b)), '[]'::jsonb),
    'trades', coalesce((
      select jsonb_agg(jsonb_build_object(
          'id', t.id, 'incoming', t.to_user = v_uid,
          'peer', case when t.to_user = v_uid then t.from_user else t.to_user end,
          'peer_name', (select username from public.profiles where id = case when t.to_user = v_uid then t.from_user else t.to_user end),
          'give', t.give_item, 'want', t.want_item, 'created_at', t.created_at) order by t.created_at desc)
      from public.trade_offers t where t.status = 'pending' and v_uid in (t.from_user, t.to_user)), '[]'::jsonb),
    'blocked', coalesce((select jsonb_agg(jsonb_build_object('id', b.blocked, 'username', p.username))
                          from public.blocks b join public.profiles p on p.id = b.blocked where b.blocker = v_uid), '[]'::jsonb));
end $$;

-- -----------------------------------------------------------------------------
-- Chat
-- -----------------------------------------------------------------------------
create function public.chat_send(p_to uuid, p_body text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_cfg  jsonb := (select value from public.app_config where key = 'social');
  v_c    record;
  v_id   bigint;
begin
  perform public.check_rate_limit(v_uid, 'chat_send', coalesce((v_cfg ->> 'chat_per_minute')::int, 15), 60);
  if p_body is null or char_length(btrim(p_body)) = 0 or char_length(p_body) > 300 then
    raise exception 'invalid_input: body' using errcode = '22023';
  end if;
  if not public.are_friends(v_uid, p_to) or public.is_blocked(v_uid, p_to) then
    raise exception 'invalid_state: not friends' using errcode = 'P0001';
  end if;
  select * into v_c from public.chat_clean(p_body);
  insert into public.chat_messages (sender, recipient, body, flagged) values (v_uid, p_to, v_c.body, v_c.flagged) returning id into v_id;
  insert into public.chat_reads as r (user_id, peer, last_read) values (v_uid, p_to, v_id)
  on conflict (user_id, peer) do update set last_read = greatest(r.last_read, excluded.last_read);
  return jsonb_build_object('id', v_id, 'body', v_c.body, 'masked', v_c.flagged);
end $$;

/** Last 50 messages (or 50 before p_before), oldest first; marks them read. */
create function public.chat_history(p_with uuid, p_before bigint default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_out jsonb;
  v_max bigint;
begin
  if not public.are_friends(v_uid, p_with) and not exists (
       select 1 from public.chat_messages where (sender = v_uid and recipient = p_with) or (sender = p_with and recipient = v_uid)) then
    raise exception 'invalid_state: not friends' using errcode = 'P0001';
  end if;
  select coalesce(jsonb_agg(jsonb_build_object('id', m.id, 'mine', m.sender = v_uid, 'body', m.body, 'at', m.created_at) order by m.id), '[]'::jsonb),
         max(m.id)
    into v_out, v_max
    from (select * from public.chat_messages
           where least(sender, recipient) = least(v_uid, p_with) and greatest(sender, recipient) = greatest(v_uid, p_with)
             and not hidden and (p_before is null or id < p_before)
           order by id desc limit 50) m;
  if v_max is not null then
    insert into public.chat_reads as r (user_id, peer, last_read) values (v_uid, p_with, v_max)
    on conflict (user_id, peer) do update set last_read = greatest(r.last_read, excluded.last_read);
  end if;
  return jsonb_build_object('messages', v_out, 'can_send', public.are_friends(v_uid, p_with) and not public.is_blocked(v_uid, p_with));
end $$;

create function public.chat_report(p_message bigint, p_reason text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_m   public.chat_messages;
  v_n   integer;
begin
  perform public.check_rate_limit(v_uid, 'chat_report', 20, 3600);
  select * into v_m from public.chat_messages where id = p_message;
  if not found or v_m.recipient <> v_uid then raise exception 'invalid_input: message' using errcode = '22023'; end if;
  insert into public.chat_reports (message_id, reporter, reason) values (p_message, v_uid, p_reason) on conflict do nothing;
  -- The reporter never has to see it again.
  update public.chat_messages set hidden = true where id = p_message;
  select count(*) into v_n from public.chat_reports r join public.chat_messages m on m.id = r.message_id where m.sender = v_m.sender;
  if v_n >= coalesce(((select value from public.app_config where key = 'social') ->> 'report_hide')::int, 3) then
    update public.chat_messages set flagged = true where sender = v_m.sender and created_at > now() - interval '7 days';
  end if;
end $$;

-- -----------------------------------------------------------------------------
-- Trading duplicates
-- -----------------------------------------------------------------------------
/** A friend's tradeable duplicates (count >= 2, not iconic), plus whether I own each. */
create function public.friend_dupes(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  if not public.are_friends(v_uid, p_user) then raise exception 'invalid_state: not friends' using errcode = 'P0001'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('id', c.id, 'count', u.count,
             'mine', coalesce((select x.count from public.user_collectibles x where x.user_id = v_uid and x.item_id = c.id), 0)) order by c.album, c.number)
      from public.user_collectibles u join public.collectibles c on c.id = u.item_id
     where u.user_id = p_user and u.count >= 2 and c.rarity <> 'iconic'), '[]'::jsonb);
end $$;

create function public.trade_offer(p_to uuid, p_give text, p_want text default null) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_cfg jsonb := (select value from public.app_config where key = 'social');
  v_id  uuid;
begin
  perform public.check_rate_limit(v_uid, 'trade_offer', 20, 3600);
  if not public.are_friends(v_uid, p_to) or public.is_blocked(v_uid, p_to) then
    raise exception 'invalid_state: not friends' using errcode = 'P0001';
  end if;
  if (select count(*) from public.trade_offers where from_user = v_uid and status = 'pending') >= (v_cfg ->> 'trade_pending')::int then
    raise exception 'invalid_state: too many pending' using errcode = 'P0001';
  end if;
  if (select count(*) from public.trade_offers where from_user = v_uid and created_at > now() - interval '1 day') >= (v_cfg ->> 'trade_daily')::int then
    raise exception 'rate_limited' using errcode = 'P0429';
  end if;
  if exists (select 1 from public.collectibles where id in (p_give, p_want) and rarity = 'iconic') then
    raise exception 'invalid_input: iconic not tradeable' using errcode = '22023';
  end if;
  if coalesce((select count from public.user_collectibles where user_id = v_uid and item_id = p_give), 0) < 2 then
    raise exception 'invalid_state: not a duplicate' using errcode = 'P0001';
  end if;
  if p_want is not null and p_want = p_give then raise exception 'invalid_input: same item' using errcode = '22023'; end if;
  insert into public.trade_offers (from_user, to_user, give_item, want_item) values (v_uid, p_to, p_give, p_want) returning id into v_id;
  return jsonb_build_object('id', v_id);
end $$;

create function public.trade_respond(p_offer uuid, p_accept boolean) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_t   public.trade_offers;
begin
  perform public.check_rate_limit(v_uid, 'trade_respond', 30, 60);
  select * into v_t from public.trade_offers where id = p_offer for update;
  if not found or v_uid not in (v_t.to_user, v_t.from_user) then raise exception 'invalid_input: offer' using errcode = '22023'; end if;
  if v_t.status <> 'pending' then raise exception 'invalid_state: offer closed' using errcode = 'P0001'; end if;
  if v_uid = v_t.from_user then
    -- the sender can only cancel
    update public.trade_offers set status = 'cancelled', decided_at = now() where id = p_offer;
    return jsonb_build_object('status', 'cancelled');
  end if;
  if not p_accept then
    update public.trade_offers set status = 'declined', decided_at = now() where id = p_offer;
    return jsonb_build_object('status', 'declined');
  end if;
  if not public.are_friends(v_t.from_user, v_t.to_user) then raise exception 'invalid_state: not friends' using errcode = 'P0001'; end if;

  -- Lock both players' sticker rows in a fixed order, then re-check ownership.
  perform 1 from public.user_collectibles
   where (user_id, item_id) in ((v_t.from_user, v_t.give_item), (v_t.to_user, coalesce(v_t.want_item, '')))
   order by user_id, item_id for update;
  if coalesce((select count from public.user_collectibles where user_id = v_t.from_user and item_id = v_t.give_item), 0) < 2
     or (v_t.want_item is not null and coalesce((select count from public.user_collectibles where user_id = v_t.to_user and item_id = v_t.want_item), 0) < 2) then
    update public.trade_offers set status = 'failed', decided_at = now() where id = p_offer;
    raise exception 'invalid_state: no longer available' using errcode = 'P0001';
  end if;

  update public.user_collectibles set count = count - 1 where user_id = v_t.from_user and item_id = v_t.give_item;
  insert into public.user_collectibles as u (user_id, item_id, count) values (v_t.to_user, v_t.give_item, 1)
  on conflict (user_id, item_id) do update set count = u.count + 1;
  if v_t.want_item is not null then
    update public.user_collectibles set count = count - 1 where user_id = v_t.to_user and item_id = v_t.want_item;
    insert into public.user_collectibles as u (user_id, item_id, count) values (v_t.from_user, v_t.want_item, 1)
    on conflict (user_id, item_id) do update set count = u.count + 1;
  end if;
  update public.trade_offers set status = 'accepted', decided_at = now() where id = p_offer;
  return jsonb_build_object('status', 'accepted');
end $$;

revoke execute on function public.are_friends(uuid, uuid), public.is_blocked(uuid, uuid), public.chat_clean(text),
  public.my_friend_code(), public.friend_request(text), public.friend_respond(uuid, boolean), public.friend_remove(uuid),
  public.block_user(uuid), public.unblock_user(uuid), public.friends_state(), public.chat_send(uuid, text),
  public.chat_history(uuid, bigint), public.chat_report(bigint, text), public.friend_dupes(uuid),
  public.trade_offer(uuid, text, text), public.trade_respond(uuid, boolean)
  from public, anon, authenticated;
grant execute on function public.my_friend_code(), public.friend_request(text), public.friend_respond(uuid, boolean), public.friend_remove(uuid),
  public.block_user(uuid), public.unblock_user(uuid), public.friends_state(), public.chat_send(uuid, text),
  public.chat_history(uuid, bigint), public.chat_report(bigint, text), public.friend_dupes(uuid),
  public.trade_offer(uuid, text, text), public.trade_respond(uuid, boolean)
  to authenticated;
