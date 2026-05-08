export const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  share_form: 'Share Form',
  form_filled: 'Form Filled',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  signed_up: 'Signed Up',
  partner_onboarding: 'Onboarding',
  onboarding_training: 'Onboarding Training',
  basic_profile: 'Basic Profile',
  job_profile: 'Job Profile',
  portfolio_updation: 'Portfolio Updation',
  final_review: 'Final Review',
  onboard_completed: 'Completed',
  live: 'Live',
  no_response: 'No Response',
  archived: 'Archived',
  contacted: 'Contacted',
  converted: 'Converted',
  rejected: 'Rejected',
};

export const STATUS_COLORS: Record<
  string,
  'blue' | 'yellow' | 'green' | 'red' | 'indigo' | 'gray'
> = {
  new: 'blue',
  share_form: 'blue',
  form_filled: 'yellow',
  under_review: 'yellow',
  shortlisted: 'indigo',
  signed_up: 'indigo',
  partner_onboarding: 'yellow',
  onboarding_training: 'yellow',
  basic_profile: 'yellow',
  job_profile: 'blue',
  portfolio_updation: 'blue',
  final_review: 'indigo',
  onboard_completed: 'green',
  live: 'green',
  no_response: 'gray',
  archived: 'gray',
  contacted: 'yellow',
  converted: 'green',
  rejected: 'red',
};

export const FORM_TYPE_TABS: { value: string; label: string }[] = [
  { value: '', label: 'All' },
  { value: 'creative', label: 'Creative' },
  { value: 'accountant', label: 'Accountant' },
];

export const STATUS_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'share_form', label: 'Share Form' },
  { value: 'form_filled', label: 'Form Filled' },
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'signed_up', label: 'Signed Up' },
  { value: 'partner_onboarding', label: 'Onboarding' },
  { value: 'onboarding_training', label: 'Onboarding Training' },
  { value: 'basic_profile', label: 'Basic Profile' },
  { value: 'job_profile', label: 'Job Profile' },
  { value: 'portfolio_updation', label: 'Portfolio Updation' },
  { value: 'final_review', label: 'Final Review' },
  { value: 'onboard_completed', label: 'Completed' },
  { value: 'live', label: 'Live' },
  { value: 'no_response', label: 'No Response' },
  { value: 'archived', label: 'Archived' },
];

export const PROFILE_TYPE_OPTIONS: { value: string; label: string }[] = [
  { value: '', label: '—' },
  { value: 'creative', label: 'Creative' },
  { value: 'accountant', label: 'Accountant' },
  { value: 'custom', label: 'Custom' },
];

export const ARCHIVE_REASONS = [
  'Not a good fit',
  'Duplicate submission',
  'No response',
  'Rejected interview',
  'Other',
];
