-- =============================================================================
-- Achievement titles: more titles to earn (king of the hill, true or false,
-- trading, gifts, perfect runs, month champion, top league…), each with a hint
-- for how to unlock it. The chosen title now travels with the player into the
-- tables (league, friends, week, month, all-time, event, king of the hill) so it
-- shows under their name everywhere.
-- =============================================================================

create function public.extra_titles(p_uid uuid, p_stats jsonb) returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_f      boolean := (select gender from public.profiles where id = p_uid) = 'female';
  v_surv   integer := (select coalesce(max(correct), 0) from public.survival_runs where user_id = p_uid and status = 'done');
  v_tf     integer := (select coalesce(max(correct), 0) from public.tf_runs where user_id = p_uid and status = 'done');
  v_trades integer := (select count(*) from public.market_listings where (user_id = p_uid or taker = p_uid) and status = 'done')
                    + (select count(*) from public.trade_offers where (from_user = p_uid or to_user = p_uid) and status = 'accepted');
  v_gifts  integer := (select count(*) from public.sticker_gifts where from_user = p_uid);
  v_perf   integer := (select count(*) from public.wallet_transactions where user_id = p_uid and reason = 'perfect_run' and currency = 'coins');
  v_month  boolean := exists (select 1 from public.month_awards a, jsonb_array_elements(a.winners) w
                               where (w ->> 'user_id')::uuid = p_uid and (w ->> 'rank')::int = 1);
  v_king   boolean := exists (select 1 from public.survival_week_awards a, jsonb_array_elements(a.winners) w
                               where (w ->> 'user_id')::uuid = p_uid and (w ->> 'rank')::int = 1);
  v_league boolean := exists (select 1 from public.league_members where user_id = p_uid and tier = 4);
begin
  return jsonb_build_array(
    jsonb_build_object('text', case when v_f then 'שורדת' else 'שורד' end, 'unlocked', v_surv >= 5,
                       'hint', 'שרדו 5 שאלות במלך הגבעה'),
    jsonb_build_object('text', case when v_f then 'כובשת הגבעה' else 'כובש הגבעה' end, 'unlocked', v_surv >= 15,
                       'hint', 'שרדו 15 שאלות במלך הגבעה'),
    jsonb_build_object('text', case when v_f then 'מלכת הגבעה' else 'מלך הגבעה' end, 'unlocked', v_king,
                       'hint', 'סיימו ראשונים בטבלה השבועית של מלך הגבעה'),
    jsonb_build_object('text', case when v_f then 'מהירה כמו הבזק' else 'מהיר כמו הבזק' end, 'unlocked', v_tf >= 25,
                       'hint', '25 תשובות נכונות ב"נכון או לא?"'),
    jsonb_build_object('text', case when v_f then 'סוחרת ממולחת' else 'סוחר ממולח' end, 'unlocked', v_trades >= 5,
                       'hint', '5 החלפות מדבקות עם חברים או בשוק'),
    jsonb_build_object('text', case when v_f then 'נדיבת הלב' else 'נדיב הלב' end, 'unlocked', v_gifts >= 10,
                       'hint', 'שלחו 10 מדבקות במתנה לחברים'),
    jsonb_build_object('text', case when v_f then 'מושלמת' else 'מושלם' end, 'unlocked', v_perf >= 3,
                       'hint', 'סיימו 3 שלבים בלי אף טעות'),
    jsonb_build_object('text', 'מוח על', 'unlocked', coalesce((p_stats ->> 'correct')::int, 0) >= 2000,
                       'hint', '2,000 תשובות נכונות'),
    jsonb_build_object('text', case when v_f then 'בלתי ניתנת לעצירה' else 'בלתי ניתן לעצירה' end,
                       'unlocked', coalesce((p_stats ->> 'best_streak')::int, 0) >= 30, 'hint', 'רצף של 30 ימי משחק'),
    jsonb_build_object('text', 'אגדת הליגה', 'unlocked', v_league, 'hint', 'הגיעו לליגת האלופים'),
    jsonb_build_object('text', case when v_f then 'אלופת החודש' else 'אלוף החודש' end, 'unlocked', v_month,
                       'hint', 'סיימו ראשונים בטבלה החודשית'));
end $$;
revoke all on function public.extra_titles(uuid, jsonb) from public, anon, authenticated;

do $$
declare
  v_def text := pg_get_functiondef('public.flair_options(uuid)'::regprocedure);
begin
  if position('extra_titles' in v_def) > 0 then return; end if;
  v_def := replace(v_def,
    $a$  return jsonb_build_object('frames', v_frames, 'titles', v_titles,$a$,
    $a$  v_titles := v_titles || public.extra_titles(p_uid, v_stats);
  return jsonb_build_object('frames', v_frames, 'titles', v_titles,$a$);
  if position('extra_titles' in v_def) = 0 then raise exception 'flair_options patch did not apply'; end if;
  execute v_def;
end $$;

-- The title under every name in the tables.
do $$
declare
  f    text;
  v_def text;
  v_new text;
begin
  foreach f in array array['public.league_state()', 'public.leaderboard_week(integer)', 'public.leaderboard_friends()',
                           'public.event_state()', 'public.leaderboard_board(text)', 'public.survival_info()'] loop
    v_def := pg_get_functiondef(f::regprocedure);
    if position($a$'title', p.title$a$ in v_def) > 0 or position($a$'title', pr.title$a$ in v_def) > 0 then continue; end if;
    v_new := replace(replace(v_def,
      $a$'username', p.username,$a$, $a$'username', p.username, 'title', p.title,$a$),
      $a$'username', pr.username,$a$, $a$'username', pr.username, 'title', pr.title,$a$);
    if v_new = v_def then raise exception 'title patch did not apply to %', f; end if;
    execute v_new;
  end loop;
end $$;
