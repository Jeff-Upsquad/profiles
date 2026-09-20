// Shared shapes + constants for the Onboarding hub (list + journey panel).

export type PipelineStage =
  | 'applicants'
  | 'application_approved'
  | 'signed_up'
  | 'onboarding_course'
  | 'basic_profile'
  | 'job_profile'
  | 'final_review'
  | 'live'
  | 'no_response';

// The CRM candidate-pipeline stages mirrored on talent_users.pipeline_stage.
// Order = funnel order. `dot`/`chip` are the tailwind tints used everywhere
// the stage shows up so a stage always looks the same across the page.
export const PIPELINE_STAGES: { value: PipelineStage; label: string; dot: string; chip: string }[] = [
  { value: 'applicants', label: 'Applicants', dot: 'bg-yellow-500', chip: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'application_approved', label: 'Application approved', dot: 'bg-purple-500', chip: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'signed_up', label: 'Application approved (legacy)', dot: 'bg-purple-500', chip: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'onboarding_course', label: 'Course', dot: 'bg-amber-500', chip: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'basic_profile', label: 'Basic profile', dot: 'bg-orange-500', chip: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'job_profile', label: 'Job profile', dot: 'bg-teal-500', chip: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'final_review', label: 'Final review', dot: 'bg-violet-500', chip: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'live', label: 'Live', dot: 'bg-emerald-500', chip: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'no_response', label: 'No response', dot: 'bg-gray-400', chip: 'bg-gray-50 text-gray-600 border-gray-200' },
];

export const STAGE_BY_VALUE = Object.fromEntries(PIPELINE_STAGES.map((s) => [s.value, s])) as Record<
  PipelineStage,
  (typeof PIPELINE_STAGES)[number]
>;

export type HubCategory = 'all' | 'creative' | 'accountant' | 'sales';

export const CATEGORY_TABS: { value: HubCategory; label: string }[] = [
  { value: 'all', label: 'All' },
  { value: 'creative', label: 'Designer / Editor' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'sales', label: 'Sales' },
];

export const CATEGORY_BADGE: Record<string, { label: string; cls: string }> = {
  creative: { label: 'Designer / Editor', cls: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  accountant: { label: 'Accountant', cls: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  sales: { label: 'Sales', cls: 'bg-sky-50 text-sky-700 border-sky-200' },
};

export type HubAttention =
  | 'pending_approval'
  | 'needs_review'
  | 'waiting_on_talent'
  | 'course_pending'
  | 'basic_incomplete'
  | 'no_job_profile';

export interface JourneySummary {
  signed_up: boolean;
  onboarding_completed: boolean;
  onboarding_bypassed: boolean;
  course_started: boolean;
  basic_profile_completed: boolean;
  basic_missing: string[];
  job_profile_completed: boolean;
  job_profiles: {
    total: number;
    draft: number;
    pending_review: number;
    changes_requested: number;
    approved: number;
    rejected: number;
  };
  changes_requested_at: string | null;
  requested_change_labels: string[];
  resubmitted_at: string | null;
  portfolio_completed: boolean;
  portfolio_items: number;
}

export interface HubRow {
  id: string;
  full_name: string;
  phone: string | null;
  email: string | null;
  current_location: string | null;
  approval_status: string;
  partner_approval_status: string | null;
  wants_jobs: boolean;
  is_active: boolean;
  suspended: boolean;
  blacklisted: boolean;
  created_at: string;
  approved_at: string | null;
  pipeline_stage: PipelineStage;
  crm_talent_pipeline_name: string | null;
  crm_talent_stage_id: string | null;
  crm_talent_stage_name: string | null;
  crm_talent_stage_changed_at: string | null;
  categories: string[];
  lead: { id: string; form_type: string; status: string } | null;
  journey: JourneySummary | null;
}

export interface HubStats {
  total: number;
  pending: number;
  by_pipeline_stage: Record<string, number>;
  by_talent_stage: Record<string, number>;
  in_talent_pipeline: number;
  attention: { pending_approval: number; needs_review: number; waiting_on_talent: number };
}

export interface CrmStage {
  id: string;
  name: string;
  sort_order: number;
}

export interface TalentPipelineConfig {
  pipeline_name: string;
  stages: CrmStage[];
}

// The five journey milestones, in order. `onboarding_completed` reads the
// course; the rest read the profile tables.
export const JOURNEY_STEPS: { key: keyof JourneySummary; label: string; short: string }[] = [
  { key: 'signed_up', label: 'Signed up', short: 'Sign-up' },
  { key: 'onboarding_completed', label: 'Onboarding course', short: 'Course' },
  { key: 'basic_profile_completed', label: 'Basic profile', short: 'Basic' },
  { key: 'job_profile_completed', label: 'Job profile', short: 'Job' },
  { key: 'portfolio_completed', label: 'Portfolio', short: 'Portfolio' },
];

/** "3d ago" / "2h ago" / "just now" — for the Joined column and stage age. */
export function timeAgo(iso: string | null | undefined): string {
  if (!iso) return '';
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60_000);
  if (m < 1) return 'just now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.floor(h / 24);
  if (d < 30) return `${d}d ago`;
  const mo = Math.floor(d / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.floor(mo / 12)}y ago`;
}

export function initials(name: string | null | undefined): string {
  return (name || '?')
    .split(' ')
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join('')
    .toUpperCase();
}
