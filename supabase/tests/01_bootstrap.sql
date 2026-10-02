-- New users get a profile, settings and an empty wallet; guests are flagged.
begin;

do $$
declare
  g uuid := test.new_user(true);
  f uuid := test.new_user(false);
  p public.profiles;
begin
  select * into p from public.profiles where id = g;
  perform test.assert(p.id is not null, 'guest profile created');
  perform test.assert(p.is_guest, 'guest flagged as guest');
  perform test.assert(p.username ~ '^שחקן', 'default Hebrew username');
  perform test.assert(p.level = 1 and p.xp = 0, 'starts at level 1, 0 xp');
  perform test.assert(not (select is_guest from public.profiles where id = f), 'full account not a guest');
  perform test.assert(exists (select 1 from public.user_settings where user_id = g and locale = 'he'),
    'settings created with Hebrew locale');
  perform test.assert(
    (select coins + gems + dust from public.wallets where user_id = g) = 0, 'empty wallet');

  -- Linking a guest keeps the same id and flips the flag.
  update auth.users set is_anonymous = false where id = g;
  perform test.assert(not (select is_guest from public.profiles where id = g),
    'linking a guest upgrades the profile in place');

  -- Deleting the auth user removes everything.
  delete from auth.users where id = g;
  perform test.assert(not exists (select 1 from public.profiles where id = g), 'profile cascade');
  perform test.assert(not exists (select 1 from public.wallets where user_id = g), 'wallet cascade');
end $$;

rollback;
