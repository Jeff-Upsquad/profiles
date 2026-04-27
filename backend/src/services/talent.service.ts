import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { UpdateProfileInput, UpdateTalentUserInput, UpdateBasicProfileInput } from '../validators/talent.validators.js';
import { parseVideoUrl, type VideoProvider } from '../../../shared/src/videoEmbed.js';
import { getAdminSetting } from './admin.service.js';

// ---------------------------------------------------------------------------
// Talent User
// ---------------------------------------------------------------------------

export async function getTalentUser(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .select('*')
    .eq('id', userId)
    .single();

  if (error || !data) throw new AppError(404, 'Talent user not found');
  return data;
}

export async function updateTalentUser(userId: string, input: UpdateTalentUserInput) {
  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .update(input)
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) throw new AppError(404, 'Talent user not found');
  return data;
}

// ---------------------------------------------------------------------------
// Basic Profile
// ---------------------------------------------------------------------------

export async function getBasicProfile(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles_basic')
    .select('*')
    .eq('talent_user_id', userId)
    .maybeSingle();

  if (error) throw new AppError(500, 'Failed to fetch basic profile');
  return data;
}

export async function updateBasicProfile(userId: string, input: UpdateBasicProfileInput) {
  // Upsert: insert if not exists, update if exists
  const { data, error } = await supabaseAdmin
    .from('talent_profiles_basic')
    .upsert(
      { ...input, talent_user_id: userId },
      { onConflict: 'talent_user_id' }
    )
    .select('*')
    .single();

  if (error) throw new AppError(500, `Failed to save basic profile: ${error.message}`);

  // Sync profile picture to talent_users so job profiles display it
  if (input.profile_picture_url !== undefined) {
    await supabaseAdmin
      .from('talent_users')
      .update({ profile_photo_url: input.profile_picture_url })
      .eq('id', userId);
  }

  return data;
}

// ---------------------------------------------------------------------------
// Lead Submission lookup (used to auto-populate signup from public form)
// ---------------------------------------------------------------------------

export async function getLeadSubmissionForTalent(userId: string) {
  const { data: user, error: userErr } = await supabaseAdmin
    .from('talent_users')
    .select('email')
    .eq('id', userId)
    .single();

  if (userErr || !user?.email) return null;

  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('id, form_type, form_data, created_at')
    .ilike('email', user.email)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

// ---------------------------------------------------------------------------
// Talent Profiles
// ---------------------------------------------------------------------------

export async function getMyProfiles(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('*, category:category_id(id, name, slug)')
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });

  if (error) throw new AppError(500, 'Failed to fetch profiles');
  return data;
}

export async function getProfile(profileId: string, userId: string) {
  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .select('*, category:category_id(id, name, slug)')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (error || !data) throw new AppError(404, 'Profile not found');
  return data;
}

export async function createProfile(
  userId: string,
  categoryId: string,
  fieldData?: Record<string, any>
) {
  // Check for existing non-deleted profile in this category
  const { data: existing } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('talent_user_id', userId)
    .eq('category_id', categoryId)
    .is('deleted_at', null)
    .maybeSingle();

  if (existing) {
    throw new AppError(409, 'You already have a profile in this category');
  }

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .insert({
      talent_user_id: userId,
      category_id: categoryId,
      status: 'draft',
      field_data: fieldData ?? {},
    })
    .select('*')
    .single();

  if (error) throw new AppError(500, 'Failed to create profile');
  return data;
}

