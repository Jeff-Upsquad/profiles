'use client';

import { useEffect, useState } from 'react';
import JobBriefForm from '@/components/business/connect-brief/JobBriefForm';

// Public design preview for the job-profile step. Seeds a complete business,
// location and job draft in localStorage, then mounts the real JobBriefForm in
// preview mode — no login, no backend. Switch category with the picker at the
// top to see the catalogue-driven skills & tools section for each job type.

const CATEGORIES = [
  {
    label: 'Accountants',
    slug: 'accountant',
    categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa2',
    title: 'Accountant',
    description: 'We are looking for an accountant to work remotely and manage the books of accounts for multiple clients. You will own day-to-day bookkeeping, reconciliations and monthly reporting, and work directly with clients to keep their records clean and compliant.',
    responsibilities: ['Manage the books of accounts for multiple clients', 'Reconcile bank, card and payment-gateway statements every month', 'Prepare monthly MIS and financial reports', 'File GST returns and keep clients compliant'],
    requirements: ['2+ years of accounting experience', 'Strong knowledge of Tally or QuickBooks', 'Comfortable working directly with clients', 'Attention to detail and reliable communication'],
    skills: ['Bank Reconciliation', 'Accounts Payable / Receivable', 'Financial Statement Preparation'],
    education: 'B.Com or equivalent',
  },
  {
    label: 'Designers',
    slug: 'designer',
    categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa1',
    title: 'Designer',
    description: 'We are hiring a designer to create on-brand visuals for our marketing and product teams. You will turn briefs into polished social creatives, campaign assets and presentation decks.',
    responsibilities: ['Create social and campaign creatives from briefs', 'Keep the brand system consistent across assets', 'Prepare presentation and sales decks', 'Work with marketing on rapid creative iterations'],
    requirements: ['Strong portfolio of brand or marketing work', 'Fluency in Figma and Adobe Creative Suite', 'Good eye for typography and layout', 'Ability to handle multiple briefs each week'],
    skills: ['Visual identity', 'Typography', 'Social creatives'],
    education: 'Any design qualification or equivalent portfolio',
  },
  {
    label: 'Video Editors',
    slug: 'video-editor',
    categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa3',
    title: 'Video Editor',
    description: 'We need a video editor for short-form and long-form content. You will cut reels, add captions and motion graphics, and deliver platform-ready files on a weekly schedule.',
    responsibilities: ['Edit reels, shorts and long-form videos', 'Add captions, transitions and motion graphics', 'Colour-correct and mix audio for delivery', 'Organise source files and exports'],
    requirements: ['2+ years editing short-form content', 'Strong sense of pacing and story', 'Experience with Premiere Pro or Final Cut', 'Portfolio of published work'],
    skills: ['Story pacing', 'Captions & subtitles', 'Motion graphics'],
    education: 'Any degree or equivalent experience',
  },
  {
    label: 'Copy / Content Writers',
    slug: 'copy-content-writer',
    categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa4',
    title: 'Copy / Content Writer',
    description: 'We are looking for a writer to own website, social and email copy. You will turn product and marketing briefs into clear, on-brand content that sounds like us.',
    responsibilities: ['Write website, landing-page and campaign copy', 'Draft social captions and email newsletters', 'Edit and proofread content from other teams', 'Maintain the brand voice guide'],
    requirements: ['2+ years writing for brands or publications', 'Strong portfolio of published work', 'Comfortable with SEO fundamentals', 'Sharp editing and proofreading'],
    skills: ['Brand voice', 'Headlines', 'Content strategy'],
    education: 'Any degree or equivalent experience',
  },
  {
    label: 'Social Media Managers',
    slug: 'social-media-manager',
    categoryId: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaa5',
    title: 'Social Media Manager',
    description: 'We need a social media manager to plan, publish and report on content across our channels. You will own the calendar, community replies and monthly performance reporting.',
    responsibilities: ['Own the monthly content calendar', 'Publish and schedule across channels', 'Reply to comments and direct messages', 'Report on reach, engagement and growth'],
    requirements: ['2+ years managing brand social accounts', 'Strong copy and community skills', 'Comfortable with scheduling tools', 'Data-led approach to content'],
    skills: ['Content planning', 'Community engagement', 'Campaign reporting'],
    education: 'Any degree or equivalent experience',
  },
] as const;

type Category = typeof CATEGORIES[number];

