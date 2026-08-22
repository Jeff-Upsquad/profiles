import { Router } from 'express';
import * as integrationsController from '../controllers/integrations.controller.js';
import * as candidatesController from '../controllers/integrations-candidates.controller.js';
import {
  verifySquadhubSecret,
  verifySquadcrmSecret,
  verifySquadcrmProvisionSecret,
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
 *
 * Provision + pending-brief use verifySquadcrmProvisionSecret (original Squad
 * CRM at crm.squadhub.in):
 *
 *   /squadcrm/business/provision          — give SQUADHire access
 *   /squadcrm/pending-brief               — business-visible submitted card
 *   /squadcrm/rooms/{list,get,send}       — CRM's window onto intro rooms
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

// Resolve a business_users row by email/phone for SquadHub's client Connections
// deep-link ("Open in SquadHire").
router.post(
  '/squadhub/business/lookup',
  verifySquadhubSecret,
  integrationsController.lookupBusinessUser,
);

// First-login credential seeding: confirm an email + password really is this
// business's SquadHire login so SquadHub can create their account with the same
// password. Identity only — no token is minted, and no password ever comes back
// the other way. See business-auth.service.verifyBusinessCredentials.
router.post(
  '/squadhub/business/verify-credentials',
  verifySquadhubSecret,
  integrationsController.verifyBusinessCredentials,
);

// Auto-login hand-off: redeem the one-time code a business carried from the
// SquadHire portal's SquadHub tab for their identity, so SquadHub can start
// their session without asking for credentials it already provisioned around.
router.post(
  '/squadhub/business/sso/token',
  verifySquadhubSecret,
  integrationsController.redeemBusinessSsoCode,
);

// Talent auto-login hand-off. Deliberately its own path + table so a talent
// code can never be redeemed as a business (or vice versa) — the talent lands
// as a partner on SquadHub, the business as a client.
router.post(
  '/squadhub/talent/sso/token',
  verifySquadhubSecret,
  integrationsController.redeemTalentSsoCode,
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

// Original Squad CRM → provision a business user when a deal enters the
// "Give SQUADHire Access" stage. Gated by its own SQUADCRM_PROVISION_SECRET.
router.post(
  '/squadcrm/business/provision',
  verifySquadcrmProvisionSecret,
  integrationsController.provisionBusinessUser,
);

// Original Squad CRM → pending brief (business-visible, no talent fan-out).
// Same provision secret as /business/provision.
router.post(
  '/squadcrm/pending-brief',
  verifySquadcrmProvisionSecret,
  integrationsController.ingestPendingBrief,
);

// Original Squad CRM → chat rooms. The salesperson who owns a requirement card
// reads and answers its intro rooms from inside CRM; SquadHire stays canonical
// for the thread. CRM sends the card ids it may see with every call.
router.post(
  '/squadcrm/rooms/list',
  verifySquadcrmProvisionSecret,
  integrationsController.listSquadcrmRooms,
);
router.post(
  '/squadcrm/rooms/get',
  verifySquadcrmProvisionSecret,
  integrationsController.getSquadcrmRoom,
);
router.post(
  '/squadcrm/rooms/send',
  verifySquadcrmProvisionSecret,
  integrationsController.sendSquadcrmRoomMessage,
);

export default router;
