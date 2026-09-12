-- A public support entry is not a legally accepted signature. Private receipts preserve exact consent.
create table private.signature_receipts (
 id uuid primary key references public.signatures(id),
 petition_id uuid not null references public.petitions(id),
 user_id uuid not null references public.profiles(id),
 disclosure jsonb not null,
 envelope jsonb not null,
 consent boolean not null check(consent),
 submitted_at timestamptz not null default now(),
 status text not null default 'pending' check(status in ('pending','accepted','rejected')),
 review_note text not null default '',
 unique(petition_id,user_id),
 check(jsonb_typeof(envelope)='object' and envelope->'version'='1'::jsonb and jsonb_typeof(envelope->'ciphertext')='string' and length(envelope->>'ciphertext') between 40 and 500000 and envelope->>'ciphertext' ~ '^[A-Za-z0-9+/]+={0,2}$' and envelope - 'version' - 'ciphertext' = '{}'::jsonb)
);
create index signature_receipts_petition_status on private.signature_receipts(petition_id,status);
alter table private.signature_receipts enable row level security;
revoke all on private.signature_receipts from public,anon,authenticated;
create function private.petition_disclosure(p public.petitions) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('petitionId',p.id,'title',p.content->>'title','fullText',(p.content->>'problem')||E'\n\nRequested action\n'||(p.content->>'action'),'recipient',p.content->>'recipient','approximateLocation',p.content->>'city','deadline',p.content->>'deadline','verification',p.content->>'verification','publicIdentities',p.content->'identities','eligibilityRule',p.content->>'customRule')
$$;
create function public.signature_receipt(petition_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.actor() is null then raise exception 'Sign in to access your private receipt.'; end if;
 return (select jsonb_build_object('id',r.id,'petitionId',r.petition_id,'disclosure',r.disclosure,'envelope',r.envelope,'consent',r.consent,'submittedAt',r.submitted_at,'status',r.status,'reviewNote',r.review_note) from private.signature_receipts r where r.petition_id=signature_receipt.petition_id and r.user_id=private.actor());
end $$;
revoke all on function public.signature_receipt(uuid) from public,anon;
grant execute on function public.signature_receipt(uuid) to authenticated;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v3;
revoke all on function public.lookaware_command_v3(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); p public.petitions; s jsonb; sid uuid; result text;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if command->>'type'='sign' then
  select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
  if not found or not private.visible(p.id) then raise exception 'Petition not found or unavailable.'; end if;
  if exists(select 1 from public.signatures where petition_id=p.id and user_id=uid) then raise exception 'You have already signed this petition.'; end if;
  -- Under the same row lock as signing, compare the entire disclosed document and rules.
  s:=command->'submission';
  if jsonb_typeof(s) is distinct from 'object' or s->'consent' is distinct from 'true'::jsonb or jsonb_typeof(s->'envelope') is distinct from 'object' or (s->'envelope')->'version' is distinct from '1'::jsonb or jsonb_typeof((s->'envelope')->'ciphertext') is distinct from 'string' then raise exception 'Review the full petition and provide your encrypted signatory record before confirming.'; end if;
  if s->'disclosure' is distinct from private.petition_disclosure(p) then raise exception 'The petition changed while you were reviewing it. Reopen the signing form and read the latest text.'; end if;
  if not exists(select 1 from private.signature_vaults where user_id=uid) then raise exception 'Set up your private signature vault in Profile first.'; end if;
  result:=public.lookaware_command_v3(command);
  select id into strict sid from public.signatures where petition_id=p.id and user_id=uid;
  insert into private.signature_receipts(id,petition_id,user_id,disclosure,envelope,consent) values(sid,p.id,uid,s->'disclosure',s->'envelope',true);
  update public.notifications set body=replace(body,'is confirmed.','was recorded for review.') where user_id=uid and kind='signature' and created_at=now();
  return result;
 end if;
 return public.lookaware_command_v3(command);
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

alter function public.lookaware_snapshot() rename to lookaware_snapshot_v2;
revoke all on function public.lookaware_snapshot_v2() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.lookaware_snapshot_v2();
 return jsonb_set(result,'{petitions}',coalesce((select jsonb_agg(p.value||jsonb_build_object('recordedSignatures',(select count(*) from private.signature_receipts r where r.petition_id=(p.value->>'id')::uuid),'acceptedSignatures',(select count(*) from private.signature_receipts r where r.petition_id=(p.value->>'id')::uuid and r.status='accepted')) order by p.ordinality) from jsonb_array_elements(result->'petitions') with ordinality p(value,ordinality)),'[]'::jsonb));
end $$;
revoke all on function public.lookaware_snapshot() from public;
grant execute on function public.lookaware_snapshot() to anon,authenticated;

-- Receipt disclosure/envelope are append-only even for trusted updates. Reviews may change status, never consent.
create function private.immutable_signature_receipt() returns trigger language plpgsql set search_path='' as $$
begin
 if old.id is distinct from new.id or old.petition_id is distinct from new.petition_id or old.user_id is distinct from new.user_id or old.disclosure is distinct from new.disclosure or old.envelope is distinct from new.envelope or old.consent is distinct from new.consent or old.submitted_at is distinct from new.submitted_at then raise exception 'A signature receipt is immutable.'; end if;
 return new;
end $$;
create trigger immutable_signature_receipt before update on private.signature_receipts for each row execute function private.immutable_signature_receipt();
