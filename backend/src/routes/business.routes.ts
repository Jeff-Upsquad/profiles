import { Router } from 'express';
import * as businessController from '../controllers/business.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  updateBusinessUserSchema,
  discoverQuerySchema,
  sendInterestSchema,
  reviewCardRecipientSchema,
  selectCardRecipientSchema,
} from '../validators/business.validators.js';
import {
  profilesQuerySchema,
  filterOptionsQuerySchema,
} from '../validators/talent-access.validators.js';

const router = Router();

// All business routes require authentication + business role
router.use(authenticate, requireRole('business'));

// Business user info
router.get('/me', businessController.getMe);
router.put(
  '/me',
  validate({ body: updateBusinessUserSchema }),
  businessController.updateMe
);

// Discover talent
router.get(
  '/discover/:categorySlug',
  validate({ query: discoverQuerySchema }),
  businessController.discoverProfiles
);
router.get('/discover/:categorySlug/:id', businessController.getProfile);

// Shortlist
router.get('/shortlist', businessController.getShortlist);
router.post('/shortlist/:profileId', businessController.addToShortlist);
router.delete('/shortlist/:profileId', businessController.removeFromShortlist);

// Interest requests
router.get('/interests', businessController.getInterests);
router.post(
  '/interest/:profileId',
  validate({ body: sendInterestSchema }),
  businessController.sendInterest
);

// Subscribed categories & shared profiles (invite-only system)
router.get('/my-categories', businessController.getMyCategories);
router.get('/my-categories/:categoryId/profiles', businessController.getSharedProfiles);
router.get('/my-categories/:categoryId/profiles/:profileId', businessController.getSharedProfile);
router.get('/my-categories/:categoryId/profiles/:profileId/portfolio', businessController.getSharedProfilePortfolio);

// Subscription cards published to this business (via SquadHub webhook)
router.get('/my-subscription-cards', businessController.getMySubscriptionCards);
router.get('/my-subscription-cards/:cardId', businessController.getMySubscriptionCard);
router.get(
  '/my-subscription-cards/:cardId/shortlisted-profiles',
  businessController.getShortlistedProfilesForCard,
);

// Per-card talent review (business-side shortlist/reject/select)
router.get(
  '/my-subscription-cards/:cardId/recipients',
  businessController.getCardRecipients,
);
router.post(
  '/my-subscription-cards/:cardId/recipients/:recipientId/review',
  validate({ body: reviewCardRecipientSchema }),
  businessController.reviewCardRecipient,
);
router.post(
  '/my-subscription-cards/:cardId/select',
  validate({ body: selectCardRecipientSchema }),
  businessController.selectCardRecipient,
);

// Talent Access browsing (bridged via business user email)
router.get('/talent-access/status', businessController.getTalentAccessStatus);
router.get(
  '/talent-access/profiles',
  validate({ query: profilesQuerySchema }),
  businessController.getTalentAccessProfiles,
);
router.get('/talent-access/profiles/:id', businessController.getTalentAccessProfile);
router.get(
  '/talent-access/filter-options',
  validate({ query: filterOptionsQuerySchema }),
  businessController.getTalentAccessFilterOptions,
);

// How it works videos (active only)
router.get('/how-it-works/videos', businessController.getHowItWorksVideos);

export default router;
