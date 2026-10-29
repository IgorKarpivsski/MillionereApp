-- =============================================================================
-- Pre-launch QA round (2026-10-29):
--   1. Under-13 (or age not given): no profile photo, chat with ready phrases only.
--   2. Trades must ask for something back and stay roughly fair (no one-way dumps to alts).
--   3. League week started on Saturday (a UTC date cast): Sunday now; stored weeks shifted.
--   4. League: a late joiner joins the emptiest group instead of a group of one; groups of
--      fewer than 4 move nobody up or down and pay only the winner.
--   5. Daily challenge: 30 questions a day (3 per slot), each player gets one set of 10.
--   6. Referrals count real games (not blitz/survival/true-false sprints).
--   7. Gift/trade daily caps hold under parallel calls.
--   8. Indexes for family rooms; old rate-limit rows are cleaned up daily.
-- =============================================================================

-- 1. Children ----------------------------------------------------------------------------
/** Under 13, or no age given: treated as a child (the safe default). */
create or replace function public.is_kid(p_user uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((select age_band from public.profiles where id = p_user), 'under13') = 'under13'
$$;
revoke all on function public.is_kid(uuid) from public, anon, authenticated;

insert into public.app_config (key, value, is_public) values ('chat.quick', '[
  "שלום! 👋", "משחק מולי?", "כל הכבוד! 🏆", "בוא נחליף מדבקות", "כמה יש לך באלבום?", "יש לך כפולות?",
  "תודה! 🙏", "נקמה? 😎", "איזה עולם הכי קשה לך?", "עברתי שלב חדש! 🎉", "בוא לחדר משפחה",
  "מה השיא שלך נגד השעון?", "לילה טוב 🌙", "חחח 😂", "אני מתאמן על האתגר היומי", "שלחתי לך מדבקה 🎁"]'::jsonb, true)
on conflict (key) do update set value = excluded.value, is_public = excluded.is_public;

do $$
declare
  v_def text := pg_get_functiondef('public.chat_send(uuid, text)'::regprocedure);
begin
  if position('is_kid' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$  select * into v_c from public.chat_clean(p_body);$a$,
    $a$  -- a child (on either side) only sends the ready phrases: no free text to or from kids
  if (public.is_kid(v_uid) or public.is_kid(p_to))
     and not exists (select 1 from jsonb_array_elements_text((select value from public.app_config where key = 'chat.quick')) q
                      where q = btrim(p_body)) then
    raise exception 'invalid_state: kids_quick_only' using errcode = 'P0001';
  end if;
  select * into v_c from public.chat_clean(p_body);$a$);
  if position('is_kid' in v_def) = 0 then raise exception 'chat_send kid patch did not apply'; end if;
  execute v_def;
end $$;

do $$
declare
  v_def text := pg_get_functiondef('public.set_profile_photo(text)'::regprocedure);
begin
  if position('is_kid' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$  if p_url is not null and not ($a$,
    $a$  if p_url is not null and public.is_kid(v_uid) then
    raise exception 'invalid_state: kids_no_photo' using errcode = 'P0001';
  end if;
  if p_url is not null and not ($a$);
  if position('is_kid' in v_def) = 0 then raise exception 'set_profile_photo kid patch did not apply'; end if;
  execute v_def;
end $$;

-- photos already set by children are taken down
update public.profiles set photo_url = null where photo_url is not null and coalesce(age_band, 'under13') = 'under13';

-- 2. Fair trades -------------------------------------------------------------------------

do $$
declare
  v_def text := pg_get_functiondef('public.trade_offer_multi(uuid, text[], text[])'::regprocedure);
begin
  if position('rarity_rank' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$cardinality(v_want) > 5$a$,
    $a$cardinality(v_want) not between 1 and 5$a$);
  v_def := replace(v_def,
    $a$  if (select count(*) from public.trade_offers where from_user = v_uid and status = 'pending')$a$,
    $a$  perform pg_advisory_xact_lock(hashtext('trade:' || v_uid));
  if (select count(*) from public.trade_offers where from_user = v_uid and status = 'pending')$a$);
  v_def := replace(v_def,
    $a$  if exists (select 1 from unnest(v_give) x
              where coalesce($a$,
    $a$  -- a trade asks for something back of a similar value: no one-way dumps to a second account
  if cardinality(v_give) > cardinality(v_want) + 1
     or (select max(public.rarity_rank(rarity)) from public.collectibles where id = any (v_give))
        > (select max(public.rarity_rank(rarity)) from public.collectibles where id = any (v_want)) + 1 then
    raise exception 'invalid_input: unfair trade' using errcode = '22023';
  end if;
  if exists (select 1 from unnest(v_give) x
              where coalesce($a$);
  if position('rarity_rank' in v_def) = 0 or position('not between 1 and 5' in v_def) = 0
     or position('trade:' in v_def) = 0 then
    raise exception 'trade_offer_multi patch did not apply';
  end if;
  execute v_def;
end $$;

do $$
declare
  v_def text := pg_get_functiondef('public.sticker_gift(uuid, text)'::regprocedure);
begin
  if position('gift:' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$  if public.gifts_left(v_uid) < 1 then$a$,
    $a$  perform pg_advisory_xact_lock(hashtext('gift:' || v_uid));
  if public.gifts_left(v_uid) < 1 then$a$);
  if position('gift:' in v_def) = 0 then raise exception 'sticker_gift lock patch did not apply'; end if;
  execute v_def;
end $$;

-- 3 + 4. League -----------------------------------------------------------------------------
-- weeks were stored as the Saturday before (UTC cast); move them to their Sunday
update public.league_members set week = week + 1 where extract(dow from week) = 6;
update public.user_leagues
   set last_result = jsonb_set(last_result, '{week}', to_jsonb(((last_result ->> 'week')::date + 1)::text))
 where last_result ? 'week' and extract(dow from (last_result ->> 'week')::date) = 6;

do $$
declare
  v_def text;
begin
  v_def := pg_get_functiondef('public.league_state()'::regprocedure);
  if position('israel_week_of' in v_def) = 0 then
    v_def := replace(v_def, $a$v_week  date := public.israel_week_start()::date;$a$,
                            $a$v_week  date := public.israel_week_of(public.israel_today());$a$);
    -- all groups full: join the emptiest one (up to a hard cap) rather than open a group of one
    v_def := replace(v_def,
      $a$    if v_group is null then
      select coalesce(max(group_no), 0) + 1 into v_group$a$,
      $a$    if v_group is null then
      select g.group_no into v_group from (
        select group_no, count(*) n from public.league_members
         where week = v_week and tier = v_tier group by group_no) g
       where g.n < coalesce((v_cfg ->> 'group_max')::int, 15) order by g.n, g.group_no limit 1;
    end if;
    if v_group is null then
      select coalesce(max(group_no), 0) + 1 into v_group$a$);
    if position('israel_week_of' in v_def) = 0 or position('group_max' in v_def) = 0 then
      raise exception 'league_state patch did not apply';
    end if;
    execute v_def;
  end if;

  v_def := pg_get_functiondef('public.league_settle(uuid)'::regprocedure);
  if position('israel_week_of' in v_def) = 0 then
    v_def := replace(v_def, $a$v_week  date := public.israel_week_start()::date;$a$,
                            $a$v_week  date := public.israel_week_of(public.israel_today());$a$);
    -- a tiny group (fewer than min_group players) moves nobody and pays only its winner
    v_def := replace(v_def,
      $a$  v_new := v_last.tier;
  if v_pts > 0$a$,
      $a$  v_new := v_last.tier;
  if v_n < coalesce((v_cfg ->> 'min_group')::int, 4) then
    v_small := v_rank > 1;
  elsif v_pts > 0$a$);
    v_def := replace(v_def, $a$  v_gems  integer := 0;$a$, $a$  v_gems  integer := 0;
  v_small boolean := false;$a$);
    v_def := replace(v_def, $a$  if v_pts > 0 then
    select r into v_rw$a$, $a$  if v_pts > 0 and not v_small then
    select r into v_rw$a$);
    if position('israel_week_of' in v_def) = 0 or position('min_group' in v_def) = 0
       or position('not v_small' in v_def) = 0 or position('v_small boolean' in v_def) = 0 then
      raise exception 'league_settle patch did not apply';
    end if;
    execute v_def;
  end if;
end $$;

update public.app_config set value = value || '{"group_max": 15, "min_group": 4}'::jsonb where key = 'league';

-- 5. Daily challenge: three sets a day ------------------------------------------------------
alter table public.daily_challenges drop constraint if exists daily_ten;
alter table public.daily_challenges add constraint daily_ten check (cardinality(question_ids) in (10, 30));

create or replace function public.daily_questions(p_day date) returns text[]
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_ids  text[];
  v_win  jsonb;
  v_id   text;
  i      integer;
  k      integer;
  v_pad  real;
begin
  select question_ids into v_ids from public.daily_challenges where day = p_day;
  if found then return v_ids; end if;
  perform pg_advisory_xact_lock(hashtext('daily:' || p_day::text));
  select question_ids into v_ids from public.daily_challenges where day = p_day;
  if found then return v_ids; end if;

  select value into v_win from public.app_config where key = 'daily.windows';
  v_ids := '{}';
  -- set k holds the questions k*10+1 .. k*10+10; every set climbs from easy to hard the same way
  for k in 0 .. 2 loop
    for i in 1 .. 10 loop
      v_id := null;
      v_pad := 0;
      while v_id is null and v_pad <= 0.5 loop
        select q.id into v_id from public.questions q
         where q.status = 'active' and q.world = public.world_rotation(i, p_day::text) and not q.volatile
           and q.ease_rank between (v_win -> (i - 1) ->> 0)::real - v_pad and (v_win -> (i - 1) ->> 1)::real + v_pad
           and not (q.id = any (v_ids))
           and not exists (select 1 from public.daily_challenges d where d.day > p_day - 90 and q.id = any (d.question_ids))
         order by hashtext(q.id || p_day::text) limit 1;
        v_pad := v_pad + 0.1;
      end loop;
      if v_id is null then
        select q.id into v_id from public.questions q
         where q.status = 'active' and not (q.id = any (v_ids)) order by random() limit 1;
      end if;
      v_ids := v_ids || v_id;
    end loop;
  end loop;
  insert into public.daily_challenges (day, question_ids) values (p_day, v_ids);
  return v_ids;
end $$;
revoke all on function public.daily_questions(date) from public, anon, authenticated;

/** Which of the day's question sets a player gets (fixed per player and day). */
create or replace function public.daily_set(p_user uuid, p_day date, p_n integer) returns integer
language sql immutable set search_path = '' as $$
  select ((hashtext(p_user::text || p_day::text) % greatest(p_n / 10, 1)) + greatest(p_n / 10, 1)) % greatest(p_n / 10, 1)
$$;
revoke all on function public.daily_set(uuid, date, integer) from public, anon, authenticated;

do $$
declare
  v_def text := pg_get_functiondef('public.daily_serve(uuid)'::regprocedure);
begin
  if position('daily_set' in v_def) > 0 then return; end if;
  v_def := replace(v_def, $a$v_ids[v_run.rung]$a$, $a$v_ids[public.daily_set(v_run.user_id, v_run.day, cardinality(v_ids)) * 10 + v_run.rung]$a$);
  if position('daily_set' in v_def) = 0 then raise exception 'daily_serve patch did not apply'; end if;
  execute v_def;
end $$;

-- 6. Referrals count real games ---------------------------------------------------------------
create or replace function public.referral_games(p_user uuid) returns integer
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.quiz_runs where user_id = p_user and status <> 'active' and correct >= 5
$$;

-- 8. Indexes and cleanup -----------------------------------------------------------------------
create index if not exists family_answers_user_idx on public.family_answers (user_id, answered_at);
create index if not exists family_players_user_idx on public.family_players (user_id);

create or replace function public.rate_limits_cleanup() returns void
language sql volatile security definer set search_path = '' as $$
  delete from public.rate_limits where window_start < now() - interval '2 days'
$$;
revoke all on function public.rate_limits_cleanup() from public, anon, authenticated;

do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'cron') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'rate-limits-cleanup';
    perform cron.schedule('rate-limits-cleanup', '23 3 * * *', 'select public.rate_limits_cleanup()');
  end if;
end $$;

-- 9. Rewarded ads are verified by Google (AdMob server-side verification is set up) ------------
-- Google's callback can land a few seconds after the ad closes: wait up to ~8 s for it.
create or replace function public.ad_ssv_consume(p_user uuid, p_kind text) returns void
language plpgsql volatile security definer set search_path = '' as $$
declare v_tx text;
begin
  if not coalesce((select (value #>> '{}')::boolean from public.app_config where key = 'ads.require_ssv'), false) then return; end if;
  if p_kind = 'vip_daily' or public.has_ad_free(p_user) then return; end if;
  for i in 1 .. 16 loop
    select transaction_id into v_tx from public.ad_views
     where user_id = p_user and used_at is null and created_at > now() - interval '15 minutes'
     order by created_at limit 1 for update skip locked;
    exit when v_tx is not null;
    perform pg_sleep(0.5);
  end loop;
  if v_tx is null then raise exception 'invalid_state: ad not verified' using errcode = 'P0001'; end if;
  update public.ad_views set used_at = now(), used_for = p_kind where transaction_id = v_tx;
end $$;
revoke all on function public.ad_ssv_consume(uuid, text) from public, anon, authenticated;

-- on the live project only (test databases have no storage schema and claim ads freely)
do $$
begin
  if exists (select 1 from pg_namespace where nspname = 'storage') then
    update public.app_config set value = 'true'::jsonb where key = 'ads.require_ssv';
  end if;
end $$;
