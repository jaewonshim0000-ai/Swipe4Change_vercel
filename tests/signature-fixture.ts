import { Petition, Adapter } from '../src/domain/model';
import {
  SignaturePoint,
  SignatureSubmission,
  petitionDisclosure,
} from '../src/domain/signature-record';
/** A short diagonal stroke: enough points to count as a drawn signature. */
export const fixtureSignature: SignaturePoint[] = Array.from({ length: 10 }, (_, i) => ({
  x: i / 10,
  y: i / 20,
  start: i === 0,
}));
export function fixtureSubmission(p: Petition): SignatureSubmission {
  return { disclosure: petitionDisclosure(p), signature: fixtureSignature, consent: true };
}
export async function prepareSubmission(adapter: Adapter, petitionId: string) {
  const p = (await adapter.load()).petitions.find((p) => p.id === petitionId);
  if (!p) throw new Error('Missing test petition');
  return fixtureSubmission(p);
}
