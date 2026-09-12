create table private.circulator_affidavits (
 id uuid primary key,
 petition_id uuid not null references public.petitions(id),
 user_id uuid not null references public.profiles(id),
 signature_ids uuid[] not null check(cardinality(signature_ids) between 1 and 200),
 declaration text not null check(length(declaration) between 30 and 10000),
 witnessed boolean not null check(witnessed),
 notarization_provided boolean not null,
 envelope jsonb not null check(jsonb_typeof(envelope)='object' and envelope->'version'='1'::jsonb and jsonb_typeof(envelope->'ciphertext')='string' and length(envelope->>'ciphertext') between 40 and 500000 and envelope->>'ciphertext' ~ '^[A-Za-z0-9+/]+={0,2}$' and envelope - 'version' - 'ciphertext'='{}'::jsonb),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 review_note text not null default '',
 submitted_at timestamptz not null default now()
);
create index circulator_affidavits_petition on private.circulator_affidavits(petition_id,status);
alter table private.circulator_affidavits enable row level security;
revoke all on private.circulator_affidavits from public,anon,authenticated;
create table private.qualification_reviews (
 id uuid primary key default gen_random_uuid(),
 petition_id uuid not null references public.petitions(id),
 resource_type text not null check(resource_type in ('requirements','affidavit','signature')),
 resource_id uuid not null,
 accepted boolean not null,
 reference text not null check(length(reference) between 10 and 2000),
 reviewed_by text not null default current_user,
 reviewed_at timestamptz not null default now()
);
alter table private.qualification_reviews enable row level security;
revoke all on private.qualification_reviews from public,anon,authenticated;
create table private.signature_acceptance (
 receipt_id uuid primary key references private.signature_receipts(id),
 affidavit_id uuid not null references private.circulator_affidavits(id),
 registration_match boolean not null check(registration_match),
 signature_valid boolean not null check(signature_valid),
 review_id uuid not null references private.qualification_reviews(id)
);
alter table private.signature_acceptance enable row level security;
revoke all on private.signature_acceptance from public,anon,authenticated;

create function public.circulator_affidavits(petition_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$ begin
 if private.actor() is null then raise exception 'Sign in to access your affidavits.'; end if;
 return coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'petitionId',a.petition_id,'signatureIds',a.signature_ids,'declaration',a.declaration,'witnessed',a.witnessed,'notarizationProvided',a.notarization_provided,'envelope',a.envelope,'status',a.status,'reviewNote',a.review_note,'submittedAt',a.submitted_at) order by a.submitted_at desc) from private.circulator_affidavits a where a.petition_id=circulator_affidavits.petition_id and a.user_id=private.actor()),'[]'::jsonb);
