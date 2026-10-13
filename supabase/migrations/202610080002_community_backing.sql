-- Community backing by member vote.
--
-- A community backs a petition when its members vote for it: at least three yes votes and more yes
-- than no (src/domain/rules.ts backingReached). One vote per member, community and petition,
-- changeable until the community backs it; then the vote closes and an endorsement records the
-- decision with its tally. This replaces the owner's one-click endorsement. Individual votes are
-- never readable by anyone else: the table has no policies, and the snapshot publishes tallies
-- plus each person's own votes.
begin;

create table public.community_backing_votes (
 petition_id uuid not null references public.petitions(id),
 community_id uuid not null references public.communities(id),
 user_id uuid not null references public.profiles(id),
 support boolean not null,
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 primary key(petition_id,community_id,user_id));
alter table public.community_backing_votes enable row level security;
create index backing_votes_user on public.community_backing_votes(user_id);

-- Every community with votes or a backing on a petition: open votes and decided ones.
create function private.backing(pid uuid) returns jsonb language sql stable security definer set search_path='' as $fn$
 select coalesce(jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
   'communityId',coalesce(v.community_id,e.community_id),'yes',coalesce(v.yes,0),'no',coalesce(v.no,0),
   'backedAt',e.created_at)) order by coalesce(v.community_id,e.community_id)),'[]'::jsonb)
 from (select community_id,count(*) filter(where support) yes,count(*) filter(where not support) no
       from public.community_backing_votes where petition_id=pid group by community_id) v
 full join (select community_id,created_at from public.petition_endorsements where petition_id=pid) e
  on e.community_id=v.community_id $fn$;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v11;
revoke all on function public.lookaware_command_v11(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); kind text:=command->>'type'; p public.petitions; c public.communities;
 support boolean; yes int; no int;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if kind='endorse' then raise exception 'Communities now back petitions by member vote.'; end if;
 -- Account deletion (lookaware_command_v10) predates this table, so private votes go here.
 if kind='delete_account' then delete from public.community_backing_votes where user_id=uid; end if;
 if kind<>'backVote' then return public.lookaware_command_v11(command); end if;
 support:=(command->>'support')::boolean;
 if support is null then raise exception 'Vote yes or no.'; end if;
 -- Locking the petition serializes votes, so two "third yes" votes cannot both back it.
 select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
 if not found or not private.visible(p.id) or p.hidden then raise exception 'Petition not found or unavailable.'; end if;
 if p.status<>'active' then raise exception 'This petition is not open for a community vote.'; end if;
 select * into c from public.communities where id=(command->>'communityId')::uuid and not archived;
 if not found then raise exception 'Community not found.'; end if;
 if not exists(select 1 from public.community_members where community_id=c.id and user_id=uid and active) then
  raise exception 'Only members of this community can vote on backing it.'; end if;
 if exists(select 1 from public.petition_endorsements where petition_id=p.id and community_id=c.id) then
  raise exception 'This community already backs this petition.'; end if;
 insert into public.community_backing_votes(petition_id,community_id,user_id,support) values(p.id,c.id,uid,support)
  on conflict(petition_id,community_id,user_id) do update set support=excluded.support,updated_at=now();
 select count(*) filter(where v.support),count(*) filter(where not v.support) into yes,no
  from public.community_backing_votes v where v.petition_id=p.id and v.community_id=c.id;
 if yes<3 or yes<=no then return null; end if;
 insert into public.petition_endorsements(petition_id,community_id,body)
  values(p.id,c.id,c.name||' members voted to back this ('||yes||' yes · '||no||' no).');
 perform private.notify(private.managers(p.id,uid),c.name||' voted to back “'||(p.content->>'title')||'”.','endorsement');
 return 'backed';
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

alter function public.lookaware_snapshot() rename to lookaware_snapshot_v8;
revoke all on function public.lookaware_snapshot_v8() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.lookaware_snapshot_v8();
 result:=jsonb_set(result,'{petitions}',(
   select coalesce(jsonb_agg(p||jsonb_build_object('backing',private.backing((p->>'id')::uuid)) order by ord),'[]'::jsonb)
   from jsonb_array_elements(result->'petitions') with ordinality as e(p,ord)));
 return result||jsonb_build_object('backingVotes',coalesce((
   select jsonb_agg(jsonb_build_object('petitionId',petition_id,'communityId',community_id,'support',support))
   from public.community_backing_votes where user_id=private.actor()),'[]'::jsonb));
end $$;
revoke all on function public.lookaware_snapshot() from public,anon,authenticated;
grant execute on function public.lookaware_snapshot() to anon,authenticated;

commit;
