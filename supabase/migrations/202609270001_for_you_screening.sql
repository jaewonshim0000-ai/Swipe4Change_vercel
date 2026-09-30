-- AI review (report screening and hidden tags) and donation links.
--
-- Screening: a report is recorded as `pending`. The ai-review Edge Function asks an AI model
-- (Claude) to review the petition's own text, never the reporter's reason, so reporting a clean
-- petition cannot hide it however often it happens. If the model finds spam, threats, insults or
-- hateful language, the petition leaves public view until a trusted reviewer decides; its
-- organizers still see it and are told why. If the model is unreachable the function falls back
-- to keyword rules. Restoring a petition is an admin operation: update public.petitions set
-- hidden=false.
--
-- Tags: the same function writes hidden hashtags (ai_tags) that the app's For You ranking reads.
-- Rewording a petition clears them so it is retagged.
--
-- The queue functions are callable only with the service role, which exists only inside the
-- Edge Function. Browsing signals for For You never reach the server at all.
--
-- Donation links: an organizer may link their own external fundraising page. The app only opens
-- it; no payment is processed here. Every change goes into the public edit history.
begin;

alter table public.petitions add column if not exists hidden boolean not null default false;
alter table public.petitions add column if not exists ai_tags text[];
alter table public.reports add column if not exists screening text not null default 'pending'
  check(screening in ('pending','clear','flagged'));

-- A hidden petition leaves every public read path (the snapshot, signatures, RLS policies) at once,
-- because they all go through this function. Its organizers keep seeing it.
create or replace function private.visible(pid uuid) returns boolean
 language sql stable security definer set search_path='' as $fn$
 select exists(select 1 from public.petitions p where p.id=pid
   and ((p.status in ('active','closed','successful') and (not p.hidden or private.manager(p.id)))
        or (p.status='draft' and private.manager(p.id)))) $fn$;

-- New wording needs new tags.
create function private.retag() returns trigger language plpgsql set search_path='' as $$
begin
 if exists(select 1 from unnest(array['title','summary','problem','action','recipient']) k
           where old.content->k is distinct from new.content->k) then new.ai_tags:=null; end if;
 return new;
end $$;
create trigger retag_on_rewording before update on public.petitions
 for each row execute function private.retag();

-- The public wording: the only thing the model ever reads.
create function private.petition_text(c jsonb) returns jsonb language sql immutable set search_path='' as $fn$
 select jsonb_build_object('title',c->>'title','summary',c->>'summary','problem',c->>'problem',
   'action',c->>'action','recipient',c->>'recipient') $fn$;

-- Work for one pass of the Edge Function, a few items at a time.
-- ponytail: no per-user report limit, so a determined user can queue many reviews; add one if abused.
create function public.ai_review_queue() returns jsonb language sql stable security definer set search_path='' as $fn$
 select jsonb_build_object(
  'reports',coalesce((select jsonb_agg(x) from (
     select jsonb_build_object('petitionId',p.id,'petition',private.petition_text(p.content)) x
     from public.petitions p
     where exists(select 1 from public.reports r where r.petition_id=p.id and r.screening='pending')
     order by p.id limit 5) q),'[]'::jsonb),
  'petitions',coalesce((select jsonb_agg(x) from (
     select jsonb_build_object('id',p.id,'seen',p.updated_at,'petition',private.petition_text(p.content)) x
     from public.petitions p
     where p.ai_tags is null and p.status in ('active','closed','successful') and not p.hidden
     order by p.created_at desc limit 5) q),'[]'::jsonb),
  'vocabulary',coalesce((select jsonb_agg(distinct t) from public.petitions p, unnest(p.ai_tags) t),'[]'::jsonb)) $fn$;

-- Settles every pending report on a petition with one review.
create function public.ai_apply_screening(target uuid, hits text[]) returns void
 language plpgsql security definer set search_path='' as $$
