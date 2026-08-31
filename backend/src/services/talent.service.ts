import { supabaseAdmin } from '../config/supabase.js';
import { AppError } from '../middleware/errorHandler.middleware.js';
import type { UpdateProfileInput, UpdateTalentUserInput, UpdateBasicProfileInput } from '../validators/talent.validators.js';
import { parseVideoUrl, type VideoProvider } from '../../../shared/src/videoEmbed.js';
import {
  isGhostCategory,
  isGhostSourceCategory,
  syncGhostForTalent,
} from './ghost-profile.service.js';
import { pushShcrmIdentityNames } from '../lib/crm-identity-names.js';

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

/**
 * Completed years between a YYYY-MM-DD date of birth and today — age in whole
 * years only, never rounded up by months. Returns null for an unparseable date.
 */
export function ageFromDob(dob: string): number | null {
  const b = new Date(`${dob}T00:00:00Z`);
  if (Number.isNaN(b.getTime())) return null;
  const now = new Date();
  let age = now.getUTCFullYear() - b.getUTCFullYear();
  const m = now.getUTCMonth() - b.getUTCMonth();
  if (m < 0 || (m === 0 && now.getUTCDate() < b.getUTCDate())) age--;
  return age;
}

export async function updateTalentUser(userId: string, input: UpdateTalentUserInput) {
  const patch: Record<string, unknown> = { ...input };

  // Date of birth is the source of truth for age. When a valid DOB is provided,
  // derive age (completed years) and persist it too, so every site that reads
  // talent_users.age keeps working unchanged. A null/absent DOB never wipes an
  // existing age (e.g. ages backfilled from the application form).
  if (typeof input.date_of_birth === 'string' && input.date_of_birth) {
    const derived = ageFromDob(input.date_of_birth);
    if (derived !== null) patch.age = derived;
  }

  const { data, error } = await supabaseAdmin
    .from('talent_users')
    .update(patch)
    .eq('id', userId)
    .select('*')
    .single();

  if (error || !data) throw new AppError(404, 'Talent user not found');

  if (input.full_name) {
    void pushShcrmIdentityNames({
      phone: (data as { phone?: string | null }).phone,
      person_name: input.full_name,
    });
  }

  // languages/age/gender changes can unlock new cards
  try {
    const { backfillCardsForTalent } = await import('./card-backfill.service.js');
    backfillCardsForTalent(userId).catch((e) => console.error('[card-backfill] talentUser backfill failed', e));
  } catch {}

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

  // A now-complete basic profile may advance the candidate's pipeline stage.
  try {
    const { syncOnboardingStage } = await import('./automation.service.js');
    await syncOnboardingStage(userId);
  } catch (e) {
    console.error('[automation] syncOnboardingStage failed:', e);
  }

  // Location/language changes can make new cards match — backfill
  try {
    const { backfillCardsForTalent } = await import('./card-backfill.service.js');
    backfillCardsForTalent(userId).catch((e) => console.error('[card-backfill] basicProfile backfill failed', e));
  } catch {}

  return data;
}

// ---------------------------------------------------------------------------
// Lead Submission lookup (used to auto-populate signup from public form)
// ---------------------------------------------------------------------------

export async function getLeadSubmissionForTalent(userId: string) {
  const { data, error } = await supabaseAdmin
    .from('lead_submissions')
    .select('id, form_type, form_data, created_at')
    .eq('linked_talent_user_id', userId)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) return null;
  return data;
}

// ---------------------------------------------------------------------------
// Onboarding progress (talent self) — 5-stage strip for the talent dashboard
// ---------------------------------------------------------------------------

// Columns we read off `talent_profiles_basic` to decide whether the
// basic-profile stage is complete. Kept in sync with the per-section
// completion rules in `frontend/src/views/talent/BasicProfileForm.tsx`.
const BASIC_PROFILE_MANDATORY_COLUMNS =
  'created_at, permanent_country, permanent_state, permanent_district, permanent_city, ' +
  'availability, job_type, employment_type, virtual_office_hours, daily_available_hours, ' +
  'freelance_available, education_courses, experience, profile_picture_url, resume_url';

