import { Router } from 'express';
import * as integrationsController from '../controllers/integrations.controller.js';
import { verifySquadhubSecret } from '../middleware/webhookAuth.middleware.js';

/**
 * Signed integration surface that SquadHub talks to. One shared-secret
 * middleware (verifySquadhubSecret) gates all of these — a caller that
 * can read the category list can also drive the talent picker and the
 * Profile Access grant lifecycle, because the secret only lives on the
 * SquadHub server.
 *
 *   /squadhub/categories                  — category metadata for targeting UI
 *   /squadhub/talents/search              — talent identity for manual-assign
 *   /squadhub/talent-access/grants (CRUD) — Profile Access grants originated
 *                                            from SquadHub's user-app tab
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

export default router;
