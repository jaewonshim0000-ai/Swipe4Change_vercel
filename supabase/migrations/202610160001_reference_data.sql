-- Reference rows every project needs, live or demo.
--
-- These used to arrive only with supabase/seed.sql, which is fictional and is never pushed to a
-- live project. Without them a live project could not finish onboarding (interests are checked
-- against public.topics) and never awarded the first-signature badge. The seed's own inserts of
-- the same rows do nothing on conflict, so the demo is unchanged.
begin;

insert into public.topics(name) values
 ('Safer streets'),('Environment'),('Education'),('Public spaces'),('Accessibility')
on conflict(name) do nothing;

insert into public.badges(name,description) values ('First voice','Confirm your first signature.')
on conflict(name) do nothing;

commit;
