-- Friends, trading duplicates, friends-only chat with filtering, report and block.
begin;
create temp table ids as select test.new_user() as a, test.new_user() as b, test.new_user() as c;
grant select on ids to authenticated;
-- a owns two duplicates; b owns one duplicate; one iconic duplicate for a.
insert into public.user_collectibles (user_id, item_id, count)
select a, 'seventies_01', 3 from ids union all
select a, 'seventies_12', 2 from ids union all
select b, 'eighties_02', 2 from ids;

set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); b uuid := (select ids.b from ids); c uuid := (select ids.c from ids);
  code_b text; r jsonb; s jsonb; offer uuid; mid bigint;
begin
  perform test.login(b);
  code_b := public.my_friend_code();
  perform test.assert(code_b ~ '^[A-Z2-9]{6}$', 'friend code format');
  perform test.assert(public.my_friend_code() = code_b, 'code is stable');

  perform test.login(a);
  perform test.assert_raises(format('select public.chat_send(%L, %L)', b, 'היי'), 'not friends', 'no chat before friendship');
  r := public.friend_request(lower(code_b));
  perform test.assert(r ->> 'status' = 'pending', 'request pending (code is case-insensitive)');
  perform test.assert_raises($q$select public.friend_request(public.my_friend_code())$q$, 'self', 'cannot add yourself');
  perform test.assert_raises(format('select public.chat_send(%L, %L)', b, 'היי'), 'not friends', 'pending is not friends');

  perform test.login(b);
  s := public.friends_state();
  perform test.assert((s -> 'friends' -> 0 ->> 'incoming')::boolean, 'b sees incoming request');
  perform public.friend_respond(a, true);

  -- chat + filtering
  perform test.login(a);
  r := public.chat_send(b, 'מה קורה אחי? תתקשר 050-1234567 או www.example.com');
  perform test.assert(r ->> 'body' = 'מה קורה אחי? תתקשר *** או ***', 'phone + link masked: ' || (r ->> 'body'));
  r := public.chat_send(b, 'אתה מטומטם');
  perform test.assert(r ->> 'body' = 'אתה ***' and (r ->> 'masked')::boolean, 'profanity masked');
  r := public.chat_send(b, 'שאלה טובה על אצטדיון');
  perform test.assert(r ->> 'body' = 'שאלה טובה על אצטדיון' and not (r ->> 'masked')::boolean, 'clean text untouched');
  mid := (r ->> 'id')::bigint;
  perform test.assert_raises(format('select public.chat_send(%L, %L)', b, repeat('א', 301)), 'invalid_input', 'max 300 chars');

  perform test.login(b);
  s := public.friends_state();
  perform test.assert((s -> 'friends' -> 0 ->> 'unread')::int = 3, 'three unread');
  r := public.chat_history(a);
  perform test.assert(jsonb_array_length(r -> 'messages') = 3 and (r ->> 'can_send')::boolean, 'history');
  perform test.assert((public.friends_state() -> 'friends' -> 0 ->> 'unread')::int = 0, 'history marks read');
  perform public.chat_report(mid, 'spam');
  perform test.assert(jsonb_array_length(public.chat_history(a) -> 'messages') = 2, 'reported message hidden');

  -- c is a stranger: cannot read the chat
  perform test.login(c);
  perform test.assert((select count(*) from public.chat_messages) = 0, 'rls: strangers see nothing');
  perform test.assert_raises(format('select public.chat_history(%L)', a), 'not friends', 'stranger history blocked');
  perform test.assert_raises(format('select public.friend_dupes(%L)', a), 'not friends', 'stranger dupes blocked');

  -- trading
  perform test.login(a);
  perform test.assert_raises(format('select public.trade_offer(%L, %L, %L)', b, 'seventies_12', 'eighties_02'), 'iconic', 'iconic not tradeable');
  perform test.assert_raises(format('select public.trade_offer(%L, %L, null)', b, 'seventies_02'), 'not a duplicate', 'only duplicates');
  offer := (public.trade_offer(b, 'seventies_01', 'eighties_02') ->> 'id')::uuid;
  perform test.assert(jsonb_array_length(public.friend_dupes(b)) = 1, 'b has one tradeable duplicate');

  perform test.login(b);
  perform test.assert((public.friends_state() -> 'trades' -> 0 ->> 'incoming')::boolean, 'b sees the offer');
  r := public.trade_respond(offer, true);
  perform test.assert(r ->> 'status' = 'accepted', 'accepted');
  perform test.assert_raises(format('select public.trade_respond(%L, true)', offer), 'offer closed', 'cannot accept twice');
end $$;
reset role;

do $$
declare a uuid := (select ids.a from ids); b uuid := (select ids.b from ids);
begin
  perform test.assert((select count from public.user_collectibles where user_id = a and item_id = 'seventies_01') = 2, 'a gave one');
  perform test.assert((select count from public.user_collectibles where user_id = b and item_id = 'seventies_01') = 1, 'b received');
  perform test.assert((select count from public.user_collectibles where user_id = b and item_id = 'eighties_02') = 1, 'b gave one');
  perform test.assert((select count from public.user_collectibles where user_id = a and item_id = 'eighties_02') = 1, 'a received');
end $$;

create temp table codes as select friend_code as b_code from public.profiles where id = (select ids.b from ids);
grant select on codes to authenticated;
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); b uuid := (select ids.b from ids); offer uuid;
begin
  -- stale offer: a no longer has a duplicate after trading it away elsewhere
  perform test.login(a);
  offer := (public.trade_offer(b, 'seventies_01', null) ->> 'id')::uuid;
  perform test.login(b);
  -- block ends everything
  perform public.block_user(a);
  perform test.assert((select status from public.trade_offers where id = offer) = 'cancelled', 'block cancels open trades');
  perform test.login(a);
  perform test.assert_raises(format('select public.chat_send(%L, %L)', b, 'שלום'), 'not friends', 'blocked: no chat');
  perform test.assert_raises(format('select public.friend_request(%L)', (select b_code from codes)), 'blocked', 'blocked: no new request');
  perform test.assert_raises(format('select public.trade_respond(%L, true)', offer), 'offer closed', 'cancelled offer closed');
end $$;
rollback;
