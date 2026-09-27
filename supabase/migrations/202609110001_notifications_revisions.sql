-- Closes the feedback loop and the revision gaps in the original command surface:
--   * every event that changes a petition someone follows or manages writes a notification
--   * a published petition can be revised field by field, not only title and action
--   * a signer can withdraw, an author or moderator can retract a post, an owner can archive
--   * members can create communities and owners can appoint moderators
--
-- Later migrations wrap lookaware_command / lookaware_snapshot as a decorator chain, each
-- delegating unknown commands downward. So this migration replaces the BASE implementations
-- (lookaware_command_v1, lookaware_snapshot_v1) in place: the drafts and signature-receipt
-- layers above keep working untouched, and new command types fall through their delegation to
-- the base. Grants were revoked on the base names and `create or
-- replace` preserves that, so nothing is re-granted here.
begin;

-- Tombstones, not silent deletes: a thread that quietly loses posts misrepresents itself.
alter table public.discussion_posts add column if not exists removed boolean not null default false;
alter table public.petition_updates add column if not exists removed boolean not null default false;
alter table public.official_responses add column if not exists removed boolean not null default false;

create index if not exists notifications_user_kind on public.notifications(user_id, kind, created_at desc);

-- Attribution and removal state for entries whose author is already shown publicly.
create or replace function private.authored(e jsonb, author_id uuid, removed boolean) returns jsonb
 language sql immutable set search_path='' as $fn$
 select e||jsonb_build_object('authorId',author_id,'removed',removed) $fn$;

create or replace function private.notify(recipients uuid[], body text, kind text) returns void
 language sql set search_path='' as $fn$
 insert into public.notifications(user_id,kind,body)
 select distinct r, kind, body from unnest(recipients) r where r is not null $fn$;

-- Signers and savers, minus the actor. Saving a petition is how you follow it without signing.
-- The volunteering migration adds volunteers to this set.
create or replace function private.followers(pid uuid, actor uuid) returns uuid[]
 language sql stable set search_path='' as $fn$
 select coalesce(array_agg(distinct u),'{}'::uuid[]) from (
   select user_id u from public.signatures where petition_id=pid
   union select user_id from public.petition_saves where petition_id=pid) x
 where u is distinct from actor $fn$;

create or replace function private.managers(pid uuid, actor uuid) returns uuid[]
 language sql stable set search_path='' as $fn$
 select coalesce(array_agg(distinct u),'{}'::uuid[]) from (
   select owner_id u from public.petitions where id=pid
   union select user_id from public.petition_collaborators where petition_id=pid) x
 where u is distinct from actor $fn$;

-- Highest signature milestone newly crossed, or null. Progress only, never a policy outcome.
create or replace function private.milestone(prev int, next int, goal int) returns int
 language sql immutable set search_path='' as $fn$
 select max(n) from unnest(array[25,50,75,100]) n
 where goal>0 and next::numeric/goal>=n/100.0 and prev::numeric/goal<n/100.0 $fn$;

-- Archived petitions leave every view, including their organizer's, matching the local adapter
-- and the warning shown before archiving. Drafts stay visible to the people who manage them.
create or replace function private.visible(pid uuid) returns boolean
 language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.petitions p where p.id=pid
   and (p.status in ('active','closed','successful') or (p.status='draft' and private.manager(p.id)))) $fn$;

create or replace function private.moderates(cid uuid, actor uuid) returns boolean
 language sql stable set search_path='' as $fn$
 select exists(select 1 from public.communities c where c.id=cid and c.owner_id=actor)
     or exists(select 1 from public.community_members m
               where m.community_id=cid and m.user_id=actor and m.active and m.role in ('moderator','owner')) $fn$;

