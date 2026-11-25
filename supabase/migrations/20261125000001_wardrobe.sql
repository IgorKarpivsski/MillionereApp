-- 0.3.0: "הארון של העצלן" — a full-body sloth dressed with 105 items in 7 slots (replaces the treehouse).
-- Owned items live in user_cosmetics ('w_*'); what the sloth wears is profiles.sloth_outfit {slot: item}.
-- Prices are in app_config 'wardrobe' so they can be tuned without a release.

alter table public.profiles add column if not exists sloth_outfit jsonb not null default '{"glasses":"w_glasses_classic"}'::jsonb;

insert into public.app_config (key, value) values ('wardrobe', $cfg${"items": [{"id": "w_hat_cap_red", "cat": "hat", "price": 400, "currency": "coins"}, {"id": "w_hat_crown", "cat": "hat", "price": 150, "currency": "gems"}, {"id": "w_hat_wizard", "cat": "hat", "price": 400, "currency": "coins"}, {"id": "w_hat_beanie", "cat": "hat", "price": 700, "currency": "coins"}, {"id": "w_hat_cowboy", "cat": "hat", "price": 700, "currency": "coins"}, {"id": "w_hat_pirate", "cat": "hat", "price": 1100, "currency": "coins"}, {"id": "w_hat_chef", "cat": "hat", "price": 1100, "currency": "coins"}, {"id": "w_hat_party", "cat": "hat", "price": 1600, "currency": "coins"}, {"id": "w_hat_tophat", "cat": "hat", "price": 1600, "currency": "coins"}, {"id": "w_hat_flowers", "cat": "hat", "price": 2400, "currency": "coins"}, {"id": "w_hat_viking", "cat": "hat", "price": 80, "currency": "gems"}, {"id": "w_hat_bucket", "cat": "hat", "price": 2400, "currency": "coins"}, {"id": "w_hat_grad", "cat": "hat", "price": 3300, "currency": "coins"}, {"id": "w_hat_headphones", "cat": "hat", "price": 3300, "currency": "coins"}, {"id": "w_hat_bunny", "cat": "hat", "price": 4500, "currency": "coins"}, {"id": "w_glasses_classic", "cat": "glasses", "price": 0, "currency": "coins"}, {"id": "w_glasses_aviator", "cat": "glasses", "price": 60, "currency": "gems"}, {"id": "w_glasses_hearts", "cat": "glasses", "price": 300, "currency": "coins"}, {"id": "w_glasses_stars", "cat": "glasses", "price": 0, "currency": "coins", "streak": 7}, {"id": "w_glasses_3d", "cat": "glasses", "price": 300, "currency": "coins"}, {"id": "w_glasses_swim", "cat": "glasses", "price": 550, "currency": "coins"}, {"id": "w_glasses_ski", "cat": "glasses", "price": 550, "currency": "coins"}, {"id": "w_glasses_monocle", "cat": "glasses", "price": 900, "currency": "coins"}, {"id": "w_glasses_cateye", "cat": "glasses", "price": 900, "currency": "coins"}, {"id": "w_glasses_rainbow", "cat": "glasses", "price": 1300, "currency": "coins"}, {"id": "w_glasses_shutter", "cat": "glasses", "price": 1300, "currency": "coins"}, {"id": "w_glasses_visor", "cat": "glasses", "price": 80, "currency": "gems"}, {"id": "w_glasses_pixel", "cat": "glasses", "price": 1900, "currency": "coins"}, {"id": "w_glasses_roundgold", "cat": "glasses", "price": 1900, "currency": "coins"}, {"id": "w_glasses_sport", "cat": "glasses", "price": 2650, "currency": "coins"}, {"id": "w_earrings_hoops", "cat": "earrings", "price": 50, "currency": "gems"}, {"id": "w_earrings_pearls", "cat": "earrings", "price": 250, "currency": "coins"}, {"id": "w_earrings_stars", "cat": "earrings", "price": 250, "currency": "coins"}, {"id": "w_earrings_hearts", "cat": "earrings", "price": 400, "currency": "coins"}, {"id": "w_earrings_bolt", "cat": "earrings", "price": 400, "currency": "coins"}, {"id": "w_earrings_diamonds", "cat": "earrings", "price": 80, "currency": "gems"}, {"id": "w_earrings_cherries", "cat": "earrings", "price": 650, "currency": "coins"}, {"id": "w_earrings_moons", "cat": "earrings", "price": 650, "currency": "coins"}, {"id": "w_earrings_rainbow", "cat": "earrings", "price": 950, "currency": "coins"}, {"id": "w_earrings_feathers", "cat": "earrings", "price": 950, "currency": "coins"}, {"id": "w_earrings_notes", "cat": "earrings", "price": 1450, "currency": "coins"}, {"id": "w_earrings_strawberry", "cat": "earrings", "price": 1450, "currency": "coins"}, {"id": "w_earrings_flowers", "cat": "earrings", "price": 2000, "currency": "coins"}, {"id": "w_earrings_drops", "cat": "earrings", "price": 2000, "currency": "coins"}, {"id": "w_earrings_balls", "cat": "earrings", "price": 2700, "currency": "coins"}, {"id": "w_bracelet_beads", "cat": "bracelet", "price": 250, "currency": "coins"}, {"id": "w_bracelet_bangles", "cat": "bracelet", "price": 250, "currency": "coins"}, {"id": "w_bracelet_smartwatch", "cat": "bracelet", "price": 400, "currency": "coins"}, {"id": "w_bracelet_friendship", "cat": "bracelet", "price": 400, "currency": "coins"}, {"id": "w_bracelet_diamond", "cat": "bracelet", "price": 100, "currency": "gems"}, {"id": "w_bracelet_sweat", "cat": "bracelet", "price": 650, "currency": "coins"}, {"id": "w_bracelet_silver", "cat": "bracelet", "price": 650, "currency": "coins"}, {"id": "w_bracelet_charms", "cat": "bracelet", "price": 950, "currency": "coins"}, {"id": "w_bracelet_neon", "cat": "bracelet", "price": 950, "currency": "coins"}, {"id": "w_bracelet_shells", "cat": "bracelet", "price": 1450, "currency": "coins"}, {"id": "w_bracelet_rope", "cat": "bracelet", "price": 1450, "currency": "coins"}, {"id": "w_bracelet_wood", "cat": "bracelet", "price": 2000, "currency": "coins"}, {"id": "w_bracelet_goldwatch", "cat": "bracelet", "price": 80, "currency": "gems"}, {"id": "w_bracelet_flowers", "cat": "bracelet", "price": 2000, "currency": "coins"}, {"id": "w_bracelet_pearl", "cat": "bracelet", "price": 2700, "currency": "coins"}, {"id": "w_necklace_medal", "cat": "necklace", "price": 300, "currency": "coins"}, {"id": "w_necklace_chain", "cat": "necklace", "price": 70, "currency": "gems"}, {"id": "w_necklace_pearls", "cat": "necklace", "price": 300, "currency": "coins"}, {"id": "w_necklace_sharktooth", "cat": "necklace", "price": 550, "currency": "coins"}, {"id": "w_necklace_diamond", "cat": "necklace", "price": 100, "currency": "gems"}, {"id": "w_necklace_locket", "cat": "necklace", "price": 550, "currency": "coins"}, {"id": "w_necklace_lei", "cat": "necklace", "price": 900, "currency": "coins"}, {"id": "w_necklace_bowtie", "cat": "necklace", "price": 900, "currency": "coins"}, {"id": "w_necklace_tie", "cat": "necklace", "price": 1300, "currency": "coins"}, {"id": "w_necklace_scarf", "cat": "necklace", "price": 1300, "currency": "coins"}, {"id": "w_necklace_whistle", "cat": "necklace", "price": 1900, "currency": "coins"}, {"id": "w_necklace_star", "cat": "necklace", "price": 0, "currency": "coins", "streak": 14}, {"id": "w_necklace_bandana", "cat": "necklace", "price": 1900, "currency": "coins"}, {"id": "w_necklace_crystal", "cat": "necklace", "price": 2650, "currency": "coins"}, {"id": "w_necklace_bulb", "cat": "necklace", "price": 2650, "currency": "coins"}, {"id": "w_outfit_hoodie", "cat": "outfit", "price": 600, "currency": "coins"}, {"id": "w_outfit_tux", "cat": "outfit", "price": 600, "currency": "coins"}, {"id": "w_outfit_hero", "cat": "outfit", "price": 0, "currency": "coins", "streak": 30}, {"id": "w_outfit_jersey", "cat": "outfit", "price": 1050, "currency": "coins"}, {"id": "w_outfit_stardress", "cat": "outfit", "price": 1050, "currency": "coins"}, {"id": "w_outfit_space", "cat": "outfit", "price": 100, "currency": "gems"}, {"id": "w_outfit_doctor", "cat": "outfit", "price": 1650, "currency": "coins"}, {"id": "w_outfit_chefcoat", "cat": "outfit", "price": 1650, "currency": "coins"}, {"id": "w_outfit_pirate", "cat": "outfit", "price": 2400, "currency": "coins"}, {"id": "w_outfit_robe", "cat": "outfit", "price": 2400, "currency": "coins"}, {"id": "w_outfit_hawaii", "cat": "outfit", "price": 3600, "currency": "coins"}, {"id": "w_outfit_puffer", "cat": "outfit", "price": 3600, "currency": "coins"}, {"id": "w_outfit_overalls", "cat": "outfit", "price": 4950, "currency": "coins"}, {"id": "w_outfit_armor", "cat": "outfit", "price": 150, "currency": "gems"}, {"id": "w_outfit_gown", "cat": "outfit", "price": 120, "currency": "gems"}, {"id": "w_shoes_sneakers", "cat": "shoes", "price": 400, "currency": "coins"}, {"id": "w_shoes_rainboots", "cat": "shoes", "price": 400, "currency": "coins"}, {"id": "w_shoes_flipflops", "cat": "shoes", "price": 700, "currency": "coins"}, {"id": "w_shoes_cowboy", "cat": "shoes", "price": 700, "currency": "coins"}, {"id": "w_shoes_ballet", "cat": "shoes", "price": 1100, "currency": "coins"}, {"id": "w_shoes_cleats", "cat": "shoes", "price": 1100, "currency": "coins"}, {"id": "w_shoes_space", "cat": "shoes", "price": 1600, "currency": "coins"}, {"id": "w_shoes_skates", "cat": "shoes", "price": 1600, "currency": "coins"}, {"id": "w_shoes_slippers", "cat": "shoes", "price": 2400, "currency": "coins"}, {"id": "w_shoes_curly", "cat": "shoes", "price": 2400, "currency": "coins"}, {"id": "w_shoes_gold", "cat": "shoes", "price": 100, "currency": "gems"}, {"id": "w_shoes_hiking", "cat": "shoes", "price": 3300, "currency": "coins"}, {"id": "w_shoes_lightup", "cat": "shoes", "price": 0, "currency": "coins", "streak": 21}, {"id": "w_shoes_clown", "cat": "shoes", "price": 3300, "currency": "coins"}, {"id": "w_shoes_iceskates", "cat": "shoes", "price": 4500, "currency": "coins"}], "starter": ["w_glasses_classic"], "slots": ["outfit", "shoes", "necklace", "bracelet", "earrings", "glasses", "hat"]}$cfg$::jsonb)
on conflict (key) do update set value = excluded.value;

