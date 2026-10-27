-- =============================================================================
-- Second reviewers' round (2026-10-27):
--   1. Nicer name suggestions (no numbers when a name is free) + 3 suggestions to pick from.
--   2. The result screen explains its coins (per correct answer, star bonus, multiplier).
--   3. The ticket cliff after the free week: 10 tickets for 3 days, then the usual 5.
--   4. The last missing sticker of an album is crafted at half the dust.
-- =============================================================================

-- 1. Names ---------------------------------------------------------------------------
create or replace function public.username_candidate(p_digits boolean) returns text
language sql volatile set search_path = '' as $$
  select (array['השועל','הנמר','האריה','הדולפין','הינשוף','הפיל','הנשר','הזאב','הקוף','הצב','הלוויתן',
                'הברדלס','הדוב','התנין','הפינגווין','הקיפוד','הסוס','העצלן','התוכי','הג׳ירפה','הדרקון','הכריש'])[1 + floor(random() * 22)::int]
      || '_'
      || (array['החכם','המהיר','הזריז','האמיץ','השנון','הערני','הסקרן','המבריק','הנועז','השמח','המסתורי','הענק','החד',
                'המוזהב','הסופר','המעופף','הקסום','הנינג׳ה','האגדי','הזוהר'])[1 + floor(random() * 20)::int]
      || case when p_digits then (10 + floor(random() * 90))::int::text else '' end
$$;
revoke all on function public.username_candidate(boolean) from public, anon, authenticated;

create or replace function public.generate_username() returns text
language plpgsql set search_path = '' as $$
declare
  v_name text;
begin
  for i in 1 .. 60 loop
    v_name := public.username_candidate(i > 20);
    if not exists (select 1 from public.profiles where lower(username) = lower(v_name)) then
      return v_name;
    end if;
  end loop;
  return 'אלוף_' || substr(replace(gen_random_uuid()::text, '-', ''), 1, 12);
end $$;

/** Three free names to pick from on the nickname screen. */
create or replace function public.username_suggestions() returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid  uuid := public.require_user();
  v_out  text[] := '{}';
  v_name text;
begin
  perform public.check_rate_limit(v_uid, 'username_suggestions', 60, 3600);
  for i in 1 .. 80 loop
    exit when cardinality(v_out) >= 3;
    v_name := public.username_candidate(i > 40);
    if not (v_name = any (v_out))
       and not exists (select 1 from public.profiles where lower(username) = lower(v_name)) then
      v_out := v_out || v_name;
    end if;
  end loop;
  return to_jsonb(v_out);
end $$;
revoke all on function public.username_suggestions() from public, anon;
grant execute on function public.username_suggestions() to authenticated;

-- 2. Coins breakdown on the result screen -------------------------------------------------
do $$
declare
  v_def text := pg_get_functiondef('public.session_finish(uuid, boolean)'::regprocedure);
begin
  if position('coins_breakdown' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$'doubled', v_run.doubled,$a$,
    $a$'doubled', v_run.doubled,
    'coins_breakdown', jsonb_build_object(
      'correct', v_new, 'per', (v_cfg ->> 'coins_per_correct')::int,
      'stars', coalesce((v_cfg -> 'star_coins' ->> v_stars)::int, 0), 'mult', v_mult),$a$);
  if position('coins_breakdown' in v_def) = 0 then raise exception 'session_finish breakdown patch did not apply'; end if;
  execute v_def;
end $$;

-- 3. Tickets: a gentle step down after the free week -----------------------------------
insert into public.app_config (key, value, is_public) values ('energy.taper', '{"days": 3, "max": 10}'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

/** End of the "10 tickets" days that follow the free week (null when there is no profile). */
create or replace function public.taper_until(p_user uuid) returns timestamptz
language sql stable security definer set search_path = '' as $$
  select public.newbie_until(p_user)
         + make_interval(days => coalesce(((select value from public.app_config where key = 'energy.taper') ->> 'days')::int, 0))
$$;

/** How many tickets this player holds at most: more in the days right after the free week. */
create or replace function public.energy_max(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select case when coalesce(public.taper_until(p_user) > now(), false)
              then greatest(coalesce(((select value from public.app_config where key = 'energy.taper') ->> 'max')::int, 0),
                            coalesce(((select value from public.app_config where key = 'energy') ->> 'max')::int, 5))
              else coalesce(((select value from public.app_config where key = 'energy') ->> 'max')::int, 5) end
$$;
revoke all on function public.taper_until(uuid), public.energy_max(uuid) from public, anon, authenticated;

do $$
declare
  d text;
  f text;
begin
  foreach f in array array['public.energy_sync(uuid)', 'public.energy_state()', 'public.energy_refill(text, uuid)'] loop
    d := pg_get_functiondef(f::regprocedure);
    if position('energy_max' in d) > 0 then continue; end if;
    d := replace(d, $x$v_max integer := coalesce((v_cfg ->> 'max')::int, 5);$x$,
      case when f = 'public.energy_sync(uuid)' then $x$v_max integer := public.energy_max(p_user);$x$
           else $x$v_max integer := public.energy_max(v_uid);$x$ end);
    if position('energy_max' in d) = 0 then raise exception '% taper patch did not apply', f; end if;
    execute d;
  end loop;
  d := pg_get_functiondef('public.energy_spend(uuid)'::regprocedure);
  if position('energy_max' in d) = 0 then
    d := replace(d, $x$v_max integer := coalesce(((select value from public.app_config where key = 'energy') ->> 'max')::int, 5);$x$,
      $x$v_max integer := public.energy_max(p_user);$x$);
    if position('energy_max' in d) = 0 then raise exception 'energy_spend taper patch did not apply'; end if;
    execute d;
  end if;
  d := pg_get_functiondef('public.energy_state()'::regprocedure);
  if position('taper_until' in d) = 0 then
    d := replace(d, $x$'ad_left',$x$,
      $x$'taper_until', case when not public.is_vip(v_uid) and public.taper_until(v_uid) > now() then public.taper_until(v_uid) end,
    'ad_left',$x$);
    if position('taper_until' in d) = 0 then raise exception 'energy_state taper_until patch did not apply'; end if;
    execute d;
  end if;
end $$;

-- 4. The last sticker of an album at half the dust ------------------------------------
insert into public.app_config (key, value, is_public) values ('packs.last_sticker_discount', '0.5'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

do $$
declare
  v_def text := pg_get_functiondef('public.craft_item(text)'::regprocedure);
begin
  if position('last_sticker_discount' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$  perform public.ledger_apply(v_uid, 'dust', -v_cost,$a$,
    $a$  -- the one sticker still missing from an album costs less
    if not exists (select 1 from public.collectibles c
                    where c.album = (select album from public.collectibles where id = p_item) and c.active and c.id <> p_item
                      and not exists (select 1 from public.user_collectibles u where u.user_id = v_uid and u.item_id = c.id and u.count > 0)) then
      v_cost := ceil(v_cost * coalesce((select (value #>> '{}')::numeric from public.app_config where key = 'packs.last_sticker_discount'), 1))::int;
    end if;
  perform public.ledger_apply(v_uid, 'dust', -v_cost,$a$);
  if position('last_sticker_discount' in v_def) = 0 then raise exception 'craft_item patch did not apply'; end if;
  execute v_def;
end $$;
