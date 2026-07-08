import { z } from 'zod';

export const ROLES = ['citizen', 'officer', 'admin'] as const;
export const RoleSchema = z.enum(ROLES);
export type Role = z.infer<typeof RoleSchema>;

export const STATUSES = [
  'Submitted',
  'Under Review',
  'Assigned',
  'In Progress',
  'Resolved',
] as const;
export const StatusSchema = z.enum(STATUSES);
export type Status = z.infer<typeof StatusSchema>;

export const PRIORITIES = ['Low', 'Medium', 'High', 'Critical'] as const;
export const PrioritySchema = z.enum(PRIORITIES);
export type Priority = z.infer<typeof PrioritySchema>;

export const SENTIMENTS = [
  'Positive',
  'Neutral',
  'Negative',
  'Highly Negative',
] as const;
export const SentimentSchema = z.enum(SENTIMENTS);
export type Sentiment = z.infer<typeof SentimentSchema>;

export const NOTIFICATION_TYPES = [
  'submitted',
  'status_updated',
  'assigned',
  'resolved',
  'escalated',
] as const;
export const NotificationTypeSchema = z.enum(NOTIFICATION_TYPES);
export type NotificationType = z.infer<typeof NotificationTypeSchema>;

export const ATTACHMENT_KINDS = ['photo', 'video', 'audio'] as const;
export const AttachmentKindSchema = z.enum(ATTACHMENT_KINDS);
export type AttachmentKind = z.infer<typeof AttachmentKindSchema>;
