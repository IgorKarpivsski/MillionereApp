-- Custom avatars ("Sims-like" creator).
--
-- The avatar is encoded in profiles.avatar_id so every RPC that already returns
-- avatar_id (leaderboard, friends, match, chat) shows it without changes:
--   av1_ + 12 base36 slots (see packages/shared/src/avatar.ts for the meaning).
-- Legacy 'avatar_NN' ids stay valid.
-- Slot 11 = accessory; '8' (shades) and '9' (crown) are earned cosmetics and are
-- checked against user_cosmetics on the server.

alter table public.profiles drop constraint profiles_avatar_format;
alter table public.profiles add constraint profiles_avatar_format
  check (avatar_id ~ '^avatar_[0-9]{2}$' or avatar_id ~ '^av1_[0-9a-z]{12}$');

create or replace function public.avatar_is_allowed(p_user uuid, p_avatar text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_acc text;
begin
  if p_avatar ~ '^avatar_[0-9]{2}$' then
    return true;
  end if;
  if p_avatar !~ '^av1_[0-9a-z]{12}$' then
    return false;
  end if;
  -- Slot ranges (keep in sync with AVATAR_SLOTS in packages/shared/src/avatar.ts).
  if position(substr(p_avatar, 5, 1) in '0123456789ab') = 0 then return false; end if;   -- species: 12
  if position(substr(p_avatar, 6, 1) in '0123456789') = 0 then return false; end if;     -- skin: 10
  if position(substr(p_avatar, 7, 1) in '0123') = 0 then return false; end if;           -- face: 4
  if position(substr(p_avatar, 8, 1) in '01234567') = 0 then return false; end if;       -- eyes: 8
  if position(substr(p_avatar, 9, 1) in '012345') = 0 then return false; end if;         -- brows: 6
  if position(substr(p_avatar, 10, 1) in '01234567') = 0 then return false; end if;      -- mouth: 8
  if position(substr(p_avatar, 11, 1) in '0123456789abcd') = 0 then return false; end if; -- hair: 14
  if position(substr(p_avatar, 12, 1) in '0123456789ab') = 0 then return false; end if;  -- hair color: 12
  if position(substr(p_avatar, 13, 1) in '012345') = 0 then return false; end if;        -- outfit: 6
  if position(substr(p_avatar, 14, 1) in '0123456789ab') = 0 then return false; end if;  -- outfit color: 12
  if position(substr(p_avatar, 15, 1) in '0123456789') = 0 then return false; end if;    -- background: 10
  v_acc := substr(p_avatar, 16, 1);
  if position(v_acc in '0123456789') = 0 then return false; end if;                      -- accessory: 10
  if v_acc = '8' then
    return exists (select 1 from public.user_cosmetics where user_id = p_user and item = 'avatar_shades');
  elsif v_acc = '9' then
    return exists (select 1 from public.user_cosmetics where user_id = p_user and item = 'avatar_crown');
  end if;
  return true;
end $$;

revoke all on function public.avatar_is_allowed(uuid, text) from public, anon, authenticated;

create or replace function public.update_my_profile(
  p_username    text    default null,
  p_avatar_id   text    default null,
  p_fav_leagues text[]  default null,
  p_fav_teams   text[]  default null
) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  perform public.check_rate_limit(v_uid, 'update_profile', 20, 3600);

  if p_username is not null then
    p_username := btrim(p_username);
    if p_username !~ '^[A-Za-z0-9_֐-׿]{3,20}$' then
      raise exception 'invalid_input: username' using errcode = '22023';
    end if;
    if exists (select 1 from public.profiles
                where lower(username) = lower(p_username) and id <> v_uid) then
      raise exception 'username_taken' using errcode = '23505';
    end if;
  end if;

  if p_avatar_id is not null and not public.avatar_is_allowed(v_uid, p_avatar_id) then
    raise exception 'invalid_input: avatar' using errcode = '22023';
  end if;

  update public.profiles set
    username    = coalesce(p_username, username),
    avatar_id   = coalesce(p_avatar_id, avatar_id),
    fav_leagues = coalesce(p_fav_leagues, fav_leagues),
    fav_teams   = coalesce(p_fav_teams, fav_teams)
  where id = v_uid;

  return public.get_my_state();
exception
  when unique_violation then
    raise exception 'username_taken' using errcode = '23505';
  when check_violation then
    raise exception 'invalid_input: %', sqlerrm using errcode = '22023';
end $$;

revoke all on function public.update_my_profile(text, text, text[], text[]) from public, anon;
grant execute on function public.update_my_profile(text, text, text[], text[]) to authenticated;
