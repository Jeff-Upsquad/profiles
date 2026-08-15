import { z } from 'zod';

export const createConversationSchema = z.object({
  cardId: z.string().uuid(),
  talentUserId: z.string().uuid(),
});

export const conversationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const conversationMessageIdParamSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
});

export const conversationMeetingIdParamSchema = z.object({
  id: z.string().uuid(),
  meetingId: z.string().uuid(),
});

export const sendMessageSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export const listMessagesQuerySchema = z.object({
  after: z.string().uuid().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const listConversationsQuerySchema = z.object({
  status: z.enum(['open', 'awaiting_salesperson', 'closed']).optional(),
  business_user_id: z.string().uuid().optional(),
  talent_user_id: z.string().uuid().optional(),
  salesperson_id: z.string().uuid().optional(),
  card_id: z.string().uuid().optional(),
});

export const assignSalespersonSchema = z.object({
  staff_user_id: z.string().uuid(),
});

export const setDefaultSalespersonSchema = z.object({
  staff_user_id: z.string().uuid().nullable(),
});

export const setFallbackSalespersonSchema = z.object({
  staff_user_id: z.string().uuid().nullable(),
});

const isoDatetime = z
  .string()
  .min(1)
  .refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid datetime');

export const proposeMeetingSchema = z.object({
  starts_at: isoDatetime,
  ends_at: isoDatetime.optional(),
  timezone: z.string().max(80).optional(),
  provider: z.enum(['meet', 'zoom', 'teams', 'other']),
  meeting_link: z.string().url().max(1000),
});

export const respondMeetingSchema = z.object({
  action: z.enum(['accept', 'decline']),
});

export const createNoteSchema = z.object({
  body: z.string().trim().min(1).max(4000),
});

export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type ProposeMeetingInput = z.infer<typeof proposeMeetingSchema>;
