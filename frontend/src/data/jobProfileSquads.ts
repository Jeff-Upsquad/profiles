import type { Category } from '@/types';

export interface ProfileSquad {
  id: string;
  name: string;
  shortName: string;
  emoji: string;
  description: string;
  tags?: string[];
  categorySlugs: string[];
}

export const PROFILE_SQUADS: ProfileSquad[] = [
  {
    id: 'content-creation',
    name: 'Content Creation Squad',
    shortName: 'Content Creation',
    emoji: '🎬',
    description: 'Designers, video editors, creative leads, social media managers, videographers, photographers, and copywriters.',
    tags: ['Design', 'Video', 'Social', 'Copywriting'],
    categorySlugs: [
      'designer',
      'video-editor',
      'creative-director',
      'copy-content-writer',
      'social-media-manager',
      'videographer',
      'photographer',
      'videographer-photographer',
      'ai-video-image-creator',
    ],
  },
  {
    id: 'marketing',
    name: 'Marketing Squad',
    shortName: 'Marketing',
    emoji: '📣',
    description: 'Growth-focused marketing support across digital, performance ads, SEO, and PR.',
    tags: ['Ads', 'Digital', 'SEO', 'PR'],
    categorySlugs: [
      'ads-specialist',
      'seo-specialist',
      'digital-marketing-team',
      'influencer-marketing',
      'offline-marketing',
    ],
  },
  {
    id: 'accounts-finance',
    name: 'Accounts & Finance Squad',
    shortName: 'Accounts & Finance',
    emoji: '📊',
    description: 'Bookkeeping, payroll, tax planning, financial reporting, and compliance.',
    tags: ['Bookkeeping', 'Tax', 'Compliance'],
    categorySlugs: [
      'accountant',
      'cfo-ca',
      'gst-experts',
      'tds-experts',
      'labour-law',
      'incorporation',
    ],
  },
  {
    id: 'sales',
    name: 'Sales Squad',
    shortName: 'Sales',
    emoji: '💼',
    description: 'B2B/B2C sales, lead generation, prospecting, inside sales, and deal closing.',
    tags: ['B2B Sales', 'Lead Gen', 'Closing'],
    categorySlugs: [
      'sales',
      'business-development',
      'inside-sales',
      'account-management',
    ],
  },
  {
    id: 'tech',
    name: 'Tech Squad',
    shortName: 'Tech',
    emoji: '💻',
    description: 'Web development, mobile apps, software solutions, and automations.',
    tags: ['Web Dev', 'Apps', 'Automation'],
    categorySlugs: [
      'web-development',
      'app-building',
      'automation',
      'software-solutions',
    ],
  },
  {
    id: 'legal',
    name: 'Legal Squad',
    shortName: 'Legal',
    emoji: '⚖️',
    description: 'Contract drafting, IP protection, compliance, and business formation.',
    tags: ['Contracts', 'Compliance', 'IP'],
    categorySlugs: [
      'contract-drafting',
      'ip-protection',
      'compliance',
      'business-formation',
    ],
  },
  {
    id: 'hiring-hr',
    name: 'Hiring & HR Squad',
    shortName: 'Hiring & HR',
    emoji: '🤝',
    description: 'End-to-end recruitment, team building, and HR operations.',
    tags: ['Recruiting', 'HR', 'Onboarding'],
    categorySlugs: [
      'end-to-end-hiring',
      'team-building',
      'hr-process',
    ],
  },
];

export interface SquadWithCategories {
  squad: ProfileSquad;
  categories: Category[];
}

export function groupCategoriesBySquad(
  categories: Category[],
  searchQuery = '',
  selectedSquadId = 'all',
): SquadWithCategories[] {
  const query = searchQuery.trim().toLowerCase();

  const categorySquadMap = new Map<string, ProfileSquad>();
  for (const squad of PROFILE_SQUADS) {
    for (const slug of squad.categorySlugs) {
      categorySquadMap.set(slug, squad);
    }
  }

  const fallbackSquad: ProfileSquad = {
    id: 'other',
    name: 'Other Squads',
    shortName: 'Other',
    emoji: '✨',
    description: 'Specialized roles and emerging squad capabilities.',
    categorySlugs: [],
  };

  const grouped = new Map<string, { squad: ProfileSquad; categories: Category[] }>();

  // Maintain squad order
  for (const squad of PROFILE_SQUADS) {
    grouped.set(squad.id, { squad, categories: [] });
  }

  for (const cat of categories) {
    const squad = categorySquadMap.get(cat.slug) ?? fallbackSquad;

    if (query) {
      const nameMatch = cat.name.toLowerCase().includes(query);
      const descMatch = (cat.description ?? '').toLowerCase().includes(query);
      const squadMatch =
        squad.name.toLowerCase().includes(query) || squad.shortName.toLowerCase().includes(query);
      if (!nameMatch && !descMatch && !squadMatch) {
        continue;
      }
    }

    if (!grouped.has(squad.id)) {
      grouped.set(squad.id, { squad, categories: [] });
    }
    grouped.get(squad.id)!.categories.push(cat);
  }

  const result: SquadWithCategories[] = [];
  for (const entry of grouped.values()) {
    if (selectedSquadId !== 'all' && entry.squad.id !== selectedSquadId) {
      continue;
    }
    if (entry.categories.length > 0) {
      result.push(entry);
    }
  }

  return result;
}
