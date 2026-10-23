-- =============================================================================
-- Month champions: the monthly table now pays the top 10, with packs, and the
-- top 3 win things to show off:
--   1st      "אלוף/ת <month>" title, the month's avatar frame, gold name colour
--   2nd–3rd  "מצטיין/ת <month>" title, the month's avatar frame, silver name colour
--   4th–10th coins, gems and a silver pack
-- Every month has its own frame (12 designs, drawn in the app), kept forever.
-- The weekly league's top 3 also get a pack now, and reaching the Champions
-- league unlocks a purple name colour.
-- Name colours travel with the player into every table, like titles.
-- =============================================================================

insert into public.app_config (key, value, is_public) values
  ('boards', '{"month_prizes": [
     {"upto": 1,  "coins": 2000, "gems": 100, "pack": "legendary", "title": "champion", "frame": true, "color": "gold"},
     {"upto": 3,  "coins": 1000, "gems": 50,  "pack": "epic",      "title": "top3",     "frame": true, "color": "silver"},
     {"upto": 10, "coins": 300,  "gems": 15,  "pack": "silver"}]}'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

update public.app_config set value = jsonb_set(value, '{rewards}', '[
  {"upto": 1,  "coins": 600, "gems": 30, "pack": "gold"},
  {"upto": 2,  "coins": 400, "gems": 20, "pack": "silver"},
  {"upto": 3,  "coins": 250, "gems": 10, "pack": "silver"},
  {"upto": 10, "coins": 100, "gems": 0}]'::jsonb)
 where key = 'league';

alter table public.profiles add column if not exists name_color text;

create or replace function public.month_he(p_month integer) returns text
language sql immutable set search_path = '' as $$
  select (array['ינואר','פברואר','מרץ','אפריל','מאי','יוני','יולי','אוגוסט','ספטמבר','אוקטובר','נובמבר','דצמבר'])[p_month]
$$;

/** Pays last month's top 10 once (the first time anyone opens the monthly table). */
create or replace function public.month_settle() returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_to     timestamptz := public.israel_month_start();
  v_from   timestamptz := public.israel_month_start(v_to - interval '1 day');
  v_month  date := (v_from at time zone 'Asia/Jerusalem')::date;
  v_prizes jsonb := (select value -> 'month_prizes' from public.app_config where key = 'boards');
  v_win    jsonb := '[]';
  v_p      jsonb;
  r        record;
begin
  insert into public.month_awards (month) values (v_month) on conflict do nothing;
  if not found then return; end if;
  for r in
    select t.user_id, t.points, row_number() over (order by t.points desc, t.user_id) as rank
      from (select user_id, sum(prize_points)::bigint as points from public.quiz_runs
             where status <> 'active' and ended_at >= v_from and ended_at < v_to
             group by user_id having sum(prize_points) > 0) t
     order by t.points desc, t.user_id limit 10
  loop
    select p into v_p from jsonb_array_elements(v_prizes) p where (p ->> 'upto')::int >= r.rank order by (p ->> 'upto')::int limit 1;
    if v_p is not null then
      if coalesce((v_p ->> 'coins')::int, 0) > 0 then
        perform public.ledger_apply(r.user_id, 'coins', (v_p ->> 'coins')::int, 'month_prize', 'month', v_month::text,
          'month:' || v_month || ':' || r.rank || ':c');
      end if;
      if coalesce((v_p ->> 'gems')::int, 0) > 0 then
        perform public.ledger_apply(r.user_id, 'gems', (v_p ->> 'gems')::int, 'month_prize', 'month', v_month::text,
          'month:' || v_month || ':' || r.rank || ':g');
      end if;
      if v_p ->> 'pack' is not null then
        perform public.grant_pack_token(r.user_id, v_p ->> 'pack', 1);
      end if;
    end if;
    v_win := v_win || jsonb_build_array(jsonb_build_object('rank', r.rank, 'user_id', r.user_id, 'points', r.points));
  end loop;
  update public.month_awards set winners = v_win where month = v_month;
end $$;

/** The months a player finished in a monthly top (rank <= p_upto). */
create or replace function public.month_wins(p_uid uuid, p_upto integer) returns setof date
language sql stable security definer set search_path = '' as $$
  select a.month from public.month_awards a, jsonb_array_elements(a.winners) w
   where (w ->> 'user_id')::uuid = p_uid and (w ->> 'rank')::int <= p_upto
$$;

