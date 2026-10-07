-- Accessibility: "extended time" gives 1.5x the answer time in classic and
-- daily runs. Enforced on the server: every question deadline is stretched
-- when the run's owner has the setting on. (Friend matches stay equal for both.)

alter table public.user_settings add column extended_time boolean not null default false;

insert into public.app_config (key, value, is_public) values
  ('quiz.extended_time_factor', '1.5'::jsonb, true)
on conflict (key) do nothing;

create or replace function public.stretch_question_deadline() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_factor numeric;
begin
  if exists (
    select 1 from public.quiz_runs r
      join public.user_settings s on s.user_id = r.user_id
     where r.id = new.run_id and s.extended_time
  ) then
    select (value #>> '{}')::numeric into v_factor from public.app_config where key = 'quiz.extended_time_factor';
    new.deadline := now() + (new.deadline - now()) * coalesce(v_factor, 1.5);
  end if;
  return new;
end $$;
revoke all on function public.stretch_question_deadline() from public, anon, authenticated;

create trigger quiz_run_questions_extended_time before insert on public.quiz_run_questions
  for each row execute function public.stretch_question_deadline();

create or replace function public.update_my_settings(p_patch jsonb) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_uid uuid := public.require_user();
  v_key text;
begin
  perform public.check_rate_limit(v_uid, 'update_settings', 120, 3600);

  if jsonb_typeof(p_patch) <> 'object' then
    raise exception 'invalid_input: patch must be an object' using errcode = '22023';
  end if;
  for v_key in select jsonb_object_keys(p_patch) loop
    if v_key not in ('locale', 'sound', 'music', 'haptics', 'reduced_motion', 'notif_prefs', 'extended_time') then
      raise exception 'invalid_input: unknown setting %', v_key using errcode = '22023';
    end if;
  end loop;

  update public.user_settings set
    locale         = coalesce(p_patch ->> 'locale', locale),
    sound          = coalesce((p_patch ->> 'sound')::boolean, sound),
    music          = coalesce((p_patch ->> 'music')::boolean, music),
    haptics        = coalesce((p_patch ->> 'haptics')::boolean, haptics),
    reduced_motion = coalesce((p_patch ->> 'reduced_motion')::boolean, reduced_motion),
    notif_prefs    = coalesce(p_patch -> 'notif_prefs', notif_prefs),
    extended_time  = coalesce((p_patch ->> 'extended_time')::boolean, extended_time)
  where user_id = v_uid;

  return public.get_my_state();
exception
  when check_violation or invalid_text_representation then
    raise exception 'invalid_input: %', sqlerrm using errcode = '22023';
end $$;
