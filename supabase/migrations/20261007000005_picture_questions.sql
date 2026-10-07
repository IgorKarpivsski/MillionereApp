-- Picture questions: an optional illustration attached to a question.
--   {"kind": "map", "map": "israel" | "europe", "lon": .., "lat": ..}
-- The base maps are bundled in the app (packages/shared/src/maps.ts); the
-- server only sends where the pin goes. Shown in classic, daily and friend matches.

alter table public.questions add column image jsonb;
alter table public.questions add constraint questions_image_shape check (
  image is null or (jsonb_typeof(image) = 'object' and image ->> 'kind' = 'map'
                    and image ->> 'map' in ('israel', 'europe')
                    and jsonb_typeof(image -> 'lon') = 'number' and jsonb_typeof(image -> 'lat') = 'number'));

-- Add the image to the two client payloads (patched in place so the rest of
-- each function stays exactly as it is).
do $$
declare d text;
begin
  d := pg_get_functiondef('public.quiz_payload(uuid)'::regprocedure);
  d := replace(d, $x$'text', v_q.text_he,$x$, $x$'text', v_q.text_he, 'image', v_q.image,$x$);
  if position($x$'image', v_q.image$x$ in d) = 0 then raise exception 'quiz_payload patch failed'; end if;
  execute d;

  d := pg_get_functiondef('public.match_state(uuid)'::regprocedure);
  d := replace(d, $x$'id', q.id, 'text', q.text_he,$x$, $x$'id', q.id, 'text', q.text_he, 'image', q.image,$x$);
  if position($x$'image', q.image$x$ in d) = 0 then raise exception 'match_state patch failed'; end if;
  execute d;
end $$;
