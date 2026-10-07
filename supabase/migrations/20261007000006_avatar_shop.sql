-- Avatar shop: extra accessories (slot values a..h) and backgrounds (a..d)
-- bought with coins or gems. Ownership lives in user_cosmetics as
-- avatar_acc_<v> / avatar_bg_<v>; update_my_profile checks it via avatar_is_allowed.

insert into public.app_config (key, value, is_public) values
  ('avatar.shop', '[
     {"item": "avatar_acc_a", "currency": "coins", "price": 1200},
     {"item": "avatar_acc_b", "currency": "coins", "price": 800},
     {"item": "avatar_acc_c", "currency": "coins", "price": 1500},
     {"item": "avatar_acc_d", "currency": "coins", "price": 1000},
     {"item": "avatar_acc_e", "currency": "coins", "price": 2000},
     {"item": "avatar_acc_f", "currency": "gems", "price": 60},
     {"item": "avatar_acc_g", "currency": "coins", "price": 900},
     {"item": "avatar_acc_h", "currency": "coins", "price": 700},
     {"item": "avatar_bg_a", "currency": "coins", "price": 1500},
     {"item": "avatar_bg_b", "currency": "gems", "price": 50},
     {"item": "avatar_bg_c", "currency": "coins", "price": 1800},
     {"item": "avatar_bg_d", "currency": "gems", "price": 40}
   ]'::jsonb, true)
on conflict (key) do nothing;

create or replace function public.avatar_is_allowed(p_user uuid, p_avatar text) returns boolean
language plpgsql stable security definer set search_path = '' as $$
declare
  v_acc text;
  v_bg  text;
  v_need text[] := '{}';
begin
  if p_avatar ~ '^avatar_[0-9]{2}$' then
    return true;
  end if;
  if p_avatar !~ '^av1_[0-9a-z]{12}$' then
    return false;
  end if;
  -- Slot ranges (keep in sync with AVATAR_SLOTS in packages/shared/src/avatar.ts).
  if position(substr(p_avatar, 5, 1) in '0123456789ab') = 0 then return false; end if;   -- species: 12
  if position(substr(p_avatar, 6, 1) in '0123456789') = 0 then return false; end if;     -- skin: 10
  if position(substr(p_avatar, 7, 1) in '0123') = 0 then return false; end if;           -- face: 4
  if position(substr(p_avatar, 8, 1) in '01234567') = 0 then return false; end if;       -- eyes: 8
  if position(substr(p_avatar, 9, 1) in '012345') = 0 then return false; end if;         -- brows: 6
  if position(substr(p_avatar, 10, 1) in '01234567') = 0 then return false; end if;      -- mouth: 8
  if position(substr(p_avatar, 11, 1) in '0123456789abcd') = 0 then return false; end if; -- hair: 14
  if position(substr(p_avatar, 12, 1) in '0123456789ab') = 0 then return false; end if;  -- hair color: 12
  if position(substr(p_avatar, 13, 1) in '012345') = 0 then return false; end if;        -- outfit: 6
  if position(substr(p_avatar, 14, 1) in '0123456789ab') = 0 then return false; end if;  -- outfit color: 12
  v_bg := substr(p_avatar, 15, 1);
  if position(v_bg in '0123456789abcd') = 0 then return false; end if;                   -- background: 14
  v_acc := substr(p_avatar, 16, 1);
  if position(v_acc in '0123456789abcdefgh') = 0 then return false; end if;              -- accessory: 18

  if v_acc = '8' then v_need := v_need || 'avatar_shades'::text;
  elsif v_acc = '9' then v_need := v_need || 'avatar_crown'::text;
  elsif v_acc ~ '[a-h]' then v_need := v_need || ('avatar_acc_' || v_acc);
  end if;
  if v_bg ~ '[a-d]' then v_need := v_need || ('avatar_bg_' || v_bg); end if;

  return not exists (
    select 1 from unnest(v_need) n
     where not exists (select 1 from public.user_cosmetics c where c.user_id = p_user and c.item = n));
end $$;
revoke all on function public.avatar_is_allowed(uuid, text) from public, anon, authenticated;

/** Buys one avatar shop item. Idempotent per item: you can only own it once. */
create or replace function public.avatar_shop_buy(p_item text) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_row  jsonb;
begin
  perform public.check_rate_limit(v_uid, 'avatar_shop_buy', 30, 3600);
  select r into v_row from jsonb_array_elements((select value from public.app_config where key = 'avatar.shop')) r
   where r ->> 'item' = p_item;
  if v_row is null then
    raise exception 'invalid_input: item' using errcode = '22023';
  end if;
  if exists (select 1 from public.user_cosmetics where user_id = v_uid and item = p_item) then
    raise exception 'already_owned' using errcode = 'P0001';
  end if;
  perform public.ledger_apply(v_uid, (v_row ->> 'currency')::public.currency_code, -((v_row ->> 'price')::bigint),
                              'avatar_shop', 'cosmetic', p_item, 'avatar_shop:' || p_item);
  insert into public.user_cosmetics (user_id, item, source) values (v_uid, p_item, 'avatar_shop');
  return jsonb_build_object('item', p_item,
    'owned', (select coalesce(jsonb_agg(item order by item), '[]'::jsonb) from public.user_cosmetics where user_id = v_uid));
end $$;
revoke all on function public.avatar_shop_buy(text) from public, anon;
grant execute on function public.avatar_shop_buy(text) to authenticated;
