-- Weekly leagues: Bronze → Silver → Gold → Diamond → Champions.
--
-- Each week (Sunday–Saturday, Israel time) an active player joins a group of
-- up to 30 players of the same tier. Points = prize points of runs that week.
-- When the player first shows up in a new week, last week is settled for them:
-- top N move up, bottom N (or anyone who scored 0) move down, and the top
-- ranks get coins/gems. Settling is lazy and idempotent (ledger keys).

insert into public.app_config (key, value, is_public) values
  ('league', '{
     "group_size": 30, "promote": 5, "demote": 5,
     "tiers": ["ארד", "כסף", "זהב", "יהלום", "אלופים"],
     "rewards": [
       {"upto": 1, "coins": 600, "gems": 20},
       {"upto": 2, "coins": 400, "gems": 10},
       {"upto": 3, "coins": 250, "gems": 5},
       {"upto": 10, "coins": 100, "gems": 0}
     ],
     "tier_bonus": 0.5
   }'::jsonb, true)
on conflict (key) do nothing;

create table public.user_leagues (
  user_id     uuid primary key references auth.users (id) on delete cascade,
  tier        smallint not null default 0 check (tier between 0 and 4),
  last_result jsonb
);

create table public.league_members (
  week     date not null,
  tier     smallint not null check (tier between 0 and 4),
  group_no integer not null,
  user_id  uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (week, user_id)
);
create index league_members_group_idx on public.league_members (week, tier, group_no);
create index league_members_user_idx on public.league_members (user_id);

alter table public.user_leagues enable row level security;
alter table public.league_members enable row level security;
create policy user_leagues_own on public.user_leagues for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.user_leagues, public.league_members from anon, authenticated;
revoke select on public.league_members from anon, authenticated;

/** Points of every member of one group in one week (week = Sunday date, Israel). */
create or replace function public.league_group_points(p_week date, p_tier smallint, p_group integer)
returns table (user_id uuid, points bigint, rank bigint, members bigint)
language sql stable security definer set search_path = '' as $$
  with m as (
    select lm.user_id, lm.joined_at from public.league_members lm
     where lm.week = p_week and lm.tier = p_tier and lm.group_no = p_group),
  pts as (
    select m.user_id, m.joined_at, coalesce(sum(r.prize_points), 0)::bigint as points
      from m left join public.quiz_runs r
        on r.user_id = m.user_id and r.status <> 'active'
       and r.ended_at >= (p_week::timestamp at time zone 'Asia/Jerusalem')
       and r.ended_at <  ((p_week + 7)::timestamp at time zone 'Asia/Jerusalem')
     group by m.user_id, m.joined_at)
  select pts.user_id, pts.points,
         row_number() over (order by pts.points desc, pts.joined_at, pts.user_id),
         count(*) over ()
    from pts
$$;
revoke all on function public.league_group_points(date, smallint, integer) from public, anon, authenticated;

/** Settles the player's most recent past week (once) and returns the new tier. */
create or replace function public.league_settle(p_user uuid) returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  v_week  date := public.israel_week_start()::date;
  v_cfg   jsonb := (select value from public.app_config where key = 'league');
  v_last  public.league_members;
  v_tier  smallint;
  v_rank  bigint;
  v_pts   bigint;
  v_n     bigint;
  v_new   smallint;
  v_rw    jsonb;
  v_mult  numeric;
  v_coins integer := 0;
  v_gems  integer := 0;
