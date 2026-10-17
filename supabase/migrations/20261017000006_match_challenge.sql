-- Challenge a friend straight from their profile: a new friend match plus an
-- invite that pops up on their phone (same invite flow as the revenge round).
create function public.match_challenge(p_user uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_new jsonb;
begin
  perform public.check_rate_limit(v_uid, 'match_challenge', 20, 3600);
  if p_user is null or p_user = v_uid or not public.are_friends(v_uid, p_user) then
    raise exception 'invalid_input: not friends' using errcode = '22023';
  end if;
  v_new := public.match_create();
  insert into public.match_invites (from_user, to_user, room_id) values (v_uid, p_user, (v_new ->> 'room_id')::uuid);
  return v_new;
end $$;
revoke all on function public.match_challenge(uuid) from public, anon, authenticated;
grant execute on function public.match_challenge(uuid) to authenticated;
