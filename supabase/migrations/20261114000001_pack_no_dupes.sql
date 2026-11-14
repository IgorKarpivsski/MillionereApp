-- 0.2.1: one pack never holds the same sticker twice. Each pick skips the stickers already picked in this pack;
-- only if a rarity has run out (not with today's catalogue) does it fall back to a repeat of that rarity.
do $$
declare
  d text := pg_get_functiondef('public.open_pack(text,text,uuid)'::regprocedure);
  a1 text := 'v_items   jsonb := ''[]''::jsonb;';
  b1 text := 'v_items   jsonb := ''[]''::jsonb;
  v_picked  text[] := ''{}'';';
  a2 text := 'select id into v_item from public.collectibles where rarity = v_r and active order by random() limit 1;';
  b2 text := 'select id into v_item from public.collectibles where rarity = v_r and active and not (id = any(v_picked)) order by random() limit 1;
    if v_item is null then
      select id into v_item from public.collectibles where rarity = v_r and active order by random() limit 1;
    end if;
    v_picked := v_picked || v_item;';
begin
  if position(a1 in d) = 0 or position(a2 in d) = 0 then
    raise exception 'open_pack patch failed';
  end if;
  execute replace(replace(d, a1, b1), a2, b2);
end $$;
