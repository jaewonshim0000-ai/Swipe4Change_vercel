import { prepareSubmission } from './signature-fixture';
import { LocalAdapter, Storage } from '../src/data/local';
import { demoIds, seedPetitions } from '../src/data/seed';
import { packetText } from '../src/domain/packet';
import { findOffice, suggestOffices } from '../src/domain/recipients';

function setup() {
  const values = new Map<string, string>();
  const storage: Storage = {
    getItem: async (k) => values.get(k) ?? null,
    setItem: async (k, v) => {
      values.set(k, v);
    },
  };
  let id = 0;
  return new LocalAdapter(storage, () => `test-${++id}`);
}
/** Maya publishes a signable petition; Sam signs it under a full-name identity. */
async function published(a: LocalAdapter) {
  await a.signIn(demoIds.maya);
  const id = await a.execute({ type: 'create', draft: seedPetitions()[0], publish: true });
  if (typeof id !== 'string') throw new Error('Missing id');
  return id;
}
async function sign(a: LocalAdapter, who: string, identity: 'full_name' | 'anonymous') {
  await a.signIn(who);
  await a.execute({
    type: 'sign',
    petitionId: (await a.load()).petitions[0].id,
    identity,
    submission: await prepareSubmission(a, (await a.load()).petitions[0].id),
  });
}

test('a delivery records who sent what, to whom, and when', async () => {
  const a = setup();
  const id = await published(a);
  await sign(a, demoIds.sam, 'full_name');
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'deliver',
    petitionId: id,
    method: 'email',
    note: 'publicworks@irvine.example, reference PW-2026-114',
  });
  const p = (await a.load()).petitions.find((x) => x.id === id)!;
  expect(p.deliveries).toHaveLength(1);
  const d = p.deliveries[0];
  expect(d.method).toBe('email');
  expect(d.deliveredBy).toBe('Maya Chen');
  expect(d.recipient).toBe(p.recipient);
  expect(d.signatureCount).toBe(p.count);
  expect(d.signatories).toContain('Sam Rivera');
});

test('the delivered packet is a snapshot, not a live view', async () => {
  const a = setup();
  const id = await published(a);
  await sign(a, demoIds.sam, 'full_name');
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'deliver',
    petitionId: id,
    method: 'mail',
    note: 'Posted to City Hall.',
  });
  const atDelivery = (await a.load()).petitions.find((x) => x.id === id)!.deliveries[0];
  // Someone else signs afterwards. The record of what was sent must not move.
  await sign(a, demoIds.maya, 'anonymous');
  await a.signIn(demoIds.maya);
  const later = (await a.load()).petitions.find((x) => x.id === id)!;
  expect(later.count).toBe(atDelivery.signatureCount + 1);
  expect(later.deliveries[0].signatureCount).toBe(atDelivery.signatureCount);
  expect(later.deliveries[0].signatories).toEqual(atDelivery.signatories);
});

test('only an organizer can deliver, and only a published petition with support', async () => {
  const a = setup();
  const id = await published(a);
  await a.signIn(demoIds.sam);
  await expect(
    a.execute({ type: 'deliver', petitionId: id, method: 'email', note: 'Trying to send this.' }),
  ).rejects.toThrow(/owner or an authorized collaborator/);
  await a.signIn(demoIds.maya);
  // Nothing signed yet beyond the fictional seed baseline of this fresh petition.
  const draft = await a.execute({
    type: 'create',
    draft: { ...seedPetitions()[1], title: 'An unpublished draft nobody can deliver' },
    publish: false,
  });
  await expect(
    a.execute({
      type: 'deliver',
      petitionId: draft as string,
      method: 'email',
      note: 'Sending an unpublished draft.',
    }),
  ).rejects.toThrow(/Publish the petition/);
  await expect(
    a.execute({ type: 'deliver', petitionId: id, method: 'email', note: 'no' }),
  ).rejects.toThrow(/at least 5|Say where it went/);
});

