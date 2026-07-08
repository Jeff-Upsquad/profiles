import { Router } from 'express';
import * as jobsBusinessController from '../controllers/jobs-business.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  answerJobQuestionSchema,
  answerOfferQuestionSchema,
  counterOfferSchema,
  createInterviewRoundSchema,
  createOffersSchema,
  hireCandidateSchema,
  interviewOutcomeSchema,
  jobCandidateParamSchema,
  jobCardIdParamSchema,
  jobQuestionIdParamSchema,
  listCandidatesQuerySchema,
  markAbsentSchema,
  negotiationDecisionSchema,
  offerIdParamSchema,
  reviewCandidateSchema,
  roundIdParamSchema,
  roundInviteParamSchema,
  sendOfferSchema,
  updateInterviewRoundSchema,
  updateOfferSchema,
} from '../validators/jobs.validators.js';

const router = Router();

router.use(authenticate, requireRole('business'));

// ─── Cards ─────────────────────────────────────────────────────────────────
router.get('/', jobsBusinessController.listCards);

// ─── Interview rounds addressed directly (before /:cardId) ────────────────
router.patch(
  '/interview-rounds/:roundId',
  validate({ params: roundIdParamSchema, body: updateInterviewRoundSchema }),
  jobsBusinessController.updateRound
);
router.post(
  '/interview-rounds/:roundId/cancel',
  validate({ params: roundIdParamSchema }),
  jobsBusinessController.cancelRound
);
// Interview-day console: FIFO queue / waitlist / showed-up / done / absent.
router.get(
  '/interview-rounds/:roundId/console',
  validate({ params: roundIdParamSchema }),
  jobsBusinessController.dayConsole
);
router.post(
  '/interview-rounds/:roundId/invites/:inviteId/showed-up',
  validate({ params: roundInviteParamSchema }),
  jobsBusinessController.markShowedUp
);
// "Start Interview" — reveals the meeting link to THAT candidate only.
router.post(
  '/interview-rounds/:roundId/invites/:inviteId/start',
  validate({ params: roundInviteParamSchema }),
  jobsBusinessController.startInterview
);
// No-show / showed-up-but-didn't-join → atomic waitlist promotion.
router.post(
  '/interview-rounds/:roundId/invites/:inviteId/no-show',
  validate({ params: roundInviteParamSchema, body: markAbsentSchema }),
  jobsBusinessController.markAbsent
);
router.post(
  '/interview-rounds/:roundId/invites/:inviteId/outcome',
  validate({ params: roundInviteParamSchema, body: interviewOutcomeSchema }),
  jobsBusinessController.interviewOutcome
);

// ─── Offers addressed directly (before /:cardId) ───────────────────────────
router.patch(
  '/offers/:offerId',
  validate({ params: offerIdParamSchema, body: updateOfferSchema }),
  jobsBusinessController.updateOffer
);
router.post(
  '/offers/:offerId/send',
  validate({ params: offerIdParamSchema, body: sendOfferSchema }),
  jobsBusinessController.sendOffer
);
router.post(
  '/offers/:offerId/mark-sent-manually',
  validate({ params: offerIdParamSchema }),
  jobsBusinessController.markOfferSentManually
);
router.post(
  '/offers/:offerId/accept-negotiation',
  validate({ params: offerIdParamSchema, body: negotiationDecisionSchema }),
  jobsBusinessController.acceptNegotiation
);
router.post(
  '/offers/:offerId/decline-negotiation',
  validate({ params: offerIdParamSchema, body: negotiationDecisionSchema }),
  jobsBusinessController.declineNegotiation
);
// Counteroffer — ALWAYS final: the talent can then only accept/decline/ask.
router.post(
  '/offers/:offerId/counter',
  validate({ params: offerIdParamSchema, body: counterOfferSchema }),
  jobsBusinessController.counterOffer
);
router.post(
  '/offers/:offerId/withdraw',
  validate({ params: offerIdParamSchema }),
  jobsBusinessController.withdrawOffer
);
router.post(
  '/offers/:offerId/answer-question',
  validate({ params: offerIdParamSchema, body: answerOfferQuestionSchema }),
  jobsBusinessController.answerOfferQuestion
);
router.get(
  '/offers/:offerId/events',
  validate({ params: offerIdParamSchema }),
  jobsBusinessController.offerEvents
);

// ─── Q&A moderation (question-addressed) ───────────────────────────────────
router.post(
  '/questions/:questionId/answer',
  validate({ params: jobQuestionIdParamSchema, body: answerJobQuestionSchema }),
  jobsBusinessController.answerQuestion
);
router.delete(
  '/questions/:questionId',
  validate({ params: jobQuestionIdParamSchema }),
  jobsBusinessController.deleteQuestion
);

// ─── Card-scoped routes ────────────────────────────────────────────────────
router.get(
  '/:cardId',
  validate({ params: jobCardIdParamSchema }),
  jobsBusinessController.getCard
);
router.post(
  '/:cardId/start-screening',
  validate({ params: jobCardIdParamSchema }),
  jobsBusinessController.startScreening
);
router.post(
  '/:cardId/close',
  validate({ params: jobCardIdParamSchema }),
  jobsBusinessController.closeCard
);
router.get(
  '/:cardId/candidates',
  validate({ params: jobCardIdParamSchema, query: listCandidatesQuerySchema }),
  jobsBusinessController.listCandidates
);
// The candidate's full talent profile — access rule: they applied to YOUR card.
router.get(
  '/:cardId/candidates/:candidateId/profile',
  validate({ params: jobCandidateParamSchema }),
  jobsBusinessController.candidateProfile
);
router.post(
  '/:cardId/candidates/:candidateId/review',
  validate({ params: jobCandidateParamSchema, body: reviewCandidateSchema }),
  jobsBusinessController.reviewCandidate
);
// Hire popup: {keep_open, joining_date}; keep_open=false closes the card and
// withdraws the remaining un-accepted offers.
router.post(
  '/:cardId/candidates/:candidateId/hire',
  validate({ params: jobCandidateParamSchema, body: hireCandidateSchema }),
  jobsBusinessController.hireCandidate
);
router.post(
  '/:cardId/candidates/:candidateId/mark-joined',
  validate({ params: jobCandidateParamSchema }),
  jobsBusinessController.markJoined
);
router.get(
  '/:cardId/questions',
  validate({ params: jobCardIdParamSchema }),
  jobsBusinessController.listQuestions
);
router.get(
  '/:cardId/interview-rounds',
  validate({ params: jobCardIdParamSchema }),
  jobsBusinessController.listRounds
);
router.post(
  '/:cardId/interview-rounds',
  validate({ params: jobCardIdParamSchema, body: createInterviewRoundSchema }),
  jobsBusinessController.createRound
);
router.get(
  '/:cardId/offers',
  validate({ params: jobCardIdParamSchema }),
  jobsBusinessController.listOffers
);
// Offer-letter template pull — canonical on SquadHub (signed GET proxy).
router.get(
  '/:cardId/offer-template',
  validate({ params: jobCardIdParamSchema }),
  jobsBusinessController.getOfferTemplate
);
router.post(
  '/:cardId/offers',
  validate({ params: jobCardIdParamSchema, body: createOffersSchema }),
  jobsBusinessController.createOffers
);

export default router;
