-- Seasonal knowledge world: Hanukkah (kids bank questions, category = world).
insert into public.question_categories (slug, name_he, sort, world) values ('hanukkah', 'חנוכה', 113, 'hanukkah')
on conflict (slug) do update set world = excluded.world, name_he = excluded.name_he;

update public.app_config
   set value = value || '[{"slug": "hanukkah", "name": "חנוכה", "icon": "menorah", "color": "#2F6FE0", "levels": 6, "active": true}]'::jsonb
 where key = 'worlds' and not value @> '[{"slug": "hanukkah"}]';
