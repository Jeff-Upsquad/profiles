type FieldType = 'string' | 'number' | 'string[]';

interface FieldDef {
  key: string;
  label: string;
  type: FieldType;
  options?: { label: string; value: string }[];
}

const COUNTRIES = [
  { label: 'India', value: 'India' },
  { label: 'United States', value: 'United States' },
  { label: 'United Kingdom', value: 'United Kingdom' },
  { label: 'United Arab Emirates', value: 'United Arab Emirates' },
  { label: 'Singapore', value: 'Singapore' },
  { label: 'Canada', value: 'Canada' },
  { label: 'Australia', value: 'Australia' },
  { label: 'Other', value: 'Other' },
];

const INDIAN_STATES = [
  'Andhra Pradesh', 'Arunachal Pradesh', 'Assam', 'Bihar', 'Chhattisgarh',
  'Goa', 'Gujarat', 'Haryana', 'Himachal Pradesh', 'Jharkhand', 'Karnataka',
  'Kerala', 'Madhya Pradesh', 'Maharashtra', 'Manipur', 'Meghalaya', 'Mizoram',
  'Nagaland', 'Odisha', 'Punjab', 'Rajasthan', 'Sikkim', 'Tamil Nadu',
  'Telangana', 'Tripura', 'Uttar Pradesh', 'Uttarakhand', 'West Bengal',
  'Andaman and Nicobar Islands', 'Chandigarh',
  'Dadra and Nagar Haveli and Daman and Diu', 'Delhi', 'Jammu and Kashmir',
  'Ladakh', 'Lakshadweep', 'Puducherry',
].map((s) => ({ label: s, value: s }));

const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

const CREATIVE_ROLES = [
  { label: 'Editor', value: 'Editor' },
  { label: 'Designer', value: 'Designer' },
  { label: 'Editor + Designer', value: 'Editor + Designer' },
];

const WORK_TYPE_SEEKING = [
  { label: 'Freelance work', value: 'Freelance work' },
  { label: 'Full Time Job', value: 'Full Time Job' },
  { label: 'Part Time Job', value: 'Part Time Job' },
  { label: 'UpSquad Partner Program', value: 'UpSquad Partner Program' },
];

const WORK_TYPE = [
  { label: 'Online', value: 'Online' },
  { label: 'At Office', value: 'At Office' },
  { label: 'Hybrid', value: 'Hybrid' },
];

export const FORM_FIELD_DEFINITIONS: Record<string, FieldDef[]> = {
  creative: [
    { key: 'country', label: 'Country', type: 'string', options: COUNTRIES },
    { key: 'state', label: 'State', type: 'string', options: INDIAN_STATES },
    { key: 'current_district', label: 'District', type: 'string' },
    { key: 'gender', label: 'Gender', type: 'string', options: GENDER_OPTIONS },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'role', label: 'Role', type: 'string[]', options: CREATIVE_ROLES },
    { key: 'work_type_seeking', label: 'Work Type Seeking', type: 'string[]', options: WORK_TYPE_SEEKING },
    { key: 'experience_years', label: 'Experience (years)', type: 'number' },
  ],
  accountant: [
    { key: 'country', label: 'Country', type: 'string', options: COUNTRIES },
    { key: 'state', label: 'State', type: 'string', options: INDIAN_STATES },
    { key: 'current_district', label: 'District', type: 'string' },
    { key: 'gender', label: 'Gender', type: 'string', options: GENDER_OPTIONS },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'work_type', label: 'Work Type', type: 'string[]', options: WORK_TYPE },
    { key: 'work_type_seeking', label: 'Work Type Seeking', type: 'string[]', options: WORK_TYPE_SEEKING },
    { key: 'experience_years', label: 'Experience (years)', type: 'number' },
    { key: 'current_salary', label: 'Current Salary', type: 'number' },
    { key: 'expected_salary', label: 'Expected Salary', type: 'number' },
  ],
  sales: [
    { key: 'country', label: 'Country', type: 'string', options: COUNTRIES },
    { key: 'state', label: 'State', type: 'string', options: INDIAN_STATES },
    { key: 'current_district', label: 'District', type: 'string' },
    { key: 'gender', label: 'Gender', type: 'string', options: GENDER_OPTIONS },
    { key: 'age', label: 'Age', type: 'number' },
    { key: 'work_type_seeking', label: 'Work Type Seeking', type: 'string[]', options: WORK_TYPE_SEEKING },
    { key: 'experience_years', label: 'Experience (years)', type: 'number' },
    { key: 'industry_experience', label: 'Industry Experience', type: 'string' },
  ],
};

export const OPERATORS_BY_TYPE: Record<FieldType, { label: string; value: string }[]> = {
  string: [
    { label: 'equals', value: 'eq' },
    { label: 'not equals', value: 'neq' },
    { label: 'is one of', value: 'in' },
    { label: 'is not one of', value: 'not_in' },
  ],
  number: [
    { label: 'equals', value: 'eq' },
    { label: 'not equals', value: 'neq' },
    { label: '≥ (at least)', value: 'gte' },
    { label: '≤ (at most)', value: 'lte' },
    { label: '> (more than)', value: 'gt' },
    { label: '< (less than)', value: 'lt' },
  ],
  'string[]': [
    { label: 'contains any of', value: 'contains_any' },
    { label: 'contains all of', value: 'contains_all' },
  ],
};

export function getFieldDef(formType: string, fieldKey: string): FieldDef | undefined {
  return FORM_FIELD_DEFINITIONS[formType]?.find((f) => f.key === fieldKey);
}

export function needsArrayValue(operator: string): boolean {
  return ['in', 'not_in', 'contains_any', 'contains_all'].includes(operator);
}
