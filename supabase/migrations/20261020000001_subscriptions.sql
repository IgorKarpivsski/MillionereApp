-- =============================================================================
-- Subscriptions done properly (Google Play subscription guidelines)
--  * Renewals: a VIP subscription renews every month with the same purchase
--    token. A job checks active subscriptions with Google every few hours
--    (iap-refresh edge function) and extends VIP, so paying players never lose
--    it; each renewal (new order id) pays the monthly 30 gems again.
--  * State: grace period / account hold / canceled are kept, so the app can
--    tell the player to fix their payment, or that VIP ends on a date.
--  * The shop knows whether VIP comes from a paid subscription (to show
--    "manage subscription") and when it renews or ends.
-- =============================================================================
alter table public.purchases add column last_order_id text;
alter table public.purchases add column expires_at timestamptz;
alter table public.purchases add column sub_state text;
alter table public.purchases add column auto_renew boolean;
alter table public.purchases add column checked_at timestamptz;
update public.purchases set last_order_id = order_id where last_order_id is null;

alter table public.user_entitlements add column sub_state text;
alter table public.user_entitlements add column sub_sku text;
alter table public.user_entitlements add column sub_expires_at timestamptz;
alter table public.user_entitlements add column sub_auto_renew boolean;

/** Records what Google says about a subscription; extends VIP while it's paid; monthly gems once per order. */
create function public.sub_apply(p_user uuid, p_sku text, p_token text, p_order text, p_state text, p_expiry timestamptz, p_auto_renew boolean)
returns void
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_p    jsonb;
  v_prev text;
