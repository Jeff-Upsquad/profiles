import type { ReactNode } from 'react';

/**
 * The single source of truth for the admin sidebar AND the per-module access
 * model. `module` is the permission slug (matches the `admin_modules` registry
 * seeded in migration 00091). The shared shell filters these by the current
 * user's grants; the staff app re-exports the matching pages.
 *
 * Note: Partner Program / Freelance / Jobs are three views of the same
 * `talents` module (filtered by ?type=), so they share one slug.
 */
export interface ModuleNavItem {
  label: string;
  href: string;
  module: string;
  icon: ReactNode;
}

export interface ModuleNavSection {
  section: string;
  items: ModuleNavItem[];
}

const icon = (d: string | string[]) => (
  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {(Array.isArray(d) ? d : [d]).map((path, i) => (
      <path key={i} strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d={path} />
    ))}
  </svg>
);

export const NAV_SECTIONS: ModuleNavSection[] = [
  {
    section: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/',
        module: 'dashboard',
        icon: icon('M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6'),
      },
    ],
  },
  {
    section: 'Talent',
    items: [
      {
        label: 'Partner Program',
        href: '/talents?type=partner_program',
        module: 'talents',
        icon: icon('M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'),
      },
      {
        label: 'Freelance',
        href: '/talents?type=freelance',
        module: 'talents',
        icon: icon('M13 10V3L4 14h7v7l9-11h-7z'),
      },
      {
        label: 'Jobs',
        href: '/talents?type=salary',
        module: 'talents',
        icon: icon('M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'),
      },
      {
        label: 'Invitations',
        href: '/invitations',
        module: 'invitations',
        icon: icon('M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z'),
      },
      {
        label: 'Approvals',
        href: '/approvals',
        module: 'approvals',
        icon: icon('M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z'),
      },
      {
        label: 'Reviews',
        href: '/reviews',
        module: 'reviews',
        icon: icon('M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4'),
      },
      {
        label: 'Training',
        href: '/training',
        module: 'training',
        icon: icon([
          'M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z',
          'M21 12a9 9 0 11-18 0 9 9 0 0118 0z',
        ]),
      },
    ],
  },
  {
    section: 'Clients & Pipeline',
    items: [
      {
        label: 'Business',
        href: '/business',
        module: 'business',
        icon: icon('M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4'),
      },
      {
        label: 'Candidates',
        href: '/leads',
        module: 'candidates',
        icon: icon('M11 5.882V19.24a1.76 1.76 0 01-3.417.592l-2.147-6.15M18 13a3 3 0 100-6M5.436 13.683A4.001 4.001 0 017 6h1.832c4.1 0 7.625-1.234 9.168-3v14c-1.543-1.766-5.067-3-9.168-3H7a3.988 3.988 0 01-1.564-.317z'),
      },
      {
        label: 'Shortlists',
        href: '/shortlists',
        module: 'shortlists',
        icon: icon('M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z'),
      },
      {
        label: 'Published Cards',
        href: '/published-cards',
        module: 'published-cards',
        icon: icon('M2.25 7.125C2.25 6.504 2.754 6 3.375 6h6c.621 0 1.125.504 1.125 1.125v3.75c0 .621-.504 1.125-1.125 1.125h-6a1.125 1.125 0 01-1.125-1.125v-3.75zM14.25 8.625c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v8.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-8.25zM3.75 16.125c0-.621.504-1.125 1.125-1.125h5.25c.621 0 1.125.504 1.125 1.125v2.25c0 .621-.504 1.125-1.125 1.125h-5.25a1.125 1.125 0 01-1.125-1.125v-2.25z'),
      },
      {
        label: 'Talent Access',
        href: '/talent-access',
        module: 'talent-access',
        icon: icon([
          'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
          'M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z',
        ]),
      },
    ],
  },
  {
    section: 'Content',
    items: [
      {
        label: 'Categories',
        href: '/categories',
        module: 'categories',
        icon: icon('M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10'),
      },
      {
        label: 'How it works',
        href: '/how-it-works',
        module: 'how-it-works',
        icon: icon('M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z'),
      },
      {
        label: 'Public Forms',
        href: '/forms',
        module: 'forms',
        icon: icon('M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z'),
      },
      {
        label: 'Notifications',
        href: '/notifications',
        module: 'notifications',
        icon: icon('M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9'),
      },
    ],
  },
  {
    section: 'System',
    items: [
      {
        label: 'Users',
        href: '/users',
        module: 'users',
        icon: icon('M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z'),
      },
      {
        label: 'Talent App',
        href: '/talent-app',
        module: 'talent-app',
        icon: icon('M12 18h.01M8 21h8a1 1 0 001-1V4a1 1 0 00-1-1H8a1 1 0 00-1 1v16a1 1 0 001 1z'),
      },
      {
        label: 'Access Requests',
        href: '/access-requests',
        module: 'access-requests',
        icon: icon('M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z'),
      },
      {
        label: 'Automations',
        href: '/automations',
        module: 'automations',
        icon: icon([
          'M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.066 2.573c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.573 1.066c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.066-2.573c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z',
          'M15 12a3 3 0 11-6 0 3 3 0 016 0z',
        ]),
      },
      {
        label: 'CRM Mapping',
        href: '/crm-mapping',
        module: 'crm-mapping',
        icon: icon('M7.5 21L3 16.5m0 0L7.5 12M3 16.5h13.5m0-13.5L21 7.5m0 0L16.5 12M21 7.5H7.5'),
      },
      {
        label: 'Archive',
        href: '/recycle-bin',
        module: 'archive',
        icon: icon('M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16'),
      },
      {
        label: 'Team & Access',
        href: '/team-access',
        module: 'team-access',
        icon: icon([
          'M12 4.354a4 4 0 110 5.292M15 21H3v-1a6 6 0 0112 0v1zm0 0h6v-1a6 6 0 00-9-5.197M13 7a4 4 0 11-8 0 4 4 0 018 0z',
          'M9 12l2 2 4-4',
        ]),
      },
    ],
  },
];
