import { Router } from 'express';
import * as subscriptionController from '../controllers/subscription.controller.js';
import * as assignmentOffers from '../controllers/assignment-offers.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  listSubscriptionsQuerySchema,
  recipientIdParamSchema,
  respondToSubscriptionSchema,
} from '../validators/subscription.validators.js';
import {
  submitOfferSchema,
  talentOfferRespondSchema,
} from '../validators/assignment-offers.validators.js';

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

// ─── Assignment offers / counter-offers (card_type='assignment') ───────────
// The talent's live offer + negotiation thread for one recipient.
router.get(
  '/:recipientId/offer',
  validate({ params: recipientIdParamSchema }),
  assignmentOffers.talentGetOffer
);
// Submit (unpriced) or counter (priced / ongoing) a figure.
router.post(
  '/:recipientId/offer',
  validate({ params: recipientIdParamSchema, body: submitOfferSchema }),
  assignmentOffers.talentSubmitOffer
);
// Accept / decline the business's counter, or withdraw an own submission.
router.post(
  '/:recipientId/offer/respond',
  validate({ params: recipientIdParamSchema, body: talentOfferRespondSchema }),
  assignmentOffers.talentRespond
);

export default router;
