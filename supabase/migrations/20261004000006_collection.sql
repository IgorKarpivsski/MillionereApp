-- =============================================================================
-- Migration 0007 — The "אגדות" album: collectibles, packs, dust, crafting.
--
-- All collectibles are ORIGINAL fictional characters (see tools/scripts/
-- gen-legends.mts). Packs are opened server-side; odds are public
-- (packs.catalog) and shown in the app before every purchase. A pity timer
-- guarantees a legendary within 30 opens. Duplicates turn into dust; dust
-- crafts a missing card. Completing an album pays a one-time reward.
-- =============================================================================

create table public.albums (
  slug  text primary key,
  title text not null,
  blurb text not null default '',
  sort  integer not null default 0
);

create table public.collectibles (
  id       text primary key,
  album    text not null references public.albums (slug),
  number   smallint not null,
  rarity   text not null,
  name_he  text not null,
  position text not null,
  era      text not null,
  bio_he   text not null,
  art_seed integer not null,  -- caricature = legendParams(art_seed, era) in packages/shared
  unique (album, number),
  constraint collectibles_rarity check (rarity in ('common', 'uncommon', 'rare', 'epic', 'legendary', 'iconic')),
  constraint collectibles_pos check (position in ('GK', 'DEF', 'MID', 'FWD'))
);

create table public.user_collectibles (
  user_id    uuid not null references auth.users (id) on delete cascade,
  item_id    text not null references public.collectibles (id),
  count      integer not null default 0,
  first_at   timestamptz not null default now(),
  primary key (user_id, item_id)
);

create table public.user_pack_tokens (
  user_id uuid not null references auth.users (id) on delete cascade,
  pack    text not null,
  count   integer not null default 0 check (count >= 0),
  primary key (user_id, pack)
);

create table public.user_pack_stats (
  user_id               uuid primary key references auth.users (id) on delete cascade,
  opens                 integer not null default 0,
  opens_since_legendary integer not null default 0
);

create table public.pack_opens (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references auth.users (id) on delete cascade,
  request_id uuid not null,
  pack       text not null,
  paid_with  text not null,
  result     jsonb not null,
  created_at timestamptz not null default now(),
  unique (user_id, request_id)
);

create table public.album_claims (
  user_id    uuid not null references auth.users (id) on delete cascade,
  album      text not null references public.albums (slug),
  claimed_at timestamptz not null default now(),
  primary key (user_id, album)
);

alter table public.albums enable row level security;
alter table public.collectibles enable row level security;
alter table public.user_collectibles enable row level security;
alter table public.user_pack_tokens enable row level security;
alter table public.user_pack_stats enable row level security;
alter table public.pack_opens enable row level security;
alter table public.album_claims enable row level security;
create policy albums_read on public.albums for select to anon, authenticated using (true);
create policy collectibles_read on public.collectibles for select to anon, authenticated using (true);
create policy user_collectibles_own on public.user_collectibles for select to authenticated using (user_id = (select auth.uid()));
create policy user_pack_tokens_own on public.user_pack_tokens for select to authenticated using (user_id = (select auth.uid()));
create policy pack_opens_own on public.pack_opens for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.albums, public.collectibles, public.user_collectibles, public.user_pack_tokens,
  public.user_pack_stats, public.pack_opens, public.album_claims from anon, authenticated;
revoke all on public.user_pack_stats, public.album_claims from anon, authenticated;

