-- Google Play Families (0.2.0 rejected again for "unclear ads/offers"): only players who said 16+ on the
-- age screen ever see an ad. Everyone else (under 13, 13–15, or not answered yet) gets every
-- "watch an ad" reward without an ad, so the server must not ask them for a verified ad view.
do $$
declare
  d text := pg_get_functiondef('public.ad_ssv_consume(uuid,text)'::regprocedure);
  a text := 'if p_kind = ''vip_daily'' or public.has_ad_free(p_user) then return; end if;';
  b text := 'if p_kind = ''vip_daily'' or public.has_ad_free(p_user) then return; end if;
  -- no ads at all below 16 (or before the age screen)
  if coalesce((select age_band from public.profiles where id = p_user), '''') <> ''16plus'' then return; end if;';
begin
  if position(a in d) = 0 then raise exception 'ad_ssv_consume patch failed'; end if;
  execute replace(d, a, b);
end $$;
