-- The kids bank grew by about 10,800 questions (2026-10-20, content/kids/), so every world
-- gets more levels (about 18 questions per level, at most 60). Levels only grow, so nobody
-- loses progress.
update public.app_config set value = (
  select jsonb_agg(w || jsonb_build_object('levels', greatest((w->>'levels')::int, case w->>'slug'
     when 'culture' then 50 when 'food' then 57 when 'football' then 60 when 'geography' then 60
     when 'hanukkah' then 9 when 'history' then 55 when 'israel' then 58 when 'music' then 47
     when 'nature' then 60 when 'people' then 37 when 'science' then 60 when 'screen' then 54
     when 'space' then 40 when 'sport' then 50 else 0 end)) order by o)
  from jsonb_array_elements(value) with ordinality as t(w, o)), updated_at = now()
where key = 'worlds';

-- the new questions need their place on each world's difficulty ladder
select public.refresh_question_ranks();
