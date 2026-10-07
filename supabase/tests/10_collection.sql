-- Album: starter pack, opening, odds guarantees, dust, crafting, album reward.
begin;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;
create function test.give_all(p_user uuid, p_album text) returns void language sql security definer set search_path = '' as $$
  insert into public.user_collectibles (user_id, item_id, count) select p_user, id, 1 from public.collectibles where album = p_album
  on conflict (user_id, item_id) do update set count = 1 $$;
create function test.pity(p_user uuid, n int) returns void language sql security definer set search_path = '' as $$
  update public.user_pack_stats set opens_since_legendary = n where user_id = p_user $$;
grant execute on function test.give_all(uuid, text), test.pity(uuid, int) to authenticated;
select public.ledger_apply((select a from ids), 'coins', 20000, 'test_seed', null, null, 'seed');
select public.ledger_apply((select a from ids), 'dust', 100, 'test_seed', null, null, 'seed_dust');

set local role authenticated;
do $$
declare
  a uuid := (select ids.a from ids);
  st jsonb; r jsonb; r2 jsonb; req uuid := gen_random_uuid(); i int; missing text;
begin
  perform test.login(a);
  st := public.collection_state();
  perform test.assert(jsonb_array_length(st -> 'albums') = 13 and jsonb_array_length(st -> 'items') = 156, 'catalogue');
  perform test.assert((st -> 'tokens' ->> 'silver')::int = 1, 'starter silver pack');

  r := public.open_pack('silver', 'token', req);
  perform test.assert(jsonb_array_length(r -> 'items') = 4, 'silver gives 4');
  r2 := public.open_pack('silver', 'token', req);
  perform test.assert(r2 = r, 'same request id returns the same result (no double open)');
  perform test.assert_raises(format($q$select public.open_pack('silver', 'token', %L)$q$, gen_random_uuid()), 'insufficient_funds', 'no tokens left');

  r := public.open_pack('gold', 'coins', gen_random_uuid());
  perform test.assert((select max(array_position(array['common','uncommon','rare','epic','legendary','iconic'], x ->> 'rarity')) from jsonb_array_elements(r -> 'items') x) >= 3, 'gold guarantees a rare');
  perform test.assert((r -> 'wallet' ->> 'coins')::int = 16000, 'gold costs 4000 coins');
  perform test.assert_raises($q$select public.open_pack('legendary', 'coins', gen_random_uuid())$q$, 'invalid_input', 'legendary packs are not for sale');
  perform test.assert_raises($q$select public.open_pack('epic', 'gems', gen_random_uuid())$q$, 'insufficient_funds', 'no gems');

  perform test.pity(a, 29);
  r := public.open_pack('bronze', 'coins', gen_random_uuid());
  perform test.assert(exists (select 1 from jsonb_array_elements(r -> 'items') x where x ->> 'rarity' = 'legendary'), 'pity gives a legendary on the 30th open');

  -- duplicates → dust
  for i in 1 .. 8 loop r := public.open_pack('bronze', 'coins', gen_random_uuid()); end loop;
  perform test.assert((select dust from public.wallets) > 100, 'duplicates made dust');

  -- craft a missing common
  select c.id into missing from public.collectibles c where c.rarity = 'common'
    and not exists (select 1 from public.user_collectibles u where u.item_id = c.id and u.count > 0) limit 1;
  r := public.craft_item(missing);
  perform test.assert((select count from public.user_collectibles where item_id = missing) = 1, 'crafted');
  perform test.assert_raises(format('select public.craft_item(%L)', missing), 'already owned', 'cannot craft owned');

  perform test.assert_raises($q$select public.claim_album('seventies')$q$, 'incomplete', 'album must be complete');
  perform test.give_all(a, 'seventies');
  r := public.claim_album('seventies');
  perform test.assert((select gems from public.wallets) = 15, 'album reward gems');
  perform test.assert((public.collection_state() -> 'tokens' ->> 'gold')::int = 1, 'album reward pack');
  perform test.assert_raises($q$select public.claim_album('seventies')$q$, 'already claimed', 'once');

  perform test.assert_raises($q$update public.user_pack_tokens set count = 99$q$, 'permission denied', 'cannot edit tokens');
end $$;

-- Runs grant packs.
reset role;
do $$
declare u uuid := test.new_user(); r uuid;
begin
  insert into public.quiz_runs (user_id, mode, day, status) values (u, 'daily', current_date, 'active') returning id into r;
  update public.quiz_runs set status = 'won' where id = r;
  perform test.assert((select count from public.user_pack_tokens where user_id = u and pack = 'bronze') = 1, 'daily gives bronze');
end $$;
rollback;

-- Glowing copies: rolled when counts go up, never more than the copies you own.
begin;
update public.app_config set value = '1'::jsonb where key = 'packs.glow_chance';
create temp table g as select test.new_user() as a;
insert into public.user_collectibles (user_id, item_id, count) select a, (select id from public.collectibles order by id limit 1), 2 from g;
do $$
begin
  perform test.assert((select glow from public.user_collectibles where user_id = (select a from g)) = 2, 'chance 1: both copies glow');
  update public.user_collectibles set count = 1 where user_id = (select a from g);
  perform test.assert((select glow from public.user_collectibles where user_id = (select a from g)) = 1, 'glow capped by count');
end $$;
update public.app_config set value = '0'::jsonb where key = 'packs.glow_chance';
do $$
begin
  update public.user_collectibles set count = 5 where user_id = (select a from g);
  perform test.assert((select glow from public.user_collectibles where user_id = (select a from g)) = 1, 'chance 0: no new glow');
end $$;
grant select on g to authenticated;
set local role authenticated;
do $$
begin
  perform test.login((select a from g));
  perform test.assert(exists (select 1 from jsonb_array_elements(public.collection_state() -> 'items') i where (i ->> 'glow')::int = 1), 'glow in collection_state');
end $$;
rollback;
