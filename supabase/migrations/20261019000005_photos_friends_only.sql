-- =============================================================================
-- Profile photos: friends only.
-- A player's real photo is shown to the player and to their friends. Everyone
-- else (tables, random opponents, the market, family rooms with strangers…)
-- sees the drawn avatar. Admin search is unchanged.
-- =============================================================================
create function public.photo_for(p_owner uuid, p_url text) returns text
language sql stable security definer set search_path = '' as $$
  select case
    when p_url is null then null
    when p_owner = auth.uid() or public.are_friends(auth.uid(), p_owner) then p_url
  end
$$;
revoke all on function public.photo_for(uuid, text) from public, anon, authenticated;

do $$
declare
  r     record;
  v_def text;
  v_new text;
begin
  for r in select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
            where n.nspname = 'public' and p.prokind = 'f'
              and p.proname not in ('admin_find_players', 'set_profile_photo', 'photo_for')
              and pg_get_functiondef(p.oid) ~ '''photo'',\s*([a-z_]+\.)?photo_url' loop
    v_def := pg_get_functiondef(r.oid);
    v_new := regexp_replace(v_def, '''photo'',\s*([a-z_]+)\.photo_url', '''photo'', public.photo_for(\1.id, \1.photo_url)', 'g');
    v_new := regexp_replace(v_new, '''photo'',\s*photo_url', '''photo'', public.photo_for(id, photo_url)', 'g');
    if v_new <> v_def then execute v_new; end if;
  end loop;
end $$;
