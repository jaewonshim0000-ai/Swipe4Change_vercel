-- LookAware: all public tables use RLS. Writes go through authenticated, narrow RPC commands.
begin;
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;
create table public.profiles (id uuid primary key default gen_random_uuid(), name text not null check(length(name) between 1 and 100), city text not null default '', onboarded boolean not null default false, created_at timestamptz not null default now());
create table private.principals (profile_id uuid primary key references public.profiles(id), clerk_subject text unique not null, email_verified boolean not null default false, location_approved boolean not null default false);
create table public.topics (id uuid primary key default gen_random_uuid(), name text unique not null, created_at timestamptz not null default now());
create table public.user_interests (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), topic_id uuid not null references public.topics(id), created_at timestamptz not null default now(), unique(user_id,topic_id));
create table public.communities (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), name text not null, description text not null, city text not null, topic text not null, sample_members int not null default 0 check(sample_members>=0), archived boolean not null default false, created_at timestamptz not null default now());
create table public.community_members (id uuid primary key default gen_random_uuid(), community_id uuid not null references public.communities(id), user_id uuid not null references public.profiles(id), role text not null default 'member' check(role in ('member','moderator','owner')), active boolean not null default true, created_at timestamptz not null default now(), unique(community_id,user_id));
create table public.petitions (id uuid primary key default gen_random_uuid(), owner_id uuid not null references public.profiles(id), community_id uuid not null references public.communities(id), content jsonb not null, status text not null default 'draft' check(status in ('draft','active','closed','successful','archived')), sample_count integer not null default 0 check(sample_count>=0), sample_saves integer not null default 0 check(sample_saves>=0), sample_velocity integer not null default 0 check(sample_velocity>=0), created_at timestamptz not null default now(), updated_at timestamptz not null default now(), check(content->>'verification' in ('account','email','community','location','custom')), check(jsonb_array_length(content->'identities')>=1));
create table public.petition_collaborators (id uuid primary key default gen_random_uuid(), petition_id uuid not null references public.petitions(id), user_id uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(petition_id,user_id));
create table public.petition_sources (id uuid primary key default gen_random_uuid(), petition_id uuid not null references public.petitions(id), label text not null, url text not null check(url like 'https://%'), created_at timestamptz not null default now());
create table public.petition_edits (id uuid primary key default gen_random_uuid(), petition_id uuid not null references public.petitions(id), author_id uuid not null references public.profiles(id), body text not null, previous_content jsonb not null, created_at timestamptz not null default now());
create table public.signatures (id uuid primary key default gen_random_uuid(), petition_id uuid not null references public.petitions(id), user_id uuid not null references public.profiles(id), identity_mode text not null check(identity_mode in ('full_name','first_name_last_initial','anonymous')), display_name text not null, created_at timestamptz not null default now(), unique(petition_id,user_id));
create table public.petition_saves (id uuid primary key default gen_random_uuid(), petition_id uuid not null references public.petitions(id), user_id uuid not null references public.profiles(id), created_at timestamptz not null default now(), unique(petition_id,user_id));
create table public.petition_updates (id uuid primary key default gen_random_uuid(), petition_id uuid not null references public.petitions(id), author_id uuid not null references public.profiles(id), body text not null check(length(body) between 5 and 2000), created_at timestamptz not null default now());
create table public.petition_endorsements (id uuid primary key default gen_random_uuid(), petition_id uuid not null references public.petitions(id), community_id uuid not null references public.communities(id), body text not null, created_at timestamptz not null default now(), unique(petition_id,community_id));
create table public.discussion_posts (id uuid primary key default gen_random_uuid(), petition_id uuid references public.petitions(id), community_id uuid references public.communities(id), author_id uuid not null references public.profiles(id), kind text not null check(kind in ('question','idea','experience')), body text not null check(length(body) between 5 and 2000), archived boolean not null default false, created_at timestamptz not null default now(), check(num_nonnulls(petition_id,community_id)=1));
create table public.reports (id uuid primary key default gen_random_uuid(), petition_id uuid not null references public.petitions(id), user_id uuid not null references public.profiles(id), reason text not null check(length(reason) between 5 and 2000), status text not null default 'submitted' check(status in ('submitted','reviewed','appealed')), appeal text not null default '', created_at timestamptz not null default now());
create table public.official_responses (id uuid primary key default gen_random_uuid(), petition_id uuid not null references public.petitions(id), author_id uuid not null references public.profiles(id), body text not null, organization text not null, verification text not null default 'unverified' check(verification in ('unverified','pending','verified')), created_at timestamptz not null default now());
create table public.badges (id uuid primary key default gen_random_uuid(), name text unique not null, description text not null, created_at timestamptz not null default now());
create table public.user_badges (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), badge_id uuid not null references public.badges(id), created_at timestamptz not null default now(), unique(user_id,badge_id));
create table public.notifications (id uuid primary key default gen_random_uuid(), user_id uuid not null references public.profiles(id), body text not null, kind text not null, created_at timestamptz not null default now());
create table private.eligibility_requests (id uuid primary key default gen_random_uuid(), petition_id uuid not null references public.petitions(id), user_id uuid not null references public.profiles(id), statement text not null check(length(statement) between 5 and 2000), status text not null default 'pending' check(status in ('pending','approved','declined')), created_at timestamptz not null default now(), unique(petition_id,user_id));
create index petitions_community_status on public.petitions(community_id,status,created_at desc);
create index signatures_petition_time on public.signatures(petition_id,created_at desc);
create index signatures_user on public.signatures(user_id);
create index members_user on public.community_members(user_id,active);
create index saves_user on public.petition_saves(user_id);
create index posts_petition on public.discussion_posts(petition_id,created_at);
create index posts_community on public.discussion_posts(community_id,created_at);
create index notifications_user on public.notifications(user_id,created_at desc);
create index reports_user on public.reports(user_id);

