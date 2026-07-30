// Registry for the business-portal "Request talent" brief. Each category is a
// service vertical the business can request. Adding a new category is as simple
// as appending an object to CONNECT_BRIEF_CATEGORIES — the picker, role step,
// and submit payload all derive from this list. The form posts to our backend
// (/api/business/connect-brief), which forwards to squadhub-web's public lead
// pipeline. `serviceType` values must match squadhub's vocabulary.

export type ServiceType =
  | 'designer'
  | 'video_editor'
  | 'designer_video_editor'
  | 'accountant';

export interface ConnectBriefRole {
  slug: string;
  title: string;
  description: string;
  // Canonical service_type sent to squadhub for this role.
  serviceType: ServiceType;
}

export interface ConnectBriefCategory {
  id: string;
  label: string;
  // Short line shown under the label in the category picker.
  description: string;
  // Heroicon-style single-path glyph for the picker tile.
  iconPath: string;
  // Roles a business can request inside this category. When exactly one role
  // exists, it is auto-selected and the role step is skipped.
  roles: ConnectBriefRole[];
  // Whether more than one role can be picked at once.
  multiRole: boolean;
}

export const CONNECT_BRIEF_CATEGORIES: ConnectBriefCategory[] = [
  {
    id: 'designer_editor',
    label: 'Designer / Editor',
    description: 'Graphic design, video editing, or a hybrid who does both.',
    iconPath:
      'M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z',
    multiRole: true,
    roles: [
      {
        slug: 'designer',
        title: 'Designer',
        description:
          'Static visuals — graphics, logos, branding, presentations, UI/UX, print.',
        serviceType: 'designer',
      },
      {
        slug: 'editor',
        title: 'Editor',
        description:
          'Motion & video — short-form reels, long-form edits, ads, animations.',
        serviceType: 'video_editor',
      },
      {
        slug: 'designer_plus_editor',
        title: 'Designer + Editor',
        description:
          'One person who does both design work and video editing.',
        serviceType: 'designer_video_editor',
      },
    ],
  },
  {
    id: 'accountant',
    label: 'Accountant',
    description: 'Bookkeeping, taxation, compliance and financial reporting.',
    iconPath:
      'M9 7h6m0 10v-3m-3 3h.01M9 17h.01M9 14h.01M12 14h.01M15 11h.01M12 11h.01M9 11h.01M7 21h10a2 2 0 002-2V5a2 2 0 00-2-2H7a2 2 0 00-2 2v14a2 2 0 002 2z',
    multiRole: false,
    roles: [
      {
        slug: 'accountant',
        title: 'Accountant',
        description:
          'Day-to-day books, GST/tax filings, payroll, MIS and compliance.',
        serviceType: 'accountant',
      },
    ],
  },
];

// Experience tiers — stored values match squadhub's tier CHECK
// (Junior / Pro / Top Talents). Shared across categories.
export const EXPERIENCE_LEVELS: { label: string; value: string; desc: string }[] = [
  { label: 'Juniors', value: 'Junior', desc: 'Under 2 years — great for straightforward, cost-effective work.' },
  { label: 'Pros', value: 'Pro', desc: '2+ years with strong, well-rounded skills. Reliable quality.' },
  { label: 'Top Talents', value: 'Top Talents', desc: '5+ years — best for high-stakes, complex or premium work.' },
];

// Weekly plans (subscription only). `name` is the plan_name sent upstream.
export const PLAN_OPTIONS: { name: string; hoursLabel: string }[] = [
  { name: 'Starter', hoursLabel: '~1 hr/day · 5 hrs/week' },
  { name: 'Basic', hoursLabel: '2–3 hrs/day · 10 hrs/week' },
  { name: 'Plus', hoursLabel: '4–5 hrs/day · 20 hrs/week' },
  { name: 'Pro', hoursLabel: '6–7 hrs/day · 30 hrs/week' },
  { name: 'Personal', hoursLabel: '~8 hrs/day · 40 hrs/week' },
];

export const LANGUAGES = [
  'English', 'Hindi', 'Tamil', 'Telugu', 'Malayalam', 'Kannada',
  'Marathi', 'Bengali', 'Gujarati', 'Punjabi', 'Urdu',
  'Arabic', 'Spanish', 'French', 'German', 'Mandarin',
];

export const WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
export const DEFAULT_WORKING_DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'];
