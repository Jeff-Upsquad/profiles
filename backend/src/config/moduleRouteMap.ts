import type { ModulePermission } from '../../../shared/src/types/access.js';

/**
 * Declarative map from an /api/admin/* sub-path to the module that owns it.
 * `enforceModuleAccess` resolves (module, requiredLevel) for each request and
 * checks the staff user's live grant. Full admins bypass entirely.
 *
 * Paths here are RELATIVE to the /api/admin mount (e.g. req.path === '/categories').
 * Rules are matched in order; the FIRST matching prefix wins, so list more
 * specific prefixes before broader ones. Unmatched admin paths are denied for
 * staff by default (full admins still pass).
 */
export interface ModuleRule {
  prefix: string;
  module: string;
}

// Order matters where one prefix is a substring of another at a path boundary.
export const MODULE_ROUTE_RULES: ModuleRule[] = [
  { prefix: '/dashboard', module: 'dashboard' },

  // Categories + the per-category template editors (skills/tools/ai-tools/genres)
  { prefix: '/categories', module: 'categories' },
  { prefix: '/fields', module: 'categories' },
  { prefix: '/skills', module: 'categories' },
  { prefix: '/tools', module: 'categories' },
  { prefix: '/ai-tools', module: 'categories' },
  { prefix: '/portfolio-categories', module: 'categories' },

  { prefix: '/reviews', module: 'reviews' },

  // Approvals = pending-signup approvals + auto-approve toggle
  { prefix: '/user-approvals', module: 'approvals' },
  { prefix: '/settings/auto-approve', module: 'approvals' },

  { prefix: '/talent-access', module: 'talent-access' },
  { prefix: '/talent-app', module: 'talent-app' },
  { prefix: '/talents', module: 'talents' },

  { prefix: '/invitations', module: 'invitations' },
  { prefix: '/business', module: 'business' },
  { prefix: '/access-requests', module: 'access-requests' },
  { prefix: '/shortlists', module: 'shortlists' },
  { prefix: '/conversations', module: 'conversations' },

  { prefix: '/search', module: 'users' },
  { prefix: '/users', module: 'users' },

  { prefix: '/recycle-bin', module: 'archive' },

  // Published Cards = subscription cards + requests
  { prefix: '/subscription-cards', module: 'published-cards' },
  { prefix: '/subscription-requests', module: 'published-cards' },

  // Candidates = leads + per-lead notes/interview flow + saved filters
  { prefix: '/lead-filters', module: 'candidates' },
  { prefix: '/leads', module: 'candidates' },
  { prefix: '/interview-questions', module: 'candidates' },
  { prefix: '/interview-invitations', module: 'candidates' },

  { prefix: '/forms', module: 'forms' },
  { prefix: '/training', module: 'training' },
  { prefix: '/how-it-works', module: 'how-it-works' },

  // Automations = automation settings/events + CRM-sync action
  { prefix: '/settings/automation', module: 'automations' },
  { prefix: '/automation', module: 'automations' },

  { prefix: '/settings/crm-status-mapping', module: 'crm-mapping' },

  { prefix: '/notifications', module: 'notifications' },

  { prefix: '/agencies', module: 'agencies' },

  // Team & Access management API (staff CRUD + grants + module registry)
  { prefix: '/staff', module: 'team-access' },
  { prefix: '/modules', module: 'team-access' },
];

/** HTTP method -> minimum tier required. */
export function levelForMethod(method: string): ModulePermission {
  switch (method.toUpperCase()) {
    case 'GET':
    case 'HEAD':
      return 'view';
    case 'DELETE':
      return 'full';
    default: // POST / PUT / PATCH
      return 'edit';
  }
}

/** Resolve which module owns a given /api/admin sub-path (or null if unmapped). */
export function resolveModule(path: string): string | null {
  for (const rule of MODULE_ROUTE_RULES) {
    if (path === rule.prefix || path.startsWith(rule.prefix + '/')) {
      return rule.module;
    }
  }
  return null;
}
