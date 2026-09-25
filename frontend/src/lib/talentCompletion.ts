import type { Profile } from '@/types';
import { needsProfileResubmission } from '@/lib/profileChanges';

/**
 * What a talent still has to finish — shared by the Basic Profile form, the
 * sidebar / More-page "Pending" tags and the job-profile screens so they all
 * agree on what "pending" means.
 */

export type BasicSectionId =
  | 'basic_details'
  | 'language'
  | 'address'
  | 'education'
  | 'experience'
  | 'job_preference'
  | 'freelance_preference'
  | 'partner_program_preference'
  | 'profile_picture'
  | 'id_proofs'
  | 'bank_account'
  | 'resume';

export interface BasicCompletionInput {
  fullName?: string | null;
  languages?: { proficiency?: string }[] | null;
  basic?: Record<string, any> | null;
}

/**
 * Per-section completion. Mirrors isBasicProfileMandatoryComplete in
 * backend/src/services/talent.service.ts — keep the two in sync.
 */
export function basicSectionCompletion({ fullName, languages, basic }: BasicCompletionInput): Record<BasicSectionId, boolean> {
  const b = basic ?? {};
  const langs = languages ?? [];
  const courses = (b.education_courses ?? []) as { course_name?: string; institution?: string }[];
  const experience = (b.experience ?? []) as { company_name?: string; designation?: string }[];
  return {
    basic_details: !!fullName?.trim(),
    language: langs.some((l) => l?.proficiency === 'native'),
    address: !!(b.permanent_country && b.permanent_state && b.permanent_district && b.permanent_city),
    education: courses.some((e) => !!e?.course_name && !!e?.institution),
    experience: experience.some((e) => !!e?.company_name && !!e?.designation),
    job_preference: (b.availability ?? []).length > 0 && (b.job_type ?? []).length > 0,
    freelance_preference: !!b.freelance_available,
    partner_program_preference:
      ((b.virtual_office_hours ?? []) as { from?: string; to?: string }[]).some((h) => !!h?.from && !!h?.to) &&
      ((b.daily_available_hours ?? []) as { hours?: number }[]).some((d) => (d?.hours ?? 0) > 0),
    profile_picture: !!b.profile_picture_url,
    id_proofs: !!(b.aadhaar_number || b.pan_number),
    bank_account: !!(b.bank_account_holder && b.bank_account_number && b.bank_ifsc_code),
    resume: !!b.resume_url,
  };
}

/**
 * Whether a section counts toward "basic profile complete" for this talent.
 * ID proofs and bank account are always optional; the preference sections
 * and the resume only apply to the matching work preference.
 */
export function isBasicSectionRequired(id: BasicSectionId, employmentType: string[] | null | undefined): boolean {
  const employment = employmentType ?? [];
  switch (id) {
    case 'id_proofs':
    case 'bank_account':
      return false;
    case 'job_preference':
    case 'resume':
      return employment.includes('salary');
    case 'freelance_preference':
      return employment.includes('freelance');
    case 'partner_program_preference':
      return employment.includes('partner_program');
    default:
      return true;
  }
}

export function pendingBasicSections(input: BasicCompletionInput): BasicSectionId[] {
  const done = basicSectionCompletion(input);
  const employment = (input.basic?.employment_type ?? []) as string[];
  return (Object.keys(done) as BasicSectionId[]).filter(
    (id) => isBasicSectionRequired(id, employment) && !done[id],
  );
}

// ── Job profiles ──────────────────────────────────────────────────────────

/** Mirrors MIN_PORTFOLIO_ITEMS_BY_SLUG in backend/src/services/talent.service.ts. */
const MIN_PORTFOLIO_ITEMS_BY_SLUG: Record<string, number> = {
  designer: 10,
  'video-editor': 10,
};

/** Portfolio items a category needs before its profile can be submitted (0 = no minimum). */
export function minPortfolioItems(categorySlug: string | null | undefined): number {
  return categorySlug ? MIN_PORTFOLIO_ITEMS_BY_SLUG[categorySlug] ?? 0 : 0;
}

export interface ProfilePendingState {
  /** Short tag text, e.g. "Not submitted". */
  label: string;
  /** Portfolio items still to upload before submitting (0 when met / no minimum). */
  portfolioShortfall: number;
}

/**
 * Why a job profile still needs the talent's attention, or null when nothing
 * is pending. Drafts haven't been submitted for review; an open change request
 * needs a resubmit. Ghost (Designer + Editor) profiles are system-managed.
 */
export function profilePendingState(profile: Profile): ProfilePendingState | null {
  if (profile.is_ghost) return null;
  const draft = profile.status === 'draft';
  const updates = needsProfileResubmission(profile);
  if (!draft && !updates) return null;
  const min = profile.status === 'approved' ? 0 : minPortfolioItems(profile.category?.slug);
  const shortfall = Math.max(0, min - (profile.portfolio_count ?? 0));
  return {
    label: updates && !draft ? 'Updates needed' : 'Not submitted',
    portfolioShortfall: shortfall,
  };
}
