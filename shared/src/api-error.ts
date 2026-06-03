import { z } from 'zod';

export const ApiErrorEnvelopeSchema = z.object({
  code: z.string(),
  message: z.string().optional(),
  details: z.unknown().optional(),
});
export type ApiErrorEnvelope = z.infer<typeof ApiErrorEnvelopeSchema>;
