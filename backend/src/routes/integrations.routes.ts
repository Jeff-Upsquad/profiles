import { Router } from 'express';
import * as integrationsController from '../controllers/integrations.controller.js';
import * as candidatesController from '../controllers/integrations-candidates.controller.js';
import {
  verifySquadhubSecret,
  verifySquadcrmSecret,
} from '../middleware/webhookAuth.middleware.js';

/**
 * Signed integration surface that SquadHub talks to. One shared-secret
 * middleware (verifySquadhubSecret) gates the /squadhub/* routes — a caller
 * that can read the category list can also drive the talent picker and the
 * Profile Access grant lifecycle, because the secret only lives on the
 * SquadHub server.
 *
 *   /squadhub/categories                  — category metadata for targeting UI
 *   /squadhub/talents/search              — talent identity for manual-assign
 *   /squadhub/talent-access/grants (CRUD) — Profile Access grants originated
 *                                            from SquadHub's user-app tab
 *
 * The /squadcrm/* routes are gated by verifySquadcrmSecret (paired with the
 * webhook side at /webhooks/squadcrm/lead-stage). The SquadHire CRM (shcrm)
 * calls these directly — no SquadHub detour.
 *
 *   /squadcrm/talents/lookup-by-phone     — talent admin deep-link by phone
 */

const router = Router();

router.get(
  '/squadhub/categories',
  verifySquadhubSecret,
  integrationsController.getCategories,
);

router.get(
  '/squadhub/talents/search',
  verifySquadhubSecret,
  integrationsController.searchTalents,
);

router.post(
  '/squadhub/users/lookup',
  verifySquadhubSecret,
  integrationsController.lookupUsersByEmail,
);

// Batch talent availability (self-declared virtual office hours → weekly hours),
// keyed by talent_user_id. Powers the "available hours" column in SquadHub's
// Subscription Assignments per-user view.
router.post(
  '/squadhub/talents/availability',
  verifySquadhubSecret,
  integrationsController.getTalentAvailability,
);

// Batch talent account status (active / inactive / suspended), keyed by
// talent_user_id. SquadHub tags former assignees on a subscription card with
// the talent's current SquadHire standing.
router.post(
  '/squadhub/talents/status',
  verifySquadhubSecret,
  integrationsController.getTalentStatus,
);

// Talent access grants — SquadHub originates and we mirror.
router.post(
  '/squadhub/talent-access/grants',
  verifySquadhubSecret,
  integrationsController.createSquadhubGrant,
);
router.patch(
  '/squadhub/talent-access/grants/:id',
  verifySquadhubSecret,
  integrationsController.updateSquadhubGrant,
);
router.delete(
  '/squadhub/talent-access/grants/:id',
  verifySquadhubSecret,
  integrationsController.deleteSquadhubGrant,
);

// Candidates — SquadHub's "Candidates" mini app reads/writes lead_submissions
// through this signed surface. Reads are full; writes (status, notes, soft
// delete/restore) are authored by the SquadHub service identity. Heavier
// actions (permanent delete, interview invites, talent onboarding) are
// deliberately NOT exposed here and stay in SquadHire's own admin.
router.get('/squadhub/candidates', verifySquadhubSecret, candidatesController.listCandidates);
// Literal sub-collections (forms / onboarding / interviews) must precede the /:id route.
router.get('/squadhub/candidates/forms', verifySquadhubSecret, candidatesController.listPublicForms);
router.get('/squadhub/candidates/onboarding', verifySquadhubSecret, candidatesController.listOnboarding);
router.get('/squadhub/candidates/interviews', verifySquadhubSecret, candidatesController.listInterviews);
router.patch('/squadhub/candidates/interviews/:id/reviewed', verifySquadhubSecret, candidatesController.setInterviewReviewed);
// Category resolvers for SquadHub's permission checks (literal paths, before /:id).
router.get('/squadhub/candidates/interviews/:id/form-type', verifySquadhubSecret, candidatesController.getInterviewFormType);
router.get('/squadhub/candidates/notes/:noteId/form-type', verifySquadhubSecret, candidatesController.getCandidateNoteFormType);
router.get('/squadhub/candidates/:id', verifySquadhubSecret, candidatesController.getCandidate);
router.patch('/squadhub/candidates/:id/status', verifySquadhubSecret, candidatesController.updateCandidateStatus);
router.get('/squadhub/candidates/:id/notes', verifySquadhubSecret, candidatesController.listCandidateNotes);
router.post('/squadhub/candidates/:id/notes', verifySquadhubSecret, candidatesController.createCandidateNote);
router.patch('/squadhub/candidates/notes/:noteId', verifySquadhubSecret, candidatesController.updateCandidateNote);
router.delete('/squadhub/candidates/notes/:noteId', verifySquadhubSecret, candidatesController.deleteCandidateNote);
router.delete('/squadhub/candidates/:id', verifySquadhubSecret, candidatesController.softDeleteCandidate);
router.patch('/squadhub/candidates/:id/restore', verifySquadhubSecret, candidatesController.restoreCandidate);

// SquadHire CRM — phone-keyed talent lookup. Returns the deep-link to admin
// (or null when SQUADHIRE_ADMIN_URL is unset) plus the talent's name and
// profile_status, so the CRM can show a clickable badge or a "no profile"
// disabled state at the top of chat / lead views.
router.post(
  '/squadcrm/talents/lookup-by-phone',
  verifySquadcrmSecret,
  integrationsController.lookupTalentByPhone,
);

export default router;
