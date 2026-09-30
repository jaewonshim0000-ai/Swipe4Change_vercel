-- Ripple: the people who signed through your share link, and everyone they brought in after them.
--
-- A share link carries an opaque code, never a profile id. When someone signs through it, the
-- signature is credited to whoever owns the code, but only if that person signed the petition
-- themselves, and never to the signer. A bad or stale code is ignored rather than blocking the
-- signature: attribution is a thank-you, not a gate.
--
-- Only counts leave the database. The referrer is told that someone signed, never who, and the
-- public sees one aggregate per petition.
begin;

create table private.ripple_codes (
  user_id uuid primary key references public.profiles(id),
  code text not null unique default left(replace(gen_random_uuid()::text,'-',''),12));
create table private.signature_referrals (
  signature_id uuid primary key references public.signatures(id) on delete cascade,
  referrer_id uuid not null references public.profiles(id));
create index signature_referrals_referrer on private.signature_referrals(referrer_id);
alter table private.ripple_codes enable row level security;
alter table private.signature_referrals enable row level security;
revoke all on private.ripple_codes, private.signature_referrals from public,anon,authenticated;

-- Everyone downstream of one person, per petition. Mirrors rippleOf() in src/domain/ripple.ts.
-- Withdrawing and re-signing through someone you brought in can loop the chain, so each person
-- counts once, at their shallowest depth, and the walk stops at depth 50.
create function private.ripple(who uuid) returns jsonb language sql stable set search_path='' as $fn$
 with recursive tree(petition_id, user_id, depth) as (
   select s.petition_id, s.user_id, 1 from private.signature_referrals r
     join public.signatures s on s.id=r.signature_id where r.referrer_id=who
   union
   select s.petition_id, s.user_id, t.depth+1 from tree t
     join private.signature_referrals r on r.referrer_id=t.user_id
     join public.signatures s on s.id=r.signature_id and s.petition_id=t.petition_id
   where t.depth<50),
 people as (select petition_id, user_id, min(depth) depth from tree where user_id<>who group by 1,2),
 totals as (select petition_id, count(*) filter (where depth=1) direct, count(*) filter (where depth>1) further
            from people group by 1)
 select coalesce(jsonb_agg(jsonb_build_object('petitionId',petition_id,'direct',direct,'further',further)),'[]'::jsonb)
 from totals where direct>0 $fn$;
revoke all on function private.ripple(uuid) from public,anon,authenticated;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v6;
revoke all on function public.lookaware_command_v6(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); pid uuid; referrer uuid; sid uuid; result text; brought int;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 result:=public.lookaware_command_v6(command);
 if command->>'type'='sign' and coalesce(command->>'via','')<>'' then
  pid:=(command->>'petitionId')::uuid;
  select c.user_id into referrer from private.ripple_codes c
   where c.code=command->>'via' and c.user_id<>uid
     and exists(select 1 from public.signatures s where s.petition_id=pid and s.user_id=c.user_id);
  if referrer is not null then
   select id into strict sid from public.signatures where petition_id=pid and user_id=uid;
   insert into private.signature_referrals(signature_id,referrer_id) values(sid,referrer);
   select count(*) into brought from private.signature_referrals r join public.signatures s on s.id=r.signature_id
    where r.referrer_id=referrer and s.petition_id=pid;
   -- Never who: a ripple is a count, so the referrer cannot map it back to a person.
   perform private.notify(array[referrer],
    'Someone signed “'||(select content->>'title' from public.petitions where id=pid)||'” through your link. '
    ||brought||case when brought=1 then ' person has' else ' people have' end||' signed it because of you.','ripple');
  end if;
 end if;
 return result;
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

alter function public.lookaware_snapshot() rename to lookaware_snapshot_v4;
revoke all on function public.lookaware_snapshot_v4() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; uid uuid;
begin
 -- The base layer provisions a profile on a first sign-in, so read the actor afterwards.
 result:=public.lookaware_snapshot_v4(); uid:=private.actor();
 if uid is not null then insert into private.ripple_codes(user_id) values(uid) on conflict do nothing; end if;
 result:=jsonb_set(result,'{petitions}',(
   select coalesce(jsonb_agg(p||jsonb_build_object('viaShares',
     (select count(*) from private.signature_referrals r join public.signatures s on s.id=r.signature_id
      where s.petition_id=(p->>'id')::uuid)) order by ord),'[]'::jsonb)
   from jsonb_array_elements(result->'petitions') with ordinality as e(p,ord)));
 return result||jsonb_build_object('ripple',case when uid is null then null else jsonb_build_object(
   'code',(select code from private.ripple_codes where user_id=uid),'petitions',private.ripple(uid)) end);
end $$;
revoke all on function public.lookaware_snapshot() from public,anon,authenticated;
grant execute on function public.lookaware_snapshot() to anon,authenticated;

commit;
