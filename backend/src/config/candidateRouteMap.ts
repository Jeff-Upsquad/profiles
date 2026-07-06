import type { CandidateSection } from '../../../shared/src/types/access.js';

/**
 * Maps each /api/admin candidates sub-path to its section + how to resolve the
 * lead's category (form_type) for that request. `enforceCandidateScope` uses
 * this to gate staff by their allowed sections + categories. Paths are matched
 * against the /api/admin-relative path (e.g. `/leads/abc-123`).
 *
 * category.kind:
 *   'lead'       — capture group [1] is a lead id        → getLeadFormType
 *   'note'       — capture group [1] is a note id        → getLeadNoteFormType
 *   'invitation' — capture group [1] is an invitation id → getInvitationFormType
 *   'queryList'  — list endpoint: validate ?form_type, else constrain the query
 *   'queryOnly'  — form_type in query/body: validate if present, else allow
 *   'none'       — section-gated only (no category subject)
 */
export type CandidateCategorySource =
  | { kind: 'lead' }
  | { kind: 'note' }
  | { kind: 'invitation' }
  | { kind: 'queryList' }
  | { kind: 'queryOnly' }
  | { kind: 'none' };

export interface CandidateRule {
  test: RegExp;
  methods?: string[];
  section: CandidateSection;
  category: CandidateCategorySource;
}

// Ordered: more specific paths first. The first match wins.
export const CANDIDATE_RULES: CandidateRule[] = [
  { test: /^\/leads\/form-fields$/, section: 'applications', category: { kind: 'queryOnly' } },
  { test: /^\/leads\/onboarding$/, section: 'onboarding', category: { kind: 'queryList' } },
  { test: /^\/leads\/notes\/([^/]+)$/, section: 'applications', category: { kind: 'note' } },
  { test: /^\/leads\/([^/]+)\/interview-invitation$/, section: 'interviews', category: { kind: 'lead' } },
  { test: /^\/leads\/([^/]+)\/notes$/, section: 'applications', category: { kind: 'lead' } },
  { test: /^\/leads\/([^/]+)\/(status|profile-type|restore|permanent)$/, section: 'applications', category: { kind: 'lead' } },
  { test: /^\/leads\/([^/]+)$/, section: 'applications', category: { kind: 'lead' } },
  { test: /^\/leads$/, section: 'applications', category: { kind: 'queryList' } },
  { test: /^\/lead-filters(\/.*)?$/, section: 'applications', category: { kind: 'none' } },
  { test: /^\/interview-invitations\/([^/]+)\/reviewed$/, section: 'interviews', category: { kind: 'invitation' } },
  { test: /^\/interview-invitations$/, section: 'interviews', category: { kind: 'queryList' } },
  { test: /^\/interview-questions(\/.*)?$/, section: 'interviews', category: { kind: 'queryOnly' } },
];

/** Find the rule + captured id for a candidates sub-path, or null if not a candidates route. */
export function matchCandidateRule(
  method: string,
  path: string,
): { rule: CandidateRule; captured?: string } | null {
  const subPath = path.replace(/^\/api\/admin/, '') || '/';
  // `/leads/stage-labels` is a shared, category-agnostic label dictionary for
  // the Leads boards — not a per-lead route. Exempt it from candidate scoping
  // so it never falls through to the `/leads/:id` rule below, which would treat
  // "stage-labels" as a lead id and 500 on the invalid-uuid lookup (silently
  // collapsing scoped staff back to the built-in stage names). Any candidates
  // viewer may read it; enforceModuleAccess already gated the 'view' grant.
  if (subPath === '/leads/stage-labels') return null;
  for (const rule of CANDIDATE_RULES) {
    if (rule.methods && !rule.methods.includes(method.toUpperCase())) continue;
    const m = subPath.match(rule.test);
    if (m) return { rule, captured: m[1] };
  }
  return null;
}
