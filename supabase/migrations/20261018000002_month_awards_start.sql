-- The monthly prize starts with October 2026: September (before the table existed) is marked as settled.
insert into public.month_awards (month) values (date '2026-09-01') on conflict do nothing;
