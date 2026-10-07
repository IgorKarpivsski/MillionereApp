-- QA pass (Supabase advisors): evaluate auth.uid() once per query in RLS, and
-- index foreign keys used by deletes/joins on hot tables.

alter policy profiles_select_own on public.profiles using (id = (select auth.uid()));
alter policy settings_select_own on public.user_settings using (user_id = (select auth.uid()));
alter policy devices_select_own on public.devices using (user_id = (select auth.uid()));
alter policy wallets_select_own on public.wallets using (user_id = (select auth.uid()));
alter policy wallet_tx_select_own on public.wallet_transactions using (user_id = (select auth.uid()));

create index if not exists user_collectibles_item_idx on public.user_collectibles (item_id);
create index if not exists seen_questions_question_idx on public.seen_questions (question_id);
create index if not exists quiz_run_questions_question_idx on public.quiz_run_questions (question_id);
create index if not exists question_reports_question_idx on public.question_reports (question_id);
create index if not exists match_rooms_host_idx on public.match_rooms (host);
create index if not exists match_rooms_guest_idx on public.match_rooms (guest);
create index if not exists match_answers_user_idx on public.match_answers (user_id);
create index if not exists purchases_user_idx on public.purchases (user_id);
create index if not exists chat_messages_sender_idx on public.chat_messages (sender);
create index if not exists blocks_blocked_idx on public.blocks (blocked);
create index if not exists trade_offers_give_item_idx on public.trade_offers (give_item);
create index if not exists trade_offers_want_item_idx on public.trade_offers (want_item);
