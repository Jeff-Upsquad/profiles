import { Router } from 'express';
import * as integrationsController from '../controllers/integrations.controller.js';
import { verifySquadhubSecret } from '../middleware/webhookAuth.middleware.js';

/**
 * Signed read-through endpoints that SquadHub proxies to when populating
 * admin-facing targeting UI. Same shared-secret scheme as the inbound
 * card ingest webhook — a caller that can write a card can also read this
 * surface.
 *
 *   /squadhub/categories         — public-ish category metadata
 *   /squadhub/talents/search     — minimal talent identity for the manual-
 *                                  assign picker on SquadHub admin
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

export default router;
