import { Router } from 'express';
import * as jobsTalentController from '../controllers/jobs-talent.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  askJobQuestionSchema,
  inviteIdParamSchema,
  inviteRespondSchema,
  jobPreferencesSchema,
  jobProfileIdParamSchema,
  jobRecipientIdParamSchema,
  listJobsQuerySchema,
  offerIdParamSchema,
  offerQuestionSchema,
  offerRespondSchema,
  respondToJobSchema,
} from '../validators/jobs.validators.js';

const router = Router();

router.use(authenticate, requireRole('talent'));

// ─── Opt-in + preferences ──────────────────────────────────────────────────
router.get('/opt-in', jobsTalentController.getPreferences);
router.post(
  '/opt-in',
  validate({ body: jobPreferencesSchema }),
  jobsTalentController.optIn
);
router.delete('/opt-in', jobsTalentController.optOut);
router.put(
  '/preferences',
  validate({ body: jobPreferencesSchema }),
  jobsTalentController.updatePreferences
);

// ─── Feed ──────────────────────────────────────────────────────────────────
router.get('/', validate({ query: listJobsQuerySchema }), jobsTalentController.list);
router.get('/unread-count', jobsTalentController.unreadCount);
router.get('/counts', jobsTalentController.tabCounts);

// ─── Job profile view (recipient-gated) + Q&A ─────────────────────────────
router.get(
  '/profiles/:jobProfileId',
  validate({ params: jobProfileIdParamSchema }),
  jobsTalentController.jobProfileView
);
router.post(
  '/profiles/:jobProfileId/questions',
  validate({ params: jobProfileIdParamSchema, body: askJobQuestionSchema }),
  jobsTalentController.askQuestion
);

// ─── Interview invites + FIFO queue ────────────────────────────────────────
router.get('/interview-invites', jobsTalentController.listInvites);
router.post(
  '/interview-invites/:inviteId/respond',
  validate({ params: inviteIdParamSchema, body: inviteRespondSchema }),
  jobsTalentController.respondToInvite
);
// The T-10 "I'm available" tap — atomic FIFO ticket via rpc.
router.post(
  '/interview-invites/:inviteId/confirm',
  validate({ params: inviteIdParamSchema }),
  jobsTalentController.confirmInvite
);
// Live queue position + approx time (clients poll ~20s).
router.get(
  '/interview-invites/:inviteId/queue',
  validate({ params: inviteIdParamSchema }),
  jobsTalentController.inviteQueue
);

// ─── Offers ────────────────────────────────────────────────────────────────
router.get('/offers', jobsTalentController.listOffers);
router.get(
  '/offers/:offerId',
  validate({ params: offerIdParamSchema }),
  jobsTalentController.offerDetail
);
router.post(
  '/offers/:offerId/respond',
  validate({ params: offerIdParamSchema, body: offerRespondSchema }),
  jobsTalentController.respondToOffer
);
router.post(
  '/offers/:offerId/questions',
  validate({ params: offerIdParamSchema, body: offerQuestionSchema }),
  jobsTalentController.askOfferQuestion
);

// ─── Card detail + respond (must stay after the static paths above) ───────
router.get(
  '/:recipientId',
  validate({ params: jobRecipientIdParamSchema }),
  jobsTalentController.detail
);
router.patch(
  '/:recipientId/respond',
  validate({ params: jobRecipientIdParamSchema, body: respondToJobSchema }),
  jobsTalentController.respond
);
// Withdraw AFTER accepting — respond() is pending-only by design.
router.post(
  '/:recipientId/withdraw',
  validate({ params: jobRecipientIdParamSchema }),
  jobsTalentController.withdrawApplication
);
// Re-apply after a talent-initiated exit, while the card is still live.
router.post(
  '/:recipientId/reapply',
  validate({ params: jobRecipientIdParamSchema }),
  jobsTalentController.reapplyToJob
);

export default router;
