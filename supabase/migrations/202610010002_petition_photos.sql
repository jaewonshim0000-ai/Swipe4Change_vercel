-- Petition photos.
--
-- The app resizes each photo and strips its metadata (including the GPS position phones record)
-- before upload, then stores it in the public petition-photos bucket under a random name. Any
-- signed-in person may add a file; only its uploader may replace or delete it. A photo appears on a
-- petition only through the `photo` command below, which only the petition's organizers may run,
-- and every change goes into the public edit history.
begin;

-- Storage exists only on a real Supabase project, not in the PGlite integration test.
do $storage$
begin
 if to_regclass('storage.buckets') is null then return; end if;
 insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)
  values('petition-photos','petition-photos',true,1048576,array['image/jpeg'])
  on conflict(id) do update set public=true,file_size_limit=1048576,allowed_mime_types=array['image/jpeg'];
 execute $p$create policy "petition photos: signed-in upload" on storage.objects for insert
  to authenticated with check (bucket_id='petition-photos' and name ~ '^[A-Za-z0-9_-]+\.jpg$')$p$;
 execute $p$create policy "petition photos: uploader replaces" on storage.objects for update
  to authenticated using (bucket_id='petition-photos' and owner_id=auth.jwt()->>'sub')$p$;
 execute $p$create policy "petition photos: uploader deletes" on storage.objects for delete
  to authenticated using (bucket_id='petition-photos' and owner_id=auth.jwt()->>'sub')$p$;
end $storage$;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v8;
revoke all on function public.lookaware_command_v8(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); p public.petitions; ph jsonb; url text; alt text;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if command->>'type'<>'photo' then return public.lookaware_command_v8(command); end if;
 select * into p from public.petitions where id=(command->>'petitionId')::uuid for update;
 if not found or not private.visible(p.id) then raise exception 'Petition not found or unavailable.'; end if;
 if not private.manager(p.id) then
  raise exception 'Only the owner or an authorized collaborator can manage this petition.'; end if;
 ph:=command->'photo';
 if ph is null or jsonb_typeof(ph)='null' then
  if not p.content ? 'photo' then raise exception 'Nothing changed.'; end if;
  update public.petitions set updated_at=now(),content=content-'photo' where id=p.id;
  insert into public.petition_edits(petition_id,author_id,body,previous_content)
   values(p.id,uid,'Photo removed.',p.content);
  return null;
 end if;
 url:=ph->>'url'; alt:=trim(coalesce(ph->>'alt',''));
 if url is null or length(url)>500
    or url !~ '^https://[^/[:space:]]+/storage/v1/object/public/petition-photos/[A-Za-z0-9_-]+\.jpg$' then
  raise exception 'Upload the photo through the app.'; end if;
 if length(alt) not between 5 and 200 then
  raise exception 'Describe the photo in a few words for people using screen readers.'; end if;
 if p.content->'photo'=jsonb_build_object('url',url,'alt',alt) then raise exception 'Nothing changed.'; end if;
 update public.petitions set updated_at=now(),
  content=content||jsonb_build_object('photo',jsonb_build_object('url',url,'alt',alt)) where id=p.id;
 -- The picture shapes how people read the request, so changes are on the public record.
 insert into public.petition_edits(petition_id,author_id,body,previous_content)
  values(p.id,uid,case when p.content ? 'photo' then 'Photo changed: “' else 'Photo added: “' end||alt||'”.',p.content);
 return null;
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

commit;
