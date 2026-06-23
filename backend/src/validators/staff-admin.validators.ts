import { z } from 'zod';
import {
  CANDIDATE_CATEGORY_VALUES,
  CANDIDATE_SECTION_VALUES,
} from '../../../shared/src/types/access.js';

const permission = z.enum(['view', 'edit', 'full', 'admin']);

// Intra-module scope (candidates). Empty/omitted dimension = unrestricted.
const candidateScopeSchema = z
  .object({
    categories: z.array(z.string()).optional(),
    sections: z.array(z.string()).optional(),
  })
  .refine(
    (s) => (s.categories ?? []).every((c) => (CANDIDATE_CATEGORY_VALUES as string[]).includes(c)),
    { message: 'Unknown candidate category' },
  )
  .refine(
    (s) => (s.sections ?? []).every((sec) => (CANDIDATE_SECTION_VALUES as string[]).includes(sec)),
    { message: 'Unknown candidate section' },
  );

export const createStaffSchema = z.object({
  email: z.string().email('A valid email is required'),
  name: z.string().min(1, 'Name is required').max(120),
  password: z.string().min(8, 'Password must be at least 8 characters'),
});

export const createStaffFromSquadhubSchema = z.object({
  squadhub_user_id: z.string().uuid('A valid SquadHub user is required'),
  email: z.string().email('A valid email is required'),
  name: z.string().min(1, 'Name is required').max(120),
});

export const updateStaffSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    is_active: z.boolean().optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  })
  .refine((v) => v.name !== undefined || v.is_active !== undefined || v.password !== undefined, {
    message: 'Provide at least one field to update',
  });

export const putGrantsSchema = z.object({
  grants: z
    .array(
      z.object({
        module_slug: z.string().min(1),
        permission,
        scope: candidateScopeSchema.nullish(),
      }),
    )
    .max(100),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type CreateStaffFromSquadhubInput = z.infer<typeof createStaffFromSquadhubSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type PutGrantsInput = z.infer<typeof putGrantsSchema>;
