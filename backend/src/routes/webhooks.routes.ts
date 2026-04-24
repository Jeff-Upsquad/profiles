import { Router } from 'express';
import * as webhooksController from '../controllers/webhooks.controller.js';
import { verifySquadhubSecret } from '../middleware/webhookAuth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import { ingestSubscriptionCardSchema } from '../validators/subscription.validators.js';

const router = Router();

router.post(
  '/squadhub/cards',
  verifySquadhubSecret,
  validate({ body: ingestSubscriptionCardSchema }),
  webhooksController.ingestSubscriptionCard
);

export default router;
