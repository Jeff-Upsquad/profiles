import { Router } from 'express';
import * as integrationsController from '../controllers/integrations.controller.js';
import { verifySquadhubSecret } from '../middleware/webhookAuth.middleware.js';

/**
 * Signed read-through endpoints that SquadHub proxies to when populating
 * admin-facing targeting UI. Same shared-secret scheme as the inbound
 * card ingest webhook — a caller that can write a card can also read the
 * category list, which is the only data we need to expose today.
 */

const router = Router();

router.get(
  '/squadhub/categories',
  verifySquadhubSecret,
  integrationsController.getCategories,
);

export default router;
