-- Communities become collaboration spaces rather than one chat log.
--
-- Three zones with different authority:
--   discussion    — members post, anyone can read
--   announcements — the owner and moderators post in the community's voice, anyone can read
--   organizers    — a private working room only moderators can read or post in
--
-- One record behind every surface: the events list is event posts sorted by date and a channel
-- is a filter, so the same row-level rules cover all of them.
--
-- Reporter identity is never returned to moderators. Naming the reporter turns a moderation
-- request into a confrontation between neighbours, and the moderator does not need it to judge
-- the post.
begin;

alter table public.discussion_posts
  drop constraint if exists discussion_posts_kind_check;
alter table public.discussion_posts
  add constraint discussion_posts_kind_check check(kind in
    ('question','idea','experience','announcement','event'));
alter table public.discussion_posts
  add column if not exists space text not null default 'discussion'
    check(space in ('discussion','announcements','organizers')),
  add column if not exists channel text not null default '' check(length(channel) <= 40),
  add column if not exists event_at timestamptz,
  add column if not exists location text not null default '' check(length(location) <= 120);

create index if not exists posts_community_space on public.discussion_posts(community_id, space);

create table if not exists public.post_reports (
  id uuid primary key default gen_random_uuid(),
  community_id uuid not null references public.communities(id),
  post_id uuid not null references public.discussion_posts(id),
  user_id uuid not null references public.profiles(id),
  reason text not null check(length(reason) between 10 and 500),
  status text not null default 'open' check(status in ('open','actioned','dismissed')),
  created_at timestamptz not null default now(),
  unique(post_id, user_id));

alter table public.post_reports enable row level security;
-- Default deny. You can see your own report; the moderator queue arrives through a
-- security-definer function that drops the reporter.
create policy own_post_reports on public.post_reports for select using(user_id = private.actor());

-- The organizer space never leaves the moderator group, so the read policy has to know about it.
drop policy if exists posts_read on public.discussion_posts;
create policy posts_read on public.discussion_posts for select using(
  not archived
  and (space <> 'organizers' or private.moderates(community_id, private.actor()))
  and (private.visible(petition_id)
       or exists(select 1 from public.communities c where c.id=community_id and not c.archived)));

create or replace function private.community_post(p public.discussion_posts, author text)
 returns jsonb language sql stable set search_path='' as $fn$
 select private.authored(
   private.entry(p.id, p.body, author, p.created_at,
     case when p.removed then 'removed' else p.kind end),
   p.author_id, p.removed)
 || jsonb_build_object('communityId',p.community_id,'space',p.space,'channel',p.channel)
 || case when p.event_at is null then '{}'::jsonb
      else jsonb_build_object('eventAt',p.event_at,'location',p.location) end $fn$;

create or replace function public.lookaware_community_posts(community_id uuid) returns jsonb
 language sql stable security definer set search_path='' as $fn$
 select coalesce(jsonb_agg(private.community_post(p,u.name) order by p.created_at),'[]')
 from public.discussion_posts p
 join public.profiles u on u.id=p.author_id
 join public.communities c on c.id=p.community_id
 where p.community_id=lookaware_community_posts.community_id and not p.archived and not c.archived
   and (p.space <> 'organizers' or private.moderates(p.community_id, private.actor())) $fn$;
revoke all on function public.lookaware_community_posts(uuid) from public,anon,authenticated;
grant execute on function public.lookaware_community_posts(uuid) to anon,authenticated;

-- Moderator queue. The reporter's id is selected but never projected.
create or replace function public.lookaware_community_reports(community_id uuid) returns jsonb
 language plpgsql security definer set search_path='' as $fn$
declare result jsonb;
begin
 if not private.moderates(lookaware_community_reports.community_id, private.actor()) then
  raise exception 'Only this community owner and its moderators can review reports.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',r.id,'communityId',r.community_id,'postId',r.post_id,'postBody',p.body,
   'postAuthor',u.name,'reason',r.reason,'status',r.status,'date',r.created_at)
   order by r.created_at desc),'[]'::jsonb)
 into result from public.post_reports r
 join public.discussion_posts p on p.id=r.post_id
 join public.profiles u on u.id=p.author_id
 where r.community_id=lookaware_community_reports.community_id;
 return result;
end $fn$;
revoke all on function public.lookaware_community_reports(uuid) from public,anon;
grant execute on function public.lookaware_community_reports(uuid) to authenticated;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v4;
revoke all on function public.lookaware_command_v4(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); kind text:=command->>'type'; cid uuid; pst public.discussion_posts;
        mods boolean; rep public.post_reports;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if kind in ('communityPost','reportPost','resolvePostReport') then
  cid:=(command->>'communityId')::uuid;
  if not exists(select 1 from public.communities where id=cid and not archived) then
   raise exception 'Community not found.'; end if;
  mods:=private.moderates(cid,uid);
 end if;

 if kind='communityPost' then
  if not exists(select 1 from public.community_members where community_id=cid and user_id=uid and active) then
   raise exception 'Join the community to post.'; end if;
  if not mods and (command->>'space' is distinct from 'discussion' or command->>'kind'='announcement') then
   raise exception 'Only this community owner and its moderators can post here. Try the public discussion.'; end if;
  if command->>'kind'='announcement' and command->>'space' is distinct from 'announcements' then
   raise exception 'Announcements belong in the announcements space.'; end if;
  if command->>'kind'='event' and (command->>'eventAt' is null or command->>'eventAt'='') then
   raise exception 'Give the event a date.'; end if;
  insert into public.discussion_posts(community_id,author_id,kind,body,space,channel,event_at,location)
  values(cid,uid,command->>'kind',command->>'body',coalesce(command->>'space','discussion'),
    left(coalesce(trim(command->>'channel'),''),40),
    case when command->>'kind'='event' then (command->>'eventAt')::timestamptz end,
    left(coalesce(command->>'location',''),120));
  return null;
 end if;

 if kind='reportPost' then
  select * into pst from public.discussion_posts where id=(command->>'postId')::uuid and community_id=cid;
  if not found then raise exception 'That post is no longer here.'; end if;
  if exists(select 1 from public.post_reports where post_id=pst.id and user_id=uid) then
   raise exception 'You already reported this post.'; end if;
  if length(coalesce(trim(command->>'reason'),''))<10 then
   raise exception 'Say what is wrong in at least 10 characters.'; end if;
  insert into public.post_reports(community_id,post_id,user_id,reason)
   values(cid,pst.id,uid,left(trim(command->>'reason'),500));
  return null;
 end if;

 if kind='resolvePostReport' then
  if not mods then raise exception 'Only this community owner and its moderators can review reports.'; end if;
  select * into rep from public.post_reports where id=(command->>'reportId')::uuid and community_id=cid for update;
  if not found then raise exception 'That report is no longer here.'; end if;
  if rep.status<>'open' then raise exception 'That report was already reviewed.'; end if;
  if command->>'action' not in ('actioned','dismissed') then raise exception 'Choose a review outcome.'; end if;
  update public.post_reports set status=command->>'action' where id=rep.id;
  return null;
 end if;

 return public.lookaware_command_v4(command);
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

commit;