begin
  select e into v_p from public.app_config c, jsonb_array_elements(c.value) e where c.key = 'store.products' and e ->> 'sku' = p_sku;
  select last_order_id into v_prev from public.purchases where purchase_token = p_token for update;
  update public.purchases
     set last_order_id = coalesce(p_order, last_order_id), expires_at = p_expiry, sub_state = p_state,
         auto_renew = p_auto_renew, checked_at = now()
   where purchase_token = p_token;
  insert into public.user_entitlements (user_id) values (p_user) on conflict (user_id) do nothing;
  update public.user_entitlements
     set sub_state = p_state, sub_sku = p_sku, sub_expires_at = p_expiry, sub_auto_renew = p_auto_renew, updated_at = now()
   where user_id = p_user;
  if p_state in ('SUBSCRIPTION_STATE_ACTIVE', 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD', 'SUBSCRIPTION_STATE_CANCELED') and p_expiry > now() then
    update public.user_entitlements set vip_until = greatest(coalesce(vip_until, now()), p_expiry), updated_at = now() where user_id = p_user;
    -- a renewal is a new order: the monthly gems again (idempotent per order)
    if p_order is not null and p_order is distinct from v_prev and coalesce((v_p ->> 'amount')::int, 0) > 0 then
      perform public.ledger_apply(p_user, 'gems', (v_p ->> 'amount')::bigint, 'vip_bonus', 'purchase', p_token, 'iapvip:' || p_order);
    end if;
  end if;
end $$;
revoke all on function public.sub_apply(uuid, text, text, text, text, timestamptz, boolean) from public, anon, authenticated;
grant execute on function public.sub_apply(uuid, text, text, text, text, timestamptz, boolean) to service_role;

/** Subscriptions worth asking Google about now: ending within 3 days or ended in the last 40, not checked in 6 hours. */
create function public.subs_to_refresh() returns table (user_id uuid, sku text, purchase_token text)
language sql stable security definer set search_path = '' as $$
  select p.user_id, p.sku, p.purchase_token from public.purchases p
   where p.sku in (select e ->> 'sku' from public.app_config c, jsonb_array_elements(c.value) e
                    where c.key = 'store.products' and e ->> 'kind' = 'vip')
     and (p.expires_at is null or p.expires_at between now() - interval '40 days' and now() + interval '3 days')
     and (p.checked_at is null or p.checked_at < now() - interval '6 hours')
   order by p.expires_at nulls first
   limit 200
$$;
revoke all on function public.subs_to_refresh() from public, anon, authenticated;
grant execute on function public.subs_to_refresh() to service_role;

-- The purchase itself: same as before, plus the subscription bookkeeping above.
create or replace function public.grant_purchase(p_user uuid, p_sku text, p_token text, p_order text, p_raw jsonb, p_expiry timestamptz default null)
returns jsonb
language plpgsql volatile security definer set search_path = '' as $$
declare
  v_p     jsonb;
  v_prev  public.purchases;
begin
  select e into v_p from public.app_config c, jsonb_array_elements(c.value) e where c.key = 'store.products' and e ->> 'sku' = p_sku;
  if v_p is null then raise exception 'invalid_input: sku' using errcode = '22023'; end if;
  select * into v_prev from public.purchases where purchase_token = p_token;
  if found then
    if v_prev.user_id <> p_user then raise exception 'not_authorized' using errcode = '42501'; end if;
    if v_p ->> 'kind' = 'vip' then
      perform public.sub_apply(p_user, p_sku, p_token, p_order, coalesce(p_raw ->> 'subscriptionState', 'SUBSCRIPTION_STATE_ACTIVE'), p_expiry,
        (p_raw -> 'lineItems' -> 0 -> 'autoRenewingPlan' ->> 'autoRenewEnabled')::boolean);
    end if;
    return jsonb_build_object('granted', false, 'duplicate', true);
  end if;

  insert into public.purchases (user_id, sku, purchase_token, order_id, raw) values (p_user, p_sku, p_token, p_order, p_raw);
  insert into public.user_entitlements (user_id) values (p_user) on conflict (user_id) do nothing;

  case v_p ->> 'kind'
    when 'coins' then
      perform public.ledger_apply(p_user, 'coins', (v_p ->> 'amount')::bigint, 'purchase', 'purchase', p_token, 'iap:' || p_token);
    when 'gems' then
      perform public.ledger_apply(p_user, 'gems', (v_p ->> 'amount')::bigint, 'purchase', 'purchase', p_token, 'iap:' || p_token);
    when 'no_ads' then
      update public.user_entitlements set no_ads = true, updated_at = now() where user_id = p_user;
    when 'vip' then
      perform public.sub_apply(p_user, p_sku, p_token, p_order, coalesce(p_raw ->> 'subscriptionState', 'SUBSCRIPTION_STATE_ACTIVE'),
        coalesce(p_expiry, now() + interval '30 days'),
        (p_raw -> 'lineItems' -> 0 -> 'autoRenewingPlan' ->> 'autoRenewEnabled')::boolean);
    else
      raise exception 'invalid_input: kind' using errcode = '22023';
  end case;
  return jsonb_build_object('granted', true, 'sku', p_sku);
end $$;

-- The shop: subscription details for "manage", renewal date and payment problems.
create or replace function public.store_state() returns jsonb
language plpgsql stable security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_e   public.user_entitlements;
begin
  select * into v_e from public.user_entitlements where user_id = v_uid;
  return jsonb_build_object(
    'products', (select value from public.app_config where key = 'store.products'),
    'no_ads', coalesce(v_e.no_ads, false),
    'vip_until', v_e.vip_until,
    'free_pack_today', not exists (select 1 from public.ad_claims where user_id = v_uid and kind = 'free_pack' and ref = public.israel_today()::text),
    'vip_daily_today', not exists (select 1 from public.ad_claims where user_id = v_uid and kind = 'vip_daily' and ref = public.israel_today()::text),
    'ad_free', public.has_ad_free(v_uid),
    'sub', case when v_e.sub_sku is not null then jsonb_build_object(
      'sku', v_e.sub_sku,
      'state', case v_e.sub_state
                 when 'SUBSCRIPTION_STATE_ACTIVE' then 'active'
                 when 'SUBSCRIPTION_STATE_IN_GRACE_PERIOD' then 'grace'
                 when 'SUBSCRIPTION_STATE_ON_HOLD' then 'on_hold'
                 when 'SUBSCRIPTION_STATE_PAUSED' then 'paused'
                 when 'SUBSCRIPTION_STATE_CANCELED' then 'canceled'
                 else 'expired' end,
      'expires_at', v_e.sub_expires_at,
      'auto_renew', coalesce(v_e.sub_auto_renew, v_e.sub_state = 'SUBSCRIPTION_STATE_ACTIVE')) end);
end $$;

-- A shared secret for the scheduled refresh call (kept private in app_config).
insert into public.app_config (key, value, is_public)
values ('ops.cron_secret', to_jsonb(encode(extensions.gen_random_bytes(24), 'hex')), false)
on conflict (key) do nothing;

-- Every 6 hours: ask Google about subscriptions that are about to renew or just changed.
do $$
begin
  if exists (select 1 from pg_extension where extname = 'pg_cron') and exists (select 1 from pg_extension where extname = 'pg_net') then
    perform cron.unschedule(jobid) from cron.job where jobname = 'iap-refresh';
    perform cron.schedule('iap-refresh', '17 */6 * * *', $job$
      select net.http_post(
        url := 'https://pajqbqjjadwcbpajkiph.supabase.co/functions/v1/iap-refresh',
        headers := jsonb_build_object('content-type', 'application/json',
                     'x-cron-secret', (select value #>> '{}' from public.app_config where key = 'ops.cron_secret')),
        body := '{}'::jsonb)
    $job$);
  end if;
end $$;
