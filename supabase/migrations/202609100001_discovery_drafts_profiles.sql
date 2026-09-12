-- Extend the existing API without weakening its authorization or public projection.
alter table public.profiles add column bio text not null default '' check(length(bio)<=280),
 add column avatar text not null default 'leaf' check(avatar in ('leaf','sun','spark','mountain','flower')),
 add column accent text not null default 'forest' check(accent in ('forest','ocean','plum','sunset')),
 add column use_signing_history boolean not null default true;
create table public.petition_drafts (
 id uuid primary key, user_id uuid not null references public.profiles(id),
 draft jsonb not null check(jsonb_typeof(draft)='object' and octet_length(draft::text)<=30000),
 step integer not null default 0 check(step between 0 and 3),
 updated_at timestamptz not null default now()
);
create index petition_drafts_owner on public.petition_drafts(user_id,updated_at desc);
alter table public.petition_drafts enable row level security;
revoke all on public.petition_drafts from anon,authenticated;
grant select on public.petition_drafts to authenticated;
create policy own_drafts on public.petition_drafts for select to authenticated using(user_id=private.actor());
insert into public.badges(name,description) values
 ('Showing up','Sign five different petitions.'),('Community builder','Join two communities.'),
 ('Change starter','Publish your first petition.'),('Conversation starter','Contribute to a petition discussion.') on conflict(name) do nothing;

alter function public.lookaware_snapshot() rename to lookaware_snapshot_v1;
revoke all on function public.lookaware_snapshot_v1() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; uid uuid;
begin
 result:=public.lookaware_snapshot_v1(); uid:=private.actor();
 if uid is not null then
  result:=jsonb_set(result,'{profile}',(result->'profile')||(select jsonb_build_object('bio',p.bio,'avatar',p.avatar,'accent',p.accent,'useSigningHistory',p.use_signing_history) from public.profiles p where p.id=uid));
 end if;
 return result||jsonb_build_object('drafts',coalesce((select jsonb_agg(jsonb_build_object('id',id,'draft',draft,'step',step,'updatedAt',updated_at) order by updated_at desc) from public.petition_drafts where user_id=uid),'[]'::jsonb));
end $$;
grant execute on function public.lookaware_snapshot() to anon,authenticated;
revoke all on function public.lookaware_snapshot() from public;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v1;
revoke all on function public.lookaware_command_v1(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); kind text:=command->>'type'; result text; did uuid;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if kind='profile' then
  if exists(select 1 from unnest(array['name','bio','avatar','accent']) k where jsonb_typeof(command->k) is distinct from 'string') or jsonb_typeof(command->'useSigningHistory') is distinct from 'boolean' or length(trim(command->>'name')) not between 2 and 100 then raise exception 'Enter a display name and valid profile preferences.'; end if;
  update public.profiles set name=trim(command->>'name'),bio=trim(command->>'bio'),avatar=command->>'avatar',accent=command->>'accent',use_signing_history=(command->>'useSigningHistory')::boolean where id=uid;
  return null;
 elsif kind in ('saveDraft','deleteDraft') then
  did:=(command->>'id')::uuid;
  if exists(select 1 from public.petition_drafts where id=did and user_id<>uid) then raise exception 'This draft is private.'; end if;
  if kind='deleteDraft' then delete from public.petition_drafts where id=did and user_id=uid; return null; end if;
  insert into public.petition_drafts(id,user_id,draft,step) values(did,uid,command->'draft',(command->>'step')::integer)
   on conflict(id) do update set draft=excluded.draft,step=excluded.step,updated_at=now() where petition_drafts.user_id=uid;
  return did::text;
 end if;
 result:=public.lookaware_command_v1(command);
 if kind='create' and command ? 'draftId' then delete from public.petition_drafts where id=(command->>'draftId')::uuid and user_id=uid; end if;
 -- Awards are computed from authoritative records, never client supplied counters.
 insert into public.user_badges(user_id,badge_id)
 select uid,b.id from public.badges b where
 (b.name='Showing up' and (select count(*) from public.signatures where user_id=uid)>=5) or
 (b.name='Community builder' and (select count(*) from public.community_members where user_id=uid and active)>=2) or
 (b.name='Change starter' and exists(select 1 from public.petitions where owner_id=uid and status in ('active','closed','successful'))) or
 (b.name='Conversation starter' and exists(select 1 from public.discussion_posts where author_id=uid and petition_id is not null and not archived))
 on conflict do nothing;
 return result;
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;