export async function updateProfile(profileId: string, userId: string, input: UpdateProfileInput) {
  // Fetch the profile (must belong to user, not deleted)
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !profile) throw new AppError(404, 'Profile not found');

  // Validate field_data against category field definitions
  if (input.field_data) {
    const errors = await validateFieldData(profile.category_id, input.field_data);
    if (errors.length > 0) {
      throw new AppError(400, `Field validation failed: ${errors.join('; ')}`);
    }
  }

  // Determine new status
  let newStatus = profile.status;
  if (profile.status === 'approved' || profile.status === 'rejected') {
    newStatus = 'pending_review';
  }

  const updatePayload: Record<string, any> = {
    status: newStatus,
  };

  // Capture previous field_data + user data for admin review diffing
  // Save on first edit only (preserve baseline); skip drafts (nothing to compare)
  if (input.field_data && profile.status !== 'draft' && !profile.previous_field_data) {
    // Also snapshot talent_users data (languages, etc.) before it gets updated
    const { data: userData } = await supabaseAdmin
      .from('talent_users')
      .select('full_name, phone, age, gender, current_location, native_place, languages_spoken')
      .eq('id', userId)
      .single();
    updatePayload.previous_field_data = {
      ...profile.field_data,
      _user: userData,
    };
  }

  if (input.field_data) {
    updatePayload.field_data = input.field_data;
  }
  if (input.resume_url !== undefined) {
    updatePayload.resume_url = input.resume_url;
  }

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update(updatePayload)
    .eq('id', profileId)
    .select('*')
    .single();

  if (error) throw new AppError(500, 'Failed to update profile');
  return data;
}

export async function submitProfile(profileId: string, userId: string) {
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !profile) throw new AppError(404, 'Profile not found');

  if (profile.status !== 'draft' && profile.status !== 'rejected') {
    throw new AppError(400, 'Only draft or rejected profiles can be submitted');
  }

  // Validate all required fields have values
  const errors = await validateRequiredFields(profile.category_id, profile.field_data || {});
  if (errors.length > 0) {
    throw new AppError(400, `Cannot submit: ${errors.join('; ')}`);
  }

  // Auto-approve the talent user inline if the global setting is on and the
  // user is still pending. Lets the celebratory loading→approved overlay
  // resolve in a single round-trip.
  let didAutoApprove = false;
  const { data: talentUser } = await supabaseAdmin
    .from('talent_users')
    .select('approval_status')
    .eq('id', userId)
    .single();

  if (talentUser?.approval_status === 'pending') {
    const enabled = await getAdminSetting<boolean>('auto_approve_signups');
    if (enabled === true) {
      const { error: approveErr } = await supabaseAdmin
        .from('talent_users')
        .update({
          approval_status: 'approved',
          approved_at: new Date().toISOString(),
        })
        .eq('id', userId)
        .eq('approval_status', 'pending');
      if (approveErr) throw new AppError(500, `Auto-approval failed: ${approveErr.message}`);
      didAutoApprove = true;
    }
  }

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({ status: 'pending_review' })
    .eq('id', profileId)
    .select('*')
    .single();

  if (error) throw new AppError(500, 'Failed to submit profile');
  return { ...data, auto_approved: didAutoApprove };
}

export async function deactivateProfile(profileId: string, userId: string) {
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !profile) throw new AppError(404, 'Profile not found');

  if (profile.status !== 'approved') {
    throw new AppError(400, 'Only approved profiles can be deactivated');
  }

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({ status: 'inactive', is_active: false })
    .eq('id', profileId)
    .select('*')
    .single();

  if (error) throw new AppError(500, 'Failed to deactivate profile');
  return data;
}

export async function reactivateProfile(profileId: string, userId: string) {
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !profile) throw new AppError(404, 'Profile not found');

  if (profile.status !== 'inactive') {
    throw new AppError(400, 'Only inactive profiles can be reactivated');
  }

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({ status: 'pending_review', is_active: true })
    .eq('id', profileId)
    .select('*')
    .single();

  if (error) throw new AppError(500, 'Failed to reactivate profile');
  return data;
}

export async function softDeleteProfile(profileId: string, userId: string) {
  const { data: profile, error: fetchErr } = await supabaseAdmin
    .from('talent_profiles')
    .select('*')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (fetchErr || !profile) throw new AppError(404, 'Profile not found');

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({ deleted_at: new Date().toISOString(), status: 'deleted' })
    .eq('id', profileId)
    .select('*')
    .single();

  if (error) throw new AppError(500, 'Failed to delete profile');
  return data;
}