test('people who saved it hear that the petition was delivered', async () => {
  const a = setup();
  const id = await published(a);
  await a.signIn(demoIds.jordan);
  await a.execute({ type: 'save', petitionId: id });
  await sign(a, demoIds.sam, 'full_name');
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'deliver',
    petitionId: id,
    method: 'in_person',
    note: 'Council meeting.',
  });
  await a.signIn(demoIds.jordan);
  expect((await a.load()).notifications.some((n) => n.body.includes('was delivered to'))).toBe(
    true,
  );
});

test('a response can answer a specific delivery', async () => {
  const a = setup();
  const id = await published(a);
  await sign(a, demoIds.sam, 'full_name');
  await a.signIn(demoIds.maya);
  await a.execute({
    type: 'deliver',
    petitionId: id,
    method: 'email',
    note: 'Sent to the office.',
  });
  const delivery = (await a.load()).petitions.find((x) => x.id === id)!.deliveries[0];
  await a.execute({
    type: 'response',
    petitionId: id,
    body: 'We have logged this request for review.',
    organization: 'Irvine Public Works (fictional)',
    deliveryId: delivery.id,
  });
  const p = (await a.load()).petitions.find((x) => x.id === id)!;
  expect(p.responses[0].deliveryId).toBe(delivery.id);
  await expect(
    a.execute({
      type: 'response',
      petitionId: id,
      body: 'A response pointing at nothing real.',
      organization: 'Somewhere else (fictional)',
      deliveryId: 'not-a-delivery-on-this-petition',
    }),
  ).rejects.toThrow(/not on this petition/);
});

test('the packet carries public names only, and never private data', async () => {
  const a = setup();
  const id = await published(a);
  await sign(a, demoIds.sam, 'full_name');
  await sign(a, demoIds.maya, 'anonymous');
  await a.signIn(demoIds.maya);
  const s = await a.load();
  const p = s.petitions.find((x) => x.id === id)!;
  const text = packetText(
    p,
    null,
    s.signatures.filter((x) => x.petitionId === p.id).map((x) => x.displayName),
    s.communities,
  );
  expect(text).toContain(p.title.toUpperCase());
  expect(text).toContain(p.action);
  expect(text).toContain('Sam Rivera');
  expect(text).toContain('Anonymous supporter');
  expect(text).toContain('FICTIONAL');
  // A real petition to a real office is not labelled fictional, and still makes no legal claim.
  const real = packetText(
    { ...p, sampleCount: 0, recipient: 'Seattle Department of Transportation' },
    null,
    [],
    s.communities,
  );
  expect(real).not.toContain('FICTIONAL');
  expect(real).toContain('not a legal ballot petition');
  // Nothing that identifies an account, and no contact channel of any kind.
  expect(text).not.toContain(demoIds.sam);
  expect(text).not.toContain(demoIds.jordan);
  expect(text).not.toMatch(/@\w+\.(com|org|net)/);
});

test('the packet renders a delivery snapshot when one is given', async () => {
  const a = setup();
  const id = await published(a);
  await sign(a, demoIds.sam, 'full_name');
  await a.signIn(demoIds.maya);
  await a.execute({ type: 'deliver', petitionId: id, method: 'portal', note: 'Portal ref 9912.' });
  const p = (await a.load()).petitions.find((x) => x.id === id)!;
  const text = packetText(p, p.deliveries[0], ['Someone Else Entirely'], []);
  expect(text).toContain('Portal ref 9912.');
  expect(text).toContain('Sam Rivera');
  expect(text).not.toContain('Someone Else Entirely');
});

test('the directory routes a topic to offices and says what they cannot decide', () => {
  const offices = suggestOffices('Safer streets', 'the crosswalk outside the school has no lights');
  expect(offices.length).toBeGreaterThan(1);
  expect(offices[0].topics).toContain('Safer streets');
  // The school board handles school grounds but explicitly not the public road outside.
  const board = findOffice('Irvine Unified School Board (fictional)')!;
  expect(board.level).toBe('school');
  expect(board.notResponsibleFor).toMatch(/Public Works/);
  expect(findOffice('An office nobody added')).toBeUndefined();
});

test('every seeded petition names an office in the directory', () => {
  for (const p of seedPetitions()) expect(findOffice(p.recipient)).toBeDefined();
});
