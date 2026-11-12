-- 0.2.0: "הבית של העצלן" — a treehouse the player furnishes with coins, and hats for the sloth bought with gems.
-- Owned things live in user_cosmetics (item ids 'home_*' and 'hat_*'); the hat being worn is profiles.sloth_hat.
-- Prices, order and the completion prize are in app_config 'home' so they can be tuned without a release.

alter table public.profiles add column if not exists sloth_hat text;

insert into public.app_config (key, value) values ('home', jsonb_build_object(
  'items', jsonb_build_array(
    jsonb_build_object('id', 'home_lights',    'price', 300,  'currency', 'coins'),
    jsonb_build_object('id', 'home_rug',       'price', 500,  'currency', 'coins'),
    jsonb_build_object('id', 'home_plant',     'price', 800,  'currency', 'coins'),
    jsonb_build_object('id', 'home_lamp',      'price', 1000, 'currency', 'coins'),
    jsonb_build_object('id', 'home_clock',     'price', 1300, 'currency', 'coins'),
    jsonb_build_object('id', 'home_armchair',  'price', 1700, 'currency', 'coins'),
    jsonb_build_object('id', 'home_hammock',   'price', 2200, 'currency', 'coins'),
    jsonb_build_object('id', 'home_tv',        'price', 2800, 'currency', 'coins'),
    jsonb_build_object('id', 'home_bookshelf', 'price', 3500, 'currency', 'coins'),
    jsonb_build_object('id', 'home_telescope', 'price', 4500, 'currency', 'coins'),
    jsonb_build_object('id', 'home_trophies',  'price', 6000, 'currency', 'coins')),
  'hats', jsonb_build_array(
    jsonb_build_object('id', 'hat_party',   'price', 20,  'currency', 'gems'),
    jsonb_build_object('id', 'hat_cap',     'price', 30,  'currency', 'gems'),
    jsonb_build_object('id', 'hat_flowers', 'price', 30,  'currency', 'gems'),
    jsonb_build_object('id', 'hat_chef',    'price', 40,  'currency', 'gems'),
    jsonb_build_object('id', 'hat_grad',    'price', 50,  'currency', 'gems'),
    jsonb_build_object('id', 'hat_pirate',  'price', 60,  'currency', 'gems'),
    jsonb_build_object('id', 'hat_wizard',  'price', 80,  'currency', 'gems'),
    jsonb_build_object('id', 'hat_crown',   'price', 120, 'currency', 'gems')),
  'complete_prize', jsonb_build_array(
    jsonb_build_object('kind', 'gems', 'amount', 50),
    jsonb_build_object('kind', 'pack', 'pack', 'legendary', 'amount', 1))))
on conflict (key) do nothing;

create or replace function public.home_state_of(p_user uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_object(
    'items', (select value -> 'items' from public.app_config where key = 'home'),
    'hats', (select value -> 'hats' from public.app_config where key = 'home'),
    'complete_prize', (select value -> 'complete_prize' from public.app_config where key = 'home'),
    'owned', coalesce((select jsonb_agg(item order by item) from public.user_cosmetics
                        where user_id = p_user and (item like 'home\_%' or item like 'hat\_%')), '[]'::jsonb),
    'hat', (select sloth_hat from public.profiles where id = p_user),
    'completed', exists (select 1 from public.user_cosmetics where user_id = p_user and item = 'done_home_1'))
$$;
revoke all on function public.home_state_of(uuid) from public, anon, authenticated;

create or replace function public.home_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.home_state_of(public.require_user())
$$;
revoke all on function public.home_state() from public, anon;
grant execute on function public.home_state() to authenticated;

/** Buys one room item or hat (once each). A hat is worn right away. Furnishing the whole room pays the prize once. */
create or replace function public.home_buy(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_cfg  jsonb := (select value from public.app_config where key = 'home');
  v_row  jsonb;
  v_done boolean := false;
  r      jsonb;
  i      integer := 0;
begin
  perform public.check_rate_limit(v_uid, 'home_buy', 30, 60);
  select x into v_row from jsonb_array_elements(coalesce(v_cfg -> 'items', '[]') || coalesce(v_cfg -> 'hats', '[]')) x
   where x ->> 'id' = p_item;
  if v_row is null then
    raise exception 'invalid_input: item' using errcode = '22023';
  end if;
  -- one purchase per player at a time, so two taps can't pay twice
  perform 1 from public.profiles where id = v_uid for update;
  if exists (select 1 from public.user_cosmetics where user_id = v_uid and item = p_item) then
    raise exception 'already_owned' using errcode = 'P0001';
  end if;
  perform public.ledger_apply(v_uid, (v_row ->> 'currency')::public.currency_code, -((v_row ->> 'price')::bigint),
                              'home', 'cosmetic', p_item, 'home:' || p_item);
  insert into public.user_cosmetics (user_id, item, source) values (v_uid, p_item, 'home');
  if p_item like 'hat\_%' then
    update public.profiles set sloth_hat = p_item where id = v_uid;
  end if;
  -- the whole room furnished: the prize, once
  if p_item like 'home\_%'
     and not exists (select 1 from jsonb_array_elements(v_cfg -> 'items') x
                      where not exists (select 1 from public.user_cosmetics c where c.user_id = v_uid and c.item = x ->> 'id'))
     and not exists (select 1 from public.user_cosmetics where user_id = v_uid and item = 'done_home_1') then
    -- the marker the state reads
    insert into public.user_cosmetics (user_id, item, source) values (v_uid, 'done_home_1', 'home');
    for r in select x from jsonb_array_elements(coalesce(v_cfg -> 'complete_prize', '[]')) x loop
      perform public.grant_reward(v_uid, r, 'home_complete:1:' || (i + 1));
      i := i + 1;
    end loop;
    v_done := true;
  end if;
  return public.home_state_of(v_uid) || jsonb_build_object('bought', p_item, 'just_completed', v_done);
end $$;
revoke all on function public.home_buy(text) from public, anon;
grant execute on function public.home_buy(text) to authenticated;

/** Puts on a hat the player owns, or takes it off (null). */
create or replace function public.home_wear(p_hat text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  if p_hat is not null and not exists (select 1 from public.user_cosmetics where user_id = v_uid and item = p_hat and item like 'hat\_%') then
    raise exception 'invalid_input: hat' using errcode = '22023';
  end if;
  update public.profiles set sloth_hat = p_hat where id = v_uid;
  return public.home_state_of(v_uid);
end $$;
revoke all on function public.home_wear(text) from public, anon;
grant execute on function public.home_wear(text) to authenticated;
