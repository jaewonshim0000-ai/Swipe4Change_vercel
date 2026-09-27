import { writeFileSync } from 'node:fs';
import { communities, demoIds, petitionId, seedPetitions, seedProfiles } from '../src/data/seed';
import { topics } from '../src/domain/model';
const sql = (value: unknown) => `'${String(value).replaceAll("'", "''")}'`;
const rows = [
  '-- Repeatable fictional Swipe4Change seed. Never run against a live community.',
  'begin;',
];
for (const p of seedProfiles())
  rows.push(
    `insert into public.profiles(id,name,city,onboarded) values(${sql(p.id)},${sql(p.name)},${sql(p.city)},false) on conflict(id) do nothing;`,
  );
for (const t of topics)
  rows.push(`insert into public.topics(name) values(${sql(t)}) on conflict(name) do nothing;`);
for (const c of communities)
  rows.push(
    `insert into public.communities(id,owner_id,name,description,city,topic,sample_members) values(${[c.id, c.ownerId, c.name, c.description, c.city, c.topic, c.members].map(sql).join(',')}) on conflict(id) do nothing;`,
  );
for (const p of seedProfiles())
  for (const id of p.joined)
    rows.push(
      `insert into public.community_members(community_id,user_id) values(${sql(id)},${sql(p.id)}) on conflict do nothing;`,
    );
for (const p of seedPetitions()) {
  const {
    title,
    summary,
    problem,
    action,
    recipient,
    topic,
    city,
    communityId,
    goal,
    deadline,
    evidence,
    verification,
    identities,
    customRule,
  } = p;
  const content = {
    title,
    summary,
    problem,
    action,
    recipient,
    topic,
    city,
    communityId,
    goal,
    deadline,
    evidence,
    verification,
    identities,
    customRule,
  };
  rows.push(
    `insert into public.petitions(id,owner_id,community_id,content,status,sample_count,sample_saves,sample_velocity,created_at) values(${sql(p.id)},${sql(p.ownerId)},${sql(p.communityId)},${sql(JSON.stringify(content))}::jsonb,'active',${p.sampleCount},${p.saves},${p.sampleVelocity},${sql(p.createdAt)}) on conflict(id) do nothing;`,
  );
  for (const e of p.evidence)
    rows.push(
      `insert into public.petition_sources(petition_id,label,url) select ${sql(p.id)},${sql(e.label)},${sql(e.url)} where not exists(select 1 from public.petition_sources where petition_id=${sql(p.id)} and url=${sql(e.url)});`,
    );
  for (const e of p.updates)
    rows.push(
      `insert into public.petition_updates(petition_id,author_id,body) select ${sql(p.id)},${sql(p.ownerId)},${sql(e.body)} where not exists(select 1 from public.petition_updates where petition_id=${sql(p.id)});`,
    );
  for (const e of p.edits)
    rows.push(
      `insert into public.petition_edits(petition_id,author_id,body,previous_content) select ${sql(p.id)},${sql(p.ownerId)},${sql(e.body)},${sql(JSON.stringify(content))}::jsonb where not exists(select 1 from public.petition_edits where petition_id=${sql(p.id)});`,
    );
  for (const e of p.endorsements)
    rows.push(
      `insert into public.petition_endorsements(petition_id,community_id,body) values(${sql(p.id)},${sql(p.communityId)},${sql(e.body)}) on conflict do nothing;`,
    );
  for (const e of p.discussion)
    rows.push(
      `insert into public.discussion_posts(petition_id,author_id,kind,body) select ${sql(p.id)},${sql(p.ownerId)},${sql(e.kind)},${sql(e.body)} where not exists(select 1 from public.discussion_posts where petition_id=${sql(p.id)});`,
    );
  for (const d of p.deliveries)
    rows.push(
      `insert into public.petition_deliveries(id,petition_id,delivered_by,recipient,method,note,signature_count,signatories,created_at) values(${sql(d.id)},${sql(p.id)},${sql(p.ownerId)},${sql(d.recipient)},${sql(d.method)},${sql(d.note)},${d.signatureCount},'[]'::jsonb,${sql(d.deliveredAt)}) on conflict(id) do nothing;`,
    );
  for (const e of p.responses)
    rows.push(
      `insert into public.official_responses(petition_id,author_id,body,organization,verification,delivery_id) select ${sql(p.id)},${sql(p.ownerId)},${sql(e.body)},${sql(e.organization)},'verified',${e.deliveryId ? sql(e.deliveryId) : 'null'} where not exists(select 1 from public.official_responses where petition_id=${sql(p.id)});`,
    );
}
rows.push(
  `insert into public.petition_saves(petition_id,user_id) values(${sql(petitionId(2))},${sql(demoIds.maya)}) on conflict do nothing;`,
);
for (const name of ['First voice', 'Community starter', 'Local voice'])
  rows.push(
    `insert into public.badges(name,description) values(${sql(name)},'Fictional participation badge') on conflict(name) do nothing;`,
  );
for (const p of seedProfiles())
  for (const badge of p.badges)
    rows.push(
      `insert into public.user_badges(user_id,badge_id) select ${sql(p.id)},id from public.badges where name=${sql(badge)} on conflict do nothing;`,
    );
rows.push('commit;');
writeFileSync('supabase/seed.sql', rows.join('\n') + '\n');
console.log(
  'Generated repeatable SQL seed: 12 petitions, 5 topics, 4 communities. Local demo uses the same typed seed factory.',
);
