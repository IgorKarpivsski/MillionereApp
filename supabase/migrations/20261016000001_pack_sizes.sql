-- Rarer packs hold more stickers: bronze 3, silver 4, gold 5, epic 6, legendary 7.
update public.app_config
set value = (
  select jsonb_agg(
    case p ->> 'slug'
      when 'epic' then jsonb_set(p, '{items}', '6')
      when 'legendary' then jsonb_set(p, '{items}', '7')
      else p
    end
    order by ord)
  from jsonb_array_elements(value) with ordinality as e(p, ord)
)
where key = 'packs.catalog';
