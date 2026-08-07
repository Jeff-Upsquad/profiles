import { Router } from 'express';
import * as businessController from '../controllers/business.controller.js';
import * as assignmentOffers from '../controllers/assignment-offers.controller.js';
import * as connectBriefController from '../controllers/connect-brief.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  businessCounterSchema,
  businessOfferActionSchema,
  cardIdOfferIdParamSchema,
  cardIdParamSchema,
} from '../validators/assignment-offers.validators.js';
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
import {
  businessLocationIdParamSchema,
  businessLocationSchema,
  businessNotificationIdParamSchema,
} from '../validators/jobs.validators.js';
import { connectBriefSchema } from '../validators/connect-brief.validators.js';

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
// Freelance assignment cards — separate list, same card shape. Detail and
// recipient-review routes below are shared (resolved by card id, not type).
router.get('/my-assignment-cards', businessController.getMyAssignmentCards);
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
  '/my-subscription-cards/:cardId/recipients/seen',
  businessController.markCardAcceptancesSeen,
);
router.post(
  '/my-subscription-cards/:cardId/select',
  validate({ body: selectCardRecipientSchema }),
  businessController.selectCardRecipient,
);

// ─── Assignment offers / counter-offers (card_type='assignment') ───────────
// The business reviews talents' offers and negotiates: counter, or accept
// (accept = select that talent), or decline. Unlimited rounds.
router.get(
  '/my-assignment-cards/:cardId/offers',
  validate({ params: cardIdParamSchema }),
  assignmentOffers.businessListOffers,
);
router.post(
  '/my-assignment-cards/:cardId/offers/:offerId/counter',
  validate({ params: cardIdOfferIdParamSchema, body: businessCounterSchema }),
  assignmentOffers.businessCounter,
);
router.post(
  '/my-assignment-cards/:cardId/offers/:offerId/accept',
  validate({ params: cardIdOfferIdParamSchema, body: businessOfferActionSchema }),
  assignmentOffers.businessAccept,
);
router.post(
  '/my-assignment-cards/:cardId/offers/:offerId/decline',
  validate({ params: cardIdOfferIdParamSchema, body: businessOfferActionSchema }),
  assignmentOffers.businessDecline,
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

// Saved interview locations (jobs module) — reusable venues for the
// physical-interview scheduler dropdown. Delete is a soft-deactivate so past
// rounds' frozen snapshots keep rendering.
router.get('/locations', businessController.listLocations);
router.post(
  '/locations',
  validate({ body: businessLocationSchema }),
  businessController.createLocation
);
router.put(
  '/locations/:locationId',
  validate({ params: businessLocationIdParamSchema, body: businessLocationSchema }),
  businessController.updateLocation
);
router.delete(
  '/locations/:locationId',
  validate({ params: businessLocationIdParamSchema }),
  businessController.deleteLocation
);

// Business in-app notifications (jobs module) — the business-portal bell.
router.get('/notifications', businessController.listNotifications);
router.get('/notifications/unread-count', businessController.notificationsUnreadCount);
router.post(
  '/notifications/:notificationId/read',
  validate({ params: businessNotificationIdParamSchema }),
  businessController.markNotificationRead
);
router.post('/notifications/mark-all-read', businessController.markAllNotificationsRead);

// Connect brief — self-serve "Request talent" form. Forwards to squadhub-web's
// public lead pipeline; contact details default to the signed-in account.
router.get('/connect-brief/countries', connectBriefController.getCountries);
router.post('/connect-brief/voice-upload-url', connectBriefController.getVoiceUploadUrl);
router.post(
  '/connect-brief',
  validate({ body: connectBriefSchema }),
  connectBriefController.submitBrief
);

export default router;
