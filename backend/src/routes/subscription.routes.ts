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

// "My Clients" — every card the talent has been selected on, grouped into
// Selected (waiting admin approval) vs Assigned (active), plus aggregated
// monthly earnings and hour commitments over the Assigned bucket.
router.get('/my-clients', subscriptionController.myClients);

router.patch(
  '/:recipientId/respond',
  validate({
    params: recipientIdParamSchema,
    body: respondToSubscriptionSchema,
  }),
  subscriptionController.respond
);

export default router;
