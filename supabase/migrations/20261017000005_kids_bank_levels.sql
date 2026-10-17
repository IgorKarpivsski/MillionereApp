-- The kids bank roughly doubled (new text + photo questions, content/kids/), so the
-- smaller worlds get more levels (about 18 questions per level). Levels only grow,
-- so nobody loses progress.
update public.app_config set value = (
  select jsonb_agg(w || jsonb_build_object('levels', greatest((w->>'levels')::int, case w->>'slug'
     when 'culture' then 10 when 'food' then 11 when 'history' then 9 when 'music' then 10 when 'nature' then 20
     when 'people' then 12 when 'science' then 9 when 'screen' then 10 when 'space' then 9 when 'sport' then 12
     else 0 end)) order by o)
  from jsonb_array_elements(value) with ordinality as t(w, o)), updated_at = now()
where key = 'worlds';
