-- Second reviewers' round: name suggestions, ticket taper, last-sticker discount.
begin;

create temp table ids as select test.new_user() as a, test.new_user() as b;
grant select on ids to authenticated;

do $$
declare
  a uuid := (select a from ids);
  s jsonb;
begin
  perform test.login(a);
  s := public.username_suggestions();
  perform test.assert(jsonb_array_length(s) = 3, 'three suggestions');
  perform test.assert((select count(distinct x) from jsonb_array_elements_text(s) x) = 3, 'suggestions differ');
  perform test.assert((s ->> 0) ~ '^ה[^_]+_ה[^_]+$', 'suggestion has no digits: ' || (s ->> 0));
end $$;

-- ticket taper: free week -> 10 for three days -> 5
do $$
declare
  a uuid := (select a from ids);
  r jsonb;
begin
  update public.profiles set created_at = now() - interval '8 days' where id = a;
  perform test.assert(public.energy_max(a) = 10, 'day 8: ten tickets');
  perform public.energy_spend(a);
  perform test.assert((select tickets from public.user_energy where user_id = a) = 9, 'day 8 starts from ten');
  perform test.login(a);
  r := public.energy_state();
  perform test.assert((r ->> 'max')::int = 10 and r ->> 'taper_until' is not null, 'state shows the taper');
  update public.profiles set created_at = now() - interval '11 days' where id = a;
  perform test.assert(public.energy_max(a) = 5, 'day 11: back to five');
  r := public.energy_state();
  perform test.assert((r ->> 'max')::int = 5 and r ->> 'taper_until' is null, 'taper over');
  update public.profiles set created_at = now() - interval '2 days' where id = a;
  r := public.energy_state();
  perform test.assert((r ->> 'unlimited')::boolean and r ->> 'taper_until' is not null, 'newbie: unlimited, taper ahead');
end $$;

-- the last missing sticker of an album costs half
do $$
declare
  b uuid := (select b from ids);
  v_album text := (select album from public.collectibles where active and rarity = 'common' group by album order by album limit 1);
  v_last text;
  v_other text;
  v_cost int;
  v_before bigint;
begin
  select id into v_last from public.collectibles where album = v_album and active and rarity = 'common' order by number desc limit 1;
  select (value ->> 'common')::int into v_cost from public.app_config where key = 'packs.craft_cost';
  perform public.ledger_apply(b, 'dust', 100000, 'test_seed', null, null, 'seed_dust_b');
  -- two missing: full price
  insert into public.user_collectibles (user_id, item_id, count)
    select b, id, 1 from public.collectibles where album = v_album and active and id <> v_last
      and id <> (select id from public.collectibles where album = v_album and active and id <> v_last and rarity = 'common' order by number limit 1);
  select id into v_other from public.collectibles where album = v_album and active and id <> v_last and rarity = 'common' order by number limit 1;
  perform test.login(b);
  v_before := (select dust from public.wallets where user_id = b);
  perform public.craft_item(v_other);
  perform test.assert(v_before - (select dust from public.wallets where user_id = b) = v_cost, 'full price with two missing');
  v_before := (select dust from public.wallets where user_id = b);
  perform public.craft_item(v_last);
  perform test.assert(v_before - (select dust from public.wallets where user_id = b) = ceil(v_cost * 0.5), 'half price for the last one');
end $$;

rollback;
