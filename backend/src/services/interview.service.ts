import crypto from 'crypto';
import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type {
  CreateInterviewQuestionInput,
  UpdateInterviewQuestionInput,
  SubmitInterviewResponsesInput,
} from '../validators/interview.validators.js';

const INVITATION_TTL_DAYS = 7;

// ---------------------------------------------------------------------------
// Questions — admin CRUD
// ---------------------------------------------------------------------------

export async function listInterviewQuestions(formType: string, includeInactive = true) {
  let query = supabaseAdmin
    .from('interview_questions')
    .select('*')
    .eq('form_type', formType)
    .order('display_order', { ascending: true });

  if (!includeInactive) query = query.eq('is_active', true);

  const { data, error } = await query;
  if (error) throw new AppError(500, `Failed to list questions: ${error.message}`);
  return data ?? [];
}

export async function createInterviewQuestion(input: CreateInterviewQuestionInput) {
  // If display_order not provided, place at the end.
  let order = input.display_order;
  if (order === undefined) {
    const { data: last } = await supabaseAdmin
      .from('interview_questions')
      .select('display_order')
      .eq('form_type', input.form_type)
      .order('display_order', { ascending: false })
      .limit(1)
      .maybeSingle();
    order = (last?.display_order ?? 0) + 1;
  }

  const { data, error } = await supabaseAdmin
    .from('interview_questions')
    .insert({
      form_type: input.form_type,
      question_text: input.question_text,
      helper_text: input.helper_text ?? null,
      field_type: input.field_type ?? 'textarea',
      options: input.options ?? null,
      is_required: input.is_required ?? true,
      display_order: order,
    })
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to create question: ${error.message}`);
  return data;
}

export async function updateInterviewQuestion(id: string, input: UpdateInterviewQuestionInput) {
  const update: Record<string, unknown> = {};
  if (input.question_text !== undefined) update.question_text = input.question_text;
  if (input.helper_text !== undefined) update.helper_text = input.helper_text;
  if (input.field_type !== undefined) update.field_type = input.field_type;
  if (input.options !== undefined) update.options = input.options;
  if (input.is_required !== undefined) update.is_required = input.is_required;
  if (input.display_order !== undefined) update.display_order = input.display_order;
  if (input.is_active !== undefined) update.is_active = input.is_active;

  const { data, error } = await supabaseAdmin
    .from('interview_questions')
    .update(update)
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to update question: ${error.message}`);
  return data;
}

export async function deleteInterviewQuestion(id: string) {
  // Soft delete — preserves historical responses that reference this id.
  const { data, error } = await supabaseAdmin
    .from('interview_questions')
    .update({ is_active: false })
    .eq('id', id)
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to deactivate question: ${error.message}`);
  return data;
}

export async function reorderInterviewQuestions(formType: string, orderedIds: string[]) {
  // Assign display_order based on array position.
  const updates = orderedIds.map((id, idx) =>
    supabaseAdmin
      .from('interview_questions')
      .update({ display_order: idx + 1 })
      .eq('id', id)
      .eq('form_type', formType)
  );
  const results = await Promise.all(updates);
  const failed = results.find((r) => r.error);
  if (failed?.error) {
    throw new AppError(500, `Failed to reorder: ${failed.error.message}`);
  }
  return listInterviewQuestions(formType);
}

// ---------------------------------------------------------------------------
// Invitations — admin
// ---------------------------------------------------------------------------

function generateToken(): string {
  return crypto.randomBytes(24).toString('hex');
}

export async function createInvitation(leadId: string, adminUserId?: string) {
  // Verify lead exists (and pull form_type for the share message).
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('lead_submissions')
    .select('id, name, form_type')
    .eq('id', leadId)
    .single();
  if (leadErr || !lead) throw new AppError(404, 'Lead not found');

  const token = generateToken();
  const expiresAt = new Date(Date.now() + INVITATION_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();

  const { data, error } = await supabaseAdmin
    .from('interview_invitations')
    .insert({
      lead_id: leadId,
      token,
      expires_at: expiresAt,
      created_by: adminUserId ?? null,
    })
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to create invitation: ${error.message}`);
  return { invitation: data, lead };
}

