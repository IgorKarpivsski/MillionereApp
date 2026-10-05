-- collection_state now also returns albums[].kind and items[].kind (players / objects).
create or replace function public.collection_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  return jsonb_build_object(
    'albums', (select coalesce(jsonb_agg(jsonb_build_object(
        'slug', a.slug, 'title', a.title, 'blurb', a.blurb, 'kind', a.kind,
        'total', (select count(*) from public.collectibles c where c.album = a.slug),
        'owned', (select count(*) from public.collectibles c join public.user_collectibles u on u.item_id = c.id and u.user_id = v_uid and u.count > 0 where c.album = a.slug),
        'claimed', exists (select 1 from public.album_claims x where x.user_id = v_uid and x.album = a.slug)) order by a.sort), '[]'::jsonb)
      from public.albums a),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'album', c.album, 'number', c.number, 'rarity', c.rarity, 'name', c.name_he, 'position', c.position,
        'era', c.era, 'bio', c.bio_he, 'art_seed', c.art_seed, 'kind', c.kind, 'count', coalesce(u.count, 0)) order by c.album, c.number), '[]'::jsonb)
      from public.collectibles c left join public.user_collectibles u on u.item_id = c.id and u.user_id = v_uid),
    'tokens', (select coalesce(jsonb_object_agg(t.pack, t.count), '{}'::jsonb) from public.user_pack_tokens t where t.user_id = v_uid and t.count > 0),
    'dust', (select dust from public.wallets where user_id = v_uid),
    'pity_left', greatest(0, coalesce((select (value #>> '{}')::int from public.app_config where key = 'packs.pity_opens'), 30)
                  - coalesce((select opens_since_legendary from public.user_pack_stats where user_id = v_uid), 0)),
    'catalog', (select value from public.app_config where key = 'packs.catalog'),
    'craft_cost', (select value from public.app_config where key = 'packs.craft_cost'),
    'paid_blocked_regions', (select value from public.app_config where key = 'packs.paid_blocked_regions'));
end $$;
