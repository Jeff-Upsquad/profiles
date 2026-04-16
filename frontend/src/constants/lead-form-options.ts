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
  'Outside India',
].map((d) => ({ label: d, value: d }));

export const ACCOUNTING_SOFTWARE = [
  'Zohobooks',
  'Quick Books',
  'Tally',
  'SAP',
  'ERPnext',
  'Cleartax',
  'Odoo',
  'Deskera',
  'Ginesys',
  'GoFrugal',
  'JustBilling',
  'Logic ERP',
  'Marg ERP',
  'Redbook',
  'EazyPharma',
  'Busy',
  'Eduflex',
  'MyClassCampus',
  'Petpooja',
  'Posist',
  'Torqus',
  'Winman',
  'KDK Spectrum',
  'Genius',
  'TaxCloud India',
  'Wave',
  'QuickFile',
  'ProfitBooks',
  'Bookkeeper',
  'Oracle NetSuite',
  'Focus ERP',
  'Ramco ERP',
  'Vyapar',
  'Saral Accounts',
  'Reach Accountant',
  'HostBooks',
  'Bookkeeper App',
  'Khatabook',
  'MyBillBook',
  'Xero',
  'FreshBooks',
].map((s) => ({ label: s, value: s }));

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
