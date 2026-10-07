-- Owner tools: admin claim via secret code, bounded grants (idempotent), promo codes.
begin;
update public.app_config set value = to_jsonb(encode(extensions.digest('S3CRET-CODE-123', 'sha256'), 'hex')) where key = 'ops.admin_code_sha256';
create temp table ids as select test.new_user() as boss, test.new_user() as p1, test.new_user() as p2, test.new_user() as p3, test.new_user() as p4;
grant select on ids to authenticated;
update public.profiles set username = 'טיקטוקר_1' where id = (select p1 from ids);

set local role authenticated;
do $$
declare boss uuid := (select ids.boss from ids); p1 uuid := (select ids.p1 from ids); p2 uuid := (select ids.p2 from ids);
  r jsonb; req uuid := gen_random_uuid(); g0 bigint;
begin
  -- Not admin yet: every admin RPC refuses.
  perform test.login(boss);
  perform test.assert((public.admin_status() ->> 'admin')::boolean = false, 'not admin by default');
  perform test.assert_raises($q$select public.admin_find_players('טיק')$q$, 'not_admin', 'find needs admin');
  perform test.assert_raises(format('select public.admin_grant(%L, %L, %L, %L)', p1, '{"kind":"gems","amount":10}', 'x', gen_random_uuid()), 'not_admin', 'grant needs admin');
  perform test.assert_raises($q$select public.admin_claim('wrong')$q$, 'not_authorized', 'wrong code refused');

  r := public.admin_claim('S3CRET-CODE-123');
  perform test.assert((public.admin_status() ->> 'admin')::boolean, 'admin after claim');

  r := public.admin_find_players('טיקטוקר');
  perform test.assert(jsonb_array_length(r) = 1 and r -> 0 ->> 'id' = p1::text, 'find by name');

  r := public.admin_grant(p1, '{"kind":"gems","amount":100}', 'פרס לייב', req);
  r := public.admin_grant(p1, '{"kind":"gems","amount":100}', 'פרס לייב', req);  -- retry, same request
  perform test.assert_raises(format('select public.admin_grant(%L, %L, %L, %L)', p1, '{"kind":"gems","amount":999999}', 'x', gen_random_uuid()), 'invalid_input', 'amount capped');
  perform test.assert_raises(format('select public.admin_grant(%L, %L, %L, %L)', p1, '{"kind":"pack","pack":"diamond","amount":1}', 'x', gen_random_uuid()), 'invalid_input', 'unknown pack');
  perform public.admin_grant(p1, '{"kind":"pack","pack":"gold","amount":2}', null, gen_random_uuid());

  r := public.admin_create_promo('live100', '{"kind":"gems","amount":100}', 2, 2);
  perform test.assert(r ->> 'code' = 'LIVE100', 'code upper-cased');
  perform test.assert_raises($q$select public.admin_create_promo('LIVE100', '{"kind":"coins","amount":5}', 1, 1)$q$, 'code_taken', 'unique codes');

  -- Players redeem.
  perform test.login(p1);
  perform test.assert((select w.gems from public.wallets w) = 100, 'granted gems arrived');
  perform test.assert((select count(*) from public.user_pack_tokens) >= 1, 'granted packs arrived');
  perform test.assert_raises($q$select public.admin_recent()$q$, 'not_admin', 'players cannot see admin data');
  r := public.redeem_code(' live100 ');
  perform test.assert((select w.gems from public.wallets w) = 200, 'promo paid');
  perform test.assert_raises($q$select public.redeem_code('LIVE100')$q$, 'code_already_redeemed', 'once per player');
  perform test.assert_raises($q$select public.redeem_code('NOPE99')$q$, 'code_invalid', 'unknown code');

  perform test.login(p2);
  perform public.redeem_code('LIVE100');
  perform test.login((select ids.p3 from ids));
  perform test.assert_raises($q$select public.redeem_code('LIVE100')$q$, 'code_used_up', 'max uses enforced');

  perform test.login(boss);
  r := public.admin_recent();
  perform test.assert((r -> 'promos' -> 0 ->> 'uses')::int = 2 and jsonb_array_length(r -> 'grants') = 2, 'recent shows promos and grants');
end $$;
reset role;
do $$
begin
  perform test.assert((select count(*) from public.admin_grants) = 2, 'one grant per request id (2 distinct requests)');
  perform test.assert((select count(*) from public.admin_audit_log where action = 'grant') = 2, 'grants audited');
end $$;
-- Cap: at most 3 admins.
do $$
begin
  insert into public.admin_users (user_id) select test.new_user() from generate_series(1, 2);
end $$;
set local role authenticated;
do $$
begin
  perform test.login((select ids.p4 from ids));
  perform test.assert_raises($q$select public.admin_claim('S3CRET-CODE-123')$q$, 'too_many_admins', 'admin cap');
end $$;
rollback;