// ---------------------------------------------------------------------------
// Portfolio Items
// ---------------------------------------------------------------------------

export async function getPortfolioItems(profileId: string, userId: string) {
  // Verify ownership
  const { data: profile } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (!profile) throw new AppError(404, 'Profile not found');

  const { data, error } = await supabaseAdmin
    .from('portfolio_items')
    .select('*')
    .eq('profile_id', profileId)
    .order('skill_name', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, 'Failed to fetch portfolio items');
  return data;
}

interface AddPortfolioItemInput {
  skill_name: string;
  file_url?: string;
  file_type: string;
  file_name: string;
  // Link-source fields (required when source_type === 'link')
  source_type?: 'upload' | 'link';
  provider?: string;
  external_url?: string;
  embed_url?: string;
}

export async function addPortfolioItem(
  profileId: string,
  userId: string,
  input: AddPortfolioItemInput
) {
  const { data: profile } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (!profile) throw new AppError(404, 'Profile not found');

  // Build the row to insert. Link rows require server-side re-validation of
  // the parsed URL — we never trust the client's `embed_url`/`provider`.
  let row: Record<string, unknown>;

  if (input.source_type === 'link') {
    if (!input.external_url) {
      throw new AppError(400, 'external_url is required for link portfolio items');
    }
    const parsed = parseVideoUrl(input.external_url);
    if (!parsed) {
      throw new AppError(
        400,
        'Unsupported video link. Paste a YouTube URL or upload your video directly.'
      );
    }
    // Reject if the client tried to forge a different provider/embed_url
    // than what the parser would derive from the external_url.
    if (input.provider && input.provider !== parsed.provider) {
      throw new AppError(400, 'Provider does not match the parsed URL');
    }
    if (input.embed_url && input.embed_url !== parsed.embedUrl) {
      throw new AppError(400, 'embed_url does not match the parsed URL');
    }

    // YouTube thumbnails are deterministic — parseVideoUrl already populates
    // them. No network calls needed.
    const thumbnailUrl: string | null = parsed.thumbnailUrl ?? null;

    row = {
      profile_id: profileId,
      skill_name: input.skill_name,
      file_type: 'video',
      file_name: input.file_name,
      // Mirror embed_url into file_url so legacy reads keep working.
      file_url: parsed.embedUrl,
      source_type: 'link',
      provider: parsed.provider satisfies VideoProvider,
      external_url: parsed.externalUrl,
      embed_url: parsed.embedUrl,
      thumbnail_url: thumbnailUrl,
    };
  } else {
    // Upload path — strip any link-only fields the client may have sent.
    if (!input.file_url) {
      throw new AppError(400, 'file_url is required for uploaded portfolio items');
    }
    row = {
      profile_id: profileId,
      skill_name: input.skill_name,
      file_url: input.file_url,
      file_type: input.file_type,
      file_name: input.file_name,
      source_type: 'upload',
    };
  }

  const { data, error } = await supabaseAdmin
    .from('portfolio_items')
    .insert(row)
    .select()
    .single();

  if (error) throw new AppError(500, `Failed to add portfolio item: ${error.message}`);
  return data;
}

export async function deletePortfolioItem(profileId: string, userId: string, itemId: string) {
  const { data: profile } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (!profile) throw new AppError(404, 'Profile not found');

  const { error } = await supabaseAdmin
    .from('portfolio_items')
    .delete()
    .eq('id', itemId)
    .eq('profile_id', profileId);

  if (error) throw new AppError(500, 'Failed to delete portfolio item');
  return { message: 'Portfolio item deleted' };
}

export async function reorderPortfolioItems(profileId: string, userId: string, items: { id: string; sort_order: number }[]) {
  const { data: profile } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (!profile) throw new AppError(404, 'Profile not found');

  const updates = items.map((item) =>
    supabaseAdmin
      .from('portfolio_items')
      .update({ sort_order: item.sort_order })
      .eq('id', item.id)
      .eq('profile_id', profileId)
  );

  await Promise.all(updates);
  return { message: 'Portfolio items reordered' };
}

