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

// Bidding tab — all open + recent bids / offers across subscription + assignment.
router.get('/offers', assignmentOffers.talentListOffers);

router.patch(
  '/:recipientId/respond',
  validate({
    params: recipientIdParamSchema,
    body: respondToSubscriptionSchema,
  }),
  subscriptionController.respond
);

// ─── Card offers / bids (subscription + assignment) ────────────────────────
// The talent's live offer + negotiation thread for one recipient.
router.get(
  '/:recipientId/offer',
  validate({ params: recipientIdParamSchema }),
  assignmentOffers.talentGetOffer
);
// Bid / submit (unpriced) / counter (priced or ongoing) a figure.
router.post(
  '/:recipientId/offer',
  validate({ params: recipientIdParamSchema, body: submitOfferSchema }),
  assignmentOffers.talentSubmitOffer
);
// Accept / decline the business's offer, or withdraw an own bid.
router.post(
  '/:recipientId/offer/respond',
  validate({ params: recipientIdParamSchema, body: talentOfferRespondSchema }),
  assignmentOffers.talentRespond
);

export default router;
