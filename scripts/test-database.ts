import { fixtureSubmission } from '../tests/signature-fixture';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { demoIds, petitionId, seedPetitions } from '../src/data/seed';
import type { CommunityPost, Snapshot } from '../src/domain/model';
async function run() {
  const db = new PGlite();
  await db.exec(
    `create role anon; create role authenticated; create schema auth; create function auth.jwt() returns jsonb language sql stable as $$ select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb $$; grant usage on schema auth to anon,authenticated; grant execute on function auth.jwt() to anon,authenticated;`,
  );
  for (const file of readdirSync('supabase/migrations')
    .filter((f) => f.endsWith('.sql'))
    .sort())
    await db.exec(readFileSync(`supabase/migrations/${file}`, 'utf8'));
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  // Seed is repeatable and does not reset real signatures or create duplicate entries.
  await db.exec(readFileSync('supabase/seed.sql', 'utf8'));
  const tables = await db.query<{ tablename: string; rowsecurity: boolean }>(
    `select tablename,rowsecurity from pg_tables where schemaname='public'`,
  );
  assert.equal(tables.rows.length, 23);
  assert(tables.rows.every((t) => t.rowsecurity));
  await db.query(
    `insert into private.principals(profile_id,clerk_subject,email_verified,location_approved) values($1,'clerk_maya',true,false),($2,'clerk_sam',true,true),($3,'clerk_jordan',false,false)`,
    [demoIds.maya, demoIds.sam, demoIds.jordan],
  );
  const auth = async (subject: string, role = 'authenticated') => {
    await db.exec('reset role');
    await db.query(`select set_config('request.jwt.claims',$1,false)`, [
      JSON.stringify(subject ? { sub: subject } : {}),
    ]);
    await db.exec(`set role ${role}`);
  };
  const command = async (c: unknown) => {
    const r = await db.query<{ value: string }>(
      `select public.lookaware_command($1::jsonb) as value`,
      [JSON.stringify(c)],
    );
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

  await db.close();
  console.log(
    'PostgreSQL integration passed: migration, repeatable seed, 23 RLS tables, private drafts, direct-write denial, drawn signatures tied to the exact text, duplicate prevention, rule locking, permissions, custom review, public anonymity, private reports and receipts, notification fan-out, save-as-follow, full-field revisions, signature withdrawal, community creation and moderation, post tombstones, owner archival, organizer-only volunteer rosters, community spaces with a private organizer room and events, anonymous moderation reports, frozen delivery packets answered by recorded responses, and ripple attribution that credits only signers and names nobody.',
  );
}
void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
