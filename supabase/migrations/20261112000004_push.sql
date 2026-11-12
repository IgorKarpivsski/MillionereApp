-- 0.2.0: real push notifications for things a friend does (invites, trades, friend requests, calls).
-- Rows go into push_outbox (by triggers), and a call to the push-send Edge Function delivers them through
-- Firebase Cloud Messaging. Nothing is sent at night (Israel 21:00–08:00): those rows are skipped.
-- Turned on with app_config 'push' -> {"enabled": true, "project": "<firebase project id>"}.

create table if not exists public.push_outbox (
  id         bigint generated always as identity primary key,
  user_id    uuid not null references auth.users (id) on delete cascade,
  kind       text not null,
  title      text not null,
  body       text not null,
  data       jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  sent_at    timestamptz,
  result     text
);
create index if not exists push_outbox_pending_idx on public.push_outbox (created_at) where sent_at is null;
alter table public.push_outbox enable row level security;
-- no policies: only the service role reads or writes it

insert into public.app_config (key, value, is_public)
values ('push', '{"enabled": false, "project": null, "quiet_from": 21, "quiet_to": 8}'::jsonb, false)
on conflict (key) do nothing;

/** The app registers its push token after sign-in (one row per token; a token moves to whoever signed in last). */
create or replace function public.device_register(p_token text, p_platform text) returns void
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  if p_token is null or char_length(p_token) < 20 or char_length(p_token) > 4096 then
    raise exception 'invalid_input: token' using errcode = '22023';
  end if;
  perform public.check_rate_limit(v_uid, 'device_register', 20, 3600);
  insert into public.devices (user_id, push_token, platform, last_seen)
  values (v_uid, p_token, p_platform::public.device_platform, now())
  on conflict (push_token) do update set user_id = excluded.user_id, platform = excluded.platform, last_seen = now();
end $$;
revoke all on function public.device_register(text, text) from public, anon;
grant execute on function public.device_register(text, text) to authenticated;

create or replace function public.device_unregister(p_token text) returns void
language sql security definer set search_path = '' as $$
  delete from public.devices where push_token = p_token and user_id = public.require_user()
$$;
revoke all on function public.device_unregister(text) from public, anon;
grant execute on function public.device_unregister(text) to authenticated;

/** Queues one push for a player and wakes the sender. Never fails the action that caused it. */
create or replace function public.push_enqueue(p_user uuid, p_kind text, p_title text, p_body text, p_data jsonb default '{}'::jsonb)
returns void language plpgsql security definer set search_path = '' as $$
declare
  v_cfg  jsonb := (select value from public.app_config where key = 'push');
  v_hour integer := extract(hour from now() at time zone 'Asia/Jerusalem');
  v_id   bigint;
begin
  if p_user is null or not coalesce((v_cfg ->> 'enabled')::boolean, false) then return; end if;
  if not exists (select 1 from public.devices where user_id = p_user) then return; end if;
  -- the player turned notifications off in the game
  if exists (select 1 from public.user_settings where user_id = p_user and notif_prefs ->> 'friends' = 'false') then return; end if;
  insert into public.push_outbox (user_id, kind, title, body, data) values (p_user, p_kind, p_title, p_body, p_data) returning id into v_id;
  if v_hour >= coalesce((v_cfg ->> 'quiet_from')::int, 21) or v_hour < coalesce((v_cfg ->> 'quiet_to')::int, 8) then
    update public.push_outbox set sent_at = now(), result = 'quiet_hours' where id = v_id;
    return;
  end if;
  if exists (select 1 from pg_extension where extname = 'pg_net') then
    perform net.http_post(
      url := 'https://pajqbqjjadwcbpajkiph.supabase.co/functions/v1/push-send',
      headers := jsonb_build_object('content-type', 'application/json',
                   'x-cron-secret', (select value #>> '{}' from public.app_config where key = 'ops.cron_secret')),
      body := jsonb_build_object('id', v_id));
  end if;
exception when others then
  -- a push is a nice-to-have: the invite / trade itself must still go through
  return;
end $$;
revoke all on function public.push_enqueue(uuid, text, text, text, jsonb) from public, anon, authenticated;

create or replace function public.push_name(p_user uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(nullif(btrim(username), ''), 'חבר') from public.profiles where id = p_user
$$;
revoke all on function public.push_name(uuid) from public, anon, authenticated;

create or replace function public.push_on_family_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_enqueue(new.to_user, 'family_invite', public.push_name(new.from_user) || ' מזמין אותך לחדר משפחה! 👨‍👩‍👧',
    'משחק טריוויה עם כל החבר׳ה. מצטרפים?', jsonb_build_object('route', '/family', 'room', new.room_id));
  return new;
end $$;
create or replace function public.push_on_match_invite() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_enqueue(new.to_user, 'match_invite', public.push_name(new.from_user) || ' מאתגר אותך לדו-קרב! ⚔️',
    'מי יענה מהר יותר? בוא לשחק', jsonb_build_object('route', '/friends'));
  return new;
end $$;
create or replace function public.push_on_trade_offer() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_enqueue(new.to_user, 'trade_offer', public.push_name(new.from_user) || ' מציע לך החלפה 🔄',
    'בוא לראות אילו מדבקות על השולחן', jsonb_build_object('route', '/friends'));
  return new;
end $$;
create or replace function public.push_on_friend_request() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.status = 'pending' then
    perform public.push_enqueue(case when new.requested_by = new.user_a then new.user_b else new.user_a end, 'friend_request',
      public.push_name(new.requested_by) || ' רוצה להיות חבר שלך 👋', 'אשרו ותוכלו לשחק ולהחליף מדבקות',
      jsonb_build_object('route', '/friends'));
  end if;
  return new;
end $$;
create or replace function public.push_on_friend_call() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_enqueue(new.friend, 'friend_call', public.push_name(new.caller) || ' צריך עזרה בשאלה! 📞',
    'יש לך כמה שניות לעזור לו', jsonb_build_object('route', '/', 'call', new.id));
  return new;
end $$;
create or replace function public.push_on_sticker_gift() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.push_enqueue(new.to_user, 'sticker_gift', public.push_name(new.from_user) || ' שלח לך מדבקה במתנה! 🎁',
    'פתחו את האלבום ותראו', jsonb_build_object('route', '/(tabs)/collection'));
  return new;
end $$;
revoke all on function public.push_on_family_invite(), public.push_on_match_invite(), public.push_on_trade_offer(),
  public.push_on_friend_request(), public.push_on_friend_call(), public.push_on_sticker_gift() from public, anon, authenticated;

drop trigger if exists push_family_invite on public.family_invites;
create trigger push_family_invite after insert on public.family_invites for each row execute function public.push_on_family_invite();
drop trigger if exists push_match_invite on public.match_invites;
create trigger push_match_invite after insert on public.match_invites for each row execute function public.push_on_match_invite();
drop trigger if exists push_trade_offer on public.trade_offers;
create trigger push_trade_offer after insert on public.trade_offers for each row execute function public.push_on_trade_offer();
drop trigger if exists push_friend_request on public.friendships;
create trigger push_friend_request after insert on public.friendships for each row execute function public.push_on_friend_request();
drop trigger if exists push_friend_call on public.friend_calls;
create trigger push_friend_call after insert on public.friend_calls for each row execute function public.push_on_friend_call();
drop trigger if exists push_sticker_gift on public.sticker_gifts;
create trigger push_sticker_gift after insert on public.sticker_gifts for each row execute function public.push_on_sticker_gift();
