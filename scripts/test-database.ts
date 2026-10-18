import { fixtureSubmission } from '../tests/signature-fixture';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { communityId, demoIds, petitionId, seedPetitions } from '../src/data/seed';
import type { CommunityPost, Snapshot } from '../src/domain/model';
import type { TrendCount } from '../src/domain/trend';
import type Anthropic from '@anthropic-ai/sdk';
import { ReviewQueue, ReviewStore, runReview } from '../supabase/functions/_shared/review';
import { PetitionText, petitionBody, screenText } from '../supabase/functions/_shared/civic-rules';
async function run() {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create role service_role; create schema auth; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.jwt() to anon,authenticated;`,
  );
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  // A live project never gets the fictional seed, so migrations alone must provide the reference
  // rows onboarding (topics) and the first-signature badge depend on.
  const reference = await db.query<{ topics: number; firstVoice: number }>(
    `select (select count(*) from public.topics)::int topics,
       (select count(*) from public.badges where name='First voice')::int "firstVoice"`,
  );
  assert.deepEqual(reference.rows[0], { topics: 5, firstVoice: 1 });
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  // Seed is repeatable and does not reset real signatures or create duplicate entries.
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const tables = await db.query<{ tablename: string; rowsecurity: boolean }>(
    `select tablename,rowsecurity from pg_tables where schemaname='public'`,
  );
  assert.equal(tables.rows.length, 24);
  assert(tables.rows.every((t) => t.rowsecurity));
  await db.query(
    `insert into private.principals(profile_id,clerk_subject,email_verified,location_approved) values($1,'clerk_maya',true,false),($2,'clerk_sam',true,true),($3,'clerk_jordan',false,false)`,
    [demoIds.maya, demoIds.sam, demoIds.jordan],
  );
  let current = { subject: '', role: 'anon' };
  const auth = async (subject: string, role = 'authenticated') => {
    current = { subject, role };
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [
      JSON.stringify(subject ? { sub: subject } : {}),
    ]);
    await db.exec(`set role ${role}`);
  };
  /**
   * Published and reworded petitions wait for the ai-review Edge Function's check. Here the check
   * runs straight after each such command with the keyword rules, as the function does without a
   * model, unless a section below drives the review itself (autoCheck = false).
   */
  let autoCheck = true;
  const settle = async () => {
    const back = current;
    await auth('', 'service_role');
    const pending = (
      await db.query<{ v: { id: string; seen: string; petition: PetitionText }[] }>(
        'select public.ai_publish_queue() as v',
      )
    ).rows[0].v;
    for (const p of pending)
      await db.query('select public.ai_apply_publish_screening($1,$2,$3)', [
        p.id,
        screenText(petitionBody(p.petition)),
        p.seen,
      ]);
    await auth(back.subject, back.role);
  };
  const command = async (c: unknown) => {
    const r = await db.query<{ value: string }>(
      `select public.lookaware_command($1::jsonb) as value`,
      [JSON.stringify(c)],
    );
    const type = (c as { type?: string }).type ?? '';
    if (autoCheck && ['create', 'publish', 'edit'].includes(type)) await settle();
    return r.rows[0].value;
  };
  const snapshot = async () => {
    const r = await db.query<{ value: Snapshot }>('select public.lookaware_snapshot() as value');
    return r.rows[0].value;
  };
  const sign = async (petitionId: string, via?: string) => {
    const p = (await snapshot()).petitions.find((p) => p.id === petitionId)!;
    return command({
      type: 'sign',
      petitionId,
      identity: 'anonymous',
      submission: fixtureSubmission(p),
      ...(via ? { via } : {}),
    });
  };
  await auth('', 'anon');
  let s = await snapshot();
  assert.equal(s.petitions.length, 12);
  assert.equal(s.profile, null);
  assert.equal((await db.query('select * from public.profiles')).rows.length, 0);
  await assert.rejects(() => command({ type: 'save', petitionId: petitionId(1) }));
  await auth('clerk_maya');
  s = await snapshot();
  assert.equal(s.profile?.name, 'Maya Chen');
  assert.equal((await db.query('select * from public.profiles')).rows.length, 1);
  await assert.rejects(() =>
    db.exec(`update public.official_responses set verification='verified'`),
  );
  await assert.rejects(() =>
    db.exec(
      `insert into public.signatures(petition_id,user_id,identity_mode,display_name) values('${petitionId(1)}','${demoIds.sam}','anonymous','Fake')`,
    ),
  );
  await sign(petitionId(1));
  await assert.rejects(() => sign(petitionId(1)), /already signed/);
  s = await snapshot();
  assert.equal(s.petitions[0].count, 685);
  assert.equal(s.signatures[0].displayName, 'Anonymous supporter');
  assert(!('userId' in s.signatures[0]));
  assert(!JSON.stringify(s).includes('clerk_'));
  await assert.rejects(
    () =>
      command({
        type: 'edit',
        petitionId: petitionId(1),
        patch: { verification: 'account', identities: ['anonymous'] },
        reason: 'A material rule change',
      }),
    /locked/,
  );
  await assert.rejects(
    () => command({ type: 'create', draft: { ...seedPetitions()[0], title: null }, publish: true }),
    /cannot be null/,
  );
  const id = await command({
    type: 'create',
    draft: { ...seedPetitions()[0], title: 'A new lighting proposal for our school' },
    publish: false,
  });
  assert(id);
  await auth('clerk_sam');
  assert(!(await snapshot()).petitions.some((p) => p.id === id));
  await assert.rejects(() => command({ type: 'publish', petitionId: id }));
  await auth('clerk_maya');
  await command({ type: 'publish', petitionId: id });
  await command({
    type: 'update',
    petitionId: id,
    body: 'The draft is now published for neighbors.',
  });
  await auth('clerk_sam');
  await sign(id);
  await command({
    type: 'discussion',
    petitionId: id,
    body: 'Could the review consider our bus shelter?',
    kind: 'question',
  });
  await assert.rejects(
    () => command({ type: 'update', petitionId: id, body: 'Unauthorized update' }),
    /permission/,
  );
  await auth('clerk_jordan');
  await assert.rejects(() => sign(id), /verified email/);
  await command({
    type: 'requestEligibility',
    petitionId: petitionId(10),
    statement: 'I use these basketball courts every week.',
  });
  await auth('clerk_sam');
  const requests = await db.query<{ value: { id: string }[] }>(
    `select public.lookaware_requests($1) as value`,
    [petitionId(10)],
  );
  await command({
    type: 'reviewEligibility',
    petitionId: petitionId(10),
    requestId: requests.rows[0].value[0].id,
    approved: true,
  });
  await auth('clerk_jordan');
  await sign(petitionId(10));
  await command({
    type: 'report',
    petitionId: id,
    reason: 'Please review the source description.',
  });
  await auth('clerk_maya');
  assert.equal((await db.query('select * from public.reports')).rows.length, 0);
  await auth('', 'anon');
  assert.equal((await db.query('select * from public.signatures')).rows.length, 0);
  assert.equal((await snapshot()).signatures.length, 3);
  await auth('clerk_maya');
  const draftId = '99000000-0000-4000-8000-000000000001';
  await command({
    type: 'saveDraft',
    id: draftId,
    draft: { ...seedPetitions()[0], title: '', problem: '' },
    step: 0,
  });
  assert.equal((await snapshot()).drafts?.[0].draft.title, '');
  await auth('clerk_sam');
  assert.deepEqual((await snapshot()).drafts, []);
  assert.equal((await db.query('select * from public.petition_drafts')).rows.length, 0);
  await assert.rejects(() => command({ type: 'deleteDraft', id: draftId }), /private/);
  await assert.rejects(
    () => command({ type: 'saveDraft', id: draftId, draft: {}, step: 0 }),
    /private/,
  );
  await assert.rejects(
    () =>
      db.query('select public.lookaware_command_v1($1)', [
        JSON.stringify({ type: 'save', petitionId: id }),
      ]),
    /permission/,
  );
  await auth('clerk_maya');
  await command({ type: 'saveDraft', id: draftId, draft: seedPetitions()[0], step: 3 });
  assert.equal((await snapshot()).drafts?.length, 1);
  await command({ type: 'create', draft: seedPetitions()[0], publish: true, draftId });
  assert.deepEqual((await snapshot()).drafts, []);
  assert((await snapshot()).profile?.badges.includes('Change starter'));
  await command({
    type: 'profile',
    name: 'Maya C',
    bio: 'Safer routes for everyone.',
    useSigningHistory: false,
  });
  assert.equal((await snapshot()).profile?.bio, 'Safer routes for everyone.');
  assert.equal((await snapshot()).profile?.useSigningHistory, false);
  await assert.rejects(() =>
    command({
      type: 'profile',
      name: '',
      bio: '',
      useSigningHistory: false,
    }),
  );
  await auth('clerk_sam');
  const receipt = async (petitionId: string) =>
    (
      await db.query<{ value: import('../src/domain/signature-record').SignatureReceipt | null }>(
        'select public.signature_receipt($1) as value',
        [petitionId],
      )
    ).rows[0].value;
  const original = await receipt(id);
  assert(original);
  assert.equal(original.signature.length, 10);
  // The drawing is returned only to its signer, never inside a snapshot.
  assert(!JSON.stringify(await snapshot()).includes('"start":true'));
  await assert.rejects(() => db.exec('select * from private.signature_receipts'), /permission/);
  await auth('clerk_maya');
  assert.equal(await receipt(id), null);
  await command({
    type: 'edit',
    petitionId: id,
    patch: { action: 'Install a crosswalk along this school route.' },
    reason: 'Clarifying our requested crossing',
  });
  await auth('clerk_sam');
  assert.deepEqual(await receipt(id), original);
  await auth('clerk_jordan');
  const unsigned = (await snapshot()).petitions.find(
    (p) => p.verification === 'account' && ![id, petitionId(10)].includes(p.id),
  )!;
  await assert.rejects(
    () => command({ type: 'sign', petitionId: unsigned.id, identity: unsigned.identities[0] }),
    /full petition/,
  );
  await assert.rejects(
    () =>
      command({
        type: 'sign',
        petitionId: unsigned.id,
        identity: unsigned.identities[0],
        submission: {
          ...fixtureSubmission(unsigned),
          disclosure: { ...fixtureSubmission(unsigned).disclosure, title: 'Stale title' },
        },
      }),
    /changed/,
  );
  await assert.rejects(
    () =>
      command({
        type: 'sign',
        petitionId: unsigned.id,
        identity: unsigned.identities[0],
        submission: { ...fixtureSubmission(unsigned), signature: [] },
      }),
    /Draw your signature/,
  );
  assert(!(await snapshot()).signed.includes(unsigned.id));
  assert.equal(await receipt(unsigned.id), null);
  for (const version of [1, 2, 3, 4, 5, 6])
    await assert.rejects(
      () =>
        db.query(`select public.lookaware_command_v${version}($1)`, [
          JSON.stringify({
            type: 'sign',
            petitionId: unsigned.id,
            identity: unsigned.identities[0],
          }),
        ]),
      /permission/,
    );
  await auth('', 'anon');
  await assert.rejects(() => receipt(id), /permission/);

  // --- Notification fan-out, revisions, withdrawal, moderation and archival ---------------------
  const inbox = async () => (await snapshot()).notifications.map((n) => n.body);

  // The organizer of the seeded flagship petition hears about what happened on it.
  await auth('clerk_sam');
  await sign(petitionId(1));
  await auth('clerk_maya');
  const flagship = (await snapshot()).petitions.find((p) => p.id === petitionId(1))!;
  assert(
    (await inbox()).some((b) => b.includes('signed') && b.includes(flagship.title)),
    'organizer is told about a signature',
  );
  assert(
    !(await inbox()).some((b) => b.includes('Sam Rivera') && b.includes('signed')),
    'an anonymous signer is never named to the organizer',
  );

  // Saving is a real subscription: Jordan saves without signing and still hears everything.
  await auth('clerk_jordan');
  await command({ type: 'save', petitionId: petitionId(1) });
  await auth('clerk_maya');
  await command({
    type: 'update',
    petitionId: petitionId(1),
    body: 'The lighting audit has a date. All events in this demo are fictional.',
  });
  await command({
    type: 'response',
    petitionId: petitionId(1),
    body: 'We have logged this request for review.',
    organization: 'Riverton Public Works (fictional)',
  });
  await auth('clerk_jordan');
  const jordan = await inbox();
  assert(
    jordan.some((b) => b.includes('New update on')),
    'followers hear about updates',
  );
  assert(
    jordan.some((b) => b.includes('unverified response')),
    'followers hear about responses',
  );
  assert.equal((await snapshot()).signed.includes(petitionId(1)), false);

  // Every editable field is revisable after signatures; signing rules are not.
  await auth('clerk_maya');
  await command({
    type: 'edit',
    petitionId: petitionId(1),
    patch: {
      recipient: 'Riverton Transportation Office (fictional)',
      goal: 1500,
      evidence: [{ label: 'A second illustrative source', url: 'https://example.org/second' }],
    },
    reason: 'Correcting the responsible department and adding a source',
  });
  const revised = (await snapshot()).petitions.find((p) => p.id === petitionId(1))!;
  assert.equal(revised.recipient, 'Riverton Transportation Office (fictional)');
  assert.equal(revised.goal, 1500);
  assert.equal(revised.evidence.length, 1);
  assert(revised.edits[0].body.includes('Riverton Public Works (fictional)'), 'prior wording kept');
  await assert.rejects(
    () => command({ type: 'edit', petitionId: petitionId(1), patch: {}, reason: 'No change' }),
    /at least one field/,
  );
  await assert.rejects(
    () =>
      command({
        type: 'edit',
        petitionId: petitionId(1),
        patch: { deadline: '2020-01-01' },
        reason: 'Moving the deadline into the past',
      }),
    /future deadline/,
  );
  await auth('clerk_jordan');
  assert((await inbox()).some((b) => b.includes('was revised by the organizer')));

  // Members create communities and owners appoint moderators from actual members.
  const madeId = await command({
    type: 'createCommunity',
    name: 'Cedar Commons friends',
    description: 'Neighbors keeping the courts and green space usable all year round.',
    city: 'Brookside, CA',
    topic: 'Public spaces',
  });
  const made = (await snapshot()).communities.find((c) => c.id === madeId)!;
  assert.equal(made.ownerId, demoIds.jordan);
  assert.equal(made.sampleMembers, 0);
  assert.equal(made.members, 1);
  await assert.rejects(
    () => command({ type: 'moderator', communityId: madeId, profileId: demoIds.sam, grant: true }),
    /current member/,
  );
  await auth('clerk_sam');
  await command({ type: 'join', communityId: madeId });
  await command({
    type: 'communityPost',
    communityId: madeId,
    body: 'A post the owner will retract.',
    kind: 'idea',
    space: 'discussion',
    channel: '',
  });
  await assert.rejects(
    () => command({ type: 'moderator', communityId: madeId, profileId: demoIds.maya, grant: true }),
    /owner/,
  );
  await auth('clerk_jordan');
  await command({ type: 'moderator', communityId: madeId, profileId: demoIds.sam, grant: true });
  assert.deepEqual((await snapshot()).communities.find((c) => c.id === madeId)!.moderators, [
    demoIds.sam,
  ]);

  // Removal leaves a visible tombstone rather than a gap, and the author is told.
  const posts = async () => {
    const r = await db.query<{ value: { id: string; body: string; removed?: boolean }[] }>(
      'select public.lookaware_community_posts($1) as value',
      [madeId],
    );
    return r.rows[0].value;
  };
  const [communityPost] = await posts();
  await command({
    type: 'removeEntry',
    scope: 'communityPost',
    entryId: communityPost.id,
    communityId: madeId,
  });
  const afterRemoval = await posts();
  assert.equal(afterRemoval.length, 1);
  assert.equal(afterRemoval[0].body, 'This post was removed by a moderator.');
  assert.equal(afterRemoval[0].removed, true);
  await auth('clerk_sam');
  assert((await inbox()).some((b) => b.includes('moderator removed your post')));

  // A signer can withdraw: the count drops, the public row goes, the private record goes.
  const withdrawTarget = (await snapshot()).petitions.find(
    (p) => p.verification === 'account' && p.id !== petitionId(1) && p.ownerId === demoIds.sam,
  )!;
  await auth('clerk_jordan');
  await sign(withdrawTarget.id);
  assert.equal(
    (await snapshot()).petitions.find((p) => p.id === withdrawTarget.id)!.count,
    withdrawTarget.count + 1,
  );
  await command({ type: 'withdraw', petitionId: withdrawTarget.id });
  const afterWithdraw = await snapshot();
  assert.equal(
    afterWithdraw.petitions.find((p) => p.id === withdrawTarget.id)!.count,
    withdrawTarget.count,
  );
  assert.equal(afterWithdraw.signed.includes(withdrawTarget.id), false);
  assert.equal(await receipt(withdrawTarget.id), null);
  await assert.rejects(
    () => command({ type: 'withdraw', petitionId: withdrawTarget.id }),
    /have not signed/,
  );

  // Reports can be withdrawn by their author and nobody else.
  const before = (await snapshot()).reports.length;
  await command({ type: 'report', petitionId: petitionId(1), reason: 'A fictional test concern.' });
  const ownReport = (await snapshot()).reports.find(
    (r) => r.reason === 'A fictional test concern.',
  )!;
  await auth('clerk_sam');
  await assert.rejects(
    () => command({ type: 'withdrawReport', reportId: ownReport.id }),
    /not found/,
  );
  await auth('clerk_jordan');
  await command({ type: 'withdrawReport', reportId: ownReport.id });
  assert.equal((await snapshot()).reports.length, before);

  // Archiving requires a public close first and is owner-only.
  await auth('clerk_maya');
  const archivable = await command({
    type: 'create',
    draft: { ...seedPetitions()[0], title: 'A petition created to be archived later' },
    publish: true,
  });
  await assert.rejects(
    () => command({ type: 'close', petitionId: archivable, status: 'archived' }),
    /Close or mark this petition successful/,
  );
  await command({ type: 'close', petitionId: archivable, status: 'closed' });
  await auth('clerk_sam');
  await assert.rejects(
    () => command({ type: 'close', petitionId: archivable, status: 'archived' }),
    /Organizer permission required|Only the owner/,
  );
  await auth('clerk_maya');
  await command({ type: 'close', petitionId: archivable, status: 'archived' });
  assert.equal(
    (await snapshot()).petitions.some((p) => p.id === archivable),
    false,
  );

  // Save and volunteer: the deck offers more than pass and sign.
  await auth('clerk_maya');
  const helpable = await command({
    type: 'create',
    draft: { ...seedPetitions()[0], title: 'A petition that needs hands as well as names' },
    publish: true,
  });
  await auth('clerk_jordan');
  await command({ type: 'save', petitionId: helpable });
  assert((await snapshot()).saved.includes(helpable), 'saved');
  await auth('clerk_maya');
  await command({ type: 'update', petitionId: helpable, body: 'An update savers receive.' });
  await auth('clerk_jordan');
  assert(
    (await inbox()).some((b) => b.includes('New update')),
    'saving subscribes',
  );
  await command({ type: 'save', petitionId: helpable });
  const quiet = (await inbox()).length;
  await auth('clerk_maya');
  await command({ type: 'update', petitionId: helpable, body: 'An update after unsaving.' });
  await auth('clerk_jordan');
  assert.equal((await inbox()).length, quiet, 'unsaving stops the updates');

  await auth('clerk_sam');
  await command({
    type: 'volunteer',
    petitionId: helpable,
    roles: ['outreach', 'outreach', 'design'],
    note: 'Weekends work best.',
  });
  const helper = await snapshot();
  assert.deepEqual(helper.volunteering, [
    { petitionId: helpable, roles: ['design', 'outreach'], note: 'Weekends work best.' },
  ]);
  assert.equal(helper.petitions.find((p) => p.id === helpable)?.volunteerCount, 1);
  await assert.rejects(
    () =>
      db.query('select public.lookaware_volunteers($1::uuid)', [helpable]).then(() => undefined),
    /Only organizers/,
    'a volunteer cannot read the roster',
  );
  await auth('clerk_maya');
  const roster = await db.query<{ value: { name: string; roles: string[] }[] }>(
    'select public.lookaware_volunteers($1::uuid) as value',
    [helpable],
  );
  assert.equal(roster.rows[0].value.length, 1);
  assert.equal(roster.rows[0].value[0].name, 'Sam Rivera');
  assert.deepEqual(roster.rows[0].value[0].roles, ['design', 'outreach']);
  assert((await inbox()).some((b) => b.includes('offered to help with design, outreach')));
  await auth('clerk_sam');
  await assert.rejects(
    () =>
      command({
        type: 'volunteer',
        petitionId: helpable,
        roles: ['design'],
        note: 'x'.repeat(501),
      }),
    /under 500 characters/,
  );
  await command({ type: 'volunteer', petitionId: helpable, roles: [], note: '' });
  assert.deepEqual((await snapshot()).volunteering, []);
  await assert.rejects(
    () => command({ type: 'volunteer', petitionId: helpable, roles: [], note: '' }),
    /have not offered/,
  );
  await auth('clerk_maya');
  assert((await inbox()).some((b) => b.includes('stepped back from volunteering')));
  await command({ type: 'close', petitionId: helpable, status: 'closed' });
  await auth('clerk_sam');
  await assert.rejects(
    () => command({ type: 'volunteer', petitionId: helpable, roles: ['outreach'], note: '' }),
    /not accepting offers/,
  );

  // Community spaces: three zones of authority, one row type.
  await auth('clerk_jordan');
  const space = await command({
    type: 'createCommunity',
    name: 'Riverton working group',
    description: 'A fictional community used to exercise the collaboration spaces.',
    city: 'Riverton, CA',
    topic: 'Safer streets',
  });
  await auth('clerk_sam');
  await command({ type: 'join', communityId: space });
  const spacePosts = async () => {
    const r = await db.query<{ value: CommunityPost[] }>(
      'select public.lookaware_community_posts($1) as value',
      [space],
    );
    return r.rows[0].value;
  };
  // A member cannot speak in the community's voice or enter the organizer room.
  await assert.rejects(
    () =>
      command({
        type: 'communityPost',
        communityId: space,
        body: 'A member trying to announce something.',
        kind: 'announcement',
        space: 'announcements',
        channel: '',
      }),
    /owner and its moderators/,
  );
  await assert.rejects(
    () =>
      command({
        type: 'communityPost',
        communityId: space,
        body: 'A member trying to reach the organizer room.',
        kind: 'idea',
        space: 'organizers',
        channel: '',
      }),
    /owner and its moderators/,
  );
  await auth('clerk_jordan');
  await command({
    type: 'communityPost',
    communityId: space,
    body: 'Private organizer planning note for the demo.',
    kind: 'idea',
    space: 'organizers',
    channel: '',
  });
  assert.equal((await spacePosts()).length, 1, 'a moderator sees the organizer space');
  await auth('clerk_sam');
  assert.equal((await spacePosts()).length, 0, 'a member cannot read the organizer space');

  // Events need a date.
  await auth('clerk_jordan');
  await assert.rejects(
    () =>
      command({
        type: 'communityPost',
        communityId: space,
        body: 'A walk-through with no date.',
        kind: 'event',
        space: 'discussion',
        channel: '',
      }),
    /date/,
  );
  await command({
    type: 'communityPost',
    communityId: space,
    body: 'Walk the unlit stretch together.',
    kind: 'event',
    space: 'discussion',
    channel: 'lighting',
    eventAt: '2026-10-04T18:30:00Z',
    location: 'Riverton library (fictional)',
  });
  const walk = (await spacePosts()).find((x) => x.kind === 'event')!;
  assert.equal(walk.location, 'Riverton library (fictional)');
  assert.equal(walk.channel, 'lighting');

  // Reporting: the moderator sees the post and the reason, never the reporter.
  await auth('clerk_sam');
  await command({
    type: 'reportPost',
    communityId: space,
    postId: walk.id,
    reason: 'This event is listed at the wrong place.',
  });
  const target = walk;
  await assert.rejects(
    () =>
      command({
        type: 'reportPost',
        communityId: space,
        postId: target.id,
        reason: 'Reporting the very same post twice.',
      }),
    /already reported/,
  );
  await assert.rejects(
    () =>
      db
        .query('select public.lookaware_community_reports($1::uuid)', [space])
        .then(() => undefined),
    /owner and its moderators/,
    'a member cannot read the moderation queue',
  );
  await auth('clerk_jordan');
  const queue = await db.query<{ value: { id: string; reason: string; status: string }[] }>(
    'select public.lookaware_community_reports($1::uuid) as value',
    [space],
  );
  assert.equal(queue.rows[0].value.length, 1);
  assert(!JSON.stringify(queue.rows[0].value).includes(demoIds.sam), 'the reporter is not named');
  await command({
    type: 'resolvePostReport',
    communityId: space,
    reportId: queue.rows[0].value[0].id,
    action: 'actioned',
  });
  await assert.rejects(
    () =>
      command({
        type: 'resolvePostReport',
        communityId: space,
        reportId: queue.rows[0].value[0].id,
        action: 'dismissed',
      }),
    /already reviewed/,
  );
  // Members hear from the people who run a community: the owner's event and announcement reach
  // Sam. The author, a member's own event and the private organizer room notify no one.
  const heard = async (who: string) => {
    await auth(who);
    return (await snapshot()).notifications
      .filter((n) => n.kind === 'community' && n.body.startsWith('Riverton working group'))
      .map((n) => n.body);
  };
  await command({
    type: 'communityPost',
    communityId: space,
    body: 'Lighting audit results are in. Thank you all.',
    kind: 'announcement',
    space: 'announcements',
    channel: '',
  });
  await command({
    type: 'communityPost',
    communityId: space,
    body: 'Moderators only: prep call before the walk.',
    kind: 'event',
    space: 'organizers',
    channel: '',
    eventAt: '2026-10-03T18:30:00Z',
    location: 'Online (fictional)',
  });
  assert.deepEqual(await heard('clerk_sam'), [
    'Riverton working group announcement: Lighting audit results are in. Thank you all.',
    'Riverton working group event: Walk the unlit stretch together.',
  ]);
  await command({
    type: 'communityPost',
    communityId: space,
    body: 'A member-run study meetup after class.',
    kind: 'event',
    space: 'discussion',
    channel: '',
    eventAt: '2026-10-05T18:30:00Z',
    location: 'Riverton library (fictional)',
  });
  assert.deepEqual(await heard('clerk_jordan'), [], 'authors and member events notify no one');

  // Delivery: the point where a petition becomes a document somebody sent.
  await auth('clerk_maya');
  const sendable = await command({
    type: 'create',
    draft: { ...seedPetitions()[0], title: 'A petition that will actually be delivered' },
    publish: true,
  });
  const delivered = () =>
    snapshot().then((x) => x.petitions.find((p) => p.id === sendable)!.deliveries);
  await assert.rejects(
    () =>
      command({ type: 'deliver', petitionId: sendable, method: 'email', note: 'Nobody signed.' }),
    /at least one signature/,
    'an unsigned petition cannot be delivered',
  );
  await auth('clerk_jordan');
  await command({ type: 'save', petitionId: sendable });
  await auth('clerk_sam');
  await sign(sendable);
  await assert.rejects(
    () =>
      command({ type: 'deliver', petitionId: sendable, method: 'email', note: 'Not my petition.' }),
    /Organizer|owner|collaborator/,
    'only an organizer delivers',
  );
  await auth('clerk_maya');
  await assert.rejects(
    () =>
      command({
        type: 'deliver',
        petitionId: sendable,
        method: 'carrier-pigeon',
        note: 'Sent somehow.',
      }),
    /how it was delivered/,
  );
  await assert.rejects(
    () => command({ type: 'deliver', petitionId: sendable, method: 'email', note: 'no' }),
    /Say where it went/,
  );
  await command({
    type: 'deliver',
    petitionId: sendable,
    method: 'email',
    note: 'publicworks@riverton.example, reference PW-2026-114',
  });
  let sent = await delivered();
  assert.equal(sent.length, 1);
  assert.equal(sent[0].method, 'email');
  // Maya renamed herself earlier in this run; the packet reflects the current profile name.
  assert.equal(sent[0].deliveredBy, 'Maya C');
  assert.equal(sent[0].signatureCount, 1);
  assert.deepEqual(sent[0].signatories, ['Anonymous supporter']);
  assert(!JSON.stringify(sent).includes('clerk_'), 'no auth identifier reaches the packet');

  // The snapshot must not move afterwards.
  sent = await delivered();
  assert.equal(sent[0].signatureCount, 1, 'the delivered count is frozen');
  await auth('clerk_jordan');
  assert(
    (await inbox()).some((b) => b.includes('was delivered to')),
    'followers hear about a delivery',
  );

  // A response can answer the delivery it replies to.
  await auth('clerk_maya');
  await command({
    type: 'response',
    petitionId: sendable,
    body: 'We have logged this request for the quarterly review.',
    organization: 'Riverton Public Works (fictional)',
    deliveryId: sent[0].id,
  });
  const answered = (await snapshot()).petitions.find((p) => p.id === sendable)!;
  assert.equal(answered.responses[0].deliveryId, sent[0].id);
  await assert.rejects(
    () =>
      command({
        type: 'response',
        petitionId: sendable,
        body: 'A response pointing at a delivery on another petition.',
        organization: 'Somewhere else (fictional)',
        deliveryId: petitionId(2),
      }),
    /not on this petition/,
  );

  // Ripple: people who signed through your link, and everyone they brought in after them.
  await auth('clerk_maya');
  const spread = await command({
    type: 'create',
    draft: {
      ...seedPetitions()[0],
      verification: 'account',
      title: 'A petition that spreads link by link',
    },
    publish: true,
  });
  await sign(spread);
  const mayaCode = (await snapshot()).ripple!.code;
  assert(mayaCode && mayaCode !== demoIds.maya, 'the code is not a profile id');
  await auth('clerk_sam');
  const samCode = (await snapshot()).ripple!.code;
  assert(!JSON.stringify(await snapshot()).includes(mayaCode), 'nobody else sees your code');
  await sign(spread, mayaCode);
  await auth('clerk_jordan');
  await sign(spread, samCode);
  await auth('clerk_maya');
  let rippled = await snapshot();
  assert.deepEqual(rippled.ripple!.petitions, [{ petitionId: spread, direct: 1, further: 1 }]);
  assert.equal(rippled.petitions.find((p) => p.id === spread)!.viaShares, 2);
  // The organizer's trend: today's signatures by source, never who. Maya is a community member;
  // Sam and Jordan arrived through links.
  const trend = async (id: string) =>
    (
      await db.query<{ value: TrendCount[] }>(
        'select public.lookaware_signature_trend($1::uuid) as value',
        [id],
      )
    ).rows[0].value;
  assert.deepEqual(await trend(spread), [
    { daysAgo: 0, source: 'community', count: 1 },
    { daysAgo: 0, source: 'link', count: 2 },
  ]);
  assert(!JSON.stringify(await trend(spread)).includes(demoIds.sam), 'no signer leaves');
  await auth('clerk_sam');
  await assert.rejects(() => trend(spread), /Only organizers/);
  await auth('clerk_maya');
  const told = rippled.notifications.find((n) => n.kind === 'ripple')!;
  assert(told.body.includes('1 person has signed it because of you'));
  assert(!told.body.includes('Sam'), 'the sharer is never told who signed');
  await assert.rejects(() => db.exec('select * from private.signature_referrals'), /permission/);
  await assert.rejects(() => db.exec('select * from private.ripple_codes'), /permission/);
  // A link credits only someone who signed, never yourself, and a bad code never blocks signing.
  const quietSpread = await command({
    type: 'create',
    draft: { ...seedPetitions()[0], verification: 'account', title: 'A petition nobody spreads' },
    publish: true,
  });
  await auth('clerk_sam');
  await sign(quietSpread, mayaCode);
  await auth('clerk_jordan');
  await sign(quietSpread, 'not-a-real-code');
  assert((await snapshot()).signed.includes(quietSpread));
  await auth('clerk_maya');
  await sign(quietSpread, mayaCode);
  rippled = await snapshot();
  assert(!rippled.ripple!.petitions.some((r) => r.petitionId === quietSpread));
  assert.equal(rippled.petitions.find((p) => p.id === quietSpread)!.viaShares, 0);
  // Withdrawing takes a signature out of the ripple it was part of.
  await auth('clerk_sam');
  await command({ type: 'withdraw', petitionId: spread });
  await auth('clerk_maya');
  rippled = await snapshot();
  assert(!rippled.ripple!.petitions.some((r) => r.petitionId === spread));
  assert.equal(rippled.petitions.find((p) => p.id === spread)!.viaShares, 1);
  await auth('', 'anon');
  assert.equal((await snapshot()).ripple, null);

  // AI review: reports wait as `pending` until the ai-review Edge Function settles them through
  // service-role-only functions. runReview is that function's own logic, driven here against the
  // real SQL with a stand-in for the model.
  const offensive = {
    ...seedPetitions()[0],
    title: 'Join our investment scheme for the council',
    summary: 'Every resident should join our investment scheme and send us their savings now.',
  };
  await auth('clerk_sam');
  const flaggedId = await command({ type: 'create', draft: offensive, publish: true });
  await auth('clerk_jordan');
  const cleanReport = await command({
    type: 'report',
    petitionId: petitionId(2),
    reason: 'I disagree with it.',
  });
  await command({ type: 'report', petitionId: flaggedId, reason: 'Insulting language.' });
  s = await snapshot();
  const reviewed = () =>
    s.reports
      .filter((r) => [flaggedId, petitionId(2)].includes(r.petitionId))
      .map((r) => `${r.petitionId === flaggedId ? 'offensive' : 'clean'}:${r.screening}`)
      .sort();
  assert.deepEqual(reviewed(), ['clean:pending', 'offensive:pending']);
  assert(
    s.reports.some((r) => r.id === cleanReport),
    'the report command returns its id',
  );
  assert(
    s.petitions.some((p) => p.id === flaggedId),
    'nothing is hidden before the review',
  );
  await assert.rejects(() => db.query('select public.ai_review_queue()'), /permission denied/);
  await assert.rejects(
    () => db.query('select public.ai_apply_screening($1,$2)', [petitionId(2), ['hate']]),
    /permission denied/,
  );
  const asService = async (sql: string, params: unknown[] = []) => {
    await auth('', 'service_role');
    return (await db.query<{ v: unknown }>(sql, params)).rows[0]?.v;
  };
  const store: ReviewStore = {
    queue: async () => (await asService('select public.ai_review_queue() as v')) as ReviewQueue,
    screened: async (target, hits) => {
      await asService('select public.ai_apply_screening($1,$2)', [target, hits]);
    },
    tagged: async (target, tags, seen) => {
      await asService('select public.ai_apply_tags($1,$2,$3)', [target, tags, seen]);
    },
    publishQueue: async () =>
      (await asService('select public.ai_publish_queue() as v')) as {
        id: string;
        seen: string;
        petition: PetitionText;
      }[],
    checked: async (target, hits, seen) => {
      await asService('select public.ai_apply_publish_screening($1,$2,$3)', [target, hits, seen]);
    },
  };
  const model = {
    beta: {
      messages: {
        parse: async (params: { system: string; messages: { content: string }[] }) => ({
          stop_reason: 'end_turn',
          parsed_output: params.system.startsWith('You tag')
            ? { tags: ['Lighting', '#students'] }
            : {
                categories: params.messages[0].content.includes('investment scheme')
                  ? ['spam']
                  : params.messages[0].content.includes('qwfp')
                    ? ['nonsense']
                    : [],
                reason: 'stand-in',
              },
        }),
      },
    },
  } as unknown as Anthropic;
  // Three petitions: these two plus the one reported near the start of this test.
  assert.deepEqual(await runReview(store, model), { checked: 0, screened: 3, tagged: 5 });
  assert.deepEqual(await runReview(store, model), { checked: 0, screened: 0, tagged: 5 });
  await assert.rejects(
    () => asService('select public.ai_apply_screening($1,$2)', [petitionId(2), ['rude']]),
    /Unknown review category/,
  );
  await auth('clerk_jordan');
  s = await snapshot();
  assert.deepEqual(reviewed(), ['clean:clear', 'offensive:flagged']);
  assert(!s.petitions.some((p) => p.id === flaggedId), 'hidden from the reporter');
  assert(
    s.petitions.some((p) => p.id === petitionId(2)),
    'a clean report hides nothing',
  );
  await assert.rejects(() => command({ type: 'save', petitionId: flaggedId }), /not found/);
  await auth('', 'anon');
  assert(!(await snapshot()).petitions.some((p) => p.id === flaggedId), 'hidden from the public');
  await auth('clerk_sam');
  s = await snapshot();
  assert.equal(s.petitions.find((p) => p.id === flaggedId)?.hidden, true);
  assert.match(s.notifications[0].body, /automatic review flagged possible spam/);

  // Publication check: a new petition stays out of public view until the review has read it.
  // Flagged wording is held with its reasons for the organizer; fixed wording goes public.
  // Sam belongs to the community these are published into, so he hears about each new campaign
  // once it is public: never while it waits for its check, and never while it is held.
  await auth('clerk_sam');
  const homeCommunity = seedPetitions()[0].communityId;
  if (!(await snapshot()).profile!.joined.includes(homeCommunity))
    await command({ type: 'join', communityId: homeCommunity });
  const campaigns = async () => {
    await auth('clerk_sam');
    return (await snapshot()).notifications
      .filter((n) => n.body.startsWith('New campaign in Riverton students'))
      .map((n) => n.body);
  };
  autoCheck = false;
  await auth('clerk_jordan');
  await assert.rejects(
    () => command({ type: 'create', draft: seedPetitions()[0], publish: true }),
    /Verify your email/,
  );
  await command({ type: 'create', draft: seedPetitions()[0], publish: false });
  await auth('clerk_maya');
  const joke = await command({
    type: 'create',
    draft: { ...seedPetitions()[0], title: 'qwfp qwfp qwfp the council please' },
    publish: true,
  });
  const fresh = await command({
    type: 'create',
    draft: { ...seedPetitions()[0], title: 'A fresh petition waiting for its check' },
    publish: true,
  });
  let held = (await snapshot()).petitions.find((p) => p.id === joke)!;
  assert.equal(held.hidden, true);
  assert.equal(held.checking, true);
  await auth('clerk_sam');
  assert(!(await snapshot()).petitions.some((p) => [joke, fresh].includes(p.id)), 'unchecked');
  assert(!(await campaigns()).some((b) => b.includes('A fresh petition')), 'not before its check');
  await assert.rejects(() => db.query('select public.ai_publish_queue()'), /permission denied/);
  assert.equal((await runReview(store, model, { tags: false })).checked, 2);
  await auth('clerk_sam');
  assert(
    (await snapshot()).petitions.some((p) => p.id === fresh),
    'clean wording goes public',
  );
  assert(!(await snapshot()).petitions.some((p) => p.id === joke), 'flagged wording stays held');
  assert(
    (await campaigns()).includes(
      'New campaign in Riverton students: “A fresh petition waiting for its check”.',
    ),
  );
  assert(!(await campaigns()).some((b) => b.includes('qwfp')), 'held wording is not announced');
  await auth('clerk_maya');
  held = (await snapshot()).petitions.find((p) => p.id === joke)!;
  assert.deepEqual(held.heldFor, ['nonsense']);
  assert.equal(held.checking, undefined);
  await command({
    type: 'edit',
    petitionId: joke,
    patch: { title: 'Light the path between the bus stop and campus' },
    reason: 'Rewrote the title.',
  });
  assert.equal((await snapshot()).petitions.find((p) => p.id === joke)!.checking, true);
  await runReview(store, model, { tags: false });
  await auth('clerk_maya');
  held = (await snapshot()).petitions.find((p) => p.id === joke)!;
  assert.equal(held.hidden, false);
  assert.equal(held.heldFor, undefined);
  await auth('clerk_sam');
  assert(
    (await snapshot()).petitions.some((p) => p.id === joke),
    'public once fixed',
  );
  assert.equal(
    (await campaigns()).filter((b) => b.includes('Light the path between the bus stop')).length,
    1,
    'announced once, when the fixed wording goes public',
  );
  autoCheck = true;

  // Donation links are organizer-only, HTTPS-only, and every change is public history.
  await auth('clerk_maya');
  const giving = await command({
    type: 'create',
    draft: { ...seedPetitions()[0], title: 'A petition with a donation page' },
    publish: true,
  });
  await assert.rejects(
    () => command({ type: 'donationLink', petitionId: giving, url: 'http://example.org' }),
    /HTTPS/,
  );
  await command({ type: 'donationLink', petitionId: giving, url: 'https://example.org/give' });
  await auth('clerk_jordan');
  await assert.rejects(
    () => command({ type: 'donationLink', petitionId: giving, url: '' }),
    /Only the owner/,
  );
  let given = (await snapshot()).petitions.find((p) => p.id === giving)!;
  assert.equal(given.donationUrl, 'https://example.org/give');
  assert.equal(given.edits[0].body, 'Donation link set to https://example.org/give.');
  await auth('clerk_maya');
  await command({ type: 'donationLink', petitionId: giving, url: '' });
  given = (await snapshot()).petitions.find((p) => p.id === giving)!;
  assert.equal(given.donationUrl, undefined);

  // Hidden tags: written by the review for the current wording only, and cleared by rewording.
  await runReview(store, model);
  await auth('clerk_maya');
  given = (await snapshot()).petitions.find((p) => p.id === giving)!;
  assert.deepEqual(given.tags, ['lighting', 'students']);
  await command({
    type: 'edit',
    petitionId: giving,
    patch: { title: 'A petition with a fresh donation page' },
    reason: 'A clearer title.',
  });
  given = (await snapshot()).petitions.find((p) => p.id === giving)!;
  assert.equal(given.tags, undefined);
  await asService('select public.ai_apply_tags($1,$2,$3)', [giving, ['stale'], '2000-01-01']);
  await auth('clerk_maya');
  assert.equal((await snapshot()).petitions.find((p) => p.id === giving)!.tags, undefined);

  // Photos: organizer-only, uploaded files with a description only, and every change is public.
  await auth('clerk_maya');
  const photoUrl =
    'https://demo.supabase.co/storage/v1/object/public/petition-photos/0b7c4d2e-91af.jpg';
  const photo = (url: string, alt: string) => ({
    type: 'photo',
    petitionId: giving,
    photo: { url, alt },
  });
  await assert.rejects(
    () => command(photo('https://example.com/x.jpg', 'A dark path')),
    /through the app/,
  );
  await assert.rejects(() => command(photo(photoUrl, 'x')), /screen readers/);
  await command(photo(photoUrl, 'The unlit path at night'));
  given = (await snapshot()).petitions.find((p) => p.id === giving)!;
  assert.deepEqual(given.photo, { url: photoUrl, alt: 'The unlit path at night' });
  assert.equal(given.edits[0].body, 'Photo added: “The unlit path at night”.');
  await assert.rejects(
    () => command(photo(photoUrl, 'The unlit path at night')),
    /Nothing changed/,
  );
  await auth('clerk_sam');
  await assert.rejects(
    () => command({ type: 'photo', petitionId: giving, photo: null }),
    /owner or an authorized/,
  );
  await auth('clerk_maya');
  await command({ type: 'photo', petitionId: giving, photo: null });
  given = (await snapshot()).petitions.find((p) => p.id === giving)!;
  assert.equal(given.photo, undefined);
  assert.equal(given.edits[0].body, 'Photo removed.');

  // AI helper requests: guests are refused and each person gets twenty an hour.
  await auth('', 'anon');
  await assert.rejects(() => db.query('select public.claim_civic_lookup()'));
  await auth('clerk_unknown');
  await assert.rejects(() => db.query('select public.claim_civic_lookup()'), /Sign in/);
  await auth('clerk_maya');
  for (let i = 0; i < 20; i++) await db.query('select public.claim_civic_lookup()');
  await assert.rejects(() => db.query('select public.claim_civic_lookup()'), /20 times an hour/);
  await auth('clerk_sam');
  await db.query('select public.claim_civic_lookup()');

  // Community backing: members vote, and three yes with more yes than no backs the petition.
  const crossing = petitionId(6);
  const riverton = communityId(1);
  const backing = async () => (await snapshot()).petitions.find((p) => p.id === crossing)!.backing;
  await auth('', 'anon');
  assert.deepEqual(await backing(), [{ communityId: riverton, yes: 2, no: 0 }]);
  await auth('clerk_maya');
  await assert.rejects(
    () => command({ type: 'endorse', petitionId: crossing, communityId: riverton }),
    /member vote/,
  );
  await assert.rejects(
    () =>
      command({
        type: 'backVote',
        petitionId: crossing,
        communityId: communityId(2),
        support: true,
      }),
    /Only members/,
  );
  assert.equal(
    await command({
      type: 'backVote',
      petitionId: crossing,
      communityId: riverton,
      support: false,
    }),
    null,
  );
  assert.deepEqual(await backing(), [{ communityId: riverton, yes: 2, no: 1 }]);
  assert.deepEqual((await snapshot()).backingVotes, [
    { petitionId: crossing, communityId: riverton, support: false },
  ]);
  // Changing the no to a yes makes three: the community backs it and the vote closes.
  assert.equal(
    await command({ type: 'backVote', petitionId: crossing, communityId: riverton, support: true }),
    'backed',
  );
  const decided = (await snapshot()).petitions.find((p) => p.id === crossing)!;
  assert.equal(decided.backing[0].yes, 3);
  assert(decided.backing[0].backedAt);
  assert(decided.endorsements.some((e) => e.body.includes('voted to back this (3 yes · 0 no)')));
  await assert.rejects(
    () =>
      command({ type: 'backVote', petitionId: crossing, communityId: riverton, support: false }),
    /already backs/,
  );
  // Individual votes are never readable directly; only totals and your own votes leave the server.
  const peek = await db
    .query('select * from public.community_backing_votes')
    .catch(() => ({ rows: [] }));
  assert.equal(peek.rows.length, 0);
  await auth('clerk_sam');
  s = await snapshot();
  assert(s.notifications.some((n) => n.body.includes('Riverton students voted to back')));
  assert(s.backingVotes.every((v) => v.support));

  // Live accounts: signed Clerk claims refresh email verification and the placeholder name.
  const claims = async (c: Record<string, unknown>) => {
    current = { subject: String(c.sub), role: 'authenticated' };
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [JSON.stringify(c)]);
    await db.exec('set role authenticated');
  };
  await claims({ sub: 'clerk_ada', email_verified: false, name: 'Ada Lovelace' });
  let ada = (await snapshot()).profile!;
  assert.equal(ada.name, 'Ada Lovelace');
  assert.equal(ada.emailVerified, false);
  await claims({ sub: 'clerk_ada', email_verified: true, name: 'Ada Lovelace' });
  assert.equal((await snapshot()).profile!.emailVerified, true);
  // A token without the claim (dashboard not configured) leaves the stored value alone.
  await claims({ sub: 'clerk_ada' });
  assert.equal((await snapshot()).profile!.emailVerified, true);
  // A chosen name is never overwritten by the claim.
  await command({ type: 'profile', name: 'Ada L.', bio: '', useSigningHistory: true });
  await claims({ sub: 'clerk_ada', email_verified: true, name: 'Ada Lovelace' });
  assert.equal((await snapshot()).profile!.name, 'Ada L.');
  await claims({ sub: 'clerk_bo', name: 'B' });
  assert.equal((await snapshot()).profile!.name, 'Community member');

  // Deleting an account removes personal records, archives the person's petitions, and keeps
  // what they wrote in public under "Deleted account". Other people's signatures stay.
  await claims({ sub: 'clerk_ada', email_verified: true });
  ada = (await snapshot()).profile!;
  const adaPetition = await command({
    type: 'create',
    draft: {
      ...seedPetitions()[0],
      title: 'Ada asks for a safer crossing by the library',
      verification: 'account',
    },
    publish: true,
  });
  const open = (await snapshot()).petitions.find(
    (p) => p.verification === 'account' && p.status === 'active' && p.id !== adaPetition,
  )!.id;
  await sign(open);
  await command({ type: 'save', petitionId: petitionId(1) });
  await command({ type: 'join', communityId: seedPetitions()[0].communityId });
  await command({
    type: 'backVote',
    petitionId: adaPetition,
    communityId: seedPetitions()[0].communityId,
    support: true,
  });
  await command({
    type: 'discussion',
    petitionId: open,
    body: 'I walk this route every morning and it is dark.',
    kind: 'experience',
  });
  await auth('clerk_maya');
  await sign(adaPetition);
  await auth('clerk_ada');
  await command({ type: 'delete_account' });
  await db.exec('reset role');
  const owned = await db.query(
    `select (select count(*) from public.signatures where user_id=$1)::int sigs,
       (select count(*) from public.petition_saves where user_id=$1)::int saves,
       (select count(*) from public.community_members where user_id=$1)::int members,
       (select count(*) from public.user_interests where user_id=$1)::int interests,
       (select count(*) from public.notifications where user_id=$1)::int notes,
       (select count(*) from public.community_backing_votes where user_id=$1)::int votes,
       (select count(*) from private.principals where profile_id=$1)::int principals,
       (select count(*) from public.discussion_posts where author_id=$1)::int posts,
       (select count(*) from public.signatures where petition_id=$2)::int others,
       (select status from public.petitions where id=$2) status,
       (select name from public.profiles where id=$1) name`,
    [ada.id, adaPetition],
  );
  assert.deepEqual(owned.rows[0], {
    sigs: 0,
    saves: 0,
    members: 0,
    interests: 0,
    notes: 0,
    votes: 0,
    principals: 0,
    posts: 1,
    others: 1,
    status: 'archived',
    name: 'Deleted account',
  });
  await auth('clerk_sam');
  assert(!(await snapshot()).petitions.some((p) => p.id === adaPetition));
  // Signing in again with the same Clerk account starts over with a fresh, empty profile.
  await claims({ sub: 'clerk_ada', email_verified: true, name: 'Ada Lovelace' });
  const restarted = (await snapshot()).profile!;
  assert.notEqual(restarted.id, ada.id);
  assert.equal(restarted.name, 'Ada Lovelace');
  await auth('', 'anon');
  await assert.rejects(() => command({ type: 'delete_account' }));

  await db.close();
  console.log(
    'PostgreSQL integration passed: migration, repeatable seed, 24 RLS tables, private drafts, direct-write denial, drawn signatures tied to the exact text, duplicate prevention, rule locking, permissions, custom review, public anonymity, private reports and receipts, notification fan-out, save-as-follow, full-field revisions, signature withdrawal, community creation and moderation, post tombstones, owner archival, organizer-only volunteer rosters, community spaces with a private organizer room and events, anonymous moderation reports, frozen delivery packets answered by recorded responses, ripple attribution that credits only signers and names nobody, AI report review through a service-role-only queue that hides only flagged petitions, a publication check that holds new and reworded petitions until they pass, a verified email to publish, hidden AI tags that clear on rewording, organizer-only donation links on the public record, signed-in, rate-limited AI helpers, organizer-only petition photos on the public record, signed claims that refresh email verification and the starting name, account deletion that keeps public writing unattributed, and community backing by private member vote.',
  );
}
void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
