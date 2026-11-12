-- Push notifications: devices register, friend actions queue a push, quiet hours and the off switch hold.
begin;
update public.app_config set value = '{"enabled": true, "project": "x", "quiet_from": 24, "quiet_to": 0}'::jsonb where key = 'push';
create function test.outbox(p_user uuid) returns bigint language sql security definer set search_path = '' as $$
  select count(*) from public.push_outbox where user_id = p_user $$;
grant execute on all functions in schema test to authenticated;
create temp table ids as select test.new_user() as a, test.new_user() as b;
grant select on ids to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); b uuid := (select ids.b from ids);
begin
  perform test.login(b);
  perform test.assert_raises($q$select public.device_register('short', 'android')$q$, 'invalid_input', 'bad token');
  perform public.device_register(repeat('t', 40), 'android');
  perform test.login(a);
  perform public.device_register(repeat('a', 40), 'android');
end $$;

reset role;
-- a friend request from a to b queues one push for b (and none for a)
insert into public.friendships (user_a, user_b, status, requested_by)
select least(a, b), greatest(a, b), 'pending', a from ids;
select test.assert(test.outbox((select b from ids)) = 1 and test.outbox((select a from ids)) = 0, 'friend request push');
-- no device: nothing queued
select public.push_enqueue(test.new_user(), 'x', 't', 'b');
select test.assert((select count(*) from public.push_outbox) = 1, 'no device, no push');
-- off switch in settings
update public.user_settings set notif_prefs = '{"friends": false}' where user_id = (select b from ids);
select public.push_enqueue((select b from ids), 'x', 't', 'b');
select test.assert(test.outbox((select b from ids)) = 1, 'turned off: no push');
-- quiet hours: queued and skipped
update public.user_settings set notif_prefs = '{}' where user_id = (select b from ids);
update public.app_config set value = '{"enabled": true, "quiet_from": 0, "quiet_to": 24}'::jsonb where key = 'push';
select public.push_enqueue((select b from ids), 'x', 't', 'b');
select test.assert((select result from public.push_outbox where user_id = (select b from ids) order by id desc limit 1) = 'quiet_hours', 'quiet hours');
rollback;
