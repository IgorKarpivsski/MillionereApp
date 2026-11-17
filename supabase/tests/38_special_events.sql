-- A dated special event replaces the weekly event world while it runs.
begin;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;
update public.app_config set value = '{"enabled": true, "coins_mult": 2, "special": [{"world": "hanukkah", "from": "2000-01-01T00:00:00Z", "to": "2100-01-01T00:00:00Z"}]}'::jsonb where key = 'event';
set local role authenticated;
do $$
declare s jsonb;
begin
  perform test.login((select ids.a from ids));
  s := public.event_state();
  perform test.assert(s ->> 'world' = 'hanukkah' and (s ->> 'special')::boolean and (s ->> 'ends_at')::timestamptz = '2100-01-01T00:00:00Z', 'special event on');
end $$;
reset role;
update public.app_config set value = '{"enabled": true, "coins_mult": 2, "special": [{"world": "hanukkah", "from": "2000-01-01T00:00:00Z", "to": "2000-01-09T00:00:00Z"}]}'::jsonb where key = 'event';
set local role authenticated;
do $$
declare s jsonb;
begin
  perform test.login((select ids.a from ids));
  s := public.event_state();
  perform test.assert(s ->> 'world' <> 'hanukkah' and not (s ->> 'special')::boolean, 'weekly rotation outside the window');
end $$;
rollback;
