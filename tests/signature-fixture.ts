import { Petition, Adapter } from '../src/domain/model';
import { petitionDisclosure, SignatureSubmission } from '../src/domain/signature-record';
// Transport fixture only. Encryption and authenticated disclosure are tested in vault.test.ts.
export const fixtureEnvelope = { version: 1 as const, ciphertext: 'A'.repeat(100) };
export function fixtureSubmission(p: Petition): SignatureSubmission {
  return { disclosure: petitionDisclosure(p), envelope: fixtureEnvelope, consent: true };
}
export async function prepareSubmission(adapter: Adapter, petitionId: string) {
  await adapter.execute({ type: 'saveVault', envelope: fixtureEnvelope });
  const p = (await adapter.load()).petitions.find((p) => p.id === petitionId);
  if (!p) throw new Error('Missing test petition');
  return fixtureSubmission(p);
}