insert into public.app_config (key, value, is_public) values
  ('packs.catalog', '[
     {"slug":"bronze","items":3,"coins":500,"gems":null,"odds":{"common":70,"uncommon":25,"rare":5},"guaranteed":null},
     {"slug":"silver","items":4,"coins":1500,"gems":null,"odds":{"common":45,"uncommon":38,"rare":14,"epic":3},"guaranteed":null},
     {"slug":"gold","items":5,"coins":4000,"gems":null,"odds":{"uncommon":40,"rare":40,"epic":17,"legendary":3},"guaranteed":"rare"},
     {"slug":"epic","items":5,"coins":null,"gems":60,"odds":{"rare":55,"epic":38,"legendary":6,"iconic":1},"guaranteed":"epic"},
     {"slug":"legendary","items":5,"coins":null,"gems":null,"odds":{"epic":60,"legendary":35,"iconic":5},"guaranteed":"legendary"}
   ]'::jsonb, true),
  ('packs.dust_from_duplicate', '{"common":5,"uncommon":15,"rare":50,"epic":200,"legendary":1000,"iconic":2500}'::jsonb, true),
  ('packs.craft_cost', '{"common":50,"uncommon":150,"rare":600,"epic":2400,"legendary":8000}'::jsonb, true),
  ('packs.pity_opens', '30'::jsonb, true),
  ('packs.album_reward', '{"gems":15,"pack":"gold"}'::jsonb, true),
  ('packs.hall_reward', '{"gems":60,"pack":"legendary"}'::jsonb, true),
  -- Regions where paid random packs are not offered (loot-box rules); free packs still open.
  ('packs.paid_blocked_regions', '["BE","NL"]'::jsonb, true)
on conflict (key) do nothing;

create function public.rarity_rank(p text) returns integer
language sql immutable set search_path = '' as $$
  select array_position(array['common', 'uncommon', 'rare', 'epic', 'legendary', 'iconic'], p)
$$;

/** Internal: add pack tokens. */
create function public.grant_pack_token(p_user uuid, p_pack text, p_n integer default 1) returns void
language sql volatile security definer set search_path = '' as $$
  insert into public.user_pack_tokens as t (user_id, pack, count) values (p_user, p_pack, p_n)
  on conflict (user_id, pack) do update set count = t.count + excluded.count
$$;

-- Free packs: every new player gets a silver pack.
create function public.on_wallet_created_pack() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform public.grant_pack_token(new.user_id, 'silver', 1);
  return new;
end $$;
create trigger wallets_starter_pack after insert on public.wallets
  for each row execute function public.on_wallet_created_pack();

-- Free packs from play: daily challenge → bronze; classic: 8+ correct → silver, all 12 → gold.
create function public.on_run_finished_pack() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.status = 'active' and new.status <> 'active' then
    if new.mode = 'daily' then
      perform public.grant_pack_token(new.user_id, 'bronze', 1);
    elsif new.status = 'won' then
      perform public.grant_pack_token(new.user_id, 'gold', 1);
    elsif new.correct >= 8 then
      perform public.grant_pack_token(new.user_id, 'silver', 1);
    end if;
  end if;
  return new;
end $$;
create trigger quiz_runs_pack_reward after update of status on public.quiz_runs
  for each row execute function public.on_run_finished_pack();

