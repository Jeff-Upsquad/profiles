import { z } from 'zod';

const TIER_VALUES = ['junior', 'pro', 'elite', 'custom'] as const;

// ---------------------------------------------------------------------------
// Admin: grant management
// ---------------------------------------------------------------------------

export const createGrantSchema = z.object({
  email: z.string().email('Valid email is required'),
  expires_at: z.string().datetime().optional(),
  category_ids: z
    .array(z.string().uuid('category_ids must be UUIDs'))
    .min(1, 'At least one category is required'),
  notes: z.string().max(500).optional(),
});

export const updateGrantSchema = z
  .object({
    expires_at: z.string().datetime().optional(),
    category_ids: z.array(z.string().uuid()).min(1).optional(),
    notes: z.string().max(500).nullable().optional(),
  })
  .refine(
    (v) =>
      v.expires_at !== undefined ||
      v.category_ids !== undefined ||
      v.notes !== undefined,
    { message: 'At least one field must be provided' }
  );

export const extendGrantSchema = z.object({
  days: z.number().int().min(1).max(365),
});

export const listGrantsQuerySchema = z.object({
  status: z.enum(['active', 'expired', 'revoked', 'all']).default('active'),
  search: z.string().trim().optional(),
});

// ---------------------------------------------------------------------------
// Public: login + browse
// ---------------------------------------------------------------------------

export const loginSchema = z.object({
  email: z.string().email('Valid email is required'),
});

export const profilesQuerySchema = z.object({
  category_id: z.string().uuid('category_id is required'),
  tier: z.enum(TIER_VALUES).optional(),
  location: z.string().trim().min(1).optional(),
  language: z.string().trim().min(1).optional(),
  skill: z.string().trim().min(1).optional(),
  ai_tool: z.string().trim().min(1).optional(),
  search: z.string().trim().min(1).optional(),
  page: z.coerce.number().int().min(1).default(1),
});

export const filterOptionsQuerySchema = z.object({
  category_id: z.string().uuid('category_id is required'),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateGrantInput = z.infer<typeof createGrantSchema>;
export type UpdateGrantInput = z.infer<typeof updateGrantSchema>;
export type ExtendGrantInput = z.infer<typeof extendGrantSchema>;
export type ListGrantsQuery = z.infer<typeof listGrantsQuerySchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type ProfilesQuery = z.infer<typeof profilesQuerySchema>;
export type FilterOptionsQuery = z.infer<typeof filterOptionsQuerySchema>;

export const TIERS = TIER_VALUES;
export type Tier = (typeof TIER_VALUES)[number];
