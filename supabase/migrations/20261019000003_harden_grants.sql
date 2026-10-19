-- =============================================================================
-- Security hardening
--  * The app never writes tables directly — every change goes through an RPC.
--    Take INSERT/UPDATE/DELETE/TRUNCATE on every public table away from the
--    client roles (a few tables still had the platform's default grants), and
--    make sure tables created later don't get them either.
-- =============================================================================
do $$
declare r record;
begin
  for r in select c.relname from pg_class c join pg_namespace n on n.oid = c.relnamespace
            where n.nspname = 'public' and c.relkind in ('r', 'p') loop
    execute format('revoke insert, update, delete, truncate on public.%I from anon, authenticated', r.relname);
  end loop;
end $$;

alter default privileges in schema public revoke insert, update, delete, truncate on tables from anon, authenticated;