// Returns true when every mandatory section of the basic profile is
// filled in. Mirrors the `completion` object in BasicProfileForm.tsx so
// the 5-stage strip on the talent dashboard and the admin views can
// agree on what "done" means.
export function isBasicProfileMandatoryComplete(
  basic: Record<string, any> | null,
  talent: { full_name: string | null; languages_spoken: unknown },
): boolean {
  if (!basic) return false;

  if (!talent.full_name || !talent.full_name.trim()) return false;

  const langs = Array.isArray(talent.languages_spoken)
    ? (talent.languages_spoken as Array<{ proficiency?: string }>)
    : [];
  if (langs.length === 0 || !langs.some((l) => l?.proficiency === 'native')) return false;

  if (
    !basic.permanent_country ||
    !basic.permanent_state ||
    !basic.permanent_district ||
    !basic.permanent_city
  ) {
    return false;
  }

  // Education & Courses and Experience are mandatory for everyone.
  const courses = Array.isArray(basic.education_courses)
    ? (basic.education_courses as Array<{ course_name?: string; institution?: string }>)
    : [];
  if (
    courses.length === 0 ||
    !courses.some((c) => !!c?.course_name?.trim() && !!c?.institution?.trim())
  ) {
    return false;
  }

  const experiences = Array.isArray(basic.experience)
    ? (basic.experience as Array<{ company_name?: string; designation?: string }>)
    : [];
  if (
    experiences.length === 0 ||
    !experiences.some((e) => !!e?.company_name?.trim() && !!e?.designation?.trim())
  ) {
    return false;
  }

  if (!basic.profile_picture_url) return false;

  // Work-preference-gated sections. ID proofs and bank account are always
  // optional; resume is mandatory only for salary (job-seeking) talent.
  const employment = Array.isArray(basic.employment_type)
    ? (basic.employment_type as string[])
    : [];

  if (employment.includes('salary')) {
    if (!Array.isArray(basic.availability) || basic.availability.length === 0) return false;
    if (!Array.isArray(basic.job_type) || basic.job_type.length === 0) return false;
    if (!basic.resume_url) return false;
  }

  if (employment.includes('freelance')) {
    if (!basic.freelance_available) return false;
  }

  if (employment.includes('partner_program')) {
    const office = Array.isArray(basic.virtual_office_hours) ? basic.virtual_office_hours : [];
    if (!office.some((h: any) => h?.from && h?.to)) return false;
    const daily = Array.isArray(basic.daily_available_hours) ? basic.daily_available_hours : [];
    if (!daily.some((d: any) => typeof d?.hours === 'number' && d.hours > 0)) return false;
  }

  return true;
}

// Computes the 5 onboarding-progress booleans (+ bypass flag + the timestamps
// the dashboard needs) for a talent. Single source of truth reused by the
// talent dashboard strip, the admin lead drawer, and the stage auto-advance.
// Returns all-false (signed_up=false) when the talent row doesn't exist.
export async function computeOnboardingProgress(userId: string): Promise<{
  signed_up: boolean;
  onboarding_completed: boolean;
  onboarding_bypassed: boolean;
  basic_profile_completed: boolean;
  job_profile_completed: boolean;
  portfolio_completed: boolean;
  timestamps: {
    basic_created_at: string | null;
    earliest_submitted_profile_at: string | null;
    earliest_portfolio_at: string | null;
  };
}> {
  const empty = {
    signed_up: false,
    onboarding_completed: false,
    onboarding_bypassed: false,
    basic_profile_completed: false,
    job_profile_completed: false,
    portfolio_completed: false,
    timestamps: {
      basic_created_at: null,
      earliest_submitted_profile_at: null,
      earliest_portfolio_at: null,
    },
  };

  const { data: talent } = await supabaseAdmin
    .from('talent_users')
    .select('id, full_name, languages_spoken, onboarding_completed, skip_onboarding')
    .eq('id', userId)
    .maybeSingle();
  if (!talent) return empty;

  const [basicRes, profilesRes] = await Promise.all([
    supabaseAdmin
      .from('talent_profiles_basic')
      .select(BASIC_PROFILE_MANDATORY_COLUMNS)
      .eq('talent_user_id', userId)
      .maybeSingle(),
    supabaseAdmin
      .from('talent_profiles')
      .select('id, created_at, status')
      .eq('talent_user_id', userId)
      .is('deleted_at', null)
      .order('created_at', { ascending: true }),
  ]);

  const basic = (basicRes.data ?? null) as Record<string, any> | null;
  const profiles = (profilesRes.data ?? []) as { id: string; created_at: string; status: string }[];
  // A job profile counts as "complete" only once submitted (pending_review) or
  // approved. `draft` and `rejected` profiles do not flip the tick on.
  const submittedProfiles = profiles.filter(
    (p) => p.status === 'approved' || p.status === 'pending_review',
  );
  const profileIds = profiles.map((p) => p.id);

  let earliestPortfolioCreatedAt: string | null = null;
  if (profileIds.length > 0) {
    const { data: portfolio } = await supabaseAdmin
      .from('portfolio_items')
      .select('created_at')
      .in('profile_id', profileIds)
      .order('created_at', { ascending: true })
      .limit(1);
    earliestPortfolioCreatedAt = portfolio?.[0]?.created_at ?? null;
  }

  return {
    signed_up: true,
    // An admin-set skip_onboarding flag exempts the talent from the course
    // without rewriting onboarding_completed.
    onboarding_completed: !!talent.onboarding_completed || !!talent.skip_onboarding,
    onboarding_bypassed: !!talent.skip_onboarding,
    basic_profile_completed: isBasicProfileMandatoryComplete(basic, {
      full_name: talent.full_name ?? null,
      languages_spoken: talent.languages_spoken,
    }),
    job_profile_completed: submittedProfiles.length > 0,
    portfolio_completed: !!earliestPortfolioCreatedAt,
    timestamps: {
      basic_created_at: (basic?.created_at ?? null) as string | null,
      earliest_submitted_profile_at: submittedProfiles[0]?.created_at ?? null,
      earliest_portfolio_at: earliestPortfolioCreatedAt,
    },
  };
}

