-- A signature is drawn by hand and kept with the exact text the person read. The receipt is
-- readable only by the signer: organizers and the public see the chosen display name, never the
-- drawing. Withdrawing a signature deletes its receipt with it.
create table private.signature_receipts (
 id uuid primary key references public.signatures(id) on delete cascade,
 petition_id uuid not null references public.petitions(id),
 user_id uuid not null references public.profiles(id),
 disclosure jsonb not null,
 signature jsonb not null check(jsonb_typeof(signature)='array' and jsonb_array_length(signature) between 8 and 3000),
 signed_at timestamptz not null default now(),
 unique(petition_id,user_id)
);
alter table private.signature_receipts enable row level security;
revoke all on private.signature_receipts from public,anon,authenticated;
-- A receipt records what was signed, so it never changes afterwards.
create function private.immutable_receipt() returns trigger language plpgsql set search_path='' as $$
begin raise exception 'A signature receipt is immutable.'; end $$;
create trigger immutable_receipt before update on private.signature_receipts for each row execute function private.immutable_receipt();

-- Field for field what the client shows on the signing sheet. See petitionDisclosure().
create function private.petition_disclosure(p public.petitions) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('petitionId',p.id,'title',p.content->>'title','fullText',(p.content->>'problem')||E'\n\nRequested action\n'||(p.content->>'action'),'recipient',p.content->>'recipient','approximateLocation',p.content->>'city','deadline',p.content->>'deadline','verification',p.content->>'verification','publicIdentities',p.content->'identities','eligibilityRule',p.content->>'customRule')
$$;
create function public.signature_receipt(petition_id uuid) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.actor() is null then raise exception 'Sign in to see your signature.'; end if;
 return (select jsonb_build_object('id',r.id,'petitionId',r.petition_id,'disclosure',r.disclosure,'signature',r.signature,'signedAt',r.signed_at) from private.signature_receipts r where r.petition_id=signature_receipt.petition_id and r.user_id=private.actor());
end $$;
revoke all on function public.signature_receipt(uuid) from public,anon;
grant execute on function public.signature_receipt(uuid) to authenticated;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v2;
revoke all on function public.lookaware_command_v2(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); p public.petitions; s jsonb; sid uuid; result text;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if command->>'type'='sign' then
  select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
  if not found or not private.visible(p.id) then raise exception 'Petition not found or unavailable.'; end if;
  if exists(select 1 from public.signatures where petition_id=p.id and user_id=uid) then raise exception 'You have already signed this petition.'; end if;
  s:=command->'submission';
  if jsonb_typeof(s) is distinct from 'object' or s->'consent' is distinct from 'true'::jsonb then raise exception 'Read the full petition and confirm your consent before signing.'; end if;
  -- Separate steps and a CASE, because OR does not promise to check a type before a cast runs.
  if jsonb_typeof(s->'signature') is distinct from 'array' then raise exception 'Draw your signature before confirming.'; end if;
  if jsonb_array_length(s->'signature') not between 8 and 3000 or exists(select 1 from jsonb_array_elements(s->'signature') pt where
   case when jsonb_typeof(pt)='object' and jsonb_typeof(pt->'x')='number' and jsonb_typeof(pt->'y')='number' and jsonb_typeof(pt->'start')='boolean' and pt - 'x' - 'y' - 'start' = '{}'::jsonb
    then (pt->>'x')::numeric not between 0 and 1 or (pt->>'y')::numeric not between 0 and 1 else true end)
  then raise exception 'Draw your signature before confirming.'; end if;
  -- Under the same row lock as signing, the text they read must still be the text on file.
  if s->'disclosure' is distinct from private.petition_disclosure(p) then raise exception 'The petition changed while you were reviewing it. Reopen the signing form and read the latest text.'; end if;
  result:=public.lookaware_command_v2(command);
  select id into strict sid from public.signatures where petition_id=p.id and user_id=uid;
  insert into private.signature_receipts(id,petition_id,user_id,disclosure,signature) values(sid,p.id,uid,s->'disclosure',s->'signature');
  return result;
 end if;
 return public.lookaware_command_v2(command);
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;
