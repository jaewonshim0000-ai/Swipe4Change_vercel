-- Spam filter at publication, and a verified email to publish.
--
-- Every petition is checked as it goes public and whenever its wording changes. A newly published
-- petition is held out of public view (hidden, screening='pending') until the ai-review Edge
-- Function has checked it with the AI model, or with the keyword rules when no model is
-- configured. A public petition whose wording changes stays up while it is rechecked. Wording
-- that is flagged is held with its reasons (held_for) for the organizers to fix; wording that
-- passes makes the petition public. Only the Edge Function (service role) records a result.
--
-- "nonsense" (gibberish, test posts, jokes with no request) joins the review categories.
begin;

alter table public.petitions add column screening text not null default 'clear'
  check(screening in ('clear','pending','flagged'));
alter table public.petitions add column held_for text[];

create function private.review_label(hits text[]) returns text language sql immutable set search_path='' as $fn$
 select string_agg(case h when 'harassment' then 'insults or profanity' when 'hate' then 'hateful language'
   when 'nonsense' then 'text that is not a real request' else h end,', ' order by h) from unnest(hits) h $fn$;

-- Same as before, with the new category.
create or replace function public.ai_apply_screening(target uuid, hits text[]) returns void
 language plpgsql security definer set search_path='' as $$
declare p public.petitions; settled int;
begin
 if exists(select 1 from unnest(hits) h where h not in ('spam','threats','harassment','hate','nonsense')) then
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
  ||private.review_label(hits)||'.','moderation');
end $$;

-- Petitions waiting for their publication check, a few at a time.
create function public.ai_publish_queue() returns jsonb language sql stable security definer set search_path='' as $fn$
 select coalesce(jsonb_agg(x),'[]'::jsonb) from (
  select jsonb_build_object('id',p.id,'seen',p.updated_at,'petition',private.petition_text(p.content)) x
  from public.petitions p where p.screening='pending' order by p.updated_at limit 10) q $fn$;

-- Records a publication check, only for the wording that was actually checked.
create function public.ai_apply_publish_screening(target uuid, hits text[], seen timestamptz) returns void
 language plpgsql security definer set search_path='' as $$
declare p public.petitions;
begin
 if exists(select 1 from unnest(hits) h where h not in ('spam','threats','harassment','hate','nonsense')) then
  raise exception 'Unknown review category.'; end if;
 select * into p from public.petitions where id=target and screening='pending' and updated_at=seen for update;
 if not found then return; end if;
 if cardinality(hits)=0 then
  update public.petitions set screening='clear',held_for=null,hidden=false where id=p.id;
  if p.hidden then
   perform private.notify(private.managers(p.id,null),
    '“'||(p.content->>'title')||'” passed the automatic check and is public.','moderation');
  end if;
 else
  update public.petitions set screening='flagged',held_for=hits,hidden=true where id=p.id;
  perform private.notify(private.managers(p.id,null),
   '“'||(p.content->>'title')||'” is not public yet: the automatic check flagged possible '
   ||private.review_label(hits)||'. Edit the wording to fix it, or wait for a reviewer.','moderation');
 end if;
end $$;

revoke all on function public.ai_publish_queue(), public.ai_apply_publish_screening(uuid,text[],timestamptz)
  from public,anon,authenticated;
grant execute on function public.ai_publish_queue(), public.ai_apply_publish_screening(uuid,text[],timestamptz)
  to service_role;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v9;
revoke all on function public.lookaware_command_v9(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); kind text:=command->>'type'; result text; before jsonb;
 publishing boolean:=(command->>'type'='create' and coalesce((command->>'publish')::boolean,false))
   or command->>'type'='publish';
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if publishing and not coalesce((select email_verified from private.principals where profile_id=uid),false) then
  raise exception 'Verify your email before publishing. You can save a draft until then.'; end if;
 if kind='edit' then
  select private.petition_text(content) into before from public.petitions where id=(command->>'petitionId')::uuid;
 end if;
 result:=public.lookaware_command_v9(command);
 if publishing then
  -- Out of public view until the publication check has run.
  update public.petitions set screening='pending',hidden=true
   where id=coalesce(result,command->>'petitionId')::uuid and status='active';
 elsif kind='edit' then
  -- Reworded: rechecked. A public petition stays up meanwhile; a held one stays held.
  update public.petitions set screening='pending'
   where id=(command->>'petitionId')::uuid and status<>'draft'
     and private.petition_text(content) is distinct from before;
 end if;
 return result;
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

-- Organizers see why a petition is held, and that a check is still running.
alter function public.lookaware_snapshot() rename to lookaware_snapshot_v6;
revoke all on function public.lookaware_snapshot_v6() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;
begin
 result:=public.lookaware_snapshot_v6();
 return jsonb_set(result,'{petitions}',(
   select coalesce(jsonb_agg(p
     ||case when x.held_for is null then '{}'::jsonb else jsonb_build_object('heldFor',to_jsonb(x.held_for)) end
     ||case when x.screening='pending' then jsonb_build_object('checking',true) else '{}'::jsonb end
     order by ord),'[]'::jsonb)
   from jsonb_array_elements(result->'petitions') with ordinality as e(p,ord)
   join public.petitions x on x.id=(p->>'id')::uuid));
end $$;
revoke all on function public.lookaware_snapshot() from public,anon,authenticated;
grant execute on function public.lookaware_snapshot() to anon,authenticated;

commit;
