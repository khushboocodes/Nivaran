import { z } from 'zod';
import {
  PrioritySchema,
  SentimentSchema,
  StatusSchema,
} from './enums';

/** Wire shape of a Complaint. Dates are ISO strings on the wire. */
export const ComplaintSchema = z.object({
  id: z.string(),
  citizenId: z.string(),
  title: z.string().min(1),
  description: z.string().min(1),
  category: z.string().min(1),
  departmentId: z.string(),
  department: z.string().optional().nullable(),
  assigneeId: z.string().optional().nullable(),
  priority: PrioritySchema,
  status: StatusSchema,
  sentiment: SentimentSchema,
  aiConfidence: z.number().min(0).max(1),
  aiSummary: z.string(),
  language: z.string().min(1),
  location: z.string().optional().nullable(),
  lat: z.number().optional().nullable(),
  lng: z.number().optional().nullable(),
  estimatedResolutionAt: z.string().datetime().optional().nullable(),
  submittedAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
  resolvedAt: z.string().datetime().optional().nullable(),
});
export type Complaint = z.infer<typeof ComplaintSchema>;

/** Body for `POST /api/complaints`. The server fills in id, citizenId, status, dates. AI fields are optional and forwarded from the client when its classifier runs. */
export const ComplaintCreateSchema = z.object({
  title: z.string().min(1).max(200),
  description: z.string().min(10).max(5_000),
  category: z.string().min(1),
  language: z.string().default('en'),
  location: z.string().optional(),
  lat: z.number().optional(),
  lng: z.number().optional(),
  // Optional AI metadata the client can attach when it has already run the
  // classifier in the browser. The server is happy to store it as-is.
  // When omitted, the row keeps the default zeros from the schema.
  priority: PrioritySchema.optional(),
  sentiment: SentimentSchema.optional(),
  aiConfidence: z.number().min(0).max(1).optional(),
  aiSummary: z.string().max(2_000).optional(),
});
export type ComplaintCreateInput = z.infer<typeof ComplaintCreateSchema>;

/** Body for `PATCH /api/complaints/:id`. Officers/admins only. */
export const ComplaintUpdateSchema = z.object({
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  assigneeId: z.string().nullable().optional(),
  category: z.string().optional(),
  departmentId: z.string().optional(),
});
export type ComplaintUpdateInput = z.infer<typeof ComplaintUpdateSchema>;

/** Query parameters for `GET /api/complaints`. */
export const ComplaintListQuerySchema = z.object({
  status: StatusSchema.optional(),
  priority: PrioritySchema.optional(),
  q: z.string().optional(),
  dept: z.string().optional(),
  page: z.coerce.number().int().positive().default(1),
  pageSize: z.coerce.number().int().positive().max(100).default(25),
});
export type ComplaintListQuery = z.infer<typeof ComplaintListQuerySchema>;

/** Body for `POST /api/complaints/:id/assign`. */
export const ComplaintAssignSchema = z.object({
  assigneeId: z.string().nullable(),
});
export type ComplaintAssignInput = z.infer<typeof ComplaintAssignSchema>;