create function private.actor() returns uuid language sql stable security definer set search_path='' as $$ select profile_id from private.principals where clerk_subject=auth.jwt()->>'sub' $$;
create function private.manager(pid uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.petitions p where p.id=pid and (p.owner_id=private.actor() or exists(select 1 from public.petition_collaborators c where c.petition_id=p.id and c.user_id=private.actor()))) $$;
create function private.visible(pid uuid) returns boolean language sql stable security definer set search_path='' as $$ select exists(select 1 from public.petitions p where p.id=pid and (p.status in ('active','closed','successful') or private.manager(p.id))) $$;
-- Only these safe helper functions are callable by policy evaluation. No private-table access is granted.
grant usage on schema private to anon,authenticated;
revoke all on all tables in schema private from public,anon,authenticated;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.actor(),private.manager(uuid),private.visible(uuid) to anon,authenticated;

do $$ declare t text; begin
 foreach t in array array['profiles','topics','user_interests','communities','community_members','petitions','petition_collaborators','petition_sources','petition_edits','signatures','petition_saves','petition_updates','petition_endorsements','discussion_posts','reports','official_responses','badges','user_badges','notifications'] loop
 execute format('alter table public.%I enable row level security',t);
 execute format('revoke all on public.%I from anon,authenticated',t);
 execute format('grant select on public.%I to anon,authenticated',t);
 end loop;
