import { z } from 'zod';

export const INTERVIEW_FIELD_TYPES = ['textarea', 'text', 'yes_no', 'acknowledge'] as const;

export const createInterviewQuestionSchema = z.object({
  form_type: z.string().min(1, 'form_type is required'),
  question_text: z.string().min(1, 'Question text is required').max(1000),
  helper_text: z.string().max(500).optional().nullable(),
  field_type: z.enum(INTERVIEW_FIELD_TYPES).default('textarea'),
  options: z.any().optional().nullable(),
  is_required: z.boolean().optional().default(true),
  display_order: z.number().int().min(0).optional(),
});

export const updateInterviewQuestionSchema = z.object({
  question_text: z.string().min(1).max(1000).optional(),
  helper_text: z.string().max(500).nullable().optional(),
  field_type: z.enum(INTERVIEW_FIELD_TYPES).optional(),
  options: z.any().nullable().optional(),
  is_required: z.boolean().optional(),
  display_order: z.number().int().min(0).optional(),
  is_active: z.boolean().optional(),
});

export const reorderInterviewQuestionsSchema = z.object({
  form_type: z.string().min(1),
  order: z.array(z.string().uuid()).min(1),
});

export const submitInterviewResponsesSchema = z.object({
  answers: z.record(z.string().uuid(), z.union([z.string(), z.boolean()])),
});

export type CreateInterviewQuestionInput = z.infer<typeof createInterviewQuestionSchema>;
export type UpdateInterviewQuestionInput = z.infer<typeof updateInterviewQuestionSchema>;
export type ReorderInterviewQuestionsInput = z.infer<typeof reorderInterviewQuestionsSchema>;
export type SubmitInterviewResponsesInput = z.infer<typeof submitInterviewResponsesSchema>;