export async function listInterviewInvitations(filters: {
  status?: 'submitted' | 'pending' | 'expired' | 'all';
  form_type?: string;
  search?: string;
  page?: number;
  limit?: number;
}) {
  const page = filters.page ?? 1;
  const limit = filters.limit ?? 25;
  const offset = (page - 1) * limit;
  const statusFilter = filters.status ?? 'submitted';
  const nowIso = new Date().toISOString();

  let query = supabaseAdmin
    .from('interview_invitations')
    .select(
      'id, lead_id, token, expires_at, submitted_at, responses, created_at, reviewed_at, reviewed_by, lead:lead_submissions!inner(name, phone, email, form_type)',
      { count: 'exact' }
    )
    .order('submitted_at', { ascending: false, nullsFirst: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1);

  if (statusFilter === 'submitted') {
    query = query.not('submitted_at', 'is', null);
  } else if (statusFilter === 'pending') {
    query = query.is('submitted_at', null).gte('expires_at', nowIso);
  } else if (statusFilter === 'expired') {
    query = query.is('submitted_at', null).lt('expires_at', nowIso);
  }

  if (filters.form_type) {
    query = query.eq('lead.form_type', filters.form_type);
  }

  if (filters.search) {
    const esc = filters.search.replace(/[%,]/g, '');
    // Supabase .or() on an embedded relationship uses the `referencedTable` option.
    query = query.or(
      `name.ilike.%${esc}%,email.ilike.%${esc}%,phone.ilike.%${esc}%`,
      { referencedTable: 'lead' }
    );
  }

  const { data, error, count } = await query;
  if (error) throw new AppError(500, `Failed to list invitations: ${error.message}`);

  const invitations = (data ?? []).map((row: any) => ({
    id: row.id,
    lead_id: row.lead_id,
    lead_name: row.lead?.name ?? '',
    lead_phone: row.lead?.phone ?? '',
    lead_email: row.lead?.email ?? null,
    form_type: row.lead?.form_type ?? '',
    created_at: row.created_at,
    expires_at: row.expires_at,
    submitted_at: row.submitted_at,
    reviewed_at: row.reviewed_at,
    reviewed_by: row.reviewed_by,
    response_count: row.responses ? Object.keys(row.responses).length : 0,
  }));

  return {
    invitations,
    total: count ?? 0,
    page,
    limit,
    total_pages: Math.ceil((count ?? 0) / limit),
  };
}

export async function setInvitationReviewed(
  invitationId: string,
  reviewed: boolean,
  adminUserId?: string
) {
  const update: Record<string, unknown> = {
    reviewed_at: reviewed ? new Date().toISOString() : null,
    reviewed_by: reviewed ? (adminUserId ?? null) : null,
  };

  const { data, error } = await supabaseAdmin
    .from('interview_invitations')
    .update(update)
    .eq('id', invitationId)
    .select('id, reviewed_at, reviewed_by')
    .single();

  if (error) throw new AppError(500, `Failed to update reviewed state: ${error.message}`);
  return data;
}

export async function getLatestInvitationForLead(leadId: string) {
  const { data, error } = await supabaseAdmin
    .from('interview_invitations')
    .select('*')
    .eq('lead_id', leadId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) throw new AppError(500, `Failed to fetch invitation: ${error.message}`);
  return data;
}

// ---------------------------------------------------------------------------
// Public — token lookup + submission
// ---------------------------------------------------------------------------

export async function getInvitationByToken(token: string) {
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from('interview_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (invErr) throw new AppError(500, `Failed to lookup invitation: ${invErr.message}`);
  if (!invitation) throw new AppError(404, 'Invalid interview link');

  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('lead_submissions')
    .select('id, name, email, phone, form_type')
    .eq('id', invitation.lead_id)
    .single();
  if (leadErr || !lead) throw new AppError(404, 'Lead not found');

  const questions = await listInterviewQuestions(lead.form_type, false);

  const now = Date.now();
  const expired = new Date(invitation.expires_at).getTime() < now;
  const submitted = !!invitation.submitted_at;

  const status: 'pending' | 'submitted' | 'expired' =
    submitted ? 'submitted' : expired ? 'expired' : 'pending';

  return {
    invitation,
    lead: {
      name: lead.name,
      email: lead.email,
      phone: lead.phone,
    },
    form_type: lead.form_type,
    questions,
    status,
  };
}

export async function submitInterviewResponses(
  token: string,
  input: SubmitInterviewResponsesInput
) {
  const { data: invitation, error: invErr } = await supabaseAdmin
    .from('interview_invitations')
    .select('*')
    .eq('token', token)
    .maybeSingle();
  if (invErr) throw new AppError(500, `Failed to lookup invitation: ${invErr.message}`);
  if (!invitation) throw new AppError(404, 'Invalid interview link');

  if (invitation.submitted_at) {
    throw new AppError(409, 'This interview has already been submitted');
  }
  if (new Date(invitation.expires_at).getTime() < Date.now()) {
    throw new AppError(410, 'This interview link has expired');
  }

  // Load lead for form_type → figure out active required questions.
  const { data: lead, error: leadErr } = await supabaseAdmin
    .from('lead_submissions')
    .select('form_type')
    .eq('id', invitation.lead_id)
    .single();
  if (leadErr || !lead) throw new AppError(404, 'Lead not found');

  const questions = await listInterviewQuestions(lead.form_type, false);

  // Validate required answers.
  for (const q of questions) {
    if (!q.is_required) continue;
    const answer = input.answers[q.id];
    const missing =
      answer === undefined ||
      answer === null ||
      (typeof answer === 'string' && answer.trim() === '') ||
      (q.field_type === 'acknowledge' && answer !== true);
    if (missing) {
      throw new AppError(400, `Question "${q.question_text}" is required`);
    }
  }

  // Drop answers that don't correspond to an active question (defense-in-depth).
  const validIds = new Set(questions.map((q) => q.id));
  const filtered: Record<string, unknown> = {};
  for (const [id, v] of Object.entries(input.answers)) {
    if (validIds.has(id)) filtered[id] = v;
  }

  const { data, error } = await supabaseAdmin
    .from('interview_invitations')
    .update({
      responses: filtered,
      submitted_at: new Date().toISOString(),
    })
    .eq('id', invitation.id)
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to save responses: ${error.message}`);
  return data;
}