end $$;
create policy own_profile on public.profiles for select using(id=private.actor());
create policy topics_read on public.topics for select using(true);
create policy own_interests on public.user_interests for select using(user_id=private.actor());
create policy community_read on public.communities for select using(not archived);
create policy own_membership on public.community_members for select using(user_id=private.actor());
create policy petition_read on public.petitions for select using(private.visible(id));
create policy collaborators_read on public.petition_collaborators for select using(private.manager(petition_id));
create policy sources_read on public.petition_sources for select using(private.visible(petition_id));
create policy edits_read on public.petition_edits for select using(private.visible(petition_id));
create policy own_signatures on public.signatures for select using(user_id=private.actor());
create policy own_saves on public.petition_saves for select using(user_id=private.actor());
create policy updates_read on public.petition_updates for select using(private.visible(petition_id));
create policy endorsements_read on public.petition_endorsements for select using(private.visible(petition_id));
create policy posts_read on public.discussion_posts for select using(not archived and (private.visible(petition_id) or exists(select 1 from public.communities c where c.id=community_id and not c.archived)));
create policy own_reports on public.reports for select using(user_id=private.actor());
create policy responses_read on public.official_responses for select using(private.visible(petition_id) and (verification='verified' or private.manager(petition_id)));
create policy badges_read on public.badges for select using(true);
create policy own_badges on public.user_badges for select using(user_id=private.actor());
create policy own_notifications on public.notifications for select using(user_id=private.actor());

create function private.display_name(n text, mode text) returns text language sql immutable set search_path='' as $$ select case mode when 'anonymous' then 'Anonymous supporter' when 'full_name' then n else split_part(n,' ',1)||case when position(' ' in n)>0 then ' '||left(regexp_replace(n,'^.* ',''),1)||'.' else '' end end $$;
create function private.entry(id uuid, body text, author text, created timestamptz, kind text) returns jsonb language sql immutable set search_path='' as $$ select jsonb_build_object('id',id,'body',body,'author',author,'date',created,'kind',kind) $$;
create function private.validate_draft(d jsonb) returns void language plpgsql set search_path='' as $$
begin
 if jsonb_typeof(d) is distinct from 'object' or exists(select 1 from unnest(array['title','summary','problem','action','recipient','city','topic','deadline','verification','communityId','customRule']) k where jsonb_typeof(d->k) is distinct from 'string') or jsonb_typeof(d->'goal') is distinct from 'number' or jsonb_typeof(d->'identities') is distinct from 'array' or jsonb_typeof(d->'evidence') is distinct from 'array' then raise exception 'Draft fields must have the expected types and cannot be null.'; end if;
 if exists(select 1 from jsonb_array_elements(d->'identities') i where jsonb_typeof(i) is distinct from 'string') or exists(select 1 from jsonb_array_elements(d->'evidence') e where jsonb_typeof(e->'label') is distinct from 'string' or jsonb_typeof(e->'url') is distinct from 'string') then raise exception 'Use valid identity modes and labeled evidence.'; end if;
 if length(d->>'customRule')>1000 or d->>'deadline' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use a short custom rule and YYYY-MM-DD deadline.'; end if;
 if length(trim(d->>'title')) not between 12 and 120 or length(trim(d->>'summary')) not between 20 and 240 or length(trim(d->>'problem')) not between 30 and 5000 or length(trim(d->>'action')) not between 15 and 1000 or length(trim(d->>'recipient')) not between 3 and 150 or length(trim(d->>'city')) not between 2 and 100 then raise exception 'Complete the title, summary, problem, action, recipient, and city.'; end if;
 if not d ?& array['title','summary','problem','action','recipient','city','topic','goal','deadline','identities','verification','communityId','customRule','evidence'] then raise exception 'Draft fields are missing.'; end if;
 if (d->>'goal')::numeric not between 10 and 1000000 or (d->>'goal')::numeric<>trunc((d->>'goal')::numeric) or (d->>'deadline')::date<=current_date then raise exception 'Use a valid goal and future deadline.'; end if;
 if not exists(select 1 from public.topics where name=d->>'topic') or not exists(select 1 from public.communities where id=(d->>'communityId')::uuid and not archived) then raise exception 'Select a topic and community.'; end if;
 if d->>'verification' not in ('account','email','community','location','custom') or jsonb_typeof(d->'identities')<>'array' or jsonb_array_length(d->'identities')<1 or exists(select 1 from jsonb_array_elements_text(d->'identities') i where i not in ('full_name','first_name_last_initial','anonymous')) then raise exception 'Choose valid verification and public identity rules.'; end if;
 if d->>'verification'='custom' and length(trim(d->>'customRule'))<15 then raise exception 'Describe the custom rule.'; end if;
 if jsonb_typeof(d->'evidence')<>'array' or exists(select 1 from jsonb_array_elements(d->'evidence') e where length(e->>'label')<3 or e->>'url' !~ '^https://[^ /]+') then raise exception 'Use labeled HTTPS sources.'; end if;