end $$;
revoke all on function public.circulator_affidavits(uuid) from public,anon;
grant execute on function public.circulator_affidavits(uuid) to authenticated;
alter function public.lookaware_command(jsonb) rename to lookaware_command_v5;
revoke all on function public.lookaware_command_v5(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare p public.petitions; q public.petition_qualification; a jsonb; ids uuid[];
begin
 if private.actor() is null then raise exception 'Sign in before making changes.'; end if;
 if command->>'type'='sign' then
  select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
  if not found or not private.visible(p.id) then raise exception 'Petition not found or unavailable.'; end if;
  if not exists(select 1 from public.petition_qualification where petition_id=p.id and details is not null) then raise exception 'The organizer must configure all four legal requirements before signatures can be recorded.'; end if;
 end if;
 if command->>'type'='affidavit' then
  select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
  if not found or not private.manager(p.id) then raise exception 'Organizer or collaborator permission required.'; end if;
  select * into q from public.petition_qualification where petition_id=p.id;
  if q.details is null then raise exception 'Configure the legal requirements before submitting an affidavit.'; end if;
  a:=command->'submission';
  if jsonb_typeof(a) is distinct from 'object' or a->>'petitionId' is distinct from p.id::text or a->>'declaration' is distinct from q.details->>'circulatorDeclaration' or a->'witnessed' is distinct from 'true'::jsonb then raise exception 'Review the exact declaration and attest that you personally witnessed the selected signatures.'; end if;
  if jsonb_typeof(a->'notarizationProvided') is distinct from 'boolean' or (q.details->>'notarization'='required' and a->'notarizationProvided'<>'true'::jsonb) then raise exception 'A notarized document reference is required for this petition.'; end if;
  if jsonb_typeof(a->'envelope') is distinct from 'object' or (a->'envelope')->'version' is distinct from '1'::jsonb or jsonb_typeof((a->'envelope')->'ciphertext') is distinct from 'string' then raise exception 'An encrypted circulator signature is required.'; end if;
  if not exists(select 1 from private.signature_vaults where user_id=private.actor()) then raise exception 'Set up your private signature vault first.'; end if;
  select array_agg(v::uuid) into ids from jsonb_array_elements_text(a->'signatureIds') v;
  if ids is null or cardinality(ids) not between 1 and 200 or cardinality(ids)<>(select count(distinct v) from unnest(ids) v) or exists(select 1 from unnest(ids) v where not exists(select 1 from private.signature_receipts r where r.id=v and r.petition_id=p.id)) then raise exception 'Select only signatures with private records for this petition.'; end if;
  insert into private.circulator_affidavits(id,petition_id,user_id,signature_ids,declaration,witnessed,notarization_provided,envelope) values((a->>'id')::uuid,p.id,private.actor(),ids,a->>'declaration',true,(a->>'notarizationProvided')::boolean,a->'envelope');
  return null;
 end if;
 return public.lookaware_command_v5(command);
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;
alter function public.lookaware_snapshot() rename to lookaware_snapshot_v4;
revoke all on function public.lookaware_snapshot_v4() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.lookaware_snapshot_v4();
 return jsonb_set(result,'{petitions}',coalesce((select jsonb_agg(jsonb_set(p.value,'{qualification}',(p.value->'qualification')||jsonb_build_object('affidavitCount',(select count(*) from private.circulator_affidavits a where a.petition_id=(p.value->>'id')::uuid),'acceptedAffidavits',(select count(*) from private.circulator_affidavits a where a.petition_id=(p.value->>'id')::uuid and a.status='accepted'))) order by p.ordinality) from jsonb_array_elements(result->'petitions') with ordinality p(value,ordinality)),'[]'::jsonb));
end $$;
revoke all on function public.lookaware_snapshot() from public;
grant execute on function public.lookaware_snapshot() to anon,authenticated;

-- These invoker functions are available only to the database owner, never to app users.
-- They record a responsible authority's external verification; they do not perform voter-roll or notary verification.
create function private.review_qualification(pid uuid, approved boolean, authority_reference text) returns void language plpgsql set search_path='' as $$
declare q public.petition_qualification;
begin
 perform 1 from public.petitions where id=pid for update;
 select * into strict q from public.petition_qualification where petition_id=pid;
 if q.details is null then raise exception 'Supply the complete requirements before review.'; end if;
 if not approved and exists(select 1 from private.signature_receipts where petition_id=pid and status='accepted') then raise exception 'Revoke dependent signature acceptance before rejecting these requirements.'; end if;
 insert into private.qualification_reviews(petition_id,resource_type,resource_id,accepted,reference) values(pid,'requirements',pid,approved,authority_reference);
 update public.petition_qualification set status=case when approved then 'verified' else 'rejected' end,review_note=authority_reference,updated_at=now() where petition_id=pid;
end $$;
create function private.review_affidavit(aid uuid, approved boolean, notarization_verified boolean, authority_reference text) returns void language plpgsql set search_path='' as $$
declare a private.circulator_affidavits; q public.petition_qualification;
begin
 select * into strict a from private.circulator_affidavits where id=aid;
 perform 1 from public.petitions where id=a.petition_id for update;
 select * into strict q from public.petition_qualification where petition_id=a.petition_id;
 if approved and (q.status<>'verified' or a.declaration<>q.details->>'circulatorDeclaration' or (q.details->>'notarization'='required' and (not a.notarization_provided or notarization_verified is not true))) then raise exception 'Verified requirements and the required notarization are prerequisites.'; end if;
 if not approved and exists(select 1 from private.signature_acceptance s join private.signature_receipts r on r.id=s.receipt_id where s.affidavit_id=aid and r.status='accepted') then raise exception 'Revoke dependent signature acceptance before rejecting this affidavit.'; end if;
 insert into private.qualification_reviews(petition_id,resource_type,resource_id,accepted,reference) values(a.petition_id,'affidavit',aid,approved,authority_reference);
 update private.circulator_affidavits set status=case when approved then 'accepted' else 'rejected' end,review_note=authority_reference where id=aid;
end $$;
create function private.review_signature(rid uuid, aid uuid, approved boolean, registration_match boolean, signature_valid boolean, authority_reference text) returns void language plpgsql set search_path='' as $$
declare r private.signature_receipts; a private.circulator_affidavits; q public.petition_qualification; reviewid uuid;
begin
 select * into strict r from private.signature_receipts where id=rid;
 perform 1 from public.petitions where id=r.petition_id for update;
 select * into strict q from public.petition_qualification where petition_id=r.petition_id;
 if approved then
  select * into strict a from private.circulator_affidavits where id=aid;
  if q.status<>'verified' or r.disclosure->'qualification' is distinct from q.details or a.status<>'accepted' or a.petition_id<>r.petition_id or not (rid=any(a.signature_ids)) or registration_match is not true or signature_valid is not true then raise exception 'Acceptance requires exact official text, a verified registration match, valid signature and accepted covering affidavit.'; end if;
 end if;
 insert into private.qualification_reviews(petition_id,resource_type,resource_id,accepted,reference) values(r.petition_id,'signature',rid,approved,authority_reference) returning id into reviewid;
 if approved then insert into private.signature_acceptance(receipt_id,affidavit_id,registration_match,signature_valid,review_id) values(rid,aid,true,true,reviewid) on conflict(receipt_id) do update set affidavit_id=excluded.affidavit_id,review_id=excluded.review_id; end if;
 update private.signature_receipts set status=case when approved then 'accepted' else 'rejected' end,review_note=authority_reference where id=rid;
end $$;
revoke all on function private.review_qualification(uuid,boolean,text),private.review_affidavit(uuid,boolean,boolean,text),private.review_signature(uuid,uuid,boolean,boolean,boolean,text) from public,anon,authenticated;
create function private.immutable_affidavit() returns trigger language plpgsql set search_path='' as $$ begin
 if (to_jsonb(old)-'status'-'review_note') is distinct from (to_jsonb(new)-'status'-'review_note') then raise exception 'A submitted affidavit is immutable.'; end if;
 return new;
end $$;
create trigger immutable_affidavit before update on private.circulator_affidavits for each row execute function private.immutable_affidavit();
