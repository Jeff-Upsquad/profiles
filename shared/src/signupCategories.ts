import { TALENT_CATEGORY_OPTIONS } from './contentRoles';

/** Signup choices keep Designer and Video Editor distinct within the creative pipeline. */
export const SIGNUP_CATEGORIES = [
  { value: 'designer', label: 'Designer', formType: 'creative' },
  { value: 'video-editor', label: 'Video Editor', formType: 'creative' },
  { value: 'accountant', label: 'Accountant', formType: 'accountant' },
  ...TALENT_CATEGORY_OPTIONS.filter((c) => c.value !== 'creative' && c.value !== 'accountant')
    .map((c) => ({ value: c.slugs[0], label: c.label, formType: c.value })),
];

export function signupFormTypes(categories: readonly string[]): string[] {
  return [...new Set(categories.flatMap((value) => {
    const category = SIGNUP_CATEGORIES.find((c) => c.value === value);
    return category ? [category.formType] : [];
  }))];
}
