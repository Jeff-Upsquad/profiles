import { Router } from 'express';
import * as integrationsController from '../controllers/integrations.controller.js';
import { verifySquadhubSecret } from '../middleware/webhookAuth.middleware.js';

/**
 * Signed read-through endpoints + grant CRUD that SquadHub uses for the
 * Profile Access feature. Single shared-secret middleware: a caller that
 * can read the category list can also issue grants on behalf of a SquadHub
 * user, since the secret only lives on the SquadHub server.
 */

const router = Router();

router.get(
  '/squadhub/categories',
  verifySquadhubSecret,
  integrationsController.getCategories,
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