declare p public.petitions; settled int;
begin
 if exists(select 1 from unnest(hits) h where h not in ('spam','threats','harassment','hate')) then
  raise exception 'Unknown review category.'; end if;
 select * into p from public.petitions where id=target for update;
 if not found then return; end if;
 update public.reports set screening=case when cardinality(hits)>0 then 'flagged' else 'clear' end
  where petition_id=p.id and screening='pending';
 get diagnostics settled=row_count;
 if settled=0 or cardinality(hits)=0 or p.hidden then return; end if;
 update public.petitions set hidden=true where id=p.id;
 perform private.notify(private.managers(p.id,null),
  '“'||(p.content->>'title')||'” is hidden while a person reviews it. After a report, the automatic review flagged possible '
  ||(select string_agg(case h when 'harassment' then 'insults or profanity' when 'hate' then 'hateful language' else h end,', ' order by h)
     from unnest(hits) h)||'.','moderation');
end $$;

-- Writes tags only if the wording is still what the model read.
create function public.ai_apply_tags(target uuid, tags text[], seen timestamptz) returns void
 language sql security definer set search_path='' as $fn$
 update public.petitions set ai_tags=tags
 where id=target and updated_at=seen and cardinality(tags) between 1 and 8
   and not exists(select 1 from unnest(tags) t where t !~ '^[a-z0-9-]{2,40}$') $fn$;

revoke all on function public.ai_review_queue(), public.ai_apply_screening(uuid,text[]),
  public.ai_apply_tags(uuid,text[],timestamptz) from public,anon,authenticated;
grant execute on function public.ai_review_queue(), public.ai_apply_screening(uuid,text[]),
  public.ai_apply_tags(uuid,text[],timestamptz) to service_role;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v7;
revoke all on function public.lookaware_command_v7(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); p public.petitions; url text;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if command->>'type'='report' then
  -- The layer below checks visibility and records the report as pending. The caller gets its id
  -- to read the review's outcome once the Edge Function has run.
  perform public.lookaware_command_v7(command);
  return (select id from public.reports where petition_id=(command->>'petitionId')::uuid
          and user_id=uid order by created_at desc limit 1)::text;
 end if;
 if command->>'type'='donationLink' then
  select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
  if not found or not private.visible(p.id) then raise exception 'Petition not found or unavailable.'; end if;
  if not private.manager(p.id) then
   raise exception 'Only the owner or an authorized collaborator can manage this petition.'; end if;
  url:=trim(coalesce(command->>'url',''));
  if url<>'' and (url !~ '^https://[^ /]+' or length(url)>500) then
   raise exception 'Use an HTTPS link to your fundraising page.'; end if;
  if url=coalesce(p.content->>'donationUrl','') then raise exception 'Nothing changed.'; end if;
  update public.petitions set updated_at=now(),
   content=case when url='' then content-'donationUrl' else content||jsonb_build_object('donationUrl',url) end
   where id=p.id;
  -- Where money goes is material, so every change is on the public record.
  insert into public.petition_edits(petition_id,author_id,body,previous_content)
   values(p.id,uid,case when url='' then 'Donation link removed.' else 'Donation link set to '||url||'.' end,p.content);
  return null;
 end if;
 return public.lookaware_command_v7(command);
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

alter function public.lookaware_snapshot() rename to lookaware_snapshot_v5;
revoke all on function public.lookaware_snapshot_v5() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.lookaware_snapshot_v5();
 -- Only organizers ever receive a hidden petition, so the flag tells them why it left public view.
 -- Tags are hidden in the app but travel with the petition so the device can rank the feed.
 result:=jsonb_set(result,'{petitions}',(
   select coalesce(jsonb_agg(p||jsonb_build_object('hidden',x.hidden)
     ||case when x.ai_tags is null then '{}'::jsonb else jsonb_build_object('tags',x.ai_tags) end
     order by ord),'[]'::jsonb)
   from jsonb_array_elements(result->'petitions') with ordinality as e(p,ord)
   join public.petitions x on x.id=(p->>'id')::uuid));
 return jsonb_set(result,'{reports}',(
   select coalesce(jsonb_agg(r||jsonb_build_object('screening',x.screening) order by ord),'[]'::jsonb)
   from jsonb_array_elements(result->'reports') with ordinality as e(r,ord)
   join public.reports x on x.id=(r->>'id')::uuid));
end $$;
revoke all on function public.lookaware_snapshot() from public,anon,authenticated;
grant execute on function public.lookaware_snapshot() to anon,authenticated;

commit;
