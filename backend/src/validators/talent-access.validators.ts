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

/**
 * Coerces a comma-separated query string (`?tier=junior,pro`) into an array.
 * Supports both `?tier=junior,pro` and a single value (`?tier=junior`).
 */
const csvArray = <T extends z.ZodTypeAny>(item: T) =>
  z
    .preprocess((v) => {
      if (v === undefined || v === null || v === '') return undefined;
      if (Array.isArray(v)) return v;
      if (typeof v === 'string') {
        const parts = v.split(',').map((p) => p.trim()).filter(Boolean);
        return parts.length === 0 ? undefined : parts;
      }
      return v;
    }, z.array(item).min(1).optional())
    .optional();

export const profilesQuerySchema = z.object({
  category_id: z.string().uuid('category_id is required'),
  tier: csvArray(z.enum(TIER_VALUES)),
  // `location` is the legacy free-text current_location filter on talent_users.
  // Kept for backwards compat — the new structured filters below are sourced
  // from talent_profiles_basic (country/state/current_district).
  location: csvArray(z.string().trim().min(1)),
  country: csvArray(z.string().trim().min(1)),
  state: csvArray(z.string().trim().min(1)),
  district: csvArray(z.string().trim().min(1)),
  language: csvArray(z.string().trim().min(1)),
  skill: csvArray(z.string().trim().min(1)),
  ai_tool: csvArray(z.string().trim().min(1)),
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
