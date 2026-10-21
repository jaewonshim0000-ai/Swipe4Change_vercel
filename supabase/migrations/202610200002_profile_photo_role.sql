-- Profile pictures and a chosen role.
--
-- The picture is a small JPEG, resized and stripped of metadata on the device
-- (src/data/photos.ts), kept as a data URL on the profile row. Profiles are readable only by
-- their owner and the snapshot returns only the caller's own profile, so nobody else receives it
-- and no public Storage bucket is involved.
-- ponytail: kept inline on the row; move it to a private Storage bucket if pictures are ever
-- shown to other people.
--
-- The role (organizer, supporter, community builder) only chooses the welcome tutorial. It grants
-- nothing and nothing checks it.
begin;

alter table public.profiles
 add column avatar text
  check (length(avatar)<=200000 and avatar ~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$'),
 add column role text check (role in ('organizer','supporter','community'));

alter function public.lookaware_command(jsonb) rename to lookaware_command_v13;
revoke all on function public.lookaware_command_v13(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); kind text:=command->>'type'; pic text:=command->>'avatar'; result text;
begin
 if kind='avatar' then
  if uid is null then raise exception 'Sign in before making changes.'; end if;
  if not command ? 'avatar' or (pic is not null and (length(pic)>200000
     or pic !~ '^data:image/jpeg;base64,[A-Za-z0-9+/]+={0,2}$')) then
   raise exception 'That picture could not be used. Try another one.';
  end if;
  update public.profiles set avatar=pic where id=uid;
  return null;
 end if;
 if kind='delete_account' and uid is not null then
  update public.profiles set avatar=null,role=null where id=uid;
 end if;
 result:=public.lookaware_command_v13(command);
 -- Onboarding and profile edits may carry the role; it is stored only after they succeed.
 if kind in ('onboard','profile') and command ? 'role' then
  if command->>'role' is null or command->>'role' not in ('organizer','supporter','community') then
   raise exception 'Choose how you want to take part.';
  end if;
  update public.profiles set role=command->>'role' where id=uid;
 end if;
 return result;
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

alter function public.lookaware_snapshot() rename to lookaware_snapshot_v9;
revoke all on function public.lookaware_snapshot_v9() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:=public.lookaware_snapshot_v9(); person public.profiles;
begin
 if jsonb_typeof(result->'profile') is distinct from 'object' then return result; end if;
 select * into person from public.profiles where id=private.actor();
 return jsonb_set(result,'{profile}',(result->'profile')||jsonb_strip_nulls(
  jsonb_build_object('avatar',person.avatar,'role',person.role)));
end $$;
revoke all on function public.lookaware_snapshot() from public,anon,authenticated;
grant execute on function public.lookaware_snapshot() to anon,authenticated;

commit;
