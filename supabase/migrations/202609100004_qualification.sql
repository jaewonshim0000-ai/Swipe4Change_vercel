-- Each petition has four mandatory qualification requirements, distinct from a community support goal.
create function private.valid_qualification(d jsonb) returns boolean language sql immutable set search_path='' as $$
 select coalesce(jsonb_typeof(d)='object'
 and not exists(select 1 from jsonb_each(d) e where e.key<>'statutoryThreshold' and jsonb_typeof(e.value)<>'string')
 and length(d->>'jurisdiction') between 3 and 150 and length(d->>'authority') between 3 and 150
 and length(d->>'measureId') between 2 and 150 and length(d->>'officialTitle') between 3 and 500
 and length(d->>'officialText') between 30 and 50000 and length(d->>'sourceUrl')<=2048 and d->>'sourceUrl' ~ '^https://[^ /]+/?.*'
 and length(d->>'statutoryRule') between 10 and 2000
 and jsonb_typeof(d->'statutoryThreshold')='number' and (d->>'statutoryThreshold')::numeric between 1 and 100000000 and trunc((d->>'statutoryThreshold')::numeric)=(d->>'statutoryThreshold')::numeric
 and length(d->>'circulatorDeclaration') between 30 and 10000 and d->>'notarization' in ('required','not_required')
 and d - array['jurisdiction','authority','measureId','officialTitle','officialText','sourceUrl','statutoryRule','statutoryThreshold','circulatorDeclaration','notarization']='{}'::jsonb,false)
$$;
create table public.petition_qualification (
 petition_id uuid primary key references public.petitions(id),
 details jsonb check(details is null or private.valid_qualification(details)),
 status text not null default 'missing' check(status in ('missing','pending','verified','rejected')),
 review_note text not null default '',
 updated_at timestamptz not null default now(),
 check((status='missing' and details is null) or (status<>'missing' and details is not null))
);
alter table public.petition_qualification enable row level security;
revoke all on public.petition_qualification from public,anon,authenticated;
grant select on public.petition_qualification to anon,authenticated;
create policy readable on public.petition_qualification for select using(private.visible(petition_id));
create function private.initialize_qualification() returns trigger language plpgsql security definer set search_path='' as $$ begin insert into public.petition_qualification(petition_id) values(new.id); return new; end $$;
create trigger initialize_qualification after insert on public.petitions for each row execute function private.initialize_qualification();
insert into public.petition_qualification(petition_id) select id from public.petitions;

-- Include the entire requirements document in consent; no legal edits after the first private receipt.
create or replace function private.petition_disclosure(p public.petitions) returns jsonb language sql stable set search_path='' as $$
 select jsonb_build_object('petitionId',p.id,'title',coalesce(q.details->>'officialTitle',p.content->>'title'),'fullText',coalesce(q.details->>'officialText',(p.content->>'problem')||E'\n\nRequested action\n'||(p.content->>'action')),'recipient',p.content->>'recipient','approximateLocation',coalesce(q.details->>'jurisdiction',p.content->>'city'),'deadline',p.content->>'deadline','verification',p.content->>'verification','publicIdentities',p.content->'identities','eligibilityRule',p.content->>'customRule','qualification',q.details) from public.petition_qualification q where q.petition_id=p.id
$$;
alter function public.lookaware_command(jsonb) rename to lookaware_command_v4;
revoke all on function public.lookaware_command_v4(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare pid uuid; p public.petitions; old_details jsonb;
begin
 if private.actor() is null then raise exception 'Sign in before making changes.'; end if;
 if command->>'type'='qualification' then
  pid:=(command->>'petitionId')::uuid;
  select * into p from public.petitions where id=pid for update;
  if not found or not private.manager(pid) then raise exception 'Organizer permission required.'; end if;
  if exists(select 1 from private.signature_receipts where petition_id=pid) then raise exception 'Legal requirements are locked after signatory records exist. Create a new petition for a new measure.'; end if;
  if not private.valid_qualification(command->'details') then raise exception 'Complete all four legal requirements with the responsible authority’s source documents.'; end if;
  if length(trim(coalesce(command->>'reason',''))) not between 5 and 2000 then raise exception 'Explain this legal requirements submission.'; end if;
  select details into old_details from public.petition_qualification where petition_id=pid;
  update public.petition_qualification set details=command->'details',status='pending',review_note='',updated_at=now() where petition_id=pid;
  insert into public.petition_edits(petition_id,author_id,body,previous_content) values(pid,private.actor(),'Legal requirements submitted for review. '||(command->>'reason')||E'\nPrevious requirements: '||coalesce(old_details::text,'None supplied'),p.content||jsonb_build_object('qualification',old_details));
  return null;
 end if;
 return public.lookaware_command_v4(command);
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

alter function public.lookaware_snapshot() rename to lookaware_snapshot_v3;
revoke all on function public.lookaware_snapshot_v3() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.lookaware_snapshot_v3();
 return jsonb_set(result,'{petitions}',coalesce((select jsonb_agg(p.value||jsonb_build_object('qualification',(select jsonb_build_object('details',q.details,'status',q.status,'reviewNote',q.review_note,'affidavitCount',0,'acceptedAffidavits',0) from public.petition_qualification q where q.petition_id=(p.value->>'id')::uuid)) order by p.ordinality) from jsonb_array_elements(result->'petitions') with ordinality p(value,ordinality)),'[]'::jsonb));
end $$;
revoke all on function public.lookaware_snapshot() from public;
grant execute on function public.lookaware_snapshot() to anon,authenticated;
