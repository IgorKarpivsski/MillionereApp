-- 7-day login calendar: one reward per Israel day; day 7 is the big one.
-- Missing a day starts the week again from day 1.

insert into public.app_config (key, value, is_public) values
  ('login.calendar', '[
     {"kind": "coins", "amount": 100},
     {"kind": "tickets", "amount": 3},
     {"kind": "coins", "amount": 250},
     {"kind": "pack", "pack": "silver", "amount": 1},
     {"kind": "gems", "amount": 10},
     {"kind": "coins", "amount": 500},
     {"kind": "pack", "pack": "gold", "amount": 1}
   ]'::jsonb, true)
on conflict (key) do nothing;

create table public.user_login_calendar (
  user_id    uuid primary key references auth.users (id) on delete cascade,
  day_index  smallint not null default 0 check (day_index between 0 and 6),
  last_claim date
);
alter table public.user_login_calendar enable row level security;
create policy user_login_calendar_own on public.user_login_calendar for select to authenticated using (user_id = (select auth.uid()));
revoke insert, update, delete, truncate on public.user_login_calendar from anon, authenticated;

/** Which day the player is on and whether today's reward is waiting. */
create or replace function public.login_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_today date := public.israel_today();
  v_row   public.user_login_calendar;
  v_next  smallint;
begin
  select * into v_row from public.user_login_calendar where user_id = v_uid;
  if not found or v_row.last_claim is null or v_row.last_claim < v_today - 1 then
    v_next := 0;                                  -- new or streak broken: day 1
  elsif v_row.last_claim = v_today then
    v_next := v_row.day_index;                    -- already claimed today
  else
    v_next := (v_row.day_index + 1) % 7;          -- claimed yesterday: next day
  end if;
  return jsonb_build_object(
    'days', (select value from public.app_config where key = 'login.calendar'),
    'day', v_next,
    'claimable', coalesce(v_row.last_claim, v_today - 1) <> v_today);
end $$;

create or replace function public.login_claim() returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid   uuid := public.require_user();
  v_today date := public.israel_today();
  v_state jsonb;
  v_day   smallint;
  v_r     jsonb;
begin
  perform public.check_rate_limit(v_uid, 'login_claim', 20, 3600);
  insert into public.user_login_calendar (user_id) values (v_uid) on conflict do nothing;
  perform 1 from public.user_login_calendar where user_id = v_uid for update;
  v_state := public.login_state();
  if not (v_state ->> 'claimable')::boolean then
    raise exception 'already claimed' using errcode = 'P0001';
  end if;
  v_day := (v_state ->> 'day')::smallint;
  v_r := v_state -> 'days' -> v_day;
  update public.user_login_calendar set day_index = v_day, last_claim = v_today where user_id = v_uid;
  perform public.grant_reward(v_uid, v_r, 'login:' || v_today);
  return jsonb_build_object('day', v_day, 'reward', v_r);
end $$;

revoke all on function public.login_state(), public.login_claim() from public, anon;
grant execute on function public.login_state(), public.login_claim() to authenticated;
