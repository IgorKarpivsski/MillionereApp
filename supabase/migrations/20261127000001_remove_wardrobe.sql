-- 0.3.1: the sloth's wardrobe is gone. Nobody bought an item; the hats that moved over from the
-- treehouse are paid back in coins. Login-streak milestones now pay coins, gems and packs only.

do $$
declare r record; v_row jsonb;
begin
  for r in select c.user_id, c.item from public.user_cosmetics c where c.item like 'w\_%' loop
    select x into v_row from jsonb_array_elements((select value -> 'items' from public.app_config where key = 'wardrobe')) x
     where x ->> 'id' = r.item;
    if v_row is not null and coalesce((v_row ->> 'price')::bigint, 0) > 0 then
      perform public.ledger_apply(r.user_id, (v_row ->> 'currency')::public.currency_code, (v_row ->> 'price')::bigint,
                                  'wardrobe_refund', 'cosmetic', r.item, 'wardrobe_refund:' || r.item);
    end if;
  end loop;
  delete from public.user_cosmetics where item like 'w\_%';
end $$;

drop function if exists public.wardrobe_wear(text, text);
drop function if exists public.wardrobe_buy(text);
drop function if exists public.wardrobe_state();
drop function if exists public.wardrobe_state_of(uuid);
delete from public.app_config where key = 'wardrobe';
alter table public.profiles drop column if exists sloth_outfit;

update public.app_config set value = (value - 'item_owned_gems') || jsonb_build_object('milestones', '[
  {"day": 3,  "rewards": [{"kind": "coins", "amount": 300}]},
  {"day": 7,  "rewards": [{"kind": "gems", "amount": 25}, {"kind": "pack", "pack": "silver", "amount": 1}]},
  {"day": 14, "rewards": [{"kind": "pack", "pack": "gold", "amount": 1}, {"kind": "gems", "amount": 30}]},
  {"day": 21, "rewards": [{"kind": "gems", "amount": 40}, {"kind": "pack", "pack": "gold", "amount": 1}]},
  {"day": 30, "rewards": [{"kind": "pack", "pack": "legendary", "amount": 1}, {"kind": "gems", "amount": 50}]}
]'::jsonb)
 where key = 'login.streak';

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
      perform public.grant_reward(v_uid, v_x, 'streak:' || v_start || ':' || v_streak || ':' || i);
      v_got := v_got || jsonb_build_array(v_x);
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
