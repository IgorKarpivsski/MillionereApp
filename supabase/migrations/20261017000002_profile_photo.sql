-- Profile photo: a picture from the phone (uploaded to the "avatars" bucket,
-- in the player's own folder) or the player's Google account picture.
-- Only the player sees it (get_my_state); other players keep seeing the
-- illustrated avatar, so children's photos are never shown to strangers.

alter table public.profiles add column photo_url text;
alter table public.profiles add constraint profiles_photo_url check (
  photo_url is null or (char_length(photo_url) <= 600 and photo_url ~ '^https://'));

create function public.set_profile_photo(p_url text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_base text := coalesce((select value #>> '{}' from public.app_config where key = 'storage.public_base'), '');
begin
  perform public.check_rate_limit(v_uid, 'set_profile_photo', 30, 3600);
  if p_url is not null and not (
       (v_base <> '' and p_url like v_base || '/avatars/' || v_uid::text || '/%')
       or p_url ~ '^https://lh[0-9]\.googleusercontent\.com/[A-Za-z0-9_\-/=.]+$') then
    raise exception 'invalid_input: photo' using errcode = '22023';
  end if;
  update public.profiles set photo_url = p_url where id = v_uid;
  return public.get_my_state();
end $$;
revoke all on function public.set_profile_photo(text) from public, anon, authenticated;
grant execute on function public.set_profile_photo(text) to authenticated;

insert into public.app_config (key, value, is_public) values
  ('storage.public_base', '"https://pajqbqjjadwcbpajkiph.supabase.co/storage/v1/object/public"'::jsonb, false)
on conflict (key) do nothing;

-- Storage bucket + policies (skipped on plain Postgres test databases).
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage')
     and to_regclass('storage.buckets') is not null then
    insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    values ('avatars', 'avatars', true, 1048576, array['image/jpeg', 'image/png', 'image/webp'])
    on conflict (id) do update set public = true, file_size_limit = 1048576,
      allowed_mime_types = array['image/jpeg', 'image/png', 'image/webp'];

    execute $p$create policy "avatars own insert" on storage.objects for insert to authenticated
      with check (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "avatars own update" on storage.objects for update to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
    execute $p$create policy "avatars own delete" on storage.objects for delete to authenticated
      using (bucket_id = 'avatars' and (storage.foldername(name))[1] = auth.uid()::text)$p$;
  end if;
end $$;
