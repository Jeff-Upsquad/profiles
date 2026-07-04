// Single source of truth for the candidate stages shown per category. The
// Leads board (StageTabs) and the CRM Status Mapping editor both read from here,
// so the "Candidate stage" column on the mapping page always matches the stages
// on the candidate's card. `label` is the built-in fallback; the live CRM name
// (via useStageLabels) overrides it wherever a stage is mapped.

export type Stage =
  | 'new'
  | 'share_form'
  | 'form_filled'
  | 'under_review'
  | 'shortlisted'
  | 'signed_up'
  | 'partner_onboarding'
  | 'onboarding_training'
  | 'basic_profile'
  | 'job_profile'
  | 'portfolio_updation'
  | 'final_review'
  | 'onboard_completed'
  | 'live'
  | 'no_response'
  | 'archived';

export interface StageDef {
  value: Stage;
  label: string;
  color: string;
}

export const CREATIVE_STAGES: StageDef[] = [
  { value: 'new', label: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'share_form', label: 'Share Form', color: 'bg-sky-50 text-sky-700 border-sky-200' },
  { value: 'form_filled', label: 'Form Filled / For Review', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'shortlisted', label: 'Shortlisted', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'signed_up', label: 'Signed Up', color: 'bg-purple-50 text-purple-700 border-purple-200' },
  { value: 'onboarding_training', label: 'Onboarding Training', color: 'bg-amber-50 text-amber-700 border-amber-200' },
  { value: 'basic_profile', label: 'Basic Profile', color: 'bg-orange-50 text-orange-700 border-orange-200' },
  { value: 'job_profile', label: 'Job Profile', color: 'bg-teal-50 text-teal-700 border-teal-200' },
  { value: 'portfolio_updation', label: 'Portfolio Updation', color: 'bg-cyan-50 text-cyan-700 border-cyan-200' },
  { value: 'final_review', label: 'Final Review', color: 'bg-violet-50 text-violet-700 border-violet-200' },
  { value: 'live', label: 'Live', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  { value: 'no_response', label: 'No Response / In Active', color: 'bg-gray-50 text-gray-700 border-gray-200' },
];

export const DEFAULT_STAGES: StageDef[] = [
  { value: 'new', label: 'New', color: 'bg-blue-50 text-blue-700 border-blue-200' },
  { value: 'under_review', label: 'Under Review', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'shortlisted', label: 'Shortlisted', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  { value: 'partner_onboarding', label: 'Onboarding', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
  { value: 'onboard_completed', label: 'Completed', color: 'bg-green-50 text-green-700 border-green-200' },
  { value: 'archived', label: 'Archived', color: 'bg-red-50 text-red-700 border-red-200' },
];

// The candidate stages for a given category. Mirrors the Leads board exactly.
export function stagesForFormType(formType?: string): StageDef[] {
  return formType === 'creative' ? CREATIVE_STAGES : DEFAULT_STAGES;
}
