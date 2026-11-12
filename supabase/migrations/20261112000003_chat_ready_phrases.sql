-- 0.2.0: chat between friends is ready phrases only, for everyone (it already was for under-13s).
-- Free text can come back with app_config 'chat.free_text' = true (then only kids are limited, as before).
insert into public.app_config (key, value) values ('chat.free_text', 'false'::jsonb) on conflict (key) do nothing;

create or replace function public.chat_send(p_to uuid, p_body text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid  uuid := public.require_user();
  v_cfg  jsonb := (select value from public.app_config where key = 'social');
  v_free boolean := coalesce((select value from public.app_config where key = 'chat.free_text')::text::boolean, false);
  v_c    record;
  v_id   bigint;
begin
  perform public.check_rate_limit(v_uid, 'chat_send', coalesce((v_cfg ->> 'chat_per_minute')::int, 15), 60);
  if p_body is null or char_length(btrim(p_body)) = 0 or char_length(p_body) > 300 then
    raise exception 'invalid_input: body' using errcode = '22023';
  end if;
  if not public.are_friends(v_uid, p_to) or public.is_blocked(v_uid, p_to) then
    raise exception 'invalid_state: not friends' using errcode = 'P0001';
  end if;
  -- ready phrases only (always for a child on either side; for everyone unless free text is on)
  if (not v_free or public.is_kid(v_uid) or public.is_kid(p_to))
     and not exists (select 1 from jsonb_array_elements_text((select value from public.app_config where key = 'chat.quick')) q
                      where q = btrim(p_body)) then
    raise exception 'invalid_state: kids_quick_only' using errcode = 'P0001';
  end if;
  select * into v_c from public.chat_clean(p_body);
  insert into public.chat_messages (sender, recipient, body, flagged) values (v_uid, p_to, v_c.body, v_c.flagged) returning id into v_id;
  insert into public.chat_reads as r (user_id, peer, last_read) values (v_uid, p_to, v_id)
  on conflict (user_id, peer) do update set last_read = greatest(r.last_read, excluded.last_read);
  return jsonb_build_object('id', v_id, 'body', v_c.body, 'masked', v_c.flagged);
end $function$;
