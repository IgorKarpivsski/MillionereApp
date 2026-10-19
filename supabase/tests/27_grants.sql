-- No client role can write any public table directly.
begin;
do $$
declare v text;
begin
  select string_agg(table_name || ':' || grantee || ':' || privilege_type, ', ') into v
    from information_schema.role_table_grants
   where table_schema = 'public' and grantee in ('anon', 'authenticated')
     and privilege_type in ('INSERT', 'UPDATE', 'DELETE', 'TRUNCATE');
  perform test.assert(v is null, 'client roles can write: ' || coalesce(v, ''));
end $$;
rollback;
