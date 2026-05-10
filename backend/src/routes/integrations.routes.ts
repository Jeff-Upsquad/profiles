import { Router } from 'express';
import * as integrationsController from '../controllers/integrations.controller.js';
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
