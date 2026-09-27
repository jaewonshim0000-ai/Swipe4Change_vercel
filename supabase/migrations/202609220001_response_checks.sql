-- Compare a petition's concrete asks with a verified response. The comparison is an organizer
-- assessment of the text, never a claim that the requested work was completed. Stored in the
-- petition content so the existing public snapshot and privacy boundary keep working.
begin;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v9;
revoke all on function public.lookaware_command_v9(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text
 language plpgsql security definer set search_path='' as $fn$
declare
 uid uuid:=private.actor();
 p public.petitions;
 item jsonb;
 normalized jsonb:='[]'::jsonb;
 label text;
 status text;
 rid uuid;
 actor_name text;
 seen text[]:='{}';
 delegated text;
begin
 if command->>'type'='edit' and (command->'patch') ? 'action' then
  delegated:=public.lookaware_command_v9(command);
  select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
  insert into public.petition_edits(petition_id,author_id,body,previous_content)
   values(p.id,uid,'Response comparison reset because the requested action changed.',p.content);
  update public.petitions set content=jsonb_set(p.content,'{responseChecks}',
   jsonb_build_array(jsonb_build_object('ask',left(p.content->>'action',240),
                                       'status','not_reviewed','note','')),true)
   where id=p.id;
  return delegated;
 end if;
 if command->>'type'<>'responseChecks' then
  return public.lookaware_command_v9(command);
 end if;
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
 if not found or not private.visible(p.id) then raise exception 'Petition not found or unavailable.'; end if;
 if not private.manager(p.id) then raise exception 'Organizer or collaborator permission required.'; end if;
 if jsonb_typeof(command->'checks')<>'array' or jsonb_array_length(command->'checks') not between 1 and 3 then
  raise exception 'List one to three specific asks.';
 end if;
 select name into actor_name from public.profiles where id=uid;
 for item in select value from jsonb_array_elements(command->'checks') loop
  if jsonb_typeof(item)<>'object' then raise exception 'Each check must be an object.'; end if;
  label:=trim(coalesce(item->>'ask',''));
  status:=item->>'status';
  if length(label) not between 12 and 240 then raise exception 'Describe each ask in 12 to 240 characters.'; end if;
  if lower(label)=any(seen) then raise exception 'Each ask must be distinct.'; end if;
  seen:=array_append(seen,lower(label));
  if status not in ('not_reviewed','answered','partial','unanswered') or status is null then
   raise exception 'Choose a valid response check status.';
  end if;
  if length(coalesce(item->>'note',''))>500 then raise exception 'Keep comparison notes under 500 characters.'; end if;
  if status='not_reviewed' then
   normalized:=normalized||jsonb_build_array(jsonb_build_object(
    'ask',label,'status',status,'note',''));
  else
   if length(trim(coalesce(item->>'note','')))<12 then
    raise exception 'Explain the assessment in at least 12 characters.';
   end if;
   if nullif(item->>'responseId','') is null then
    raise exception 'Choose a verified response before assessing an ask.';
   end if;
   rid:=(item->>'responseId')::uuid;
   if not exists(select 1 from public.official_responses r
                 where r.id=rid and r.petition_id=p.id and r.verification='verified' and not r.removed) then
    raise exception 'Choose a verified, available response from this petition.';
   end if;
   normalized:=normalized||jsonb_build_array(jsonb_build_object(
    'ask',label,'status',status,'note',trim(coalesce(item->>'note','')),
    'responseId',rid,'reviewedAt',now(),'reviewedBy',actor_name));
  end if;
 end loop;
 insert into public.petition_edits(petition_id,author_id,body,previous_content)
  values(p.id,uid,
   'Organizer revised the request-to-response comparison. This is an assessment of the response text, not proof that work was completed.',
   p.content);
 update public.petitions set content=jsonb_set(p.content,'{responseChecks}',normalized,true) where id=p.id;
 perform private.notify(private.followers(p.id,uid),
  'The response comparison on “'||(p.content->>'title')||'” was updated.','edit');
 return null;
end $fn$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

commit;
