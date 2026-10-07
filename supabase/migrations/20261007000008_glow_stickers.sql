-- Glowing stickers: every sticker a player receives has a small chance to be a
-- glowing (animated) copy. Rolled on the server whenever a count goes up, so it
-- covers packs, crafting and rewards without touching those functions.

alter table public.user_collectibles add column glow integer not null default 0 check (glow >= 0);

insert into public.app_config (key, value, is_public) values ('packs.glow_chance', '0.04'::jsonb, true)
on conflict (key) do nothing;

create or replace function public.roll_glow() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_n integer := new.count - coalesce(case when tg_op = 'UPDATE' then old.count end, 0);
  v_p numeric;
begin
  if v_n > 0 then
    v_p := coalesce((select (value #>> '{}')::numeric from public.app_config where key = 'packs.glow_chance'), 0.04);
    for i in 1 .. least(v_n, 50) loop
      if random() < v_p then
        new.glow := new.glow + 1;
      end if;
    end loop;
  end if;
  new.glow := least(new.glow, greatest(new.count, 0));
  return new;
end $$;
revoke all on function public.roll_glow() from public, anon, authenticated;

create trigger user_collectibles_glow before insert or update of count on public.user_collectibles
  for each row execute function public.roll_glow();

do $$
declare d text;
begin
  d := pg_get_functiondef('public.collection_state()'::regprocedure);
  d := replace(d, $x$'count', coalesce(u.count, 0))$x$, $x$'count', coalesce(u.count, 0), 'glow', coalesce(u.glow, 0))$x$);
  if position($x$'glow', coalesce(u.glow, 0)$x$ in d) = 0 then raise exception 'collection_state patch failed'; end if;
  execute d;
end $$;
