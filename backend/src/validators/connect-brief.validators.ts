import { z } from 'zod';

// Mirrors squadhub-web's public /leads/landing submission schema
// (server/src/routes/leads-public.ts). The business-portal brief form posts
// here; the backend fills contact defaults from the signed-in account and
// forwards to squadhub. Kept in sync with the upstream contract.

const SERVICE_TYPE = z.enum([
  'designer',
  'video_editor',
  'designer_video_editor',
  'accountant',
]);

const roleRequirementSchema = z.object({
  note: z.string().trim().max(2000).optional(),
  hours: z.string().trim().max(200).optional(),
  // Agencies is a delivery option, alongside individual talent levels. It is
  // forwarded verbatim to SquadHub so it appears on the requirement card.
  tiers: z.array(z.enum(['Junior', 'Pro', 'Top Talents', 'Agencies', 'Custom'])).max(5).optional(),
  plan: z.string().trim().max(50).optional(),
  tier_budgets: z.record(z.string(), z.number().int().nonnegative()).optional(),
  budget: z.number().int().nonnegative().optional(),
  duration: z.string().trim().max(200).optional(),
  start_date: z.string().trim().max(40).optional(),
  deadline: z.string().trim().max(40).optional(),
  scope_type: z.string().trim().max(100).optional(),
  pricing_mode: z.enum(['priced', 'unpriced']).optional(),
  request_type: z.enum(['fixed', 'business_service']).optional(),
  work_type: z.string().trim().max(100).optional(),
  pricing_basis: z.enum(['project', 'per_unit']).optional(),
  unit: z.enum(['design', 'video']).optional(),
  quantity: z.number().int().min(1).max(999).optional(),
  // Optional skills/tools the business would like the talent to have. Forwarded
  // verbatim to squadhub. Descriptive only — never used to match talent.
  additional_requirements: z
    .record(z.string().trim().min(1).max(40), z.array(z.string().trim().min(1).max(80)).max(40))
    .optional(),
}).superRefine((value, ctx) => {
  if (value.request_type !== 'business_service') return;
  if (value.pricing_mode !== 'unpriced') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pricing_mode'], message: 'Business service requests must invite quotes.' });
  if (!value.work_type) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['work_type'], message: 'Select a type of work.' });
  if (value.pricing_basis !== 'per_unit') ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['pricing_basis'], message: 'Business services must be priced per unit.' });
  if (!value.unit) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['unit'], message: 'Select a quote unit.' });
});

export const connectBriefSchema = z
  .object({
    service_types: z
      .array(SERVICE_TYPE)
      .min(1, 'Pick at least one service.')
      .refine((arr) => new Set(arr).size === arr.length, {
        message: 'service_types must be unique',
      }),
    brand_name: z.string().trim().min(1).max(200),
    business_nature: z.string().trim().min(1).max(200),
    business_note: z.string().trim().min(1).max(2000),
    // Contact fields are optional here — the controller backfills them from the
    // authenticated business account when the client omits them.
    contact_name: z.string().trim().min(1).max(200).optional(),
    email: z.string().trim().email().max(200).optional(),
    phone: z.string().trim().min(4).max(30).optional(),
    business_location: z.string().trim().max(500).optional().or(z.literal('')),
    // Location is opt-in — the business can leave country empty ("Anywhere").
    country_id: z.string().uuid().optional(),
    state_regions: z.array(z.string().trim().min(1).max(100)).max(60).default([]),
    languages: z.array(z.string().trim().min(1).max(60)).min(1).max(20),
    working_days: z.array(z.string().trim().min(1).max(20)).max(7).default([]),
    // Optional requirement voice note (public R2 URL from the voice-upload
    // endpoint). Forwarded to squadhub as requirement_voice_url.
    requirement_voice_url: z.string().trim().url().max(1000).optional().or(z.literal('')),
    role_requirements: z.record(SERVICE_TYPE, roleRequirementSchema).optional(),
    card_type: z.enum(['subscription', 'assignment']).default('subscription'),
  })
  .superRefine((val, ctx) => {
    // Subscriptions need at least one working day (matches upstream).
    if (val.card_type !== 'assignment' && val.working_days.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['working_days'],
        message: 'Pick at least one working day.',
      });
    }
  });

export type ConnectBriefInput = z.infer<typeof connectBriefSchema>;