end $$;
create function private.lock_rules() returns trigger language plpgsql set search_path='' as $$ begin
 if (old.content->'verification' is distinct from new.content->'verification' or old.content->'identities' is distinct from new.content->'identities' or old.content->'customRule' is distinct from new.content->'customRule' or old.community_id is distinct from new.community_id) and (old.sample_count>0 or exists(select 1 from public.signatures where petition_id=old.id)) then raise exception 'Signing rules are locked after the first signature.'; end if;
 return new;
end $$;
create trigger immutable_signing_rules before update on public.petitions for each row execute function private.lock_rules();

create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); result jsonb; profile jsonb; person public.profiles; principal private.principals;
begin
 -- Third-party Clerk JWTs are validated by Supabase. Subjects never enter public rows or payloads.
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
 'communities',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'description',c.description,'city',c.city,'topic',c.topic,'ownerId',c.owner_id,'members',c.sample_members+(select count(*) from public.community_members m where m.community_id=c.id and m.active))) from public.communities c where not c.archived),'[]'),
 'petitions',coalesce((select jsonb_agg(p.content||jsonb_build_object('id',p.id,'ownerId',p.owner_id,'creator',u.name,'communityId',p.community_id,'status',p.status,'createdAt',p.created_at,
 'collaborators',coalesce((select jsonb_agg(user_id) from public.petition_collaborators where petition_id=p.id),'[]'),
 'count',p.sample_count+(select count(*) from public.signatures where petition_id=p.id),'sampleCount',p.sample_count,
 'saves',p.sample_saves+(select count(*) from public.petition_saves where petition_id=p.id),'recentSignatures',p.sample_velocity+(select count(*) from public.signatures where petition_id=p.id and created_at>now()-interval '7 days'),
 'evidence',coalesce((select jsonb_agg(jsonb_build_object('label',label,'url',url)) from public.petition_sources where petition_id=p.id),'[]'),
 'updates',coalesce((select jsonb_agg(private.entry(e.id,e.body,a.name,e.created_at,'update') order by e.created_at desc) from public.petition_updates e join public.profiles a on a.id=e.author_id where e.petition_id=p.id),'[]'),
 'edits',coalesce((select jsonb_agg(private.entry(e.id,e.body,a.name,e.created_at,'material edit') order by e.created_at desc) from public.petition_edits e join public.profiles a on a.id=e.author_id where e.petition_id=p.id),'[]'),
 'endorsements',coalesce((select jsonb_agg(private.entry(e.id,e.body,c.name,e.created_at,'endorsement')) from public.petition_endorsements e join public.communities c on c.id=e.community_id where e.petition_id=p.id),'[]'),
 'discussion',coalesce((select jsonb_agg(private.entry(e.id,e.body,a.name,e.created_at,e.kind) order by e.created_at) from public.discussion_posts e join public.profiles a on a.id=e.author_id where e.petition_id=p.id and not e.archived),'[]'),
 'responses',coalesce((select jsonb_agg(private.entry(e.id,e.body,a.name,e.created_at,'response')||jsonb_build_object('organization',e.organization,'verification',e.verification)) from public.official_responses e join public.profiles a on a.id=e.author_id where e.petition_id=p.id and (e.verification='verified' or private.manager(p.id))),'[]')) order by p.created_at desc) from public.petitions p join public.profiles u on u.id=p.owner_id where private.visible(p.id)),'[]'),
 'signed',coalesce((select jsonb_agg(petition_id) from public.signatures where user_id=uid),'[]'),
 'saved',coalesce((select jsonb_agg(petition_id) from public.petition_saves where user_id=uid),'[]'),
 'signatures',coalesce((select jsonb_agg(jsonb_build_object('id',id,'petitionId',petition_id,'displayName',display_name,'identity',identity_mode)) from public.signatures where private.visible(petition_id)),'[]'),
 'reports',coalesce((select jsonb_agg(jsonb_build_object('id',id,'petitionId',petition_id,'reason',reason,'status',status,'appeal',appeal)) from public.reports where user_id=uid),'[]'),
 'notifications',coalesce((select jsonb_agg(private.entry(id,body,'LookAware',created_at,kind) order by created_at desc) from public.notifications where user_id=uid),'[]'),
 'customApprovals',coalesce((select jsonb_agg(petition_id) from private.eligibility_requests where user_id=uid and status='approved'),'[]')) into result;
 return result;
