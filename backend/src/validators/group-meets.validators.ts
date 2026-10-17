import { z } from 'zod';

// Small grace so a "starting right now" meeting still validates despite
// client/server clock drift; anything further in the past is rejected.
const START_GRACE_MS = 2 * 60 * 1000;

export const groupMeetScheduleSchema = z.object({
  title: z.string().trim().min(1).max(160).optional(),
  starts_at: z.string().datetime({ offset: true }),
  ends_at: z.string().datetime({ offset: true }),
  timezone: z.string().trim().min(1).max(100).default('UTC'),
}).refine((value) => new Date(value.ends_at) > new Date(value.starts_at), {
  message: 'Meeting end time must be after its start time',
  path: ['ends_at'],
}).refine((value) => new Date(value.starts_at).getTime() > Date.now() - START_GRACE_MS, {
  message: 'Meeting start time cannot be in the past',
  path: ['starts_at'],
});

export const groupMeetIdParamSchema = z.object({ meetingId: z.string().uuid() });
export const groupMeetCardParamSchema = z.object({ cardId: z.string().uuid() });
export const groupMeetRespondSchema = z.object({ action: z.enum(['accept', 'decline']) });
export const groupMeetMessageSchema = z.object({ body: z.string().trim().min(1).max(4000) });

const proxyActorSchema = z.object({
  email: z.string().email().optional().nullable(),
  name: z.string().trim().min(1).max(200).optional().nullable(),
  id: z.string().trim().min(1).max(80).optional().nullable(),
}).optional();
export const clientViewGroupMeetGetSchema = z.object({ external_id: z.string().min(1).max(200), actor: proxyActorSchema });
export const clientViewGroupMeetScheduleSchema = groupMeetScheduleSchema.and(z.object({ external_id: z.string().min(1).max(200), actor: proxyActorSchema }));
export const clientViewGroupMeetUpdateSchema = groupMeetScheduleSchema.and(z.object({ meeting_id: z.string().uuid(), actor: proxyActorSchema }));
export const clientViewGroupMeetActionSchema = z.object({ meeting_id: z.string().uuid(), actor: proxyActorSchema });
export const clientViewGroupMeetMessageSchema = clientViewGroupMeetActionSchema.extend({ body: z.string().trim().min(1).max(4000) });