begin
  insert into public.user_leagues (user_id) values (p_user) on conflict do nothing;
  select tier into v_tier from public.user_leagues where user_id = p_user for update;

  select * into v_last from public.league_members
   where user_id = p_user and week < v_week order by week desc limit 1;
  if not found or (select last_result ->> 'week' from public.user_leagues where user_id = p_user) = v_last.week::text then
    return v_tier;
  end if;

  select g.rank, g.points, g.members into v_rank, v_pts, v_n
    from public.league_group_points(v_last.week, v_last.tier, v_last.group_no) g where g.user_id = p_user;

  v_new := v_last.tier;
  if v_pts > 0 and v_rank <= (v_cfg ->> 'promote')::int and v_last.tier < 4 then
    v_new := v_last.tier + 1;
  elsif v_last.tier > 0 and (v_pts = 0 or (v_n > (v_cfg ->> 'promote')::int + (v_cfg ->> 'demote')::int
                                            and v_rank > v_n - (v_cfg ->> 'demote')::int)) then
    v_new := v_last.tier - 1;
  end if;

  if v_pts > 0 then
    select r into v_rw from jsonb_array_elements(v_cfg -> 'rewards') r
     where (r ->> 'upto')::int >= v_rank order by (r ->> 'upto')::int limit 1;
    if v_rw is not null then
      v_mult := 1 + v_last.tier * coalesce((v_cfg ->> 'tier_bonus')::numeric, 0.5);
      v_coins := round((v_rw ->> 'coins')::int * v_mult);
      v_gems := (v_rw ->> 'gems')::int;
      if v_coins > 0 then
        perform public.ledger_apply(p_user, 'coins', v_coins, 'league_reward', 'league', v_last.week::text,
                                    'league:' || v_last.week || ':coins');
      end if;
      if v_gems > 0 then
        perform public.ledger_apply(p_user, 'gems', v_gems, 'league_reward', 'league', v_last.week::text,
                                    'league:' || v_last.week || ':gems');
      end if;
    end if;
  end if;

  update public.user_leagues set tier = v_new, last_result = jsonb_build_object(
    'week', v_last.week, 'from_tier', v_last.tier, 'to_tier', v_new, 'rank', v_rank, 'members', v_n,
    'points', v_pts, 'coins', v_coins, 'gems', v_gems)
   where user_id = p_user;
  return v_new;
end $$;
revoke all on function public.league_settle(uuid) from public, anon, authenticated;

/** The player's league this week (joins a group on first call) with the group table. */
create or replace function public.league_state() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_week  date := public.israel_week_start()::date;
  v_cfg   jsonb := (select value from public.app_config where key = 'league');
  v_tier  smallint;
  v_group integer;
  v_rows  jsonb;
  v_size  int;
begin
  perform public.check_rate_limit(v_uid, 'league_state', 240, 3600);
  v_tier := public.league_settle(v_uid);

  select group_no into v_group from public.league_members where week = v_week and user_id = v_uid;
  if not found then
    v_size := (v_cfg ->> 'group_size')::int;
    -- One joiner at a time per tier/week so groups never overfill.
    perform pg_advisory_xact_lock(hashtext('league:' || v_week || ':' || v_tier));
    select g.group_no into v_group from (
      select group_no, count(*) n from public.league_members
       where week = v_week and tier = v_tier group by group_no) g
     where g.n < v_size order by g.group_no limit 1;
    if v_group is null then
      select coalesce(max(group_no), 0) + 1 into v_group from public.league_members where week = v_week and tier = v_tier;
    end if;
    insert into public.league_members (week, tier, group_no, user_id) values (v_week, v_tier, v_group, v_uid);
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
           'rank', g.rank, 'username', p.username, 'avatar_id', p.avatar_id, 'level', p.level,
           'points', g.points, 'me', g.user_id = v_uid) order by g.rank), '[]'::jsonb)
    into v_rows
    from public.league_group_points(v_week, v_tier, v_group) g
    join public.profiles p on p.id = g.user_id;

  return jsonb_build_object(
    'week_start', v_week,
    'seconds_left', greatest(0, extract(epoch from (((v_week + 7)::timestamp at time zone 'Asia/Jerusalem') - now()))::int),
    'tier', v_tier,
    'tier_name', v_cfg -> 'tiers' ->> v_tier,
    'tiers', v_cfg -> 'tiers',
    'promote', case when v_tier < 4 then (v_cfg ->> 'promote')::int else 0 end,
    'demote', case when v_tier > 0 then (v_cfg ->> 'demote')::int else 0 end,
    'rewards', v_cfg -> 'rewards',
    'tier_bonus', v_cfg -> 'tier_bonus',
    'rows', v_rows,
    'last_result', (select last_result from public.user_leagues where user_id = v_uid));
end $$;

revoke all on function public.league_state() from public, anon;
grant execute on function public.league_state() to authenticated;
