-- Live accounts: signed Clerk claims keep the private record current, and people can delete
-- their account.
--
-- The session token carries `email_verified` and `name` (see SETUP.md). Verification was read
-- only when an account was first provisioned, so anyone who verified later stayed unverified
-- and could never publish; every account also started as "Community member".
begin;

-- Returns true when it changed something, so the snapshot can read once more.
create function private.sync_claims() returns boolean language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); claims jsonb:=auth.jwt();
 nm text:=left(trim(coalesce(claims->>'name','')),100); n integer; changed boolean:=false;
begin
 if uid is null then return false; end if;
 -- A token without the claim (dashboard not configured yet) leaves the stored value alone.
 if claims ? 'email_verified' then
  update private.principals set email_verified=coalesce((claims->>'email_verified')::boolean,false)
   where profile_id=uid
     and email_verified is distinct from coalesce((claims->>'email_verified')::boolean,false);
  get diagnostics n=row_count; changed:=n>0;
 end if;
 -- Only the placeholder is replaced; a name the person chose is never overwritten.
 if length(nm)>=2 then
  update public.profiles set name=nm where id=uid and name='Community member';
  get diagnostics n=row_count; changed:=changed or n>0;
 end if;
 return changed;
end $$;
revoke all on function private.sync_claims() from public,anon,authenticated;

alter function public.lookaware_snapshot() rename to lookaware_snapshot_v7;
revoke all on function public.lookaware_snapshot_v7() from public,anon,authenticated;
create function public.lookaware_snapshot() returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb:=public.lookaware_snapshot_v7();
begin
 -- The first read provisions a new account, so claims are applied after it.
 if private.sync_claims() then result:=public.lookaware_snapshot_v7(); end if;
 return result;
end $$;
revoke all on function public.lookaware_snapshot() from public,anon,authenticated;
grant execute on function public.lookaware_snapshot() to anon,authenticated;

alter function public.lookaware_command(jsonb) rename to lookaware_command_v10;
revoke all on function public.lookaware_command_v10(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor();
begin
 if command->>'type' is distinct from 'delete_account' then
  return public.lookaware_command_v10(command);
 end if;
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 -- Personal records go. Receipts and ripple credit for these signatures cascade with them.
 delete from public.signatures where user_id=uid;
 delete from private.signature_receipts where user_id=uid;
 delete from private.signature_referrals where referrer_id=uid;
 delete from private.ripple_codes where user_id=uid;
 delete from private.eligibility_requests where user_id=uid;
 delete from private.civic_lookups where profile_id=uid;
 delete from public.user_interests where user_id=uid;
 delete from public.community_members where user_id=uid;
 delete from public.petition_saves where user_id=uid;
 delete from public.petition_drafts where user_id=uid;
 delete from public.petition_volunteers where user_id=uid;
 delete from public.petition_collaborators where user_id=uid;
 delete from public.post_reports where user_id=uid;
 delete from public.reports where user_id=uid;
 delete from public.user_badges where user_id=uid;
 delete from public.notifications where user_id=uid;
 -- Their petitions leave public view. What they wrote in public stays, unattributed.
 update public.petitions set status='archived',updated_at=now() where owner_id=uid and status<>'archived';
 update public.profiles set name='Deleted account',city='',bio='',onboarded=false where id=uid;
 -- Without the mapping the Clerk account can never reach this profile again.
 delete from private.principals where profile_id=uid;
 return null;
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;

commit;
