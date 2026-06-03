import { z } from 'zod';
import { NotificationTypeSchema } from './enums';

export const NotificationSchema = z.object({
  id: z.string(),
  userId: z.string(),
  type: NotificationTypeSchema,
  message: z.string(),
  complaintId: z.string(),
  read: z.boolean(),
  createdAt: z.string().datetime(),
});
export type Notification = z.infer<typeof NotificationSchema>;
