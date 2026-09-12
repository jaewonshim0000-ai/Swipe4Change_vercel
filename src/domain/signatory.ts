import { z } from 'zod';
export const pointSchema = z.object({
  x: z.number().min(0).max(1),
  y: z.number().min(0).max(1),
  start: z.boolean(),
});
export const signatorySchema = z.object({
  printedName: z.string().trim().min(2).max(150),
  residenceAddress: z.string().trim().min(8).max(300),
  jurisdiction: z.string().trim().min(3).max(150),
  signature: z.array(pointSchema).min(8, 'Draw your signature before saving.').max(3000),
  residenceAttested: z.literal(true, {
    errorMap: () => ({ message: 'Confirm that this matches your voter registration residence.' }),
  }),
});
export type Signatory = z.infer<typeof signatorySchema>;
export type SignaturePoint = z.infer<typeof pointSchema>;
export const envelopeSchema = z
  .object({
    version: z.literal(1),
    ciphertext: z
      .string()
      .min(40)
      .max(500000)
      .regex(/^[A-Za-z0-9+/]+={0,2}$/),
  })
  .strict();
export type EncryptedVault = z.infer<typeof envelopeSchema>;
