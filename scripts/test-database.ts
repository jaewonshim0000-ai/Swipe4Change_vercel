import { qualificationFixture } from '../tests/qualification-fixture';
import { qualificationChecklist } from '../src/domain/qualification';
import { fixtureEnvelope, fixtureSubmission } from '../tests/signature-fixture';
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
  assert.equal(tables.rows.length, 27);
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
  const sign = async (petitionId: string) => {
    const p = (await snapshot()).petitions.find((p) => p.id === petitionId)!;
    await command({ type: 'saveVault', envelope: fixtureEnvelope });
    return command({
      type: 'sign',
      petitionId,
      identity: 'anonymous',
      submission: fixtureSubmission(p),
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
  const sampleChecks = s.petitions.find((p) => p.id === petitionId(1))!.responseChecks!;
  assert.equal(sampleChecks.length, 3);
  assert.equal(sampleChecks[0].status, 'partial');
  assert.equal(sampleChecks[0].responseId, s.petitions[0].responses[0].id);
  await auth('clerk_sam');
  await assert.rejects(() =>
    command({
      type: 'responseChecks',
      petitionId: petitionId(1),
      checks: [
        {
          ask: 'Publish a lighting plan',
          status: 'unanswered',
          note: 'No plan appears in the reply.',
          responseId: sampleChecks[0].responseId,
        },
      ],
    }),
  );
  await auth('clerk_maya');
  await assert.rejects(() =>
    command({
      type: 'responseChecks',
      petitionId: petitionId(1),
      checks: [
        {
          ask: 'Publish a lighting plan',
          status: 'answered',
          note: 'Claims an answer without a linked response.',
        },
      ],
    }),
  );
  await command({
    type: 'responseChecks',
    petitionId: petitionId(1),
    checks: [
      {
        ask: 'Publish a lighting plan',
        status: 'unanswered',
        note: 'No plan appears in the reply.',
        responseId: sampleChecks[0].responseId,
      },
    ],
  });
  assert.equal((await snapshot()).petitions[0].responseChecks?.[0].reviewedBy, 'Maya Chen');
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
  assert.equal((await snapshot()).petitions.find((item) => item.id === id)?.responseChecks, undefined);
  await auth('clerk_sam');
  assert(!(await snapshot()).petitions.some((p) => p.id === id));
  await assert.rejects(() => command({ type: 'publish', petitionId: id }));
  await auth('clerk_maya');
  await command({ type: 'publish', petitionId: id });
  await command({
    type: 'qualification',
    petitionId: id,
    details: qualificationFixture,
    reason: 'Fictional source requirements supplied',
  });
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
    avatar: 'sun',
    accent: 'ocean',
    useSigningHistory: false,
  });
  assert.equal((await snapshot()).profile?.bio, 'Safer routes for everyone.');
  assert.equal((await snapshot()).profile?.useSigningHistory, false);
  await assert.rejects(() =>
    command({
      type: 'profile',
      name: '',
      bio: '',
      avatar: 'sun',
      accent: 'ocean',
      useSigningHistory: false,
    }),
  );
  const encrypted = { version: 1, ciphertext: 'A'.repeat(100) };
  await command({ type: 'saveVault', envelope: encrypted });
  assert(!JSON.stringify(await snapshot()).includes(encrypted.ciphertext));
  const vault = async () =>
    (await db.query<{ value: unknown }>('select public.signature_vault() as value')).rows[0].value;
  assert.deepEqual(await vault(), encrypted);
  await assert.rejects(() =>
    command({
      type: 'saveVault',
      envelope: { ...encrypted, printedName: 'must not be plaintext' },
    }),
  );
  await auth('clerk_sam');
  await command({ type: 'deleteVault' });
  assert.equal(await vault(), null);
  await assert.rejects(() => db.query('select * from private.signature_vaults'), /permission/);
  await command({ type: 'deleteVault' });
  await auth('clerk_maya');
  assert.deepEqual(await vault(), encrypted);
  await command({ type: 'deleteVault' });
  assert.equal(await vault(), null);
  await auth('', 'anon');
  await assert.rejects(vault, /permission/);
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
  assert.equal(original.status, 'pending');
  assert.equal((await snapshot()).petitions.find((p) => p.id === id)?.acceptedSignatures, 0);
  assert(!JSON.stringify(await snapshot()).includes(fixtureEnvelope.ciphertext));
  await assert.rejects(() => db.exec('select * from private.signature_receipts'), /permission/);
  await auth('clerk_maya');
  assert.equal(await receipt(id), null);
  const p = (await snapshot()).petitions.find((p) => p.id === id)!;
  await command({
    type: 'edit',
    petitionId: id,
    patch: { action: 'Install a crosswalk along this school route.' },
    reason: 'Clarifying our requested crossing',
  });
  assert.deepEqual(
    (await snapshot()).petitions.find((item) => item.id === id)?.responseChecks?.[0].status,
    'not_reviewed',
  );
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
  await assert.rejects(() =>
    command({
      type: 'sign',
      petitionId: unsigned.id,
      identity: unsigned.identities[0],
      submission: { ...fixtureSubmission(unsigned), envelope: { version: 1, ciphertext: 'short' } },
    }),
  );
  assert(!(await snapshot()).signed.includes(unsigned.id));
  assert.equal(await receipt(unsigned.id), null);
  for (const version of [1, 2, 3, 4, 5])
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

  // Complete legal workflow with fictional evidence. Only the database owner simulates trusted external review.
  await auth('clerk_maya');
  const legalId = await command({ type: 'create', draft: seedPetitions()[0], publish: true });
  await assert.rejects(() => sign(legalId), /configure all four/);
  await command({
    type: 'qualification',
    petitionId: legalId,
    details: qualificationFixture,
    reason: 'Fictional source for integration testing',
  });
  assert.equal(
    (await snapshot()).petitions.find((p) => p.id === legalId)?.qualification?.status,
    'pending',
  );
  await assert.rejects(
    () => db.exec("update public.petition_qualification set status='verified'"),
    /permission/,
  );
  await assert.rejects(
    () =>
      db.query('select private.review_qualification($1,true,$2)', [
        legalId,
        'Forged approval reference',
      ]),
    /permission/,
  );
  await auth('clerk_sam');
  await assert.rejects(
    () =>
      command({
        type: 'qualification',
        petitionId: legalId,
        details: qualificationFixture,
        reason: 'Unauthorized revision',
      }),
    /permission/,
  );
  await sign(legalId);
  const legalReceipt = (await receipt(legalId))!;
  assert.equal(legalReceipt.disclosure.fullText, qualificationFixture.officialText);
  await auth('clerk_maya');
  await assert.rejects(
    () =>
      command({
        type: 'qualification',
        petitionId: legalId,
        details: { ...qualificationFixture, statutoryThreshold: 1 },
        reason: 'An impermissible revision',
      }),
    /locked/,
  );
  await command({ type: 'saveVault', envelope: fixtureEnvelope });
  const affidavit = {
    id: 'a1000000-0000-4000-8000-000000000001',
    petitionId: legalId,
    signatureIds: [legalReceipt.id],
    declaration: qualificationFixture.circulatorDeclaration,
    witnessed: true,
    notarizationProvided: true,
    envelope: fixtureEnvelope,
  };
  await assert.rejects(
    () =>
      command({
        type: 'affidavit',
        petitionId: legalId,
        submission: { ...affidavit, notarizationProvided: false },
      }),
    /notarized/,
  );
  await assert.rejects(
    () =>
      command({
        type: 'affidavit',
        petitionId: legalId,
        submission: { ...affidavit, signatureIds: [original.id] },
      }),
    /only signatures/,
  );
  await command({ type: 'affidavit', petitionId: legalId, submission: affidavit });
  const affidavits = async () =>
    (
      await db.query<{ value: unknown[] }>('select public.circulator_affidavits($1) as value', [
        legalId,
      ])
    ).rows[0].value;
  assert.equal((await affidavits()).length, 1);
  assert.equal(
    (await snapshot()).petitions.find((p) => p.id === legalId)?.qualification?.acceptedAffidavits,
    0,
  );
  await auth('clerk_sam');
  assert.deepEqual(await affidavits(), []);
  await assert.rejects(
    () =>
      db.query('select private.review_signature($1,$2,true,true,true,$3)', [
        legalReceipt.id,
        affidavit.id,
        'Forged authority reference',
      ]),
    /permission/,
  );
  await db.exec('reset role');
  await assert.rejects(
    () =>
      db.query('select private.review_signature($1,$2,true,true,true,$3)', [
        legalReceipt.id,
        affidavit.id,
        'Fictional review result before prerequisites',
      ]),
    /Acceptance requires/,
  );
  await db.query('select private.review_qualification($1,true,$2)', [
    legalId,
    'Fictional authority verified the test requirements',
  ]);
  await assert.rejects(
    () =>
      db.query('select private.review_affidavit($1,true,false,$2)', [
        affidavit.id,
        'Fictional result without notarization',
      ]),
    /notarization/,
  );
  await db.query('select private.review_affidavit($1,true,true,$2)', [
    affidavit.id,
    'Fictional witness and notarial record reviewed',
  ]);
  await assert.rejects(
    () =>
      db.query('select private.review_signature($1,$2,true,false,true,$3)', [
        legalReceipt.id,
        affidavit.id,
        'Fictional signature with no registration match',
      ]),
    /Acceptance requires/,
  );
  await db.query('select private.review_signature($1,$2,true,true,true,$3)', [
    legalReceipt.id,
    affidavit.id,
    'Fictional authority confirmed registration and signature',
  ]);
  await assert.rejects(
    () =>
      db.query('update private.signature_receipts set disclosure=$1 where id=$2', [
        {},
        legalReceipt.id,
      ]),
    /immutable/,
  );
  await assert.rejects(
    () =>
      db.query(
        "update private.circulator_affidavits set declaration='Rewrite the sworn statement' where id=$1",
        [affidavit.id],
      ),
    /immutable/,
  );
  await assert.rejects(
    () =>
      db.query('select private.review_affidavit($1,false,false,$2)', [
        affidavit.id,
        'Fictional attempt to revoke before dependencies',
      ]),
    /Revoke dependent/,
  );
  await auth('clerk_sam');
  const qualified = (await snapshot()).petitions.find((p) => p.id === legalId)!;
  assert.equal(qualified.acceptedSignatures, 1);
  assert.equal(qualified.qualification?.acceptedAffidavits, 1);
  assert.equal(qualificationChecklist(qualified)[3].ready, false); // 1 accepted < exact threshold of 2, regardless of goal/sample counts.
  assert.equal(qualificationChecklist({ ...qualified, acceptedSignatures: 2 })[3].ready, true);
  assert.equal((await receipt(legalId))?.status, 'accepted');

  // --- Notification fan-out, revisions, withdrawal, moderation and archival ---------------------
  const inbox = async () => (await snapshot()).notifications.map((n) => n.body);

  // The organizer of the seeded flagship petition hears about what happened on it.
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

  // Saving is a real subscription: Jordan follows without signing and still hears everything.
  await auth('clerk_jordan');
  await command({ type: 'save', petitionId: petitionId(1) });
  await command({ type: 'follow', petitionId: petitionId(1) });
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
  await command({
    type: 'qualification',
    petitionId: withdrawTarget.id,
    details: qualificationFixture,
    reason: 'Fictional source requirements supplied',
  });
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

  // Follow, volunteer: the deck offers more than pass and sign.
  await auth('clerk_maya');
  const helpable = await command({
    type: 'create',
    draft: { ...seedPetitions()[0], title: 'A petition that needs hands as well as names' },
    publish: true,
  });
  await auth('clerk_jordan');
  await command({ type: 'save', petitionId: helpable });
  let follower = await snapshot();
  assert(follower.saved.includes(helpable), 'saved');
  assert(!follower.following.includes(helpable), 'saving alone does not subscribe');
  const quiet = (await inbox()).length;
  await auth('clerk_maya');
  await command({ type: 'update', petitionId: helpable, body: 'An update only followers get.' });
  await auth('clerk_jordan');
  assert.equal((await inbox()).length, quiet, 'a saver is not notified');
  await command({ type: 'follow', petitionId: helpable });
  follower = await snapshot();
  assert(follower.following.includes(helpable), 'following');
  await command({ type: 'follow', petitionId: helpable });
  assert(!(await snapshot()).following.includes(helpable), 'follow toggles off');

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
  assert(helper.following.includes(helpable), 'volunteering subscribes you');
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

  // Community spaces: three zones of authority, nine surfaces, one row type.
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

  // A poll: counts are public, the choice is not.
  await auth('clerk_jordan');
  await command({
    type: 'communityPost',
    communityId: space,
    body: 'When should we walk the route together?',
    kind: 'poll',
    space: 'discussion',
    channel: 'lighting',
    options: ['Weeknight', '', 'Weekend morning'],
  });
  const poll = (await spacePosts()).find((x) => x.kind === 'poll')!;
  assert.deepEqual(poll.options, ['Weeknight', 'Weekend morning'], 'blanks dropped, order kept');
  await assert.rejects(
    () =>
      command({
        type: 'communityPost',
        communityId: space,
        body: 'A poll offering the same answer twice.',
        kind: 'poll',
        space: 'discussion',
        channel: '',
        options: ['Same', 'Same'],
      }),
    /must differ/,
  );
  await auth('clerk_sam');
  await command({
    type: 'communityInteract',
    communityId: space,
    postId: poll.id,
    action: 'vote',
    option: 'Weeknight',
  });
  let seen = (await spacePosts()).find((x) => x.id === poll.id)!;
  assert.equal(seen.votes?.Weeknight, 1);
  assert.equal(seen.myVote, 'Weeknight');
  await assert.rejects(
    () =>
      command({
        type: 'communityInteract',
        communityId: space,
        postId: poll.id,
        action: 'vote',
        option: 'Weeknight',
      }),
    /already chose/,
  );
  // Changing your mind moves the count rather than adding one.
  await command({
    type: 'communityInteract',
    communityId: space,
    postId: poll.id,
    action: 'vote',
    option: 'Weekend morning',
  });
  seen = (await spacePosts()).find((x) => x.id === poll.id)!;
  assert.equal(seen.votes?.Weeknight, 0);
  assert.equal(seen.votes?.['Weekend morning'], 1);
  await auth('clerk_jordan');
  seen = (await spacePosts()).find((x) => x.id === poll.id)!;
  assert.equal(seen.votes?.['Weekend morning'], 1, 'the count is public');
  assert.equal(seen.myVote ?? null, null, 'another member\u2019s choice is not');

  // A task board: claim, release, complete, and nobody else steering your task.
  await command({
    type: 'communityPost',
    communityId: space,
    body: 'Photograph the unlit stretch after dark.',
    kind: 'task',
    space: 'discussion',
    channel: '',
  });
  const task = (await spacePosts()).find((x) => x.kind === 'task')!;
  assert.equal(task.taskStatus, 'open');
  await auth('clerk_sam');
  await command({
    type: 'communityInteract',
    communityId: space,
    postId: task.id,
    action: 'claim',
  });
  seen = (await spacePosts()).find((x) => x.id === task.id)!;
  assert.equal(seen.taskStatus, 'claimed');
  assert.equal(seen.claimedName, 'Sam Rivera');
  await assert.rejects(
    () =>
      command({ type: 'communityInteract', communityId: space, postId: task.id, action: 'claim' }),
    /already on this task/,
  );
  await command({
    type: 'communityInteract',
    communityId: space,
    postId: task.id,
    action: 'release',
  });
  assert.equal((await spacePosts()).find((x) => x.id === task.id)!.taskStatus, 'open');
  await command({
    type: 'communityInteract',
    communityId: space,
    postId: task.id,
    action: 'claim',
  });
  await command({
    type: 'communityInteract',
    communityId: space,
    postId: task.id,
    action: 'complete',
  });
  assert.equal((await spacePosts()).find((x) => x.id === task.id)!.taskStatus, 'done');

  // A proposal: reversible positions, tallied without naming anyone.
  await auth('clerk_jordan');
  await command({
    type: 'communityPost',
    communityId: space,
    body: 'Propose that we ask for a lighting assessment before the winter term.',
    kind: 'proposal',
    space: 'discussion',
    channel: '',
  });
  const proposal = (await spacePosts()).find((x) => x.kind === 'proposal')!;
  await auth('clerk_sam');
  await command({
    type: 'communityInteract',
    communityId: space,
    postId: proposal.id,
    action: 'support',
  });
  assert.equal((await spacePosts()).find((x) => x.id === proposal.id)!.support, 1);
  await command({
    type: 'communityInteract',
    communityId: space,
    postId: proposal.id,
    action: 'oppose',
  });
  seen = (await spacePosts()).find((x) => x.id === proposal.id)!;
  assert.equal(seen.support, 0);
  assert.equal(seen.oppose, 1);
  await command({
    type: 'communityInteract',
    communityId: space,
    postId: proposal.id,
    action: 'withdraw',
  });
  assert.equal((await spacePosts()).find((x) => x.id === proposal.id)!.oppose, 0);

  // Documents are links, never uploads, and the link has to be https.
  await assert.rejects(
    () =>
      command({
        type: 'communityPost',
        communityId: space,
        body: 'An insecure link nobody should be handed.',
        kind: 'document',
        space: 'discussion',
        channel: '',
        url: 'http://example.org/plan.pdf',
      }),
    /https/,
  );

  // Reporting: the moderator sees the post and the reason, never the reporter.
  const target = (await spacePosts()).find((x) => x.kind === 'poll')!;
  await command({
    type: 'reportPost',
    communityId: space,
    postId: target.id,
    reason: 'This poll is worded to push one answer.',
  });
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
  await command({
    type: 'qualification',
    petitionId: sendable,
    details: qualificationFixture,
    reason: 'Fictional source requirements supplied',
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
  await command({ type: 'follow', petitionId: sendable });
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

  await db.close();
  console.log(
    'PostgreSQL integration passed: migration, repeatable seed, 27 RLS tables, private drafts, direct-write denial, signing, duplicate prevention, rule locking, permissions, custom review, public anonymity, private reports, encrypted receipts, mandatory qualification records, immutable affidavits, trusted acceptance prerequisites, notification fan-out, full-field revisions, signature withdrawal, community creation and moderation, post tombstones, owner archival, follow subscriptions, organizer-only volunteer rosters, community spaces with a private organizer room, private poll and proposal ledgers, task boards, anonymous moderation reports, and frozen delivery packets answered by recorded responses.',
  );
}
void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
