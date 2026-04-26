import { Router } from 'express';
import * as webhooksController from '../controllers/webhooks.controller.js';
import { verifySquadhubSecret } from '../middleware/webhookAuth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  ingestSubscriptionCardSchema,
  removeTalentFromCardSchema,
  externalIdParamSchema,
} from '../validators/subscription.validators.js';

const router = Router();

router.post(
  '/squadhub/cards',
  verifySquadhubSecret,
  validate({ body: ingestSubscriptionCardSchema }),
  webhooksController.ingestSubscriptionCard
);

// Hide a previously-shared talent from the linked business's dashboard.
// Idempotent: returns { removed: 0 } if the row was already gone.
router.post(
  '/squadhub/cards/:externalId/remove-talent',
  verifySquadhubSecret,
  validate({ params: externalIdParamSchema, body: removeTalentFromCardSchema }),
  webhooksController.removeTalentFromCard
);

export default router;
