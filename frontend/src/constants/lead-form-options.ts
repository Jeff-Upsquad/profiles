export const CREATIVE_ROLES = [
  { label: 'Editor', value: 'Editor' },
  { label: 'Designer', value: 'Designer' },
  { label: 'Editor + Designer', value: 'Editor + Designer' },
];

export const GENDER_OPTIONS = [
  { label: 'Male', value: 'male' },
  { label: 'Female', value: 'female' },
  { label: 'Other', value: 'other' },
  { label: 'Prefer not to say', value: 'prefer_not_to_say' },
];

export const WORK_TYPE_OPTIONS = [
  { label: 'Online', value: 'Online' },
  { label: 'At Office', value: 'At Office' },
  { label: 'Hybrid', value: 'Hybrid' },
];

export const WORK_TYPE_SEEKING_OPTIONS = [
  { label: 'Freelance work', value: 'Freelance work' },
  { label: 'Full Time Job', value: 'Full Time Job' },
  { label: 'Part Time Job', value: 'Part Time Job' },
  { label: 'UpSquad Partner Program', value: 'UpSquad Partner Program' },
];

export const KERALA_DISTRICTS = [
  'Alappuzha',
  'Ernakulam',
  'Idukki',
  'Kannur',
  'Kasaragod',
  'Kollam',
  'Kottayam',
  'Kozhikode',
  'Malappuram',
  'Palakkad',
  'Pathanamthitta',
  'Thiruvananthapuram',
  'Thrissur',
  'Wayanad',
  'Outside Kerala',
  'Outside India',
].map((d) => ({ label: d, value: d }));

// Primary ones first, then alphabetical rest
export const ACCOUNTING_SOFTWARE_PRIMARY = [
  'Zohobooks',
  'Tally',
  'Quick Books',
  'Vyapar',
  'Odoo',
  'ERPnext',
].map((s) => ({ label: s, value: s }));

export const ACCOUNTING_SOFTWARE_OTHER = [
  'Bookkeeper',
  'Bookkeeper App',
  'Busy',
  'Cleartax',
  'Deskera',
  'EazyPharma',
  'Eduflex',
  'Focus ERP',
  'FreshBooks',
  'Genius',
  'Ginesys',
  'GoFrugal',
  'HostBooks',
  'JustBilling',
  'KDK Spectrum',
  'Khatabook',
  'Logic ERP',
  'Marg ERP',
  'MyBillBook',
  'MyClassCampus',
  'Oracle NetSuite',
  'Petpooja',
  'Posist',
  'ProfitBooks',
  'QuickFile',
  'Ramco ERP',
  'Reach Accountant',
  'Redbook',
  'SAP',
  'Saral Accounts',
  'TaxCloud India',
  'Torqus',
  'Wave',
  'Winman',
  'Xero',
].map((s) => ({ label: s, value: s }));

export const ACCOUNTING_SOFTWARE = [...ACCOUNTING_SOFTWARE_PRIMARY, ...ACCOUNTING_SOFTWARE_OTHER];

export const ACCOUNTING_SKILLS = [
  'GST Filing',
  'TDS Calculations and Filing',
  'ESI / PF Calculations and Filing',
  'ITR Filing Personal',
  'ITR Filing Business',
  'UAE VAT related knowledge',
].map((s) => ({ label: s, value: s }));

export const LANGUAGES = [
  'English',
  'Malayalam',
  'Tamil',
  'Hindi',
  'Kannada',
  'Telugu',
  'Arabic',
  'German',
  'Spanish',
  'French',
].map((l) => ({ label: l, value: l }));
