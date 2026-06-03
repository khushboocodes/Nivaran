import { z } from 'zod';

export const FeedbackSchema = z.object({
  id: z.string(),
  complaintId: z.string(),
  citizenId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().optional().nullable(),
  createdAt: z.string().datetime(),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

export const FeedbackCreateSchema = z.object({
  complaintId: z.string(),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2_000).optional(),
});
export type FeedbackCreateInput = z.infer<typeof FeedbackCreateSchema>;
