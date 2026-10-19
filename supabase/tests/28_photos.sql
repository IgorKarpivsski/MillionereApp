-- Photos are shown to the owner and to friends only.
begin;
create function test.set_photo(p_user uuid) returns void language sql security definer set search_path = '' as $$
  update public.profiles set photo_url = 'https://lh3.googleusercontent.com/p' where id = p_user $$;
create function test.friends(p_a uuid, p_b uuid) returns void language sql security definer set search_path = '' as $$
  insert into public.friendships (user_a, user_b, status, requested_by) values (least(p_a, p_b), greatest(p_a, p_b), 'accepted', p_a) $$;
create function test.surv(p_user uuid) returns void language sql security definer set search_path = '' as $$
  insert into public.survival_runs (user_id, ended_at, correct, status) values (p_user, now(), 7, 'done') $$;
grant execute on all functions in schema test to authenticated;
create temp table ids4 as select test.new_user() as a, test.new_user() as b, test.new_user() as c;
grant select on ids4 to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids4.a from ids4); b uuid := (select ids4.b from ids4); c uuid := (select ids4.c from ids4); s jsonb;
begin
  perform test.set_photo(a);
  perform test.surv(a);
  perform test.friends(a, b);
  perform test.login(a);
  s := public.survival_info();
  perform test.assert(s -> 'rows' -> 0 ->> 'photo' is not null, 'own photo visible');
  perform test.login(b);
  s := public.survival_info();
  perform test.assert(s -> 'rows' -> 0 ->> 'photo' is not null, 'friend sees the photo');
  perform test.login(c);
  s := public.survival_info();
  perform test.assert(s -> 'rows' -> 0 ? 'photo' and s -> 'rows' -> 0 ->> 'photo' is null, 'stranger does not');
end $$;
rollback;

-- Guard: any new function that returns a photo must go through photo_for.
do $$
declare v text;
begin
  select string_agg(p.proname, ', ') into v from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prokind = 'f' and p.proname not in ('admin_find_players', 'set_profile_photo', 'photo_for')
     and pg_get_functiondef(p.oid) ~ '''photo'',\s*([a-z_]+\.)?photo_url';
  perform test.assert(v is null, 'photo returned without photo_for in: ' || coalesce(v, ''));
end $$;
