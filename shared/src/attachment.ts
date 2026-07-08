import { z } from 'zod';
import { AttachmentKindSchema, type AttachmentKind } from './enums';

export type { AttachmentKind };
export { AttachmentKindSchema };

/** Wire shape returned by `GET /api/complaints/:id/attachments` and similar. */
export const AttachmentSchema = z.object({
  id: z.string(),
  complaintId: z.string(),
  kind: AttachmentKindSchema,
  url: z.string().url(),
  sizeBytes: z.number().int().nonnegative(),
  createdAt: z.string().datetime(),
});
export type Attachment = z.infer<typeof AttachmentSchema>;

/** Request body for `POST /api/complaints/:id/attachments/sign`. */
export const AttachmentSignRequestSchema = z.object({
  kind: AttachmentKindSchema,
  contentType: z.string().min(3).max(120),
  // Cap individual uploads at 25 MB. The browser also enforces this client-side.
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
  filename: z.string().max(200).optional(),
});
export type AttachmentSignRequest = z.infer<typeof AttachmentSignRequestSchema>;

/**
 * Response body for `POST /api/complaints/:id/attachments/sign`.
 * The browser PUTs the file bytes to `uploadUrl` with `Content-Type` set,
 * then POSTs the same `objectKey` back to `/finalize` to record the row.
 */
export const AttachmentSignResponseSchema = z.object({
  uploadUrl: z.string().url(),
  objectKey: z.string(),
  expiresInSeconds: z.number().int().positive(),
  publicUrl: z.string().url(),
});
export type AttachmentSignResponse = z.infer<typeof AttachmentSignResponseSchema>;

/** Body for `POST /api/complaints/:id/attachments`. */
export const AttachmentFinalizeSchema = z.object({
  kind: AttachmentKindSchema,
  objectKey: z.string().min(1),
  sizeBytes: z.number().int().positive().max(25 * 1024 * 1024),
});
export type AttachmentFinalizeInput = z.infer<typeof AttachmentFinalizeSchema>;