end $$;

create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); kind text:=command->>'type'; pid uuid; cid uuid; p public.petitions; d jsonb; old_content jsonb; nm text; mode text; ident text; b text; rid uuid; affected integer;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 select name into nm from public.profiles where id=uid;
 if kind='onboard' then
  if length(trim(command->>'city')) not between 2 and 100 or jsonb_array_length(command->'interests') not in (0,3,4,5) or exists(select 1 from jsonb_array_elements_text(command->'interests') i where not exists(select 1 from public.topics t where t.name=i)) then raise exception 'Choose three interests or skip, and enter a city.'; end if;
  update public.profiles set city=trim(command->>'city'),onboarded=true where id=uid;
  delete from public.user_interests where user_id=uid;
  insert into public.user_interests(user_id,topic_id) select uid,id from public.topics where name in(select jsonb_array_elements_text(command->'interests'));
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
 elsif kind='appeal' then
  b:=trim(command->>'body');if length(b) not between 5 and 2000 then raise exception 'Write an appeal of 5 to 2000 characters.'; end if;
  update public.reports set appeal=b,status='appealed' where id=(command->>'reportId')::uuid and user_id=uid;
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
  insert into public.signatures(petition_id,user_id,identity_mode,display_name) values(pid,uid,ident,private.display_name(nm,ident));
  insert into public.user_badges(user_id,badge_id) select uid,id from public.badges where name='First voice' on conflict do nothing;
  insert into public.notifications(user_id,kind,body) values(uid,'signature','Your signature on “'||(p.content->>'title')||'” is confirmed. Public name: '||private.display_name(nm,ident));return null;
 elsif kind='discussion' then
  if p.status<>'active' then raise exception 'Discussion is closed.';end if;
  insert into public.discussion_posts(petition_id,author_id,kind,body) values(pid,uid,command->>'kind',trim(command->>'body'));return null;
 elsif kind='report' then
  insert into public.reports(petition_id,user_id,reason) values(pid,uid,trim(command->>'reason'));return null;
 elsif kind='requestEligibility' then
  if p.content->>'verification'<>'custom' then raise exception 'This petition does not use custom review.';end if;
  insert into private.eligibility_requests(petition_id,user_id,statement) values(pid,uid,trim(command->>'statement')) on conflict(petition_id,user_id) do update set statement=excluded.statement,status='pending' where eligibility_requests.status='declined';
  get diagnostics affected=row_count;if affected=0 then raise exception 'Your request is already pending or approved.';end if;return null;
 elsif kind='endorse' then
  cid:=(command->>'communityId')::uuid;
  if not exists(select 1 from public.communities where id=cid and owner_id=uid and not archived) then raise exception 'Only the community owner can endorse on its behalf.';end if;
  insert into public.petition_endorsements(petition_id,community_id,body) select pid,cid,name||' supports this requested action.' from public.communities where id=cid;return null;
 end if;
 if not private.manager(pid) then raise exception 'Organizer permission required.';end if;
 if kind='update' then
  insert into public.petition_updates(petition_id,author_id,body) values(pid,uid,trim(command->>'body'));
 elsif kind='publish' then
  if p.status<>'draft' then raise exception 'Only drafts can be published.';end if;
  perform private.validate_draft(p.content);update public.petitions set status='active',updated_at=now() where id=pid;
 elsif kind='edit' then
  b:=trim(command->>'reason');if length(b) not between 5 and 2000 then raise exception 'Explain the material edit.';end if;
  d:=p.content||jsonb_build_object('title',command->>'title','action',command->>'action','verification',command->>'verification','identities',command->'identities','customRule',coalesce(command->>'customRule',p.content->>'customRule'));perform private.validate_draft(d);
  update public.petitions set content=d,updated_at=now() where id=pid;
  insert into public.petition_edits(petition_id,author_id,body,previous_content) values(pid,uid,'Title: “'||(p.content->>'title')||'” → “'||(d->>'title')||'”. Action: “'||(p.content->>'action')||'” → “'||(d->>'action')||'”. Reason: '||b,p.content);
 elsif kind='response' then
  b:=trim(command->>'body');if length(b) not between 5 and 2000 or length(trim(command->>'organization')) not between 5 and 200 then raise exception 'Supply a response and organization.';end if;
  insert into public.official_responses(petition_id,author_id,body,organization) values(pid,uid,b,trim(command->>'organization'));
 elsif kind='close' then
  if p.status<>'active' or command->>'status' not in ('closed','successful') then raise exception 'Only active petitions can be closed or marked successful.';end if;
  update public.petitions set status=command->>'status',updated_at=now() where id=pid;
  insert into public.petition_edits(petition_id,author_id,body,previous_content) values(pid,uid,'Organizer marked this petition '||(command->>'status')||'. This is not independent verification.',p.content);
 elsif kind='collaborator' then
  if p.owner_id<>uid then raise exception 'Only the owner can add collaborators.';end if;
  insert into public.petition_collaborators(petition_id,user_id) values(pid,(command->>'profileId')::uuid) on conflict do nothing;
 elsif kind='reviewEligibility' then
  if p.content->>'verification'<>'custom' then raise exception 'Only custom eligibility may be organizer-reviewed.';end if;
  update private.eligibility_requests set status=case when (command->>'approved')::boolean then 'approved' else 'declined' end where id=(command->>'requestId')::uuid and petition_id=pid;
  get diagnostics affected=row_count;if affected=0 then raise exception 'Request not found.';end if;
 else raise exception 'Unsupported command.';
 end if;
 return null;