export async function getMyOnboardingProgress(userId: string) {
  const p = await computeOnboardingProgress(userId);
  if (!p.signed_up) throw new AppError(404, 'Talent user not found');

  const progress = {
    signed_up: p.signed_up,
    onboarding_completed: p.onboarding_completed,
    basic_profile_completed: p.basic_profile_completed,
    job_profile_completed: p.job_profile_completed,
    portfolio_completed: p.portfolio_completed,
  };

  const allCompleted =
    progress.onboarding_completed &&
    progress.basic_profile_completed &&
    progress.job_profile_completed &&
    progress.portfolio_completed;

  let allCompletedAt: string | null = null;
  if (allCompleted) {
    const candidates = [
      p.timestamps.basic_created_at,
      p.timestamps.earliest_submitted_profile_at,
      p.timestamps.earliest_portfolio_at,
    ].filter((t): t is string => !!t);
    if (candidates.length > 0) {
      allCompletedAt = candidates.reduce((max, t) =>
        new Date(t).getTime() > new Date(max).getTime() ? t : max,
      );
    }
  }

  return {
    progress,
    all_completed_at: allCompletedAt,
  };
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

  // Ghost rows carry no field_data of their own — embed the two source
  // profiles (Designer + Video Editor) and their portfolios so the
  // talent's view can render the combined "Designer + Editor" listing
  // with a tab switcher, mirroring what businesses see.
  if ((data as any).is_ghost === true) {
    const designerId = (data as any).source_designer_profile_id as string | null;
    const editorId = (data as any).source_editor_profile_id as string | null;
    const ids = [designerId, editorId].filter((v): v is string => !!v);
    if (ids.length > 0) {
      const [{ data: sources, error: srcErr }, { data: portfolio, error: pfErr }] =
        await Promise.all([
          supabaseAdmin
            .from('talent_profiles')
            .select('*, category:category_id(id, name, slug)')
            .in('id', ids)
            .is('deleted_at', null),
          supabaseAdmin
            .from('portfolio_items')
            .select('*, portfolio_item_skills(skill_name)')
            .in('profile_id', ids)
            .order('category_name', { ascending: true })
            .order('skill_name', { ascending: true })
            .order('sort_order', { ascending: true }),
        ]);
      if (srcErr) throw new AppError(500, 'Failed to load ghost source profiles');
      if (pfErr) throw new AppError(500, 'Failed to load ghost source portfolio');

      const portfolioByProfile: Record<string, any[]> = {};
      for (const row of (portfolio ?? []) as any[]) {
        const { portfolio_item_skills, ...rest } = row;
        const item = {
          ...rest,
          skills: Array.isArray(portfolio_item_skills)
            ? portfolio_item_skills.map((s: { skill_name: string }) => s.skill_name)
            : [],
        };
        const pid = rest.profile_id as string;
        if (!portfolioByProfile[pid]) portfolioByProfile[pid] = [];
        portfolioByProfile[pid].push(item);
      }

      const sourceProfiles = (sources ?? []).map((p: any) => ({
        id: p.id,
        category_id: p.category_id,
        category: p.category,
        status: p.status,
        field_data: p.field_data,
        created_at: p.created_at,
        updated_at: p.updated_at,
        portfolio_items: portfolioByProfile[p.id] ?? [],
      }));
      // Designer first, then Video Editor — matches the "Designer + Editor" label.
      sourceProfiles.sort((a, b) =>
        a.category?.slug === 'designer' ? -1 : b.category?.slug === 'designer' ? 1 : 0,
      );
      return { ...data, source_profiles: sourceProfiles };
    }
  }

  return data;
}

