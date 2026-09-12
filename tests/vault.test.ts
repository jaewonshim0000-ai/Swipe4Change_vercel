import { petitionDisclosure } from '../src/domain/signature-record';
import { seedPetitions } from '../src/data/seed';
import { TextDecoder, TextEncoder } from 'node:util';
import { webcrypto } from 'node:crypto';
// Exercise the app's encryption contract with standards-based WebCrypto. Expo native is verified separately by platform builds.
jest.mock('expo-crypto', () => {
  const { webcrypto: crypto } = jest.requireActual<typeof import('node:crypto')>('node:crypto');
  return {
    AESEncryptionKey: {
      generate: async () => {
        const bytes = crypto.getRandomValues(new Uint8Array(32));
        return { encoded: async () => Buffer.from(bytes).toString('hex') };
      },
      import: async (hex: string) =>
        crypto.subtle.importKey('raw', Buffer.from(hex, 'hex'), 'AES-GCM', false, [
          'encrypt',
          'decrypt',
        ]),
    },
    AESSealedData: { fromCombined: (text: string) => Buffer.from(text, 'base64') },
    aesEncryptAsync: async (
      bytes: Uint8Array,
      key: CryptoKey,
      options: { additionalData: Uint8Array },
    ) => {
      const iv = crypto.getRandomValues(new Uint8Array(12));
      const ciphertext = await crypto.subtle.encrypt(
        { name: 'AES-GCM', iv, additionalData: new Uint8Array(options.additionalData) },
        key,
        new Uint8Array(bytes),
      );
      return {
        combined: async () =>
          Buffer.concat([Buffer.from(iv), Buffer.from(ciphertext)]).toString('base64'),
      };
    },
    aesDecryptAsync: async (
      sealed: Buffer,
      key: CryptoKey,
      options: { additionalData: Uint8Array },
    ) =>
      new Uint8Array(
        await crypto.subtle.decrypt(
          {
            name: 'AES-GCM',
            iv: new Uint8Array(sealed.subarray(0, 12)),
            additionalData: new Uint8Array(options.additionalData),
          },
          key,
          new Uint8Array(sealed.subarray(12)),
        ),
      ),
  };
});
import {
  decryptAffidavit,
  encryptAffidavit,
  decryptReceipt,
  encryptReceipt,
  decryptSignatory,
  encryptSignatory,
  generateVaultKey,
} from '../src/security/signature-vault';
import { Signatory, signatorySchema } from '../src/domain/signatory';
Object.assign(global, { TextEncoder, TextDecoder });
const value: Signatory = {
  printedName: 'Sample Signer',
  residenceAddress: '123 Fictional Lane, Sample City, CA 00000',
  jurisdiction: 'Sample County, CA',
  residenceAttested: true,
  signature: Array.from({ length: 10 }, (_, i) => ({ x: i / 10, y: 0.5, start: i === 0 })),
};
test('encrypts private data with unique nonces, recovers only with matching owner and key', async () => {
  const key = await generateVaultKey();
  const first = await encryptSignatory('owner-1', key, value);
  const second = await encryptSignatory('owner-1', key, value);
  expect(first.ciphertext).not.toBe(second.ciphertext);
  expect(JSON.stringify(first)).not.toContain('Sample');
  expect(await decryptSignatory('owner-1', key, first)).toEqual(value);
  await expect(decryptSignatory('owner-2', key, first)).rejects.toThrow(/unlock/);
  await expect(decryptSignatory('owner-1', await generateVaultKey(), first)).rejects.toThrow(
    /unlock/,
  );
  const bytes = Buffer.from(first.ciphertext, 'base64');
  bytes[20] ^= 1;
  await expect(
    decryptSignatory('owner-1', key, { ...first, ciphertext: bytes.toString('base64') }),
  ).rejects.toThrow(/unlock/);
});
test('requires name, registered residence, signature, and explicit self-attestation', () => {
  expect(signatorySchema.safeParse(value).success).toBe(true);
  for (const change of [
    { printedName: '' },
    { residenceAddress: '' },
    { signature: [] },
    { residenceAttested: false },
  ]) {
    expect(signatorySchema.safeParse({ ...value, ...change }).success).toBe(false);
  }
});
test('uses a full random 256-bit key', async () => {
  expect(await generateVaultKey()).toMatch(/^[a-f0-9]{64}$/);
  expect(webcrypto).toBeDefined();
});

test('receipt encryption authenticates exact disclosure, owner and record type', async () => {
  const key = await generateVaultKey();
  const disclosure = petitionDisclosure(seedPetitions()[0]);
  const payload = { disclosure, signatory: value, confirmedAt: new Date().toISOString() };
  const envelope = await encryptReceipt('owner-1', key, payload);
  expect(await decryptReceipt('owner-1', key, disclosure, envelope)).toEqual(payload);
  await expect(
    decryptReceipt('owner-1', key, { ...disclosure, fullText: 'Rewritten text' }, envelope),
  ).rejects.toThrow(/unlock/);
  await expect(decryptReceipt('owner-2', key, disclosure, envelope)).rejects.toThrow(/unlock/);
  await expect(decryptSignatory('owner-1', key, envelope)).rejects.toThrow(/unlock/);
});

test('affidavit encryption authenticates the witnessed record list and notary assertion', async () => {
  const key = await generateVaultKey();
  const context = {
    id: 'a1000000-0000-4000-8000-000000000001',
    petitionId: 'petition-1',
    signatureIds: ['record-1'],
    declaration: 'I witnessed the execution of these fictional test signatures.',
    witnessed: true as const,
    notarizationProvided: true,
  };
  const payload = {
    context,
    signatory: value,
    sheetReference: 'Fictional signed sheet 1',
    notaryReference: 'Fictional notarial record 1',
    signedAt: new Date().toISOString(),
  };
  const envelope = await encryptAffidavit('owner-1', key, payload);
  expect(await decryptAffidavit('owner-1', key, context, envelope)).toEqual(payload);
  await expect(
    decryptAffidavit('owner-1', key, { ...context, signatureIds: ['record-2'] }, envelope),
  ).rejects.toThrow(/unlock/);
  await expect(
    decryptAffidavit('owner-1', key, { ...context, notarizationProvided: false }, envelope),
  ).rejects.toThrow(/unlock/);
  await expect(decryptAffidavit('other-owner', key, context, envelope)).rejects.toThrow(/unlock/);
});
