-- Organizer trend chart: real signatures per day for the last 14 days, by where they came from.
-- Day 0 is the last 24 hours. A share link (a referral row) wins over community membership, so
-- each signature counts once. Only aggregates leave the database: never a signer or a time.
create or replace function public.lookaware_signature_trend(petition_id uuid) returns jsonb
 language plpgsql stable security definer set search_path='' as $fn$
declare result jsonb;
begin
 if not private.manager(petition_id) then raise exception 'Only organizers can see signature trends.'; end if;
 select coalesce(jsonb_agg(jsonb_build_object('daysAgo',t.days_ago,'source',t.source,'count',t.n)
   order by t.days_ago, t.source),'[]'::jsonb)
 into result from (
   select floor(extract(epoch from now()-s.created_at)/86400)::int days_ago,
     case
       when exists(select 1 from private.signature_referrals r where r.signature_id=s.id) then 'link'
       when exists(select 1 from public.community_members m
         where m.community_id=p.community_id and m.user_id=s.user_id and m.active) then 'community'
       else 'other'
     end source,
     count(*)::int n
   from public.signatures s join public.petitions p on p.id=s.petition_id
   where s.petition_id=lookaware_signature_trend.petition_id
     and s.created_at > now()-interval '14 days'
   group by 1,2
 ) t;
 return result;
end $fn$;
revoke all on function public.lookaware_signature_trend(uuid) from public,anon;
grant execute on function public.lookaware_signature_trend(uuid) to authenticated;
