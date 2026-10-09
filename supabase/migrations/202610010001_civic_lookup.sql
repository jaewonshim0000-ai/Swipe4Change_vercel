-- The AI helpers (recipient finder, petition writer) call Anthropic's API, which costs money per
-- call. The civic-lookup Edge Function calls this with the caller's own Clerk token before each
-- request: it refuses guests and allows each person 20 an hour. Only the time of each is kept.
begin;

create table private.civic_lookups (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index civic_lookups_recent on private.civic_lookups(profile_id, created_at);

create function public.claim_civic_lookup() returns void
 language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor();
begin
 if uid is null then raise exception 'Sign in to use the AI helpers.'; end if;
 perform pg_advisory_xact_lock(hashtextextended(uid::text,1));
 if (select count(*) from private.civic_lookups
     where profile_id=uid and created_at>now()-interval '1 hour')>=20 then
  raise exception 'You can use the AI helpers 20 times an hour. Try again later.';
 end if;
 delete from private.civic_lookups where created_at<now()-interval '1 day';
 insert into private.civic_lookups(profile_id) values(uid);
end $$;
revoke all on function public.claim_civic_lookup() from public,anon;
grant execute on function public.claim_civic_lookup() to authenticated;

commit;
