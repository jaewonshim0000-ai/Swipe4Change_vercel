-- More badges, a notification for every badge, and petitions that belong to no community.
--
-- Badges: six more, awarded from authoritative records after every command, like the ones in
-- 202609100001 (never from client-supplied counters). Two are earned through other people, so a
-- signature also checks the petition's owner (Goal getter) and whoever shared the link it came
-- through (Ripple maker). Mirrors badgeDefinitions in src/domain/personalization.ts.
--
-- Every award, including First voice in the base sign command, tells its owner through a
-- trigger, so no award path can forget to.
--
-- Optional community: community_id becomes nullable. The app sends '' for "no community"; the
-- command turns it into null before the base insert casts it to uuid, and validate_draft accepts
-- it unless signing is limited to community members.
begin;

insert into public.badges(name,description) values
 ('Steady voice','Sign ten different petitions.'),
 ('Wide lens','Sign petitions in three different topics.'),
 ('Keeping watch','Save three petitions to follow their updates.'),
 ('Helping hand','Offer to help on a petition.'),
 ('Ripple maker','Someone signs a petition through your share link.'),
 ('Goal getter','A petition you started reaches its signature goal.')
on conflict(name) do nothing;

create function private.award_badges(who uuid) returns void language sql set search_path='' as $fn$
 insert into public.user_badges(user_id,badge_id)
 select who,b.id from public.badges b where who is not null and (
  (b.name='Steady voice' and (select count(*) from public.signatures where user_id=who)>=10) or
  (b.name='Wide lens' and (select count(distinct p.content->>'topic') from public.signatures s
    join public.petitions p on p.id=s.petition_id where s.user_id=who)>=3) or
  (b.name='Keeping watch' and (select count(*) from public.petition_saves where user_id=who)>=3) or
  (b.name='Helping hand' and exists(select 1 from public.petition_volunteers where user_id=who)) or
  (b.name='Ripple maker' and exists(select 1 from private.signature_referrals where referrer_id=who)) or
  (b.name='Goal getter' and exists(select 1 from public.petitions p where p.owner_id=who
    and p.status in ('active','closed','successful') and (p.content->>'goal')::int>0
    and p.sample_count+(select count(*) from public.signatures s where s.petition_id=p.id)
      >=(p.content->>'goal')::int)))
 on conflict do nothing $fn$;

create function private.badge_notice() returns trigger language plpgsql set search_path='' as $fn$
begin
 perform private.notify(array[new.user_id],
  'You earned the '||(select b.name from public.badges b where b.id=new.badge_id)
  ||' badge. See all your badges in Profile.','badge');
 return null;
end $fn$;
create trigger badge_notice after insert on public.user_badges
 for each row execute function private.badge_notice();
revoke all on function private.award_badges(uuid), private.badge_notice() from public,anon,authenticated;

alter table public.petitions alter column community_id drop not null;

-- As in 202609050001, except that the community may be null ('' counts as null).
create or replace function private.validate_draft(d jsonb) returns void language plpgsql set search_path='' as $$
declare cid text:=nullif(d->>'communityId','');
begin
 if jsonb_typeof(d) is distinct from 'object' or exists(select 1 from unnest(array['title','summary','problem','action','recipient','city','topic','deadline','verification','customRule']) k where jsonb_typeof(d->k) is distinct from 'string') or jsonb_typeof(d->'communityId') not in ('string','null') or jsonb_typeof(d->'goal') is distinct from 'number' or jsonb_typeof(d->'identities') is distinct from 'array' or jsonb_typeof(d->'evidence') is distinct from 'array' then raise exception 'Draft fields must have the expected types and cannot be null.'; end if;
 if exists(select 1 from jsonb_array_elements(d->'identities') i where jsonb_typeof(i) is distinct from 'string') or exists(select 1 from jsonb_array_elements(d->'evidence') e where jsonb_typeof(e->'label') is distinct from 'string' or jsonb_typeof(e->'url') is distinct from 'string') then raise exception 'Use valid identity modes and labeled evidence.'; end if;
 if length(d->>'customRule')>1000 or d->>'deadline' !~ '^\d{4}-\d{2}-\d{2}$' then raise exception 'Use a short custom rule and YYYY-MM-DD deadline.'; end if;
 if length(trim(d->>'title')) not between 12 and 120 or length(trim(d->>'summary')) not between 20 and 240 or length(trim(d->>'problem')) not between 30 and 5000 or length(trim(d->>'action')) not between 15 and 1000 or length(trim(d->>'recipient')) not between 3 and 150 or length(trim(d->>'city')) not between 2 and 100 then raise exception 'Complete the title, summary, problem, action, recipient, and city.'; end if;
 if not d ?& array['title','summary','problem','action','recipient','city','topic','goal','deadline','identities','verification','communityId','customRule','evidence'] then raise exception 'Draft fields are missing.'; end if;
 if (d->>'goal')::numeric not between 10 and 1000000 or (d->>'goal')::numeric<>trunc((d->>'goal')::numeric) or (d->>'deadline')::date<=current_date then raise exception 'Use a valid goal and future deadline.'; end if;
 if not exists(select 1 from public.topics where name=d->>'topic') then raise exception 'Select a topic.'; end if;
 if cid is not null and not exists(select 1 from public.communities where id=cid::uuid and not archived) then raise exception 'That community no longer exists. Choose another, or none.'; end if;
 if d->>'verification'='community' and cid is null then raise exception 'Community-only signing needs a community.'; end if;
 if d->>'verification' not in ('account','email','community','location','custom') or jsonb_typeof(d->'identities')<>'array' or jsonb_array_length(d->'identities')<1 or exists(select 1 from jsonb_array_elements_text(d->'identities') i where i not in ('full_name','first_name_last_initial','anonymous')) then raise exception 'Choose valid verification and public identity rules.'; end if;
 if d->>'verification'='custom' and length(trim(d->>'customRule'))<15 then raise exception 'Describe the custom rule.'; end if;
 if jsonb_typeof(d->'evidence')<>'array' or exists(select 1 from jsonb_array_elements(d->'evidence') e where length(e->>'label')<3 or e->>'url' !~ '^https://[^ /]+') then raise exception 'Use labeled HTTPS sources.'; end if;
end $$;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v14;
revoke all on function public.lookaware_command_v14(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); kind text:=command->>'type'; result text; pid uuid;
begin
 if kind='create' and command->'draft'->>'communityId'='' then
  command:=jsonb_set(command,'{draft,communityId}','null'::jsonb);
 end if;
 result:=public.lookaware_command_v14(command);
 if kind<>'delete_account' then perform private.award_badges(uid); end if;
 if kind='sign' then
  pid:=(command->>'petitionId')::uuid;
  perform private.award_badges((select owner_id from public.petitions where id=pid));
  perform private.award_badges((select r.referrer_id from private.signature_referrals r
   join public.signatures s on s.id=r.signature_id where s.petition_id=pid and s.user_id=uid));
 end if;
 return result;
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

commit;
