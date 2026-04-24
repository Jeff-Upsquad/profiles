import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  listSubscriptionsQuerySchema,
  recipientIdParamSchema,
  respondToSubscriptionSchema,
} from '../validators/subscription.validators.js';

const router = Router();

router.use(authenticate, requireRole('talent'));

router.get(
  '/',
  validate({ query: listSubscriptionsQuerySchema }),
  subscriptionController.list
);

router.get('/unread-count', subscriptionController.unreadCount);

router.patch(
  '/:recipientId/respond',
  validate({
    params: recipientIdParamSchema,
    body: respondToSubscriptionSchema,
  }),
  subscriptionController.respond
);

export default router;
