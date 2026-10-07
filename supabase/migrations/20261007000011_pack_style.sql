-- Which pack look the app shows: scenes | retro | neon | jersey | holo | mascot.
insert into public.app_config (key, value, is_public) values ('packs.style', '"scenes"'::jsonb, true)
on conflict (key) do nothing;
