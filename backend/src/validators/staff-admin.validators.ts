import { z } from 'zod';

const permission = z.enum(['view', 'edit', 'full', 'admin']);

export const createStaffSchema = z.object({
  email: z.string().email('A valid email is required'),
  name: z.string().min(1, 'Name is required').max(120),
  password: z.string().min(8, 'Password must be at least 8 characters'),
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
      }),
    )
    .max(100),
});

export type CreateStaffInput = z.infer<typeof createStaffSchema>;
export type UpdateStaffInput = z.infer<typeof updateStaffSchema>;
export type PutGrantsInput = z.infer<typeof putGrantsSchema>;
