-- The game's admins (the owner) play without ads, on any device they sign in with.
create or replace function public.has_ad_free(p_user uuid)
 returns boolean
 language sql
 stable security definer
 set search_path to ''
as $function$
  select exists (select 1 from public.admin_users where user_id = p_user)
      or coalesce((select no_ads or coalesce(vip_until > now(), false) from public.user_entitlements where user_id = p_user), false)
$function$;
