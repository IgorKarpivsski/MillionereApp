-- One art style for every face: new players get a random 3D character (avatar_31 … avatar_70),
-- and players still on the drawn avatars (or the default avatar_01) get one too.
alter table public.profiles alter column avatar_id set default ('avatar_' || (31 + floor(random() * 40))::int);
update public.profiles set avatar_id = 'avatar_' || (31 + floor(random() * 40))::int
 where avatar_id !~ '^avatar_(3[1-9]|[4-6][0-9]|70)$';