-- Base snapshot. Adds authorId/removed to entries a person can retract, moderator and
-- sample-member data to communities, and exposes sampleVelocity beside the rolling 7-day count.
create or replace function public.lookaware_snapshot_v1() returns jsonb language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=private.actor(); result jsonb; profile jsonb; person public.profiles; principal private.principals;
begin
 if uid is null and coalesce(auth.jwt()->>'sub','')<>'' then
  perform pg_advisory_xact_lock(hashtextextended(auth.jwt()->>'sub',0)); uid:=private.actor();
  if uid is null then
   insert into public.profiles(name) values('Community member') returning id into uid;
   insert into private.principals(profile_id,clerk_subject,email_verified) values(uid,auth.jwt()->>'sub',coalesce((auth.jwt()->>'email_verified')::boolean,false));
  end if;
 end if;
 if uid is not null then
  select * into person from public.profiles where id=uid; select * into principal from private.principals where profile_id=uid;
  profile:=jsonb_build_object('id',uid,'name',person.name,'city',person.city,'onboarded',person.onboarded,'emailVerified',principal.email_verified,'locationApproved',principal.location_approved,
  'interests',coalesce((select jsonb_agg(t.name) from public.user_interests i join public.topics t on t.id=i.topic_id where i.user_id=uid),'[]'),
  'joined',coalesce((select jsonb_agg(community_id) from public.community_members where user_id=uid and active),'[]'),
  'badges',coalesce((select jsonb_agg(b.name) from public.user_badges ub join public.badges b on b.id=ub.badge_id where ub.user_id=uid),'[]'));
 end if;
 select jsonb_build_object('profile',profile,
 'communities',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'city',c.city,'topic',c.topic,'ownerId',c.owner_id,
   'sampleMembers',c.sample_members,
   'moderators',coalesce((select jsonb_agg(m.user_id) from public.community_members m where m.community_id=c.id and m.active and m.role='moderator'),'[]'),
   'members',c.sample_members+(select count(*) from public.community_members m where m.community_id=c.id and m.active))) from public.communities c where not c.archived),'[]'),
 'petitions',coalesce((select jsonb_agg(p.content||jsonb_build_object('id',p.id,'ownerId',p.owner_id,'creator',u.name,'communityId',p.community_id,'status',p.status,'createdAt',p.created_at,
 'collaborators',coalesce((select jsonb_agg(user_id) from public.petition_collaborators where petition_id=p.id),'[]'),
 'count',p.sample_count+(select count(*) from public.signatures where petition_id=p.id),'sampleCount',p.sample_count,
 'saves',p.sample_saves+(select count(*) from public.petition_saves where petition_id=p.id),
 'sampleVelocity',p.sample_velocity,
 'recentSignatures',p.sample_velocity+(select count(*) from public.signatures where petition_id=p.id and created_at>now()-interval '7 days'),
 'evidence',coalesce((select jsonb_agg(jsonb_build_object('label',label,'url',url)) from public.petition_sources where petition_id=p.id),'[]'),
 'updates',coalesce((select jsonb_agg(private.authored(private.entry(e.id,e.body,a.name,e.created_at,case when e.removed then 'removed' else 'update' end),e.author_id,e.removed) order by e.created_at desc) from public.petition_updates e join public.profiles a on a.id=e.author_id where e.petition_id=p.id),'[]'),
 'edits',coalesce((select jsonb_agg(private.entry(e.id,e.body,a.name,e.created_at,'material edit') order by e.created_at desc) from public.petition_edits e join public.profiles a on a.id=e.author_id where e.petition_id=p.id),'[]'),
 'endorsements',coalesce((select jsonb_agg(private.entry(e.id,e.body,c.name,e.created_at,'endorsement')) from public.petition_endorsements e join public.communities c on c.id=e.community_id where e.petition_id=p.id),'[]'),
 'discussion',coalesce((select jsonb_agg(private.authored(private.entry(e.id,e.body,a.name,e.created_at,case when e.removed then 'removed' else e.kind end),e.author_id,e.removed) order by e.created_at) from public.discussion_posts e join public.profiles a on a.id=e.author_id where e.petition_id=p.id and not e.archived),'[]'),
 'responses',coalesce((select jsonb_agg(private.authored(private.entry(e.id,e.body,a.name,e.created_at,'response'),e.author_id,e.removed)||jsonb_build_object('organization',e.organization,'verification',e.verification)) from public.official_responses e join public.profiles a on a.id=e.author_id where e.petition_id=p.id and (e.verification='verified' or private.manager(p.id))),'[]')) order by p.created_at desc) from public.petitions p join public.profiles u on u.id=p.owner_id where private.visible(p.id)),'[]'),
 'signed',coalesce((select jsonb_agg(petition_id) from public.signatures where user_id=uid),'[]'),
 'saved',coalesce((select jsonb_agg(petition_id) from public.petition_saves where user_id=uid),'[]'),
 'signatures',coalesce((select jsonb_agg(jsonb_build_object('id',id,'petitionId',petition_id,'displayName',display_name,'identity',identity_mode)) from public.signatures where private.visible(petition_id)),'[]'),
 'reports',coalesce((select jsonb_agg(jsonb_build_object('id',id,'petitionId',petition_id,'reason',reason,'status',status,'appeal',appeal)) from public.reports where user_id=uid),'[]'),
 'notifications',coalesce((select jsonb_agg(private.entry(id,body,'Swipe4Change',created_at,kind) order by created_at desc) from public.notifications where user_id=uid),'[]'),
 'customApprovals',coalesce((select jsonb_agg(petition_id) from private.eligibility_requests where user_id=uid and status='approved'),'[]')) into result;
 return result;
