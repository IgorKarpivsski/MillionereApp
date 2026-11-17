-- Special events: a dated window in app_config 'event'.special puts one world (even one left out of the weekly
-- rotation, like Hanukkah) in the spotlight with the event's coin multiplier and its own table,
-- instead of the weekly world. Outside every window the weekly rotation runs as before.
create or replace function public.event_special() returns jsonb
language sql stable security definer set search_path = '' as $$
  select s from public.app_config c, jsonb_array_elements(coalesce(c.value -> 'special', '[]'::jsonb)) s
   where c.key = 'event' and coalesce((c.value ->> 'enabled')::boolean, false)
     and now() >= (s ->> 'from')::timestamptz and now() < (s ->> 'to')::timestamptz
   order by (s ->> 'from')::timestamptz desc limit 1
$$;
revoke all on function public.event_special() from public, anon, authenticated;

create or replace function public.event_world() returns text
language sql stable security definer set search_path = '' as $$
  select case when coalesce(((select value from public.app_config where key = 'event') ->> 'enabled')::boolean, false)
    then coalesce(public.event_special() ->> 'world',
           (select w[1 + (floor(extract(epoch from public.israel_week_start()) / 604800)::int % cardinality(w))]
              from (select array_remove(public.world_slugs(), 'hanukkah') as w) x))
    end
$$;

do $$
declare d text := pg_get_functiondef('public.event_state()'::regprocedure);
  a1 text := 'r.ended_at >= public.israel_week_start()';
  b1 text := 'r.ended_at >= coalesce((public.event_special() ->> ''from'')::timestamptz, public.israel_week_start())';
  a2 text := '''ends_at'', public.israel_week_start() + interval ''7 days''';
  b2 text := '''ends_at'', coalesce((public.event_special() ->> ''to'')::timestamptz, public.israel_week_start() + interval ''7 days''), ''special'', public.event_special() is not null';
begin
  if position(a1 in d) = 0 or position(a2 in d) = 0 then raise exception 'event_state patch failed'; end if;
  execute replace(replace(d, a1, b1), a2, b2);
end $$;

-- Hanukkah 2026 (first candle Friday evening 4 Dec, last night 11 Dec): the Hanukkah world, double coins.
update public.app_config
   set value = value || '{"special": [{"world": "hanukkah", "from": "2026-12-04T14:00:00Z", "to": "2026-12-12T22:00:00Z"}]}'::jsonb
 where key = 'event';
