-- Members hear about their community.
--
-- Announcements and events posted by the people who run a community (owner or moderators) notify
-- its members. A member's own event still lists under Events but notifies no one, and the
-- private organizer room never does. A new campaign is announced once, the first time it is
-- actually public: publication marks it announce_pending, and the publication check announces it
-- when it clears. Petitions published before this migration, and restorations, never announce.
begin;

alter table public.petitions add column announce_pending boolean not null default false;

create function private.excerpt(t text) returns text language sql immutable set search_path='' as $fn$
 select case when length(t)>100 then left(t,99)||'…' else t end $fn$;

-- Active members of a community, minus the given people.
create function private.members(cid uuid, skip uuid[]) returns uuid[]
 language sql stable set search_path='' as $fn$
 select coalesce(array_agg(m.user_id),'{}'::uuid[]) from public.community_members m
 where m.community_id=cid and m.active and not (m.user_id=any(skip)) $fn$;
-- Member lists stay inside the database: only the functions below read them.
revoke all on function private.members(uuid,uuid[]), private.excerpt(text) from public,anon,authenticated;

-- As in 202610010003, plus the announcement when a published petition first goes public.
create or replace function public.ai_apply_publish_screening(target uuid, hits text[], seen timestamptz) returns void
 language plpgsql security definer set search_path='' as $$
declare p public.petitions;
begin
 if exists(select 1 from unnest(hits) h where h not in ('spam','threats','harassment','hate','nonsense')) then
  raise exception 'Unknown review category.'; end if;
 select * into p from public.petitions where id=target and screening='pending' and updated_at=seen for update;
 if not found then return; end if;
 if cardinality(hits)=0 then
  update public.petitions set screening='clear',held_for=null,hidden=false,announce_pending=false where id=p.id;
  if p.hidden then
   perform private.notify(private.managers(p.id,null),
    '“'||(p.content->>'title')||'” passed the automatic check and is public.','moderation');
  end if;
  if p.announce_pending and p.status='active' then
   perform private.notify(private.members(p.community_id,private.managers(p.id,null)),
    'New campaign in '||(select c.name from public.communities c where c.id=p.community_id)
    ||': “'||(p.content->>'title')||'”.','community');
  end if;
 else
  update public.petitions set screening='flagged',held_for=hits,hidden=true where id=p.id;
  perform private.notify(private.managers(p.id,null),
   '“'||(p.content->>'title')||'” is not public yet: the automatic check flagged possible '
   ||private.review_label(hits)||'. Edit the wording to fix it, or wait for a reviewer.','moderation');
 end if;
end $$;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v12;
revoke all on function public.lookaware_command_v12(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); kind text:=command->>'type'; result text; cid uuid;
begin
 result:=public.lookaware_command_v12(command);
 if (kind='create' and coalesce((command->>'publish')::boolean,false)) or kind='publish' then
  update public.petitions set announce_pending=true
   where id=coalesce(result,command->>'petitionId')::uuid and status='active';
 elsif kind='communityPost' and command->>'kind' in ('announcement','event')
   and command->>'space'<>'organizers' then
  cid:=(command->>'communityId')::uuid;
  if private.moderates(cid,uid) then
   perform private.notify(private.members(cid,array[uid]),
    (select c.name from public.communities c where c.id=cid)||' '||(command->>'kind')||': '
    ||private.excerpt(trim(command->>'body')),'community');
  end if;
 end if;
 return result;
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

commit;
