-- Delivery: the point where a petition stops being a counter and becomes a document somebody sent.
--
-- Until now a petition collected signatures and stopped. Nothing recorded that it ever reached the
-- office it names, so "did this do anything?" had no answer in the data. A delivery is therefore a
-- first-class row rather than a sentence in an organizer update, and an official response can point
-- at the delivery it answers.
--
-- The signature count and the list of public names are SNAPSHOTTED into the row at delivery time.
-- A packet has to say what was actually sent; re-deriving it later from live signatures would
-- quietly rewrite history every time someone new signed or withdrew. Names are copied exactly as
-- each signer chose to appear in public — the private identity behind an anonymous signature is
-- never read here.
begin;

create table if not exists public.petition_deliveries (
  id uuid primary key default gen_random_uuid(),
  petition_id uuid not null references public.petitions(id),
  delivered_by uuid not null references public.profiles(id),
  recipient text not null,
  method text not null check(method in ('email','portal','in_person','mail')),
  note text not null check(length(note) between 5 and 500),
  signature_count integer not null check(signature_count >= 0),
  signatories jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now());

create index if not exists deliveries_petition on public.petition_deliveries(petition_id, created_at desc);

alter table public.official_responses
  add column if not exists delivery_id uuid references public.petition_deliveries(id);

alter table public.petition_deliveries enable row level security;
-- A delivery is public accountability: anyone who can see the petition can see that it was sent.
create policy deliveries_read on public.petition_deliveries for select using(private.visible(petition_id));

create or replace function private.deliveries(pid uuid) returns jsonb
 language sql stable set search_path='' as $fn$
 select coalesce(jsonb_agg(jsonb_build_object(
   'id',d.id,'petitionId',d.petition_id,'recipient',d.recipient,'method',d.method,
   'deliveredBy',u.name,'deliveredAt',d.created_at,'note',d.note,
   'signatureCount',d.signature_count,'signatories',d.signatories)
   order by d.created_at desc),'[]'::jsonb)
 from public.petition_deliveries d join public.profiles u on u.id=d.delivered_by
 where d.petition_id=pid $fn$;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v5;
revoke all on function public.lookaware_command_v5(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); p public.petitions; names jsonb; total integer; who text; did uuid;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if command->>'type'='deliver' then
  select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
  if not found or not private.visible(p.id) then raise exception 'Petition not found or unavailable.'; end if;
  if not private.manager(p.id) then raise exception 'Organizer or collaborator permission required.'; end if;
  if p.status='draft' then raise exception 'Publish the petition before recording a delivery.'; end if;
  if command->>'method' not in ('email','portal','in_person','mail') then raise exception 'Choose how it was delivered.'; end if;
  if length(coalesce(trim(command->>'note'),''))<5 then
   raise exception 'Say where it went — an inbox, a meeting, a portal reference.'; end if;
  select p.sample_count + count(*) into total from public.signatures where petition_id=p.id;
  if total < 1 then raise exception 'Collect at least one signature before delivering this petition.'; end if;
  -- Exactly the names the petition already shows in public, and nothing else.
  select coalesce(jsonb_agg(display_name order by created_at),'[]'::jsonb) into names
   from public.signatures where petition_id=p.id;
  insert into public.petition_deliveries(petition_id,delivered_by,recipient,method,note,signature_count,signatories)
   values(p.id,uid,p.content->>'recipient',command->>'method',left(trim(command->>'note'),500),total,names);
  select name into who from public.profiles where id=uid;
  perform private.notify(private.followers(p.id,uid),
    '“'||(p.content->>'title')||'” was delivered to '||(p.content->>'recipient')||' with '||total||' signatures.',
    'delivery');
  return null;
 end if;
 if command->>'type'='response' and command->>'deliveryId' is not null then
  did:=(command->>'deliveryId')::uuid;
  if not exists(select 1 from public.petition_deliveries
                where id=did and petition_id=(command->>'petitionId')::uuid) then
   raise exception 'That delivery is not on this petition.'; end if;
  -- Let the existing layer create the response, then attach it to the delivery it answers.
  perform public.lookaware_command_v5(command - 'deliveryId');
  update public.official_responses set delivery_id=did
   where id=(select id from public.official_responses
             where petition_id=(command->>'petitionId')::uuid order by created_at desc limit 1);
  return null;
 end if;
 return public.lookaware_command_v5(command);
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

alter function public.lookaware_snapshot() rename to lookaware_snapshot_v3;
revoke all on function public.lookaware_snapshot_v3() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.lookaware_snapshot_v3();
-- Deliveries hang off the petition, and each response carries the delivery it answers so the
 -- reader can see which hand-off produced which reply.
 return jsonb_set(result,'{petitions}',(
   select coalesce(jsonb_agg(
     jsonb_set(p||jsonb_build_object('deliveries',private.deliveries((p->>'id')::uuid)),
       '{responses}',
       (select coalesce(jsonb_agg(r||coalesce((select jsonb_build_object('deliveryId',o.delivery_id)
              from public.official_responses o
              where o.id=(r->>'id')::uuid and o.delivery_id is not null),'{}'::jsonb)
            order by ord2),'[]'::jsonb)
        from jsonb_array_elements(p->'responses') with ordinality as rr(r,ord2)))
     order by ord),'[]'::jsonb)
   from jsonb_array_elements(result->'petitions') with ordinality as e(p,ord)));
end $$;
revoke all on function public.lookaware_snapshot() from public,anon,authenticated;
grant execute on function public.lookaware_snapshot() to anon,authenticated;

commit;