// ---------------------------------------------------------------------------
// Dynamic field validation helpers
// ---------------------------------------------------------------------------

async function validateFieldData(categoryId: string, fieldData: Record<string, any>): Promise<string[]> {
  const { data: fields } = await supabaseAdmin
    .from('category_fields')
    .select('*, field_options(*)')
    .eq('category_id', categoryId)
    .eq('is_active', true);

  if (!fields) return [];

  const errors: string[] = [];

  for (const field of fields) {
    const value = fieldData[field.field_key];

    // Check required
    if (field.is_required && (value === undefined || value === null || value === '')) {
      errors.push(`${field.field_label} is required`);
      continue;
    }

    if (value === undefined || value === null) continue;

    // Type validation
    switch (field.field_type) {
      case 'text':
      case 'textarea':
      case 'email':
      case 'phone':
        if (typeof value !== 'string') errors.push(`${field.field_label} must be text`);
        if (field.validation_rules?.maxLength && typeof value === 'string' && value.length > field.validation_rules.maxLength) {
          errors.push(`${field.field_label} exceeds max length`);
        }
        break;
      case 'number':
      case 'currency':
        if (typeof value !== 'number') errors.push(`${field.field_label} must be a number`);
        if (field.validation_rules?.min !== undefined && value < field.validation_rules.min) {
          errors.push(`${field.field_label} must be at least ${field.validation_rules.min}`);
        }
        if (field.validation_rules?.max !== undefined && value > field.validation_rules.max) {
          errors.push(`${field.field_label} must be at most ${field.validation_rules.max}`);
        }
        break;
      case 'select': {
        const validValues = (field.field_options || []).filter((o: any) => o.is_active).map((o: any) => o.value);
        if (!validValues.includes(value)) errors.push(`${field.field_label} has invalid selection`);
        break;
      }
      case 'multi_select': {
        if (!Array.isArray(value)) {
          errors.push(`${field.field_label} must be an array`);
          break;
        }
        const validMulti = (field.field_options || []).filter((o: any) => o.is_active).map((o: any) => o.value);
        for (const v of value) {
          if (!validMulti.includes(v)) errors.push(`${field.field_label} contains invalid option: ${v}`);
        }
        break;
      }
      case 'file_upload':
        if (typeof value !== 'string') errors.push(`${field.field_label} must be a URL string`);
        break;
      case 'date':
        if (typeof value !== 'string' || isNaN(Date.parse(value))) {
          errors.push(`${field.field_label} must be a valid date`);
        }
        break;
    }
  }

  return errors;
}

async function validateRequiredFields(categoryId: string, fieldData: Record<string, any>): Promise<string[]> {
  const { data: fields } = await supabaseAdmin
    .from('category_fields')
    .select('field_key, field_label, is_required')
    .eq('category_id', categoryId)
    .eq('is_active', true)
    .eq('is_required', true);

  if (!fields) return [];

  const errors: string[] = [];

  for (const field of fields) {
    const value = fieldData[field.field_key];
    if (value === undefined || value === null || value === '') {
      errors.push(`${field.field_label} is required`);
    }
  }

  return errors;
}

// ---------------------------------------------------------------------------
// Public: Categories
// ---------------------------------------------------------------------------

export async function getActiveCategories() {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('id, name, slug, description, icon_url, is_active')
    .eq('is_active', true)
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, 'Failed to fetch categories');
  return data;
}

export async function getCategoryBySlug(slug: string) {
  const { data, error } = await supabaseAdmin
    .from('categories')
    .select('*, category_fields!category_id(*, field_options(*))')
    .eq('slug', slug)
    .eq('is_active', true)
    .single();

  if (error || !data) throw new AppError(404, 'Category not found');

  // Filter to only active fields and active options
  data.category_fields = (data.category_fields || [])
    .filter((f: any) => f.is_active)
    .map((f: any) => ({
      ...f,
      field_options: (f.field_options || []).filter((o: any) => o.is_active),
    }));

  return data;
}
