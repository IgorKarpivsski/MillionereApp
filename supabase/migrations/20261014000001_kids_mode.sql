-- Kids & teens mode: only simple, well-known questions stay active.
--  * The hand-checked kids bank (template 'kids:<world>', tools/question-gen/kids/) is imported separately.
--  * Generated questions keep only the best-known share of kid-friendly templates (kids_keep_rules);
--    everything else, including every "which year / century" question, is retired (not deleted).
--  * 25 seconds per question, fewer levels per world to match the smaller banks.
create table if not exists public.kids_keep_rules (template text primary key, frac real not null);
alter table public.kids_keep_rules enable row level security;
insert into public.kids_keep_rules values
 ('flag',0.35),('continent',0.5),('capital',0.25),('capital_rev',0.2),('city_country',0.05),('landmark_photo',0.06),('language',0.15),
 ('animal_photo',0.15),('animal_class',0.12),('dog_photo',0.2),('planet_photo',1),('planet_order',1),
 ('author',0.03),('artwork_photo',0.1),('director',0.04),('instrument_photo',0.25),('person_photo',0.05),('person_field',0.06),
 ('israel_photo',0.1),('sport_photo',1),('athlete_sport',0.04),('dish_photo',0.15),('vegetable_photo',1),('dish_origin',0.08),
 ('player:national_team',0.1),('winner:Q19317',1),('winner:Q260858',1),('wc:title_count',1),('winner:Q18756',0.15),('club:city',0.1),('club:stadium',0.1),('club:which_player',0.03)
on conflict (template) do update set frac = excluded.frac;

with r as (select q.id, q.template, percent_rank() over (partition by q.template, q.world order by q.obscurity, q.id) pr
             from public.questions q where q.status = 'active' and q.template not like 'kids:%'),
drop_ids as (select r.id from r left join public.kids_keep_rules k on k.template = r.template where k.frac is null or r.pr > k.frac)
update public.questions q set status = 'retired' from drop_ids d where q.id = d.id and q.status = 'active';
select public.refresh_question_ranks();

update public.app_config set value = (
  select jsonb_agg(w || jsonb_build_object('levels', case w->>'slug'
     when 'geography' then 30 when 'football' then 25 when 'nature' then 20 when 'israel' then 12 when 'food' then 10
     when 'people' then 10 when 'sport' then 9 when 'culture' then 9 when 'screen' then 8 when 'science' then 8
     when 'music' then 7 when 'space' then 6 else 5 end) order by o)
  from jsonb_array_elements(value) with ordinality as t(w, o)), updated_at = now()
where key = 'worlds';
update public.app_config set value = value || '{"seconds": 25}'::jsonb, updated_at = now() where key = 'session';