export async function createProfile(
  userId: string,
  categoryId: string,
  fieldData?: Record<string, any>
) {
  // Block direct creation of the Designer + Editor combined profile —
  // talents pick Designer and Video Editor separately, and the ghost
  // profile service auto-generates a virtual combined entry. The
  // frontend already hides this category, but we enforce it here too
  // as defense in depth.
  if (await isGhostCategory(categoryId)) {
    throw new AppError(
      400,
      'The Designer + Editor profile is generated automatically when you have both a Designer and a Video Editor profile.'
    );
  }

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

  // If this is a Designer or Video Editor profile, the ghost service
  // may need to (re)build the combined ghost row.
  if (await isGhostSourceCategory(categoryId)) {
    await syncGhostForTalent(userId);
  }

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

  // Status may have flipped from approved → pending_review on edit. If
  // this is a ghost source profile, the ghost's mirrored status needs
  // to be recomputed.
  if (await isGhostSourceCategory(profile.category_id)) {
    await syncGhostForTalent(userId);
  }

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

  const { data, error } = await supabaseAdmin
    .from('talent_profiles')
    .update({ status: 'pending_review' })
    .eq('id', profileId)
    .select('*')
    .single();

  if (error) throw new AppError(500, 'Failed to submit profile');

  if (await isGhostSourceCategory(profile.category_id)) {
    await syncGhostForTalent(userId);
  }

  // Submitting a job profile may advance the candidate's pipeline stage.
  try {
    const { syncOnboardingStage } = await import('./automation.service.js');
    await syncOnboardingStage(userId);
  } catch (e) {
    console.error('[automation] syncOnboardingStage failed:', e);
  }

  return data;
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

  if (await isGhostSourceCategory(profile.category_id)) {
    await syncGhostForTalent(userId);
  }

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

  if (await isGhostSourceCategory(profile.category_id)) {
    await syncGhostForTalent(userId);
  }

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

  // Removing one of the source profiles voids the ghost — let the
  // ghost service hard-delete it.
  if (await isGhostSourceCategory(profile.category_id)) {
    await syncGhostForTalent(userId);
  }

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
    .select('*, portfolio_item_skills(skill_name)')
    .eq('profile_id', profileId)
    .order('category_name', { ascending: true })
    .order('skill_name', { ascending: true })
    .order('sort_order', { ascending: true });

  if (error) throw new AppError(500, 'Failed to fetch portfolio items');

  return (data ?? []).map((row: any) => {
    const { portfolio_item_skills, ...rest } = row;
    return {
      ...rest,
      skills: Array.isArray(portfolio_item_skills)
        ? portfolio_item_skills.map((s: { skill_name: string }) => s.skill_name)
        : [],
    };
  });
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
  // New axes
  category_name?: string | null;
  skill_names?: string[];
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
      category_name: input.category_name ?? null,
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
      category_name: input.category_name ?? null,
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

  // First portfolio item may advance the candidate's pipeline stage.
  try {
    const { syncOnboardingStage } = await import('./automation.service.js');
    await syncOnboardingStage(userId);
  } catch (e) {
    console.error('[automation] syncOnboardingStage failed:', e);
  }

  // Seed the skills junction. If skill_names is omitted, the legacy
  // single skill_name is the sole tag — keeps the historical PortfolioUploader
  // call shape working unchanged.
  const skillNames =
    input.skill_names && input.skill_names.length > 0
      ? Array.from(new Set(input.skill_names))
      : input.skill_name
        ? [input.skill_name]
        : [];
  if (skillNames.length > 0) {
    await supabaseAdmin
      .from('portfolio_item_skills')
      .insert(skillNames.map((skill_name) => ({ portfolio_item_id: data.id, skill_name })));
  }

  return { ...data, skills: skillNames };
}

interface UpdatePortfolioItemInput {
  category_name?: string | null;
  skill_names?: string[];
}

