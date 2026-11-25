-- 0.3.0: the login streak page. Every day the 7-day gift is claimed counts; a missed day starts over.
-- Milestones (3, 7, 14, 21, 30 days) pay bigger prizes, some of them wardrobe items you can't buy.
-- Past 30 days the 30-day prize comes again every 30 days (an owned item turns into gems).
-- Every claim also has a small chance of a lucky bonus on top.

alter table public.user_login_calendar
  add column if not exists streak integer not null default 0,
  add column if not exists best integer not null default 0,
  add column if not exists run_start date;

insert into public.app_config (key, value, is_public) values ('login.streak', '{
  "milestones": [
    {"day": 3,  "rewards": [{"kind": "coins", "amount": 300}]},
    {"day": 7,  "rewards": [{"kind": "cosmetic", "item": "w_glasses_stars"}, {"kind": "gems", "amount": 15}]},
    {"day": 14, "rewards": [{"kind": "cosmetic", "item": "w_necklace_star"}, {"kind": "pack", "pack": "gold", "amount": 1}]},
    {"day": 21, "rewards": [{"kind": "cosmetic", "item": "w_shoes_lightup"}, {"kind": "gems", "amount": 30}]},
    {"day": 30, "rewards": [{"kind": "cosmetic", "item": "w_outfit_hero"}, {"kind": "pack", "pack": "legendary", "amount": 1}]}
  ],
  "item_owned_gems": 40,
  "lucky": {"chance": 0.25, "pool": [
    {"kind": "coins", "amount": 250}, {"kind": "coins", "amount": 150}, {"kind": "gems", "amount": 5},
    {"kind": "tickets", "amount": 2}, {"kind": "pack", "pack": "silver", "amount": 1}
  ]}
}'::jsonb, true)
on conflict (key) do update set value = excluded.value;

create or replace function public.streak_state_of(p_user uuid) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_today date := public.israel_today();
  v_row   public.user_login_calendar;
  v_live  integer := 0;
begin
  select * into v_row from public.user_login_calendar where user_id = p_user;
  if found and v_row.last_claim >= v_today - 1 then v_live := v_row.streak; end if;
  return jsonb_build_object(
    'streak', v_live,
    'best', coalesce(v_row.best, 0),
    'claimed_today', coalesce(v_row.last_claim = v_today, false),
    'config', (select value from public.app_config where key = 'login.streak'));
end $$;
revoke all on function public.streak_state_of(uuid) from public, anon, authenticated;

create or replace function public.streak_state() returns jsonb
language sql stable security definer set search_path = '' as $$
  select public.streak_state_of(public.require_user())
$$;
revoke all on function public.streak_state() from public, anon;
grant execute on function public.streak_state() to authenticated;

/** The day's gift as before, plus: the streak grows, milestones pay, and sometimes a lucky bonus. */
create or replace function public.login_claim() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid    uuid := public.require_user();
  v_today  date := public.israel_today();
  v_state  jsonb;
  v_day    smallint;
  v_r      jsonb;
  v_row    public.user_login_calendar;
  v_streak integer;
  v_start  date;
  v_cfg    jsonb := (select value from public.app_config where key = 'login.streak');
  v_ms     jsonb;
  v_got    jsonb := '[]'::jsonb;
  v_x      jsonb;
  v_lucky  jsonb := null;
  v_pool   jsonb;
  v_mday   integer;
  i        integer := 0;
begin
  perform public.check_rate_limit(v_uid, 'login_claim', 20, 3600);
  insert into public.user_login_calendar (user_id) values (v_uid) on conflict do nothing;
  select * into v_row from public.user_login_calendar where user_id = v_uid for update;
  v_state := public.login_state();
  if not (v_state ->> 'claimable')::boolean then
    raise exception 'already claimed' using errcode = 'P0001';
  end if;
  v_day := (v_state ->> 'day')::smallint;
  v_r := v_state -> 'days' -> v_day;

  -- the streak: yesterday claimed = +1, otherwise a new run starts today
  if v_row.last_claim = v_today - 1 and v_row.streak > 0 then
    v_streak := v_row.streak + 1; v_start := coalesce(v_row.run_start, v_today - v_row.streak);
  else
    v_streak := 1; v_start := v_today;
  end if;

  update public.user_login_calendar
     set day_index = v_day, last_claim = v_today, streak = v_streak, best = greatest(best, v_streak), run_start = v_start
   where user_id = v_uid;
  perform public.grant_reward(v_uid, v_r, 'login:' || v_today);

  -- milestones: the exact day, and the 30-day one again every 30 days after
  v_mday := case when v_streak > 30 and v_streak % 30 = 0 then 30 else v_streak end;
  select m into v_ms from jsonb_array_elements(coalesce(v_cfg -> 'milestones', '[]')) m where (m ->> 'day')::int = v_mday;
  if v_ms is not null then
    for v_x in select x from jsonb_array_elements(v_ms -> 'rewards') x loop
      i := i + 1;
      if v_x ->> 'kind' = 'cosmetic'
         and exists (select 1 from public.user_cosmetics where user_id = v_uid and item = v_x ->> 'item') then
        v_x := jsonb_build_object('kind', 'gems', 'amount', coalesce((v_cfg ->> 'item_owned_gems')::int, 40));
      end if;
      perform public.grant_reward(v_uid, v_x, 'streak:' || v_start || ':' || v_streak || ':' || i);
      v_got := v_got || jsonb_build_array(v_x);
    end loop;
    -- a streak item goes straight onto the sloth
    for v_x in select x from jsonb_array_elements(v_got) x where x ->> 'kind' = 'cosmetic' loop
      update public.profiles p set sloth_outfit = coalesce(p.sloth_outfit, '{}'::jsonb)
             || jsonb_build_object(c ->> 'cat', v_x ->> 'item')
        from jsonb_array_elements((select value -> 'items' from public.app_config where key = 'wardrobe')) c
       where p.id = v_uid and c ->> 'id' = v_x ->> 'item';
    end loop;
  end if;

  -- sometimes a little extra
  v_pool := v_cfg -> 'lucky' -> 'pool';
  if v_pool is not null and jsonb_array_length(v_pool) > 0 and random() < coalesce((v_cfg -> 'lucky' ->> 'chance')::float, 0) then
    v_lucky := v_pool -> floor(random() * jsonb_array_length(v_pool))::int;
    perform public.grant_reward(v_uid, v_lucky, 'lucky:' || v_today);
  end if;

  return jsonb_build_object('day', v_day, 'reward', v_r, 'streak', v_streak, 'milestone', v_got, 'lucky', v_lucky);
end $$;
revoke all on function public.login_claim() from public, anon;
grant execute on function public.login_claim() to authenticated;
