-- An account that is already an admin can open the admin screen with the code even while it is a
-- guest account (the guest check only guards adding a NEW admin).
create or replace function public.admin_claim(p_code text)
 returns jsonb
 language plpgsql
 security definer
 set search_path to ''
as $function$
declare
  v_uid  uuid := public.require_user();
  v_hash text := (select value #>> '{}' from public.app_config where key = 'ops.admin_code_sha256');
  v_n    integer;
begin
  perform public.check_rate_limit(v_uid, 'admin_claim', 5, 3600);
  insert into public.admin_claim_attempts as a (window_start, count) values (date_trunc('hour', now()), 1)
    on conflict (window_start) do update set count = a.count + 1 returning a.count into v_n;
  if v_n > 30 then return jsonb_build_object('admin', false, 'error', 'rate_limited'); end if;
  if v_hash is null or v_hash = 'disabled'
     or v_hash <> encode(extensions.digest(coalesce(btrim(p_code), ''), 'sha256'), 'hex') then
    return jsonb_build_object('admin', false, 'error', 'not_authorized');
  end if;
  if public.is_admin(v_uid) then
    return jsonb_build_object('admin', true);
  end if;
  if coalesce((select is_guest from public.profiles where id = v_uid), true) then
    return jsonb_build_object('admin', false, 'error', 'not_authorized');
  end if;
  if (select count(*) from public.admin_users) >= 3 then
    raise exception 'too_many_admins' using errcode = 'P0001';
  end if;
  insert into public.admin_users (user_id) values (v_uid);
  insert into public.admin_audit_log (admin_id, action, entity, entity_id) values (v_uid, 'admin_claim', 'admin_users', v_uid::text);
  return jsonb_build_object('admin', true);
end $function$;