export async function updatePortfolioItem(
  profileId: string,
  userId: string,
  itemId: string,
  input: UpdatePortfolioItemInput,
) {
  const { data: profile } = await supabaseAdmin
    .from('talent_profiles')
    .select('id')
    .eq('id', profileId)
    .eq('talent_user_id', userId)
    .is('deleted_at', null)
    .single();

  if (!profile) throw new AppError(404, 'Profile not found');

  const updates: Record<string, unknown> = {};
  if (input.category_name !== undefined) updates.category_name = input.category_name;
  // Mirror primary skill into legacy skill_name column for back-compat
  // reads (public profile feeds, share links, etc.). Empty selection
  // preserves whatever was there — a portfolio_item can't lose its
  // legacy skill_name, only get retagged.
  if (input.skill_names && input.skill_names.length > 0) {
    updates.skill_name = input.skill_names[0];
  }

  if (Object.keys(updates).length > 0) {
    const { error: updateError } = await supabaseAdmin
      .from('portfolio_items')
      .update(updates)
      .eq('id', itemId)
      .eq('profile_id', profileId);
    if (updateError) {
      throw new AppError(500, `Failed to update portfolio item: ${updateError.message}`);
    }
  }

  if (input.skill_names) {
    const dedup = Array.from(new Set(input.skill_names));
    const { error: deleteError } = await supabaseAdmin
      .from('portfolio_item_skills')
      .delete()
      .eq('portfolio_item_id', itemId);
    if (deleteError) {
      throw new AppError(500, `Failed to clear skill tags: ${deleteError.message}`);
    }
    if (dedup.length > 0) {
      const { error: insertError } = await supabaseAdmin
        .from('portfolio_item_skills')
        .insert(dedup.map((skill_name) => ({ portfolio_item_id: itemId, skill_name })));
      if (insertError) {
        throw new AppError(500, `Failed to write skill tags: ${insertError.message}`);
      }
    }
  }

  const { data, error } = await supabaseAdmin
    .from('portfolio_items')
    .select('*, portfolio_item_skills(skill_name)')
    .eq('id', itemId)
    .single();

  if (error) throw new AppError(500, 'Failed to read updated portfolio item');

  const { portfolio_item_skills, ...rest } = data as any;
  return {
    ...rest,
    skills: Array.isArray(portfolio_item_skills)
      ? portfolio_item_skills.map((s: { skill_name: string }) => s.skill_name)
      : [],
  };
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

  const errors: string[] = [];

  // Built-in Experience pseudo-field. Always present on job profiles; not
  // stored in category_fields but validated here.
  const experience = fieldData._experience;
  if (experience === undefined || experience === null) {
    errors.push('Experience is required');
  } else if (typeof experience !== 'object' || Array.isArray(experience)) {
    errors.push('Experience must be a { years, months } object');
  } else {
    const { years, months } = experience as { years?: unknown; months?: unknown };
    const yearsBad = typeof years !== 'number' || !Number.isInteger(years) || years < 0 || years > 50;
    const monthsBad = typeof months !== 'number' || !Number.isInteger(months) || months < 0 || months > 11;
    if (yearsBad || monthsBad) {
      errors.push('Experience must be 0–50 years and 0–11 months');
    }
  }

  if (!fields) return errors;

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
      case 'experience': {
        if (typeof value !== 'object' || value === null || Array.isArray(value)) {
          errors.push(`${field.field_label} must be a { years, months } object`);
          break;
        }
        const { years, months } = value as { years?: unknown; months?: unknown };
        if (typeof years !== 'number' || typeof months !== 'number'
            || !Number.isInteger(years) || !Number.isInteger(months)
            || years < 0 || years > 50 || months < 0 || months > 11) {
          errors.push(`${field.field_label} must be 0–50 years and 0–11 months`);
        }
        break;
      }
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

  const errors: string[] = [];

  // Built-in Experience pseudo-field is always required on every job profile.
  const exp = fieldData._experience;
  if (exp === undefined || exp === null) {
    errors.push('Experience is required');
  }

  if (!fields) return errors;

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

/**
 * Categories a talent is allowed to create a profile in.
 *
 * Excludes the Designer + Editor combined category — that one is now
 * a ghost-only category, auto-generated when a talent has both a
 * Designer profile and a Video Editor profile (see
 * `ghost-profile.service.ts`). Other contexts (business discovery,
 * subscription cards, admin) continue to use `getActiveCategories()`.
 */
export async function getTalentCreatableCategories() {
  const all = await getActiveCategories();
  return (all ?? []).filter((c: any) => c.slug !== 'designer-editor');
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
