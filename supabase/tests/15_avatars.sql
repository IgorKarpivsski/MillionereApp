-- Custom avatars: format + slot ranges validated, premium accessories need the cosmetic.
begin;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); s jsonb;
begin
  perform test.login(a);
  s := public.update_my_profile(p_avatar_id => 'av1_1324531a2b30');
  perform test.assert(s -> 'profile' ->> 'avatar_id' = 'av1_1324531a2b30', 'custom avatar saved');
  s := public.update_my_profile(p_avatar_id => 'avatar_03');
  perform test.assert(s -> 'profile' ->> 'avatar_id' = 'avatar_03', 'legacy avatar still allowed');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_c324531a2b30')$q$, 'invalid_input', 'species out of range');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_13245z1a2b30')$q$, 'invalid_input', 'hair out of range');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_1324531a2b3')$q$, 'invalid_input', 'too short');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_1324531a2b39')$q$, 'invalid_input', 'crown needs cosmetic');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => 'av1_1324531a2b38')$q$, 'invalid_input', 'shades need cosmetic');
  perform test.assert_raises($q$select public.avatar_is_allowed(gen_random_uuid(), 'av1_000000000000')$q$, 'permission denied', 'helper not callable by clients');
end $$;

reset role;
insert into public.user_cosmetics (user_id, item, source) select a, 'avatar_crown', 'test' from ids;
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); s jsonb;
begin
  perform test.login(a);
  s := public.update_my_profile(p_avatar_id => 'av1_1324531a2b39');
  perform test.assert(s -> 'profile' ->> 'avatar_id' = 'av1_1324531a2b39', 'crown allowed once owned');
end $$;
rollback;
