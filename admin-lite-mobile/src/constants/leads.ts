export const STATUS_LABELS: Record<string, string> = {
  new: 'New',
  under_review: 'Under Review',
  shortlisted: 'Shortlisted',
  partner_onboarding: 'Onboarding',
  onboard_completed: 'Completed',
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
  under_review: 'yellow',
  shortlisted: 'indigo',
  partner_onboarding: 'yellow',
  onboard_completed: 'green',
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
  { value: 'under_review', label: 'Under Review' },
  { value: 'shortlisted', label: 'Shortlisted' },
  { value: 'partner_onboarding', label: 'Onboarding' },
  { value: 'onboard_completed', label: 'Completed' },
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
