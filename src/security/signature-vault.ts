import {
  AffidavitContext,
  AffidavitPayload,
  affidavitContext,
  affidavitPayloadSchema,
} from '../domain/affidavit';
import {
  Disclosure,
  ReceiptPayload,
  disclosureContext,
  receiptPayloadSchema,
} from '../domain/signature-record';
import { AESEncryptionKey, AESSealedData, aesEncryptAsync, aesDecryptAsync } from 'expo-crypto';

import { EncryptedVault, Signatory, envelopeSchema, signatorySchema } from '../domain/signatory';
export async function generateVaultKey() {
  return (await AESEncryptionKey.generate()).encoded('hex');
}
async function importKey(code: string) {
  const normalized = code.trim().toLowerCase();
  if (!/^[a-f0-9]{64}$/.test(normalized)) throw new Error('Enter your 64-character recovery key.');
  return AESEncryptionKey.import(normalized, 'hex');
}
const context = (ownerId: string) =>
  new TextEncoder().encode(`swipe4change:signature-vault:v1:${ownerId}`);
export async function encryptSignatory(
  ownerId: string,
  code: string,
  value: Signatory,
): Promise<EncryptedVault> {
  const validated = signatorySchema.parse(value);
  const key = await importKey(code);
  const bytes = new TextEncoder().encode(JSON.stringify(validated));
  try {
    const sealed = await aesEncryptAsync(bytes, key, { additionalData: context(ownerId) });
    return envelopeSchema.parse({ version: 1, ciphertext: await sealed.combined('base64') });
  } finally {
    bytes.fill(0);
  }
}
export async function decryptSignatory(
  ownerId: string,
  code: string,
  envelope: EncryptedVault,
): Promise<Signatory> {
  const checked = envelopeSchema.parse(envelope);
  const key = await importKey(code);
  try {
    const bytes = await aesDecryptAsync(AESSealedData.fromCombined(checked.ciphertext), key, {
      additionalData: context(ownerId),
    });
    try {
      return signatorySchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
    } finally {
      bytes.fill(0);
    }
  } catch {
    throw new Error('Could not unlock this vault. Check your recovery key.');
  }
}

/** Each receipt has its own encryption nonce and is cryptographically bound to one exact disclosure. */
export async function encryptReceipt(
  ownerId: string,
  code: string,
  value: ReceiptPayload,
): Promise<EncryptedVault> {
  const payload = receiptPayloadSchema.parse(value);
  const key = await importKey(code);
  const bytes = new TextEncoder().encode(JSON.stringify(payload));
  try {
    const sealed = await aesEncryptAsync(bytes, key, {
      additionalData: receiptContext(ownerId, payload.disclosure),
    });
    return envelopeSchema.parse({ version: 1, ciphertext: await sealed.combined('base64') });
  } finally {
    bytes.fill(0);
  }
}
export async function decryptReceipt(
  ownerId: string,
  code: string,
  disclosure: Disclosure,
  envelope: EncryptedVault,
): Promise<ReceiptPayload> {
  const checked = envelopeSchema.parse(envelope);
  const key = await importKey(code);
  try {
    const bytes = await aesDecryptAsync(AESSealedData.fromCombined(checked.ciphertext), key, {
      additionalData: receiptContext(ownerId, disclosure),
    });
    try {
      const payload = receiptPayloadSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
      if (disclosureContext(payload.disclosure) !== disclosureContext(disclosure))
        throw new Error('Disclosure mismatch');
      return payload;
    } finally {
      bytes.fill(0);
    }
  } catch {
    throw new Error(
      'Could not unlock this signature receipt. Check the recovery key used when you signed.',
    );
  }
}
function receiptContext(ownerId: string, disclosure: Disclosure) {
  return new TextEncoder().encode(
    `swipe4change:signature-receipt:v1:${ownerId}:${disclosureContext(disclosure)}`,
  );
}

export async function encryptAffidavit(
  ownerId: string,
  code: string,
  input: AffidavitPayload,
): Promise<EncryptedVault> {
  const value = affidavitPayloadSchema.parse(input);
  const key = await importKey(code);
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  try {
    const sealed = await aesEncryptAsync(bytes, key, {
      additionalData: affidavitEncryptionContext(ownerId, value.context),
    });
    return envelopeSchema.parse({ version: 1, ciphertext: await sealed.combined('base64') });
  } finally {
    bytes.fill(0);
  }
}
export async function decryptAffidavit(
  ownerId: string,
  code: string,
  context: AffidavitContext,
  envelope: EncryptedVault,
): Promise<AffidavitPayload> {
  try {
    const value = envelopeSchema.parse(envelope);
    const key = await importKey(code);
    const sealed = AESSealedData.fromCombined(value.ciphertext);
    const bytes = await aesDecryptAsync(sealed, key, {
      additionalData: affidavitEncryptionContext(ownerId, context),
    });
    try {
      const parsed = affidavitPayloadSchema.parse(JSON.parse(new TextDecoder().decode(bytes)));
      if (affidavitContext(parsed.context) !== affidavitContext(context))
        throw new Error('Mismatch');
      return parsed;
    } finally {
      bytes.fill(0);
    }
  } catch {
    throw new Error(
      'Could not unlock this affidavit. Check the recovery key used when it was signed.',
    );
  }
}
function affidavitEncryptionContext(ownerId: string, context: AffidavitContext) {
  return new TextEncoder().encode(
    `swipe4change:circulator-affidavit:v1:${ownerId}:${affidavitContext(context)}`,
  );
}