/** Everything the album and shop screens need. */
create function public.collection_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare v_uid uuid := public.require_user();
begin
  return jsonb_build_object(
    'albums', (select coalesce(jsonb_agg(jsonb_build_object(
        'slug', a.slug, 'title', a.title, 'blurb', a.blurb,
        'total', (select count(*) from public.collectibles c where c.album = a.slug),
        'owned', (select count(*) from public.collectibles c join public.user_collectibles u on u.item_id = c.id and u.user_id = v_uid and u.count > 0 where c.album = a.slug),
        'claimed', exists (select 1 from public.album_claims x where x.user_id = v_uid and x.album = a.slug)) order by a.sort), '[]'::jsonb)
      from public.albums a),
    'items', (select coalesce(jsonb_agg(jsonb_build_object(
        'id', c.id, 'album', c.album, 'number', c.number, 'rarity', c.rarity, 'name', c.name_he, 'position', c.position,
        'era', c.era, 'bio', c.bio_he, 'art_seed', c.art_seed, 'count', coalesce(u.count, 0)) order by c.album, c.number), '[]'::jsonb)
      from public.collectibles c left join public.user_collectibles u on u.item_id = c.id and u.user_id = v_uid),
    'tokens', (select coalesce(jsonb_object_agg(t.pack, t.count), '{}'::jsonb) from public.user_pack_tokens t where t.user_id = v_uid and t.count > 0),
    'dust', (select dust from public.wallets where user_id = v_uid),
    'pity_left', greatest(0, coalesce((select (value #>> '{}')::int from public.app_config where key = 'packs.pity_opens'), 30)
                  - coalesce((select opens_since_legendary from public.user_pack_stats where user_id = v_uid), 0)),
    'catalog', (select value from public.app_config where key = 'packs.catalog'),
    'craft_cost', (select value from public.app_config where key = 'packs.craft_cost'),
    'paid_blocked_regions', (select value from public.app_config where key = 'packs.paid_blocked_regions'));
end $$;

create function public.open_pack(p_pack text, p_pay text, p_request uuid) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid     uuid := public.require_user();
  v_prev    jsonb;
  v_pk      jsonb;
  v_n       integer;
  v_rar     text[] := '{}';
  v_roll    numeric;
  v_acc     numeric;
  v_r       text;
  v_k       text;
  i         integer;
  v_pity    integer;
  v_pity_at integer;
  v_best    integer;
  v_items   jsonb := '[]'::jsonb;
  v_item    text;
  v_cnt     integer;
  v_dust    integer := 0;
  v_dmap    jsonb;
  v_d       integer;
  v_result  jsonb;
  v_rarities constant text[] := array['common', 'uncommon', 'rare', 'epic', 'legendary', 'iconic'];
begin
  perform public.check_rate_limit(v_uid, 'open_pack', 60, 60);
  if p_request is null then
    raise exception 'invalid_input: request id' using errcode = '22023';
  end if;
  select result into v_prev from public.pack_opens where user_id = v_uid and request_id = p_request;
  if found then return v_prev; end if;   -- retry of the same open

  select e into v_pk from public.app_config c, jsonb_array_elements(c.value) e
   where c.key = 'packs.catalog' and e ->> 'slug' = p_pack;
  if v_pk is null then
    raise exception 'invalid_input: pack' using errcode = '22023';
  end if;

  -- Pay
  if p_pay = 'token' then
    update public.user_pack_tokens set count = count - 1 where user_id = v_uid and pack = p_pack and count > 0;
    if not found then raise exception 'insufficient_funds' using errcode = 'P0402'; end if;
  elsif p_pay in ('coins', 'gems') and (v_pk ->> p_pay) is not null then
    perform public.ledger_apply(v_uid, p_pay::public.currency_code, -((v_pk ->> p_pay)::bigint), 'pack_purchase', 'pack', p_pack,
      'pack:' || p_request::text);
  else
    raise exception 'invalid_input: payment' using errcode = '22023';
  end if;

  -- Roll rarities
  v_n := (v_pk ->> 'items')::int;
  for i in 1 .. v_n loop
    v_roll := random() * 100;
    v_acc := 0;
    v_r := null;
    foreach v_k in array v_rarities loop
      if v_pk -> 'odds' ? v_k then
        v_acc := v_acc + (v_pk -> 'odds' ->> v_k)::numeric;
        if v_roll < v_acc and v_r is null then v_r := v_k; end if;
      end if;
    end loop;
    v_rar := v_rar || coalesce(v_r, v_k);
  end loop;
  select max(public.rarity_rank(x)) into v_best from unnest(v_rar) x;
  if v_pk ->> 'guaranteed' is not null and v_best < public.rarity_rank(v_pk ->> 'guaranteed') then
    v_rar[v_n] := v_pk ->> 'guaranteed';
  end if;

  -- Pity: a legendary within N opens.
  insert into public.user_pack_stats (user_id) values (v_uid) on conflict (user_id) do nothing;
  select opens_since_legendary into v_pity from public.user_pack_stats where user_id = v_uid for update;
  select (value #>> '{}')::int into v_pity_at from public.app_config where key = 'packs.pity_opens';
  select max(public.rarity_rank(x)) into v_best from unnest(v_rar) x;
  if v_best < 5 and v_pity + 1 >= coalesce(v_pity_at, 30) then
    v_rar[v_n] := 'legendary';
    v_best := 5;
  end if;
  update public.user_pack_stats set opens = opens + 1,
         opens_since_legendary = case when v_best >= 5 then 0 else opens_since_legendary + 1 end
   where user_id = v_uid;

  -- Draw cards
  select value into v_dmap from public.app_config where key = 'packs.dust_from_duplicate';
  foreach v_r in array v_rar loop
    select id into v_item from public.collectibles where rarity = v_r order by random() limit 1;
    insert into public.user_collectibles as u (user_id, item_id, count) values (v_uid, v_item, 1)
      on conflict (user_id, item_id) do update set count = u.count + 1
      returning count into v_cnt;
    v_d := case when v_cnt > 1 then coalesce((v_dmap ->> v_r)::int, 0) else 0 end;
    v_dust := v_dust + v_d;
    v_items := v_items || jsonb_build_object('id', v_item, 'rarity', v_r, 'new', v_cnt = 1, 'dust', v_d);
  end loop;
  if v_dust > 0 then
    perform public.ledger_apply(v_uid, 'dust', v_dust, 'duplicate_dust', 'pack', p_request::text, 'packdust:' || p_request::text);
  end if;

  v_result := jsonb_build_object('pack', p_pack, 'items', v_items, 'dust_gained', v_dust,
    'wallet', (select jsonb_build_object('coins', coins, 'gems', gems, 'dust', dust) from public.wallets where user_id = v_uid));
  insert into public.pack_opens (user_id, request_id, pack, paid_with, result) values (v_uid, p_request, p_pack, p_pay, v_result);
  return v_result;
end $$;

create function public.craft_item(p_item text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_rar  text;
  v_cost integer;
begin
  perform public.check_rate_limit(v_uid, 'craft_item', 30, 60);
  select rarity into v_rar from public.collectibles where id = p_item;
  if v_rar is null then raise exception 'invalid_input: item' using errcode = '22023'; end if;
  select (value ->> v_rar)::int into v_cost from public.app_config where key = 'packs.craft_cost';
  if v_cost is null then raise exception 'invalid_input: not craftable' using errcode = '22023'; end if;
  if exists (select 1 from public.user_collectibles where user_id = v_uid and item_id = p_item and count > 0) then
    raise exception 'invalid_state: already owned' using errcode = 'P0001';
  end if;
  perform public.ledger_apply(v_uid, 'dust', -v_cost, 'craft', 'collectible', p_item, 'craft:' || p_item);
  insert into public.user_collectibles (user_id, item_id, count) values (v_uid, p_item, 1)
    on conflict (user_id, item_id) do update set count = 1;
  return jsonb_build_object('id', p_item, 'dust', (select dust from public.wallets where user_id = v_uid));
end $$;

create function public.claim_album(p_album text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid    uuid := public.require_user();
  v_reward jsonb;
  v_total  integer;
  v_owned  integer;
begin
  perform public.check_rate_limit(v_uid, 'claim_album', 20, 60);
  select count(*), count(u.item_id) filter (where u.count > 0) into v_total, v_owned
    from public.collectibles c left join public.user_collectibles u on u.item_id = c.id and u.user_id = v_uid
   where c.album = p_album;
  if v_total = 0 then raise exception 'invalid_input: album' using errcode = '22023'; end if;
  if v_owned < v_total then raise exception 'invalid_state: album incomplete' using errcode = 'P0001'; end if;
  insert into public.album_claims (user_id, album) values (v_uid, p_album) on conflict do nothing;
  if not found then raise exception 'invalid_state: already claimed' using errcode = 'P0001'; end if;
  select value into v_reward from public.app_config where key = case when p_album = 'hall' then 'packs.hall_reward' else 'packs.album_reward' end;
  if (v_reward ->> 'gems')::int > 0 then
    perform public.ledger_apply(v_uid, 'gems', (v_reward ->> 'gems')::int, 'album_complete', 'album', p_album, 'album:' || p_album);
  end if;
  if v_reward ->> 'pack' is not null then
    perform public.grant_pack_token(v_uid, v_reward ->> 'pack', 1);
  end if;
  return v_reward;
end $$;

revoke execute on function
  public.rarity_rank(text), public.grant_pack_token(uuid, text, integer), public.on_wallet_created_pack(),
  public.on_run_finished_pack(), public.collection_state(), public.open_pack(text, text, uuid),
  public.craft_item(text), public.claim_album(text)
from public, anon, authenticated;
grant execute on function public.collection_state(), public.open_pack(text, text, uuid), public.craft_item(text), public.claim_album(text)
to authenticated;

-- Existing players get their starter pack too.
insert into public.user_pack_tokens (user_id, pack, count) select user_id, 'silver', 1 from public.wallets
on conflict (user_id, pack) do nothing;
