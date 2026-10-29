-- The first season's name came from the football days; the game is general knowledge now.
update public.app_config
   set value = jsonb_set(value, '{title}', '"עונה 1: יוצאים לדרך"')
 where key = 'season.current' and value ->> 'title' = 'עונה 1: הבעיטה הראשונה';
