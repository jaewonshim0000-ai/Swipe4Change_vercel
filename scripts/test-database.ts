import { qualificationFixture } from '../tests/qualification-fixture';
import { qualificationChecklist } from '../src/domain/qualification';
import { fixtureEnvelope, fixtureSubmission } from '../tests/signature-fixture';
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import assert from 'node:assert/strict';
import { demoIds, petitionId, seedPetitions } from '../src/data/seed';
import type { Snapshot } from '../src/domain/model';
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
  assert.equal(tables.rows.length, 21);
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
  await assert.rejects(
    () =>
      command({
        type: 'edit',
        petitionId: petitionId(1),
        title: s.petitions[0].title,
        action: s.petitions[0].action,
        reason: 'A material rule change',
        verification: 'account',
        identities: ['anonymous'],
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
    title: p.title,
    action: 'Install a crosswalk along this school route.',
    reason: 'Clarifying our requested crossing',
    verification: p.verification,
    identities: p.identities,
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
  await db.close();
  console.log(
    'PostgreSQL integration passed: migration, repeatable seed, 21 RLS tables, private drafts, direct-write denial, signing, duplicate prevention, rule locking, permissions, custom review, public anonymity, private reports, encrypted receipts, mandatory qualification records, immutable affidavits, and trusted acceptance prerequisites.',
  );
}
void run().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});
