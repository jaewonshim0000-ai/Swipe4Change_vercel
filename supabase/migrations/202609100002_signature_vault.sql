-- Ciphertext only. The recovery key, signature image, and residence never reach the server in plaintext.
create table private.signature_vaults (
 user_id uuid primary key references public.profiles(id),
 envelope jsonb not null check(jsonb_typeof(envelope)='object' and envelope->>'version'='1' and jsonb_typeof(envelope->'ciphertext')='string' and length(envelope->>'ciphertext') between 40 and 500000 and envelope->>'ciphertext' ~ '^[A-Za-z0-9+/]+={0,2}$' and envelope - 'version' - 'ciphertext' = '{}'::jsonb),
 updated_at timestamptz not null default now()
);
alter table private.signature_vaults enable row level security;
revoke all on private.signature_vaults from public,anon,authenticated;
create function public.signature_vault() returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if private.actor() is null then raise exception 'Sign in to access your private vault.'; end if;
 return (select envelope from private.signature_vaults where user_id=private.actor());
end $$;
revoke all on function public.signature_vault() from public,anon;
grant execute on function public.signature_vault() to authenticated;
alter function public.lookaware_command(jsonb) rename to lookaware_command_v2;
revoke all on function public.lookaware_command_v2(jsonb) from public,anon,authenticated;
create function public.lookaware_command(command jsonb) returns text language plpgsql security definer set search_path='' as $$
declare uid uuid:=private.actor(); e jsonb;
begin
 if uid is null then raise exception 'Sign in before making changes.'; end if;
 if command->>'type'='saveVault' then
  e:=command->'envelope';
  if e is null or e->'version' is distinct from '1'::jsonb or jsonb_typeof(e->'ciphertext') is distinct from 'string' then raise exception 'Use a supported encrypted vault.'; end if;
  insert into private.signature_vaults(user_id,envelope) values(uid,e) on conflict(user_id) do update set envelope=excluded.envelope,updated_at=now();
  return null;
 elsif command->>'type'='deleteVault' then
  delete from private.signature_vaults where user_id=uid; return null;
 end if;
 return public.lookaware_command_v2(command);
end $$;
revoke all on function public.lookaware_command(jsonb) from public,anon;
grant execute on function public.lookaware_command(jsonb) to authenticated;
