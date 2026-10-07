-- The legendary pack can now be bought with gems (it used to be rewards-only).
update public.app_config
   set value = (select jsonb_agg(case when p ->> 'slug' = 'legendary' then p || '{"gems": 250}'::jsonb else p end order by ord)
                  from jsonb_array_elements(value) with ordinality e(p, ord))
 where key = 'packs.catalog';
