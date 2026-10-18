// Single source of truth for the squads + categories a business can brief us on.
// Mirrors the public site's `client/src/data/squads.js` so the portal and the
// marketing site tell the same story. Keep the ids/order in sync when the site
// changes.
//
// `brief` is what makes an item bookable here: it names the ConnectBriefDrawer
// form that opens when the row is tapped. Items without `brief` are not open
// for briefs yet and render as Waitlist / Coming soon.

import type { ConnectBriefCategoryId } from '@/components/business/connect-brief/categories';

export type SquadItemStatus = 'live' | 'waitlist' | 'coming-soon';

export type SquadItem = {
  /** Stable id, unique across all squads. */
  id: string;
  name: string;
  emoji: string;
  desc: string;
  status: SquadItemStatus;
  /** Set on live items — the brief form to open. */
  brief?: ConnectBriefCategoryId;
  /** Pre-selects a role inside the designer/editor brief. */
  briefRole?: 'designer' | 'editor';
};

export type Squad = {
  id: string;
  name: string;
  /** Short label for the scrolling squad rail. */
  shortName: string;
  emoji: string;
  description: string;
  tags: string[];
  /** Programme stage shown next to the squad name. */
  badge?: string;
  items: SquadItem[];
};

export const SERVICE_SQUADS: Squad[] = [
  {
    id: 'content-creation',
    name: 'Content Creation',
    shortName: 'Content',
    emoji: '🎬',
    description:
      'End-to-end content production across design, video and social — designers, editors, creative leads, social managers and writers under one subscription.',
    tags: ['Design', 'Video', 'Social', 'Copywriting'],
    items: [
      {
        id: 'designers',
        name: 'Designers',
        emoji: '🎨',
        desc: 'Graphics, logos, branding, presentations, UI/UX and print collateral.',
        status: 'live',
        brief: 'designer_editor',
        briefRole: 'designer',
      },
      {
        id: 'editors',
        name: 'Video Editors',
        emoji: '🖥️',
        desc: 'Reels, long-form edits, ads, corporate videos and motion graphics.',
        status: 'live',
        brief: 'designer_editor',
        briefRole: 'editor',
      },
      {
        id: 'creative-director',
        name: 'Creative Director',
        emoji: '🎬',
        desc: 'Oversees creative vision and brand direction across all content.',
        status: 'live',
        brief: 'creative_director',
      },
      {
        id: 'copywriters',
        name: 'Copy / Content Writers',
        emoji: '✍️',
        desc: 'Creates compelling copy and content that speaks to your audience.',
        status: 'live',
        brief: 'copy_content_writer',
      },
      {
        id: 'social-media-managers',
        name: 'Social Media Managers',
        emoji: '📣',
        desc: "Manages and grows your brand's presence across social platforms.",
        status: 'live',
        brief: 'social_media_manager',
      },
      {
        id: 'videographers',
        name: 'Videographers',
        emoji: '🎥',
        desc: 'Captures high-quality video content that tells your brand story.',
        status: 'live',
        brief: 'videographer',
      },
      {
        id: 'photographers',
        name: 'Photographers',
        emoji: '📷',
        desc: 'Captures high-quality photography for products, brands and events.',
        status: 'live',
        brief: 'photographer',
      },
      {
        id: 'ai-creators',
        name: 'AI Video & Image Creator',
        emoji: '🤖',
        desc: 'AI-generated visuals and video to accelerate your creative output.',
        status: 'live',
        brief: 'ai_video_image_creator',
      },
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing',
    shortName: 'Marketing',
    emoji: '📣',
    badge: 'Beta',
    description:
      'Growth-focused marketing support across digital, offline and PR — ad specialists, digital marketers, offline marketers and PR experts on one subscription.',
    tags: ['Digital', 'Offline', 'PR', 'Ads'],
    items: [
      {
        id: 'ad-specialists',
        name: 'Ad Specialists',
        emoji: '🎯',
        desc: 'Plans, runs and optimises paid campaigns on Google, Meta, LinkedIn and more — built around ROI.',
        status: 'live',
        brief: 'ads_specialist',
      },
      {
        id: 'seo-specialists',
        name: 'SEO Specialists',
        emoji: '🔍',
        desc: 'Improves search visibility, drives organic traffic and builds inbound growth.',
        status: 'live',
        brief: 'seo_specialist',
      },
      {
        id: 'digital-marketing-team',
        name: 'Digital Marketing Team',
        emoji: '📊',
        desc: 'A full team on strategy, execution, analytics and optimisation across channels.',
        status: 'live',
        brief: 'digital_marketing_team',
      },
      {
        id: 'influencer-marketing',
        name: 'Influencer Marketing Experts',
        emoji: '🤝',
        desc: 'Connects your brand with the right creators for trust, reach and conversions.',
        status: 'live',
        brief: 'influencer_marketing',
      },
      {
        id: 'offline-marketing',
        name: 'Offline Marketing Specialists',
        emoji: '📢',
        desc: 'On-ground campaigns, activations and traditional marketing for local presence.',
        status: 'live',
        brief: 'offline_marketing',
      },
    ],
  },
  {
    id: 'accounts-finance',
    name: 'Accounts & Finance',
    shortName: 'Finance',
    emoji: '📊',
    badge: 'Beta',
    description:
      'Bookkeeping, payroll, tax planning, financial reporting and fractional CFO support — your finance back office, fully managed.',
    tags: ['Bookkeeping', 'Tax', 'CFO'],
    items: [
      {
        id: 'accountants',
        name: 'Accountants',
        emoji: '🧾',
        desc: 'Day-to-day bookkeeping, transactions and financial records, kept accurate.',
        status: 'live',
        brief: 'accountant',
      },
      {
        id: 'cfo-ca',
        name: 'CFOs / CAs',
        emoji: '📈',
        desc: 'Strategic financial guidance, planning and high-level business insight.',
        status: 'live',
        brief: 'cfo_ca',
      },
      {
        id: 'gst-experts',
        name: 'GST Experts',
        emoji: '🧮',
        desc: 'GST filings, compliance and advisory for smooth tax operations.',
        status: 'live',
        brief: 'gst_experts',
      },
      {
        id: 'tds-experts',
        name: 'TDS Experts',
        emoji: '📑',
        desc: 'TDS calculations, deductions and timely filings without errors.',
        status: 'live',
        brief: 'tds_experts',
      },
      {
        id: 'labour-law',
        name: 'Labour Law Experts',
        emoji: '⚖️',
        desc: 'Employment law, payroll regulation and statutory compliance.',
        status: 'live',
        brief: 'labour_law',
      },
      {
        id: 'incorporation',
        name: 'Incorporation & Licenses',
        emoji: '🏢',
        desc: 'Company registration, legal structuring and business licences.',
        status: 'live',
        brief: 'incorporation',
      },
    ],
  },
  {
    id: 'tech',
    name: 'Tech',
    shortName: 'Tech',
    emoji: '💻',
    badge: 'Pilot run',
    description:
      'Web development, app building, automation and software solutions — from MVPs to full platforms, built to scale with your brand.',
    tags: ['Web Dev', 'Apps', 'Automation'],
    items: [
      {
        id: 'web-development',
        name: 'Web Development',
        emoji: '🌐',
        desc: 'Websites and web platforms built to scale with your brand.',
        status: 'live',
        brief: 'web_development',
      },
      {
        id: 'app-building',
        name: 'App Building',
        emoji: '📱',
        desc: 'Mobile apps — from quick MVPs to full production platforms.',
        status: 'live',
        brief: 'app_building',
      },
      {
        id: 'automation',
        name: 'Automation',
        emoji: '⚙️',
        desc: 'Workflows and automations that cut manual work and save time.',
        status: 'live',
        brief: 'automation',
      },
      {
        id: 'software-solutions',
        name: 'Software Solutions',
        emoji: '🛠️',
        desc: 'Custom software built around how your business actually works.',
        status: 'live',
        brief: 'software_solutions',
      },
    ],
  },
  {
    id: 'legal',
    name: 'Legal',
    shortName: 'Legal',
    emoji: '⚖️',
    description:
      'Contract drafting, IP protection, compliance and business formation — legal support without the hourly rates.',
    tags: ['Contracts', 'Compliance', 'IP'],
    items: [
      {
        id: 'contract-drafting',
        name: 'Contract Drafting',
        emoji: '📄',
        desc: 'Contracts drafted and reviewed — without the hourly rates.',
        status: 'live',
        brief: 'contract_drafting',
      },
      {
        id: 'ip-protection',
        name: 'IP Protection',
        emoji: '🛡️',
        desc: 'Trademarks, copyrights and intellectual property kept protected.',
        status: 'live',
        brief: 'ip_protection',
      },
      {
        id: 'compliance',
        name: 'Compliance',
        emoji: '✅',
        desc: 'Stay on the right side of the regulations that affect your business.',
        status: 'live',
        brief: 'compliance',
      },
      {
        id: 'business-formation',
        name: 'Business Formation',
        emoji: '🏢',
        desc: 'Company registration, structuring and formation support.',
        status: 'live',
        brief: 'business_formation',
      },
    ],
  },
  {
    id: 'hiring-hr',
    name: 'Hiring & HR',
    shortName: 'Hiring & HR',
    emoji: '🤝',
    description:
      'End-to-end hiring support, team building and HR process management for growing brands.',
    tags: ['Recruiting', 'HR', 'Onboarding'],
    items: [
      {
        id: 'end-to-end-hiring',
        name: 'End-to-End Hiring',
        emoji: '🎯',
        desc: 'Sourcing, screening and closing the right candidates for your team.',
        status: 'live',
        brief: 'end_to_end_hiring',
      },
      {
        id: 'team-building',
        name: 'Team Building',
        emoji: '🏗️',
        desc: 'Build strong, well-rounded teams as your brand grows.',
        status: 'live',
        brief: 'team_building',
      },
      {
        id: 'hr-process',
        name: 'HR Process Management',
        emoji: '🗂️',
        desc: 'Onboarding, policies and day-to-day HR operations handled for you.',
        status: 'live',
        brief: 'hr_process',
      },
    ],
  },
];

export function liveItemCount(squad: Squad): number {
  return squad.items.filter((i) => i.status === 'live').length;
}

/** Every bookable item, in squad order — used for "available now" shortcuts. */
export const LIVE_ITEMS: { squadId: string; item: SquadItem }[] = SERVICE_SQUADS.flatMap(
  (squad) => squad.items.filter((i) => i.status === 'live').map((item) => ({ squadId: squad.id, item })),
);