/** Name colours a player can pick. */
create or replace function public.name_colors(p_uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  select jsonb_build_array(
    jsonb_build_object('key', 'gold', 'unlocked', exists (select 1 from public.month_wins(p_uid, 1)),
                       'hint', 'סיימו ראשונים בטבלה החודשית'),
    jsonb_build_object('key', 'silver', 'unlocked', exists (select 1 from public.month_wins(p_uid, 3)),
                       'hint', 'סיימו בשלושת הראשונים בטבלה החודשית'),
    jsonb_build_object('key', 'purple', 'unlocked', exists (select 1 from public.league_members where user_id = p_uid and tier = 4),
                       'hint', 'הגיעו לליגת האלופים'))
$$;

-- Month titles, month frames and name colours in the flair options.
create or replace function public.month_titles(p_uid uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_f    boolean := (select gender from public.profiles where id = p_uid) = 'female';
  v_now  integer := extract(month from now() at time zone 'Asia/Jerusalem')::int;
  v_out  jsonb := '[]';
  m      integer;
begin
  -- titles from months already won, then this month's two as a goal
  for m in select distinct extract(month from d)::int from public.month_wins(p_uid, 1) d loop
    v_out := v_out || jsonb_build_array(jsonb_build_object('text', (case when v_f then 'אלופת ' else 'אלוף ' end) || public.month_he(m),
      'unlocked', true, 'hint', 'סיימו ראשונים בטבלה החודשית'));
  end loop;
  for m in select distinct extract(month from d)::int from public.month_wins(p_uid, 3) d loop
    v_out := v_out || jsonb_build_array(jsonb_build_object('text', (case when v_f then 'מצטיינת ' else 'מצטיין ' end) || public.month_he(m),
      'unlocked', true, 'hint', 'סיימו בשלושת הראשונים בטבלה החודשית'));
  end loop;
  if not exists (select 1 from jsonb_array_elements(v_out) x where x ->> 'text' like '% ' || public.month_he(v_now) and x ->> 'text' like 'אלו%') then
    v_out := v_out || jsonb_build_array(jsonb_build_object('text', (case when v_f then 'אלופת ' else 'אלוף ' end) || public.month_he(v_now),
      'unlocked', false, 'hint', 'סיימו ראשונים בטבלה החודשית של ' || public.month_he(v_now)));
  end if;
  return v_out;
end $$;

create or replace function public.month_frames(p_uid uuid) returns jsonb
language sql stable security definer set search_path = '' as $$
  with won as (select distinct extract(month from d)::int as m from public.month_wins(p_uid, 3) d),
       now_m as (select extract(month from now() at time zone 'Asia/Jerusalem')::int as m)
  select coalesce(jsonb_agg(jsonb_build_object('key', 'm' || x.m, 'need', 3, 'unlocked', x.won) order by x.won desc, x.m), '[]'::jsonb)
    from (select m, true as won from won
          union all
          select m, false from now_m where m not in (select m from won)) x
$$;

do $$
declare
  v_def text := pg_get_functiondef('public.flair_options(uuid)'::regprocedure);
begin
  if position('month_frames' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$  v_titles := v_titles || public.extra_titles(p_uid, v_stats);$a$,
    $a$  v_titles := v_titles || public.extra_titles(p_uid, v_stats) || public.month_titles(p_uid);
  v_frames := v_frames || public.month_frames(p_uid);$a$);
  v_def := replace(v_def,
    $a$'frame', (select frame from public.profiles where id = p_uid), 'title', (select title from public.profiles where id = p_uid));$a$,
    $a$'frame', (select frame from public.profiles where id = p_uid), 'title', (select title from public.profiles where id = p_uid),
    'colors', public.name_colors(p_uid), 'color', (select name_color from public.profiles where id = p_uid));$a$);
  if position('month_frames' in v_def) = 0 or position('name_colors' in v_def) = 0 then
    raise exception 'flair_options patch did not apply';
  end if;
  execute v_def;
end $$;

/** Pick a name colour (null = the normal colour). */
create or replace function public.set_name_color(p_color text) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
begin
  perform public.check_rate_limit(v_uid, 'set_name_color', 60, 3600);
  if p_color is not null and not exists (select 1 from jsonb_array_elements(public.name_colors(v_uid)) c
                                          where c ->> 'key' = p_color and (c ->> 'unlocked')::boolean) then
    raise exception 'invalid_input: color' using errcode = '22023';
  end if;
  update public.profiles set name_color = p_color where id = v_uid;
  return public.get_my_state();
end $$;

-- Name colours under every name in the tables, next to the title.
do $$
declare
  f    text;
  v_def text;
  v_new text;
begin
  foreach f in array array['public.league_state()', 'public.leaderboard_week(integer)', 'public.leaderboard_friends()',
                           'public.event_state()', 'public.leaderboard_board(text)', 'public.survival_info()'] loop
    v_def := pg_get_functiondef(f::regprocedure);
    if position($a$'name_color'$a$ in v_def) > 0 then continue; end if;
    v_new := replace(replace(v_def,
      $a$'title', p.title,$a$, $a$'title', p.title, 'name_color', p.name_color,$a$),
      $a$'title', pr.title,$a$, $a$'title', pr.title, 'name_color', pr.name_color,$a$);
    if v_new = v_def then raise exception 'name colour patch did not apply to %', f; end if;
    execute v_new;
  end loop;
end $$;

-- The monthly table also says which month it is (for the prize names).
do $$
declare
  v_def text := pg_get_functiondef('public.leaderboard_board(text)'::regprocedure);
begin
  if position('month_name' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$'last_winners', coalesce(v_last, '[]'::jsonb));$a$,
    $a$'last_winners', coalesce(v_last, '[]'::jsonb),
    'month_name', public.month_he(extract(month from now() at time zone 'Asia/Jerusalem')::int));$a$);
  if position('month_name' in v_def) = 0 then raise exception 'leaderboard_board patch did not apply'; end if;
  execute v_def;
end $$;

-- The weekly league's top 3 get a pack too.
do $$
declare
  v_def text := pg_get_functiondef('public.league_settle(uuid)'::regprocedure);
begin
  if position('grant_pack_token' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$      if v_gems > 0 then$a$,
    $a$      if v_rw ->> 'pack' is not null then
        perform public.grant_pack_token(p_user, v_rw ->> 'pack', 1);
      end if;
      if v_gems > 0 then$a$);
  v_def := replace(v_def,
    $a$'points', v_pts, 'coins', v_coins, 'gems', v_gems)$a$,
    $a$'points', v_pts, 'coins', v_coins, 'gems', v_gems, 'pack', v_rw ->> 'pack')$a$);
  if position('grant_pack_token' in v_def) = 0 then raise exception 'league_settle patch did not apply'; end if;
  execute v_def;
end $$;

revoke all on function public.month_he(integer), public.month_wins(uuid, integer), public.name_colors(uuid),
  public.month_titles(uuid), public.month_frames(uuid), public.set_name_color(text) from public, anon, authenticated;
grant execute on function public.set_name_color(text) to authenticated;