const business = {
  id: 'preview-business',
  name: 'Northwind Studio',
  about: 'A small brand and performance studio working with growing consumer businesses.',
  industry: 'Marketing & advertising',
  company_size: '11–50 employees',
  founded_year: 2018,
  website: '',
  logo_url: '',
  socials: {},
  photos: [],
  culture: '',
  perks: [],
  contact_name: 'Jeff Thomas',
  contact_email: 'jeff@northwind.example',
  contact_phone: '+91 98765 43210',
};

const location = {
  id: 'preview-location',
  business_profile_id: 'preview-business',
  label: 'Northwind HQ',
  address: '12 Marine Drive',
  city: 'Kochi',
  region: 'Kerala',
  district: 'Ernakulam',
  postal_code: '682031',
  country_id: null,
  is_primary: true,
};

function makeDraft(category: Category) {
  return {
    step: 3,
    businessId: 'preview-business',
    brandId: '',
    jobId: '',
    editingBusiness: false,
    editingBrand: false,
    editingJob: true,
    business: { id: 'preview-business' },
    brand: { id: '' },
    job: {
      id: 'preview-job',
      title: category.title,
      description: category.description,
      responsibilities: category.responsibilities,
      requirements: category.requirements,
      skills: category.skills,
      min_experience_years: 2,
      max_experience_years: 5,
      education: category.education,
      employment_type: 'full_time',
      work_mode: 'remote',
      working_days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri'],
      working_hours: { start: '09:30', end: '18:30', timezone: 'Asia/Kolkata' },
      salary_min: 35000,
      salary_max: 55000,
      salary_currency: 'INR',
      salary_period: 'monthly',
      benefits: ['Paid leave', 'Learning budget', 'Work-from-home setup'],
      growth_path: 'You will grow into a senior role owning client relationships and reviewing the work of junior team members.',
      preference_rules: { target_tiers: ['Pro', 'Top Talents'], target_languages: ['English'] },
      squadhire_category_ids: [category.categoryId],
      location_id: null,
      // Keyed by the form's resolved category slug (JobBriefForm's internal
      // previewCategories); proficiency levels demonstrate the "pick an item,
      // choose a level on the right" flow.
      additional_requirements: {
        [category.slug]: {
          skills_proficiency: category.skills.map((name, i) => ({ name, level: [4, 5, 3][i % 3] })),
          tools_proficiency: [],
        },
      },
    },
    openings: '1',
    joiningDate: '',
    requestId: '11111111-1111-4111-8111-111111111111',
  };
}

export default function JobProfilePreviewPage() {
  const [category, setCategory] = useState<Category>(CATEGORIES[0]);
  const [seeded, setSeeded] = useState(0);

  // Allow deep links like /preview/job-profile?type=Video+Editors so a specific
  // job type can be shared without clicking the picker.
  useEffect(() => {
    const type = new URLSearchParams(window.location.search).get('type');
    const match = CATEGORIES.find((item) => item.label === type);
    if (match) setCategory(match);
  }, []);

  useEffect(() => {
    localStorage.setItem(
      'squadhire:hiring-library:preview',
      JSON.stringify({ businesses: [business], brands: [], jobs: [], locations: [location] }),
    );
    localStorage.setItem(
      `squadhire:hiring-wizard:preview:${category.label}`,
      JSON.stringify(makeDraft(category)),
    );
    setSeeded((value) => value + 1);
  }, [category]);

  return <div className="flex h-screen flex-col bg-[#F5F5F6]">
    <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[#E7E7EA] bg-white px-4 py-3 sm:px-6">
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-widest text-[#a3a3a3]">Job profile · UI preview</p>
        <h1 className="truncate font-[family-name:var(--font-jakarta)] text-base font-semibold tracking-tight text-[#0a0a0a]">Build your hiring profile</h1>
      </div>
      <label className="flex items-center gap-2 text-xs font-semibold text-[#525252]">
        Job type
        <select
          value={category.label}
          onChange={(event) => {
            const next = CATEGORIES.find((item) => item.label === event.target.value) ?? CATEGORIES[0];
            setCategory(next);
            window.history.replaceState(null, '', `?type=${encodeURIComponent(next.label)}`);
          }}
          className="rounded-lg border border-[#D9D5C7] bg-white px-2.5 py-2 text-xs font-semibold text-[#222] outline-none focus:border-black focus:ring-2 focus:ring-[#FCF487]"
        >
          {CATEGORIES.map((item) => <option key={item.label} value={item.label}>{item.label}</option>)}
        </select>
      </label>
    </div>
    <div className="min-h-0 flex-1 overflow-y-auto">
      {seeded > 0 && <JobBriefForm key={seeded} categoryName={category.label} preview onClose={() => undefined} />}
    </div>
  </div>;
}
