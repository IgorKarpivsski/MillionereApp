-- Guests created by the guest-signup function are flagged as guests;
-- the per-IP throttle works; clients cannot touch either.
begin;

do $$
declare
  g uuid;
  r uuid;
begin
  insert into auth.users (is_anonymous, raw_app_meta_data)
  values (false, '{"guest": true}') returning id into g;
  insert into auth.users (is_anonymous, raw_app_meta_data)
  values (false, '{}') returning id into r;

  perform test.assert((select is_guest from public.profiles where id = g), 'function-made guest is a guest');
  perform test.assert(not (select is_guest from public.profiles where id = r), 'regular user is not a guest');
  perform test.assert(exists (select 1 from public.wallets where user_id = g), 'guest gets a wallet');

  for i in 1..3 loop
    perform test.assert(public.guest_signup_allowed('ip-a', 3), 'under the cap is allowed');
  end loop;
  perform test.assert(not public.guest_signup_allowed('ip-a', 3), 'over the cap is refused');
  perform test.assert(public.guest_signup_allowed('ip-b', 3), 'other IPs are independent');
end $$;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-000000000001","role":"authenticated"}', true);
do $$
begin
  perform test.assert_raises($q$select public.guest_signup_allowed('x', 100)$q$,
    'permission denied', 'clients cannot call the throttle');
  perform test.assert_raises($q$select count(*) from public.guest_signups$q$,
    'permission denied', 'clients cannot read signup log');
end $$;

rollback;