end $$;
create function public.lookaware_requests(petition_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if not private.manager(petition_id) then raise exception 'Organizer permission required.';end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'petitionId',r.petition_id,'name',private.display_name(p.name,'first_name_last_initial'),'statement',r.statement,'status',r.status)) from private.eligibility_requests r join public.profiles p on p.id=r.user_id where r.petition_id=lookaware_requests.petition_id),'[]');
end $$;
create function public.lookaware_community_posts(community_id uuid) returns jsonb language sql stable security definer set search_path='' as $$ select coalesce(jsonb_agg(private.entry(p.id,p.body,u.name,p.created_at,p.kind) order by p.created_at),'[]') from public.discussion_posts p join public.profiles u on u.id=p.author_id join public.communities c on c.id=p.community_id where p.community_id=lookaware_community_posts.community_id and not p.archived and not c.archived $$;
revoke all on all functions in schema private from public,anon,authenticated;
grant execute on function private.actor(),private.manager(uuid),private.visible(uuid) to anon,authenticated;
revoke all on function public.lookaware_snapshot(),public.lookaware_command(jsonb),public.lookaware_requests(uuid),public.lookaware_community_posts(uuid) from public,anon,authenticated;
grant execute on function public.lookaware_snapshot(),public.lookaware_community_posts(uuid) to anon,authenticated;
grant execute on function public.lookaware_command(jsonb),public.lookaware_requests(uuid) to authenticated;
-- No storage bucket is public by default. Evidence is HTTPS links; no file uploads in this slice.
-- Realtime subscriptions are optional. Queries revalidate after every mutation.
commit;
