-- First-run personalisation (gender for Hebrew wording, favourite worlds) and
-- the player's statistics for the profile screen.

alter table public.profiles add column gender text;
alter table public.profiles add column fav_worlds text[] not null default '{}';
alter table public.profiles add column onboarded_at timestamptz;
alter table public.profiles add constraint profiles_gender check (gender is null or gender in ('male', 'female', 'other'));
alter table public.profiles add constraint profiles_fav_worlds check (cardinality(fav_worlds) <= 20);

create function public.save_preferences(p_gender text, p_worlds text[]) returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_ok  text[];
begin
  perform public.check_rate_limit(v_uid, 'save_preferences', 30, 3600);
  if p_gender is not null and p_gender not in ('male', 'female', 'other') then
    raise exception 'invalid_input: gender' using errcode = '22023';
  end if;
  -- keep only real worlds, in the order given
  select coalesce(array_agg(w order by o), '{}') into v_ok
    from unnest(coalesce(p_worlds, '{}')) with ordinality t(w, o)
   where w = any (public.world_slugs());
  update public.profiles
     set gender = coalesce(p_gender, gender),
         fav_worlds = case when p_worlds is null then fav_worlds else v_ok[1:20] end,
         onboarded_at = coalesce(onboarded_at, now())
   where id = v_uid;
  return public.get_my_state();
end $$;
revoke all on function public.save_preferences(text, text[]) from public, anon, authenticated;
grant execute on function public.save_preferences(text, text[]) to authenticated;

/** Everything the profile's statistics section shows, in one call. */
create function public.my_stats() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid     uuid := public.require_user();
  v_worlds  jsonb;
  v_q       record;
  v_m       record;
  v_f       record;
  v_b       record;
begin
  -- answers in sessions, quick play and the daily challenge, by world
  with a as (
    select q.world, rq.is_correct
      from public.quiz_runs r
      join public.quiz_run_questions rq on rq.run_id = r.id
      join public.questions q on q.id = rq.question_id
     where r.user_id = v_uid and rq.answered_at is not null
  ),
  fam as (
    select q.world, fa.is_correct
      from public.family_answers fa
      join public.family_rooms fr on fr.id = fa.room_id
      join public.questions q on q.id = fr.question_ids[fa.idx + 1]
     where fa.user_id = v_uid
  ),
  mat as (
    select q.world, ma.is_correct
      from public.match_answers ma
      join public.match_rooms mr on mr.id = ma.room_id
      join public.questions q on q.id = mr.question_ids[ma.idx + 1]
     where ma.user_id = v_uid
  ),
  allq as (select * from a union all select * from fam union all select * from mat),
  per as (
    select world, count(*) as answered, count(*) filter (where is_correct) as correct from allq group by world
  ),
  lv as (
    select world, count(*) filter (where stars > 0) as levels, coalesce(sum(stars), 0) as stars,
           count(*) filter (where stars = 3) as perfect
      from public.user_world_levels where user_id = v_uid group by world
  )
  select coalesce(jsonb_agg(jsonb_build_object(
           'world', coalesce(per.world, lv.world),
           'answered', coalesce(per.answered, 0), 'correct', coalesce(per.correct, 0),
           'levels', coalesce(lv.levels, 0), 'stars', coalesce(lv.stars, 0), 'perfect', coalesce(lv.perfect, 0))
           order by coalesce(per.answered, 0) desc), '[]'::jsonb)
    into v_worlds
    from per full join lv on lv.world = per.world
   where coalesce(per.world, lv.world) is not null;

  select count(*) filter (where status::text not in ('active', 'abandoned') and mode = 'session') as sessions,
         count(*) filter (where mode = 'daily' and status::text not in ('active', 'abandoned')) as dailies,
         coalesce(max(correct), 0) as best_run,
         count(distinct (started_at at time zone 'Asia/Jerusalem')::date) as days
    into v_q from public.quiz_runs where user_id = v_uid;

  select count(*) filter (where status = 'done') as played,
         count(*) filter (where status = 'done' and kind = 'friend') as friend,
         count(*) filter (where status = 'done' and kind = 'random') as random,
         count(*) filter (where status = 'done' and exists (
           select 1 from public.wallet_transactions t
            where t.user_id = v_uid and t.idempotency_key = 'match:' || r.id::text
              and t.amount >= public.match_cfg('win_coins', 100))) as won
    into v_m from public.match_rooms r where (host = v_uid or guest = v_uid);

  select count(distinct fr.id) as played,
         count(distinct fr.id) filter (where exists (
           select 1 from public.wallet_transactions t
            where t.user_id = v_uid and t.idempotency_key = 'family:' || fr.id::text
              and t.amount >= public.family_cfg('win_coins', 150))) as won
    into v_f from public.family_rooms fr join public.family_players fp on fp.room_id = fr.id
   where fp.user_id = v_uid and fr.status = 'done';

  select count(*) as played, coalesce(max(correct), 0) as best, coalesce(sum(answered), 0) as answered,
         coalesce(sum(correct), 0) as correct
    into v_b from public.blitz_runs where user_id = v_uid and status = 'done';

  return jsonb_build_object(
    'joined_at', (select created_at from public.profiles where id = v_uid),
    'level', (select level from public.profiles where id = v_uid),
    'xp', (select xp from public.profiles where id = v_uid),
    'answered', coalesce((select sum((w ->> 'answered')::int) from jsonb_array_elements(v_worlds) w), 0) + v_b.answered,
    'correct', coalesce((select sum((w ->> 'correct')::int) from jsonb_array_elements(v_worlds) w), 0) + v_b.correct,
    'levels', coalesce((select sum((w ->> 'levels')::int) from jsonb_array_elements(v_worlds) w), 0),
    'stars', coalesce((select sum((w ->> 'stars')::int) from jsonb_array_elements(v_worlds) w), 0),
    'perfect', coalesce((select sum((w ->> 'perfect')::int) from jsonb_array_elements(v_worlds) w), 0),
    'sessions', v_q.sessions, 'dailies', v_q.dailies, 'best_run', v_q.best_run, 'days_played', v_q.days,
    'matches', v_m.played, 'match_wins', v_m.won,
    'family', v_f.played, 'family_wins', v_f.won,
    'blitz_games', v_b.played, 'blitz_best', v_b.best,
    'streak', coalesce((select current from public.user_streaks where user_id = v_uid), 0),
    'best_streak', coalesce((select best from public.user_streaks where user_id = v_uid), 0),
    'stickers', (select count(*) from public.user_collectibles where user_id = v_uid and count > 0),
    'stickers_total', (select count(*) from public.collectibles),
    'puzzles', (select count(*) from public.user_puzzles where user_id = v_uid and solved_at is not null),
    'worlds', v_worlds);
end $$;
revoke all on function public.my_stats() from public, anon, authenticated;
grant execute on function public.my_stats() to authenticated;
