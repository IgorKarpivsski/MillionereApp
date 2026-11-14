-- A pack never holds the same sticker twice.
begin;
create temp table ids as select test.new_user() as a;
grant select on ids to authenticated;
-- few commons left, so repeats would be likely without the rule
update public.collectibles set active = false where rarity = 'common' and id not in (select id from public.collectibles where rarity = 'common' order by id limit 4);
insert into public.user_pack_tokens (user_id, pack, count) values ((select a from ids), 'bronze', 40)
on conflict (user_id, pack) do update set count = 40;
set local role authenticated;
do $$
declare a uuid := (select ids.a from ids); r jsonb; i int;
begin
  perform test.login(a);
  for i in 1 .. 40 loop
    r := public.open_pack('bronze', 'token', gen_random_uuid());
    perform test.assert((select count(distinct x ->> 'id') from jsonb_array_elements(r -> 'items') x) = jsonb_array_length(r -> 'items'),
      'no duplicate sticker inside one pack');
  end loop;
end $$;
rollback;