create or replace function public.wardrobe_state_of(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'items', (select value -> 'items' from public.app_config where key = 'wardrobe'),
    'owned', coalesce((select value -> 'starter' from public.app_config where key = 'wardrobe'), '[]'::jsonb)
             || coalesce((select jsonb_agg(item order by item) from public.user_cosmetics
                           where user_id = p_user and item like 'w\_%'), '[]'::jsonb),
    'outfit', coalesce((select sloth_outfit from public.profiles where id = p_user), '{}'::jsonb))
$$;
revoke all on function public.wardrobe_state_of(uuid) from public, anon, authenticated;

create or replace function public.wardrobe_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.wardrobe_state_of(public.require_user())
$$;
revoke all on function public.wardrobe_state() from public, anon;
grant execute on function public.wardrobe_state() to authenticated;

/** Buys one item (once) and puts it on right away. */
create or replace function public.wardrobe_buy(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_row jsonb;
begin
  perform public.check_rate_limit(v_uid, 'wardrobe_buy', 30, 60);
  select x into v_row from jsonb_array_elements((select value -> 'items' from public.app_config where key = 'wardrobe')) x
   where x ->> 'id' = p_item;
  if v_row is null or (v_row ->> 'price')::bigint <= 0 then
    raise exception 'invalid_input: item' using errcode = '22023';
  end if;
  perform 1 from public.profiles where id = v_uid for update;
  if exists (select 1 from public.user_cosmetics where user_id = v_uid and item = p_item) then
    raise exception 'already_owned' using errcode = 'P0001';
  end if;
  perform public.ledger_apply(v_uid, (v_row ->> 'currency')::public.currency_code, -((v_row ->> 'price')::bigint),
                              'wardrobe', 'cosmetic', p_item, 'wardrobe:' || p_item);
  insert into public.user_cosmetics (user_id, item, source) values (v_uid, p_item, 'wardrobe');
  update public.profiles set sloth_outfit = coalesce(sloth_outfit, '{}'::jsonb) || jsonb_build_object(v_row ->> 'cat', p_item)
   where id = v_uid;
  return public.wardrobe_state_of(v_uid) || jsonb_build_object('bought', p_item);
end $$;
revoke all on function public.wardrobe_buy(text) from public, anon;
grant execute on function public.wardrobe_buy(text) to authenticated;

/** Puts on an owned item in its slot, or empties a slot (p_item null). */
create or replace function public.wardrobe_wear(p_slot text, p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_cfg jsonb := (select value from public.app_config where key = 'wardrobe');
begin
  if not (v_cfg -> 'slots') ? p_slot then
    raise exception 'invalid_input: slot' using errcode = '22023';
  end if;
  if p_item is null then
    update public.profiles set sloth_outfit = coalesce(sloth_outfit, '{}'::jsonb) - p_slot where id = v_uid;
  else
    if not exists (select 1 from jsonb_array_elements(v_cfg -> 'items') x where x ->> 'id' = p_item and x ->> 'cat' = p_slot)
       or not (exists (select 1 from public.user_cosmetics where user_id = v_uid and item = p_item)
               or (v_cfg -> 'starter') ? p_item) then
      raise exception 'invalid_input: item' using errcode = '22023';
    end if;
    update public.profiles set sloth_outfit = coalesce(sloth_outfit, '{}'::jsonb) || jsonb_build_object(p_slot, p_item)
     where id = v_uid;
  end if;
  return public.wardrobe_state_of(v_uid);
end $$;
revoke all on function public.wardrobe_wear(text, text) from public, anon;
grant execute on function public.wardrobe_wear(text, text) to authenticated;

-- The treehouse is gone: room items are refunded in coins; hats move to the wardrobe (same hat, new art).
do $$
declare r record; v_price bigint;
begin
  for r in select c.user_id, c.item from public.user_cosmetics c where c.item like 'home\_%' loop
    select (x ->> 'price')::bigint into v_price from public.app_config a, jsonb_array_elements(a.value -> 'items') x
     where a.key = 'home' and x ->> 'id' = r.item;
    if coalesce(v_price, 0) > 0 then
      perform public.ledger_apply(r.user_id, 'coins', v_price, 'home_refund', 'cosmetic', r.item, 'home_refund:' || r.item);
    end if;
  end loop;
  insert into public.user_cosmetics (user_id, item, source)
  select c.user_id, m.new_id, 'home_hat'
    from public.user_cosmetics c
    join (values ('hat_party','w_hat_party'),('hat_cap','w_hat_cap_red'),('hat_flowers','w_hat_flowers'),('hat_chef','w_hat_chef'),
                 ('hat_grad','w_hat_grad'),('hat_pirate','w_hat_pirate'),('hat_wizard','w_hat_wizard'),('hat_crown','w_hat_crown')) m(old_id, new_id)
      on m.old_id = c.item
  on conflict do nothing;
  update public.profiles p set sloth_outfit = coalesce(p.sloth_outfit, '{}'::jsonb) || jsonb_build_object('hat', m.new_id)
    from (values ('hat_party','w_hat_party'),('hat_cap','w_hat_cap_red'),('hat_flowers','w_hat_flowers'),('hat_chef','w_hat_chef'),
                 ('hat_grad','w_hat_grad'),('hat_pirate','w_hat_pirate'),('hat_wizard','w_hat_wizard'),('hat_crown','w_hat_crown')) m(old_id, new_id)
   where p.sloth_hat = m.old_id;
end $$;
