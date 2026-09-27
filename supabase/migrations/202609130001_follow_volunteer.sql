-- Swipe-to-act: the deck offers more than "seen it" and "not for me". A person can volunteer
-- specific help (outreach, design, research, canvassing) as well as sign or save.
--
-- Saving is following. A saved petition sends you its updates, and so does one you signed or
-- offered to help with; there is no separate bookmark that stays silent.
--
-- This migration adds a new decorator layer on top of the existing chain rather than replacing
-- a base function: the new command type is handled here and everything else delegates down.
begin;

-- Contact details are deliberately absent. An organizer gets a name, chosen roles and a short
-- note; anything more belongs in a channel the volunteer controls.
create table if not exists public.petition_volunteers (
  id uuid primary key default gen_random_uuid(),
  petition_id uuid not null references public.petitions(id),
  user_id uuid not null references public.profiles(id),
  -- A check constraint cannot hold a subquery, so duplicate roles are deduplicated by the
  -- command (array_agg(distinct …)) rather than rejected here. Nothing else can write this table.
  roles text[] not null check(
    cardinality(roles) between 1 and 4
    and roles <@ array['outreach','design','research','canvassing']),
  note text not null default '' check(length(note) <= 500),
  created_at timestamptz not null default now(),
  unique(petition_id, user_id));

alter table public.petitions add column if not exists sample_volunteers integer not null default 0
  check(sample_volunteers >= 0);

create index if not exists volunteers_petition on public.petition_volunteers(petition_id);

alter table public.petition_volunteers enable row level security;
-- Default deny; the command RPC does every write. You can read your own offer, and an organizer
-- reads their petition's offers through the security-definer function below.
create policy own_volunteering on public.petition_volunteers for select using(user_id = private.actor());

-- Signers, savers and volunteers, minus the actor.
create or replace function private.followers(pid uuid, actor uuid) returns uuid[]
 language sql stable set search_path='' as $fn$
 select coalesce(array_agg(distinct u),'{}'::uuid[]) from (
   select user_id u from public.signatures where petition_id=pid
   union select user_id from public.petition_saves where petition_id=pid
   union select user_id from public.petition_volunteers where petition_id=pid) x
 where u is distinct from actor $fn$;

-- Organizer-only. A volunteer offered their name to the organizers, not to the public.
create or replace function public.lookaware_volunteers(petition_id uuid) returns jsonb
 language plpgsql security definer set search_path='' as $fn$
declare result jsonb;
begin
 if not private.manager(petition_id) then raise exception 'Only organizers can see who offered to help.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',v.id,'petitionId',v.petition_id,'name',pr.name,'roles',to_jsonb(v.roles),
   'note',v.note,'date',v.created_at) order by v.created_at desc),'[]'::jsonb)
 into result from public.petition_volunteers v join public.profiles pr on pr.id=v.user_id
 where v.petition_id=lookaware_volunteers.petition_id;
 return result;
end $fn$;
revoke all on function public.lookaware_volunteers(uuid) from public,anon;
grant execute on function public.lookaware_volunteers(uuid) to authenticated;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v3;
revoke all on function public.lookaware_command_v3(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare p public.petitions; uid uuid:=private.actor(); rs text[]; who text;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if command->>'type'='volunteer' then
  select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
  if not found or not private.visible(p.id) then raise exception 'Petition not found or unavailable.'; end if;
  if p.status<>'active' then raise exception 'This petition is not accepting offers of help right now.'; end if;
  if jsonb_typeof(command->'roles') is distinct from 'array' then raise exception 'Choose the help you can offer.'; end if;
  if jsonb_typeof(command->'note') is distinct from 'string' or length(command->>'note')>500 then raise exception 'Keep the note under 500 characters.'; end if;
  select array_agg(distinct r) into rs from jsonb_array_elements_text(command->'roles') r;
  select name into who from public.profiles where id=uid;
  -- No roles means "step back": a volunteer withdraws without asking the organizer.
  if rs is null then
   delete from public.petition_volunteers where petition_id=p.id and user_id=uid;
   if not found then raise exception 'You have not offered to help with this petition.'; end if;
   perform private.notify(private.managers(p.id,uid), who||' stepped back from volunteering.', 'volunteer');
   return null;
  end if;
  if not (rs <@ array['outreach','design','research','canvassing']) then raise exception 'Choose the help you can offer.'; end if;
  insert into public.petition_volunteers(petition_id,user_id,roles,note)
   values(p.id,uid,rs,trim(command->>'note'))
   on conflict (petition_id,user_id) do update set roles=excluded.roles, note=excluded.note, created_at=now();
  perform private.notify(private.managers(p.id,uid),
    who||' offered to help with '||array_to_string(rs,', ')||'.', 'volunteer');
  return null;
 end if;
 return public.lookaware_command_v3(command);
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

alter function public.lookaware_snapshot() rename to lookaware_snapshot_v2;
revoke all on function public.lookaware_snapshot_v2() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; uid uuid:=private.actor();
begin
 result:=public.lookaware_snapshot_v2();
 -- Public aggregate on each petition; who volunteered stays organizer-only.
 result:=jsonb_set(result,'{petitions}',(
   select coalesce(jsonb_agg(p||jsonb_build_object(
     'sampleVolunteers',coalesce(pt.sample_volunteers,0),
     'volunteerCount',coalesce(pt.sample_volunteers,0)+
       (select count(*) from public.petition_volunteers v where v.petition_id=pt.id)) order by ord),'[]'::jsonb)
   from jsonb_array_elements(result->'petitions') with ordinality as e(p,ord)
   left join public.petitions pt on pt.id=(e.p->>'id')::uuid));
 return result||jsonb_build_object(
   'volunteering',(select coalesce(jsonb_agg(jsonb_build_object(
      'petitionId',petition_id,'roles',to_jsonb(roles),'note',note)),'[]'::jsonb)
      from public.petition_volunteers where user_id=uid));
end $$;
revoke all on function public.lookaware_snapshot() from public,anon,authenticated;
grant execute on function public.lookaware_snapshot() to anon,authenticated;

commit;
