import { z } from 'zod';
import { RoleSchema } from './enums';

export const UserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  phone: z.string().optional().nullable(),
  name: z.string().min(1),
  city: z.string().optional().nullable(),
  role: RoleSchema,
  language: z.string().min(1),
  twoFactorEnabled: z.boolean(),
  departmentId: z.string().optional().nullable(),
  createdAt: z.string().datetime(),
});
export type User = z.infer<typeof UserSchema>;
