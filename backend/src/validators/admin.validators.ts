import { z } from 'zod';

// ---------------------------------------------------------------------------
// Category schemas
// ---------------------------------------------------------------------------

export const createCategorySchema = z.object({
  name: z.string().min(1, 'Category name is required').max(100),
  description: z.string().max(500).optional(),
  icon_url: z.string().url().optional(),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

export const updateCategorySchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).optional(),
  icon_url: z.string().url().optional().or(z.literal('')),
  is_active: z.boolean().optional(),
  sort_order: z.number().int().min(0).optional(),
});

// ---------------------------------------------------------------------------
// Category field schemas
// ---------------------------------------------------------------------------

const fieldTypeEnum = z.enum([
  'text',
  'textarea',
  'number',
  'currency',
  'email',
  'phone',
  'select',
  'multi_select',
  'file_upload',
  'date',
]);

export const createFieldSchema = z.object({
  field_key: z.string().min(1, 'field_key is required').max(100),
  field_label: z.string().min(1, 'field_label is required').max(200),
  field_type: fieldTypeEnum,
  is_required: z.boolean().optional(),
  placeholder: z.string().max(300).optional(),
  helper_text: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  validation_rules: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().int().optional(),
      maxLength: z.number().int().optional(),
      pattern: z.string().optional(),
      maxFileSize: z.number().optional(),
      allowedFileTypes: z.array(z.string()).optional(),
    })
    .optional(),
});

export const updateFieldSchema = z.object({
  field_key: z.string().min(1).max(100).optional(),
  field_label: z.string().min(1).max(200).optional(),
  field_type: fieldTypeEnum.optional(),
  is_required: z.boolean().optional(),
  placeholder: z.string().max(300).optional(),
  helper_text: z.string().max(500).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
  validation_rules: z
    .object({
      min: z.number().optional(),
      max: z.number().optional(),
      minLength: z.number().int().optional(),
      maxLength: z.number().int().optional(),
      pattern: z.string().optional(),
      maxFileSize: z.number().optional(),
      allowedFileTypes: z.array(z.string()).optional(),
    })
    .optional(),
});

// ---------------------------------------------------------------------------
// Field option schemas
// ---------------------------------------------------------------------------

export const createOptionSchema = z.object({
  label: z.string().min(1, 'Label is required').max(200),
  value: z.string().min(1, 'Value is required').max(200),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const updateOptionSchema = z.object({
  label: z.string().min(1).max(200).optional(),
  value: z.string().min(1).max(200).optional(),
  sort_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

// ---------------------------------------------------------------------------
// Reorder schema
// ---------------------------------------------------------------------------

export const reorderSchema = z.object({
  items: z
    .array(
      z.object({
        id: z.string().uuid('Each item id must be a valid UUID'),
        sort_order: z.number().int().min(0),
      })
    )
    .min(1, 'At least one item is required'),
});

// ---------------------------------------------------------------------------
// Pagination schema (applied to query params)
// ---------------------------------------------------------------------------

export const paginationSchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().optional(),
});

// ---------------------------------------------------------------------------
// Inferred types
// ---------------------------------------------------------------------------

export type CreateCategoryInput = z.infer<typeof createCategorySchema>;
export type UpdateCategoryInput = z.infer<typeof updateCategorySchema>;
export type CreateFieldInput = z.infer<typeof createFieldSchema>;
export type UpdateFieldInput = z.infer<typeof updateFieldSchema>;
export type CreateOptionInput = z.infer<typeof createOptionSchema>;
export type UpdateOptionInput = z.infer<typeof updateOptionSchema>;
export type ReorderInput = z.infer<typeof reorderSchema>;
export type PaginationInput = z.infer<typeof paginationSchema>;
