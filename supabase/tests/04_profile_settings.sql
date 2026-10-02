-- Profile and settings RPC validation + rate limiting.
begin;

create temp table ids as select test.new_user() as a, test.new_user() as b;
grant select on ids to authenticated;

set local role authenticated;
select test.login((select b from ids));
select public.update_my_profile(p_username => 'גולר_10');

select test.login((select a from ids));

do $$
declare
  s jsonb;
begin
  s := public.update_my_profile(p_username => 'מלך_השערים', p_avatar_id => 'avatar_07',
                                p_fav_leagues => array['israeli', 'spain']);
  perform test.assert(s -> 'profile' ->> 'username' = 'מלך_השערים', 'Hebrew username accepted');
  perform test.assert(s -> 'profile' ->> 'avatar_id' = 'avatar_07', 'avatar updated');
  perform test.assert(jsonb_array_length(s -> 'profile' -> 'fav_leagues') = 2, 'leagues saved');

  perform test.assert_raises($q$select public.update_my_profile(p_username => 'ab')$q$,
    'invalid_input', 'too-short username');
  perform test.assert_raises($q$select public.update_my_profile(p_username => 'bad name!')$q$,
    'invalid_input', 'illegal characters');
  perform test.assert_raises($q$select public.update_my_profile(p_username => 'גולר_10')$q$,
    'username_taken', 'username unique');
  perform test.assert_raises($q$select public.update_my_profile(p_avatar_id => '../etc')$q$,
    'invalid_input', 'avatar id validated');

  s := public.update_my_settings('{"sound": false, "reduced_motion": true}');
  perform test.assert(not (s -> 'settings' ->> 'sound')::boolean, 'sound off');
  perform test.assert((s -> 'settings' ->> 'reduced_motion')::boolean, 'reduced motion on');
  perform test.assert((s -> 'settings' ->> 'music')::boolean, 'untouched settings preserved');

  perform test.assert_raises($q$select public.update_my_settings('{"coins": 5}')$q$,
    'invalid_input', 'unknown setting key rejected');
  perform test.assert_raises($q$select public.update_my_settings('{"sound": "loud"}')$q$,
    'invalid_input', 'bad value rejected');
  perform test.assert_raises($q$select public.update_my_settings('{"locale": "xx"}')$q$,
    'invalid_input', 'unknown locale rejected');

  -- Rate limit: 20 profile updates per hour (earlier attempts count too).
  declare
    hit boolean := false;
  begin
    for n in 1..30 loop
      perform public.update_my_profile(p_avatar_id => 'avatar_02');
    end loop;
    raise exception 'no rate limit was hit after 30 updates';
  exception when others then
    hit := position('rate_limited' in sqlerrm) > 0;
    perform test.assert(hit, 'profile updates are rate limited (got: ' || sqlerrm || ')');
  end;
  perform test.assert(
    (select count(*) from public.rate_limits) = 0, 'rate_limits still hidden from client');
end $$;

rollback;