end $fn$;

create or replace function public.lookaware_community_posts(community_id uuid) returns jsonb language sql stable security definer set search_path='' as $fn$
 select coalesce(jsonb_agg(private.authored(private.entry(p.id,p.body,u.name,p.created_at,case when p.removed then 'removed' else p.kind end),p.author_id,p.removed) order by p.created_at),'[]')
 from public.discussion_posts p join public.profiles u on u.id=p.author_id join public.communities c on c.id=p.community_id
 where p.community_id=lookaware_community_posts.community_id and not p.archived and not c.archived $fn$;

create or replace function public.lookaware_command_v1(command jsonb) returns text language plpgsql security definer set search_path='' as $fn$
declare uid uuid:=private.actor(); kind text:=command->>'type'; pid uuid; cid uuid; p public.petitions; d jsonb; nm text; mode text; ident text; b text; affected integer;
        patch jsonb; changed text[]; note text; before_count integer; reached integer; shown text; author uuid; owns boolean;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 select name into nm from public.profiles where id=uid;
 if kind='onboard' then
  if length(trim(command->>'city')) not between 2 and 100 or jsonb_array_length(command->'interests') not in (0,3,4,5) or exists(select 1 from jsonb_array_elements_text(command->'interests') i where not exists(select 1 from public.topics t where t.name=i)) then raise exception 'Choose three interests or skip, and enter a city.'; end if;
  update public.profiles set city=trim(command->>'city'),onboarded=true where id=uid;
  delete from public.user_interests where user_id=uid;
  insert into public.user_interests(user_id,topic_id) select uid,id from public.topics where name in(select jsonb_array_elements_text(command->'interests'));
  return null;
 elsif kind='createCommunity' then
  if length(trim(coalesce(command->>'name',''))) not between 3 and 60 or length(trim(coalesce(command->>'description',''))) not between 20 and 280 or length(trim(coalesce(command->>'city',''))) not between 2 and 100 then raise exception 'Give the community a name, a description, and a city.'; end if;
  if not exists(select 1 from public.topics t where t.name=command->>'topic') then raise exception 'Choose a topic.'; end if;
  if exists(select 1 from public.communities where lower(name)=lower(trim(command->>'name')) and not archived) then raise exception 'A community with that name already exists.'; end if;
  insert into public.communities(owner_id,name,description,city,topic) values(uid,trim(command->>'name'),trim(command->>'description'),trim(command->>'city'),command->>'topic') returning id into cid;
  insert into public.community_members(community_id,user_id,role) values(cid,uid,'owner') on conflict(community_id,user_id) do update set active=true, role='owner';
  return cid::text;
 elsif kind='moderator' then
  cid:=(command->>'communityId')::uuid; author:=(command->>'profileId')::uuid;
  if not exists(select 1 from public.communities where id=cid and owner_id=uid and not archived) then raise exception 'Only the community owner can change moderators.'; end if;
  if author=uid then raise exception 'You already moderate as the owner.'; end if;
  update public.community_members set role=case when (command->>'grant')::boolean then 'moderator' else 'member' end
   where community_id=cid and user_id=author and active;
  get diagnostics affected=row_count; if affected=0 then raise exception 'Choose a current member of this community.'; end if;
  perform private.notify(array[author], case when (command->>'grant')::boolean then 'You are now a moderator of ' else 'You are no longer a moderator of ' end||(select name from public.communities where id=cid)||'.', 'community');
  return null;
 elsif kind='join' then
  cid:=(command->>'communityId')::uuid;
  if not exists(select 1 from public.communities where id=cid and not archived) then raise exception 'Community not found.'; end if;
  insert into public.community_members(community_id,user_id) values(cid,uid) on conflict(community_id,user_id) do update set active=not community_members.active;
  return null;
 elsif kind='communityPost' then
  cid:=(command->>'communityId')::uuid;
  if not exists(select 1 from public.community_members where community_id=cid and user_id=uid and active) then raise exception 'Join this community before posting.'; end if;
  insert into public.discussion_posts(community_id,author_id,kind,body) values(cid,uid,command->>'kind',trim(command->>'body')); return null;
 elsif kind='removeEntry' then
  -- Removal replaces the body with a visible note. The author may retract their own post; a
  -- petition's managers may retract anything on their petition; a community's owner or its
  -- moderators may retract anything in their community.
  if command->>'scope'='communityPost' then
   cid:=(command->>'communityId')::uuid;
   select author_id into author from public.discussion_posts where id=(command->>'entryId')::uuid and community_id=cid and not removed;
   if author is null then raise exception 'Post not found.'; end if;
   owns:=author=uid;
   if not owns and not private.moderates(cid,uid) then raise exception 'Only the author, the community owner, or a moderator can remove it.'; end if;
   update public.discussion_posts set removed=true, body=case when owns then 'This post was removed by its author.' else 'This post was removed by a moderator.' end where id=(command->>'entryId')::uuid;
   if not owns then perform private.notify(array[author],'A moderator removed your post in '||(select name from public.communities where id=cid)||'.','community'); end if;
   return null;
  end if;
  pid:=(command->>'petitionId')::uuid;
  if command->>'scope'='discussion' then
   select author_id into author from public.discussion_posts where id=(command->>'entryId')::uuid and petition_id=pid and not removed;
  elsif command->>'scope'='update' then
   select author_id into author from public.petition_updates where id=(command->>'entryId')::uuid and petition_id=pid and not removed;
  elsif command->>'scope'='response' then
   select author_id into author from public.official_responses where id=(command->>'entryId')::uuid and petition_id=pid and not removed;
  else raise exception 'Unsupported removal scope.'; end if;
  if author is null then raise exception 'Post not found or already removed.'; end if;
  owns:=author=uid;
  -- Organizer updates and recorded responses speak for the petition, so only managers retract them.
  if not (private.manager(pid) or (command->>'scope'='discussion' and owns)) then raise exception 'You cannot remove this post.'; end if;
  note:=case when owns then 'This post was removed by its author.' else 'This post was removed by a moderator.' end;
  if command->>'scope'='discussion' then update public.discussion_posts set removed=true, body=note where id=(command->>'entryId')::uuid;
  elsif command->>'scope'='update' then update public.petition_updates set removed=true, body=note where id=(command->>'entryId')::uuid;
  else update public.official_responses set removed=true, body=note where id=(command->>'entryId')::uuid; end if;
  if not owns then perform private.notify(array[author],'The organizer removed your post on a petition you contributed to.','discussion'); end if;
  return null;
 elsif kind='appeal' then
  b:=trim(command->>'body');if length(b) not between 5 and 2000 then raise exception 'Write an appeal of 5 to 2000 characters.'; end if;
  update public.reports set appeal=b,status='appealed' where id=(command->>'reportId')::uuid and user_id=uid;
  get diagnostics affected=row_count; if affected=0 then raise exception 'Report not found.'; end if;return null;
 elsif kind='withdrawReport' then
  delete from public.reports where id=(command->>'reportId')::uuid and user_id=uid;
  get diagnostics affected=row_count; if affected=0 then raise exception 'Report not found.'; end if;return null;
 elsif kind='create' then
  -- Whitelist draft fields, preventing payload injection of aggregate/private fields.
  select jsonb_object_agg(key,value) into d from jsonb_each(command->'draft') where key=any(array['title','summary','problem','action','recipient','topic','city','communityId','goal','deadline','evidence','verification','identities','customRule']);
  perform private.validate_draft(d);
  insert into public.petitions(owner_id,community_id,content,status) values(uid,(d->>'communityId')::uuid,d,case when (command->>'publish')::boolean then 'active' else 'draft' end) returning id into pid;
  insert into public.petition_sources(petition_id,label,url) select pid,e->>'label',e->>'url' from jsonb_array_elements(d->'evidence') e;
  return pid::text;
 end if;
 pid:=(command->>'petitionId')::uuid;
 -- Row lock serializes signing, rule edits, publication and close operations.
 select * into p from public.petitions where id=pid for update;
 if not found or not private.visible(pid) then raise exception 'Petition not found or unavailable.'; end if;
 if kind='save' then
  delete from public.petition_saves where petition_id=pid and user_id=uid;get diagnostics affected=row_count;
  if affected=0 then insert into public.petition_saves(petition_id,user_id) values(pid,uid);end if;return null;
 elsif kind='sign' then
  mode:=p.content->>'verification';ident:=command->>'identity';
  if p.status<>'active' or (p.content->>'deadline')::date<current_date then raise exception 'This petition is not accepting signatures.';end if;
  if not p.content->'identities' ? ident then raise exception 'Choose an allowed public identity.';end if;
  if exists(select 1 from public.signatures where petition_id=pid and user_id=uid) then raise exception 'You have already signed this petition.';end if;
  if mode='email' and not exists(select 1 from private.principals where profile_id=uid and email_verified) then raise exception 'A verified email is required.';end if;
  if mode='location' and not exists(select 1 from private.principals where profile_id=uid and location_approved) then raise exception 'Trusted location approval is required.';end if;
  if mode='community' and not exists(select 1 from public.community_members where user_id=uid and community_id=p.community_id and active) then raise exception 'Join this community before signing.';end if;
  if mode='custom' and not exists(select 1 from private.eligibility_requests where petition_id=pid and user_id=uid and status='approved') then raise exception 'Organizer eligibility approval is required.';end if;
  shown:=private.display_name(nm,ident);
  select p.sample_count+count(*) into before_count from public.signatures where petition_id=pid;
  insert into public.signatures(petition_id,user_id,identity_mode,display_name) values(pid,uid,ident,shown);
  insert into public.user_badges(user_id,badge_id) select uid,id from public.badges where name='First voice' on conflict do nothing;
  perform private.notify(array[uid],'Your signature on “'||(p.content->>'title')||'” is confirmed. Public name: '||shown,'signature');
  -- Organizers only ever learn the public identity the signer chose, never their real name.
  perform private.notify(private.managers(pid,uid),shown||' signed “'||(p.content->>'title')||'”. '||(before_count+1)||' of '||(p.content->>'goal')||'.','signature');
  reached:=private.milestone(before_count,before_count+1,(p.content->>'goal')::int);
  if reached is not null then
   perform private.notify(private.managers(pid,uid)||private.followers(pid,uid)||array[uid],'“'||(p.content->>'title')||'” reached '||reached||'% of its signature goal — '||(before_count+1)||' of '||(p.content->>'goal')||' voices. This is signature progress, not a verified outcome.','milestone');
  end if;
  return null;
 elsif kind='withdraw' then
  select id into author from public.signatures where petition_id=pid and user_id=uid;
  if author is null then raise exception 'You have not signed this petition.'; end if;
  -- The receipt and any ripple credit cascade with the signature.
  delete from public.signatures where id=author;
  perform private.notify(array[uid],'You withdrew your signature from “'||(p.content->>'title')||'”. It is no longer counted or shown publicly, and your drawn signature was deleted.','signature');
  return null;
 elsif kind='discussion' then
  if p.status<>'active' then raise exception 'Discussion is closed.';end if;
  insert into public.discussion_posts(petition_id,author_id,kind,body) values(pid,uid,command->>'kind',trim(command->>'body'));
  perform private.notify(private.managers(pid,uid),nm||' posted a '||(command->>'kind')||' on “'||(p.content->>'title')||'”.','discussion');
  return null;
 elsif kind='report' then
  insert into public.reports(petition_id,user_id,reason) values(pid,uid,trim(command->>'reason'));return null;
 elsif kind='requestEligibility' then
  if p.content->>'verification'<>'custom' then raise exception 'This petition does not use custom review.';end if;
  insert into private.eligibility_requests(petition_id,user_id,statement) values(pid,uid,trim(command->>'statement')) on conflict(petition_id,user_id) do update set statement=excluded.statement,status='pending' where eligibility_requests.status='declined';
  get diagnostics affected=row_count;if affected=0 then raise exception 'Your request is already pending or approved.';end if;
  -- Without this the organizer has no way to learn a request is waiting.
  perform private.notify(private.managers(pid,uid),private.display_name(nm,'first_name_last_initial')||' requested eligibility review on “'||(p.content->>'title')||'”. Review it in Manage.','eligibility');
  return null;
 elsif kind='endorse' then
  cid:=(command->>'communityId')::uuid;
  if not exists(select 1 from public.communities where id=cid and owner_id=uid and not archived) then raise exception 'Only the community owner can endorse on its behalf.';end if;
  insert into public.petition_endorsements(petition_id,community_id,body) select pid,cid,name||' supports this requested action.' from public.communities where id=cid;
  perform private.notify(private.managers(pid,uid),(select name from public.communities where id=cid)||' endorsed “'||(p.content->>'title')||'”.','endorsement');
  return null;
 end if;
 if not private.manager(pid) then raise exception 'Organizer permission required.';end if;
 if kind='update' then
  insert into public.petition_updates(petition_id,author_id,body) values(pid,uid,trim(command->>'body'));
  perform private.notify(private.followers(pid,uid),'New update on “'||(p.content->>'title')||'” from '||nm||'.','update');
 elsif kind='publish' then
  if p.status<>'draft' then raise exception 'Only drafts can be published.';end if;
  perform private.validate_draft(p.content);update public.petitions set status='active',updated_at=now() where id=pid;
 elsif kind='edit' then
  b:=trim(command->>'reason');if length(b) not between 5 and 2000 then raise exception 'Explain the material edit.'; end if;
  -- Every editable field, not only title and action. topic and communityId are excluded: they
  -- define the audience the petition was signed into. The immutable_signing_rules trigger still
  -- rejects verification/identities/customRule changes once a signature exists.
  select jsonb_object_agg(key,value) into patch from jsonb_each(command->'patch')
   where key=any(array['title','summary','problem','action','recipient','city','goal','deadline','evidence','verification','identities','customRule']);
  if patch is null then raise exception 'Change at least one field.'; end if;
  select coalesce(array_agg(e.key order by e.key),'{}'::text[]) into changed from jsonb_each(patch) e where e.value is distinct from p.content->e.key;
  if cardinality(changed)=0 then raise exception 'Nothing changed. Revise a field before publishing.'; end if;
  d:=p.content||patch;
  perform private.validate_draft(d);
  update public.petitions set content=d,updated_at=now() where id=pid;
  if patch ? 'evidence' then
   delete from public.petition_sources where petition_id=pid;
   insert into public.petition_sources(petition_id,label,url) select pid,e->>'label',e->>'url' from jsonb_array_elements(d->'evidence') e;
  end if;
  note:=(select string_agg(k||': “'||coalesce(p.content->>k,'')||'” → “'||coalesce(d->>k,'')||'”','. ' order by k) from unnest(changed) k);
  insert into public.petition_edits(petition_id,author_id,body,previous_content) values(pid,uid,note||'. Reason: '||b,p.content);
  perform private.notify(private.followers(pid,uid),'“'||(d->>'title')||'” was revised by the organizer: '||array_to_string(changed,', ')||'. The previous wording is in its public history.','edit');
 elsif kind='response' then
  b:=trim(command->>'body');if length(b) not between 5 and 2000 or length(trim(command->>'organization')) not between 5 and 200 then raise exception 'Supply a response and organization.';end if;
  insert into public.official_responses(petition_id,author_id,body,organization) values(pid,uid,b,trim(command->>'organization'));
  perform private.notify(private.followers(pid,uid),'An unverified response from '||trim(command->>'organization')||' was recorded on “'||(p.content->>'title')||'”. Swipe4Change has not verified the respondent.','response');
 elsif kind='close' then
  if command->>'status'='archived' then
   -- Archiving hides a petition from everyone, so it must follow a public close.
   if p.owner_id<>uid then raise exception 'Only the owner can archive a petition.'; end if;
   if p.status not in ('draft','closed','successful') then raise exception 'Close or mark this petition successful before archiving it.'; end if;
  elsif p.status<>'active' or command->>'status' not in ('closed','successful') then
   raise exception 'Only active petitions can be closed or marked successful.';
  end if;
  perform private.notify(private.followers(pid,uid),
   case when command->>'status'='archived'
    then '“'||(p.content->>'title')||'” was archived by its organizer and is no longer listed.'
    else '“'||(p.content->>'title')||'” was marked '||(command->>'status')||' by its organizer, so it is no longer accepting signatures. This is the organizer''s report, not independent verification.' end,'status');
  update public.petitions set status=command->>'status',updated_at=now() where id=pid;
  insert into public.petition_edits(petition_id,author_id,body,previous_content) values(pid,uid,'Organizer marked this petition '||(command->>'status')||'. This is not independent verification.',p.content);
 elsif kind='collaborator' then
  if p.owner_id<>uid then raise exception 'Only the owner can add collaborators.';end if;
  insert into public.petition_collaborators(petition_id,user_id) values(pid,(command->>'profileId')::uuid) on conflict do nothing;
 elsif kind='reviewEligibility' then
  if p.content->>'verification'<>'custom' then raise exception 'Only custom eligibility may be organizer-reviewed.';end if;
  update private.eligibility_requests set status=case when (command->>'approved')::boolean then 'approved' else 'declined' end where id=(command->>'requestId')::uuid and petition_id=pid returning user_id into author;
  get diagnostics affected=row_count;if affected=0 then raise exception 'Request not found.';end if;
  perform private.notify(array[author],
   case when (command->>'approved')::boolean
    then 'The organizer approved your eligibility to sign “'||(p.content->>'title')||'”. You can sign it now.'
    else 'The organizer declined your eligibility request on “'||(p.content->>'title')||'”. You can submit a new statement.' end,'eligibility');
 else raise exception 'Unsupported command.';
 end if;
 return null;
end $fn$;

commit;
