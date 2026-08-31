import { Router } from 'express';
import * as talentController from '../controllers/talent.controller.js';
import * as trainingController from '../controllers/training.controller.js';
import * as trainingSopController from '../controllers/training-sop.controller.js';
import * as notificationsController from '../controllers/notifications.controller.js';
import * as appInstallController from '../controllers/app-install.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createProfileSchema,
  updateProfileSchema,
  updateTalentUserSchema,
  updateBasicProfileSchema,
} from '../validators/talent.validators.js';
import { requireApprovalOrAutoApprove } from '../middleware/approval.middleware.js';
import { requestCourseReopenSchema } from '../validators/access-requests.validators.js';
import { appCheckinSchema } from '../validators/app-install.validators.js';
import * as conversationsController from '../controllers/conversations.controller.js';
import {
  conversationIdParamSchema,
  conversationMeetingIdParamSchema,
  listMessagesQuerySchema,
  proposeMeetingSchema,
  respondMeetingSchema,
  sendMessageSchema,
} from '../validators/conversations.validators.js';

const router = Router();

// All talent routes require authentication + talent role
router.use(authenticate, requireRole('talent'));

// SquadHub auto-login — mints the one-time code the SquadHub tab hands over so
// an assigned talent lands inside SquadHub as a partner without a second
// sign-in. Mirrors /api/business/squadhub/sso/authorize.
router.post('/squadhub/sso/authorize', talentController.authorizeSquadhubLogin);

// App install/version check-in — fired by the mobile app once per launch so the
// admin panel can see who has the talent app and which build they run.
router.post('/app-checkin', validate({ body: appCheckinSchema }), appInstallController.checkin);

// Talent user (self)
router.get('/me', talentController.getMe);
router.put('/me', validate({ body: updateTalentUserSchema }), talentController.updateMe);

// Basic profile
router.get('/me/basic-profile', talentController.getBasicProfile);
router.put('/me/basic-profile', validate({ body: updateBasicProfileSchema }), talentController.updateBasicProfile);

// Lead submission (used by signup to auto-populate from a prior public-form lead)
router.get('/me/lead-submission', talentController.getMyLeadSubmission);

// Onboarding progress (5-stage strip on the talent dashboard)
router.get('/me/onboarding-progress', talentController.getMyOnboardingProgress);

// Categories a talent is allowed to create a profile in.
// Filters out the Designer + Editor combined category — that one is now
// a ghost-only category, auto-generated when a talent has both a Designer
// and a Video Editor profile (see ghost-profile.service.ts).
router.get('/profile-categories', talentController.getTalentCreatableCategories);

// Talent profiles (rejected accounts cannot submit; pending can)
router.get('/profiles', talentController.getProfiles);
router.post('/profiles', validate({ body: createProfileSchema }), talentController.createProfile);
router.get('/profiles/:id', talentController.getProfile);
router.put('/profiles/:id', validate({ body: updateProfileSchema }), talentController.updateProfile);
router.patch('/profiles/:id/submit', requireApprovalOrAutoApprove, talentController.submitProfile);
router.patch('/profiles/:id/deactivate', talentController.deactivateProfile);
router.patch('/profiles/:id/reactivate', talentController.reactivateProfile);
router.delete('/profiles/:id', talentController.deleteProfile);

// Portfolio items
router.get('/profiles/:id/portfolio', talentController.getPortfolioItems);
router.post('/profiles/:id/portfolio', talentController.addPortfolioItem);
router.delete('/profiles/:id/portfolio/:itemId', talentController.deletePortfolioItem);
router.patch('/profiles/:id/portfolio/reorder', talentController.reorderPortfolioItems);
router.patch('/profiles/:id/portfolio/:itemId', talentController.updatePortfolioItem);

// Training program
router.get('/training/onboarding', trainingController.getOnboardingTraining);
router.get('/training/onboarding-courses', trainingController.getMyOnboardingCourses);
router.get('/training/module-access', trainingController.getModuleAccess);
router.get('/training/profile-gate/:categoryId', trainingController.getProfileGate);
router.post('/training/complete-onboarding', trainingController.completeOnboarding);
router.post('/training/courses/:id/start', trainingController.startCourse);
router.post(
  '/training/courses/:id/request-reopen',
  validate({ body: requestCourseReopenSchema }),
  trainingController.requestCourseReopen,
);
router.get('/training', trainingController.getMyTraining);
router.get('/training/incomplete-count', trainingController.getIncompleteTrainingCount);
router.get('/training/sops', trainingSopController.getMySops);
router.get('/training/sops/:id', trainingSopController.getSopForTalent);
router.post('/training/sops/:id/complete', trainingSopController.completeSop);
router.post('/training/lessons/:lessonId/complete', trainingController.markComplete);
router.delete('/training/lessons/:lessonId/complete', trainingController.markIncomplete);

// Notifications
router.get('/notifications', notificationsController.listTalent);
router.get('/notifications/unread-count', notificationsController.unreadCountTalent);
router.post('/notifications/mark-all-read', notificationsController.markAllReadTalent);
router.post('/notifications/:id/read', notificationsController.markReadTalent);

// Intro rooms
router.get('/conversations', conversationsController.talentList);
router.get('/conversations/unread-count', conversationsController.talentUnread);
router.get(
  '/conversations/:id',
  validate({ params: conversationIdParamSchema }),
  conversationsController.talentGet,
);
router.get(
  '/conversations/:id/messages',
  validate({ params: conversationIdParamSchema, query: listMessagesQuerySchema }),
  conversationsController.talentMessages,
);
router.post(
  '/conversations/:id/messages',
  validate({ params: conversationIdParamSchema, body: sendMessageSchema }),
  conversationsController.talentSend,
);
router.post(
  '/conversations/:id/meetings',
  validate({ params: conversationIdParamSchema, body: proposeMeetingSchema }),
  conversationsController.talentProposeMeeting,
);
router.post(
  '/conversations/:id/meetings/:meetingId/respond',
  validate({ params: conversationMeetingIdParamSchema, body: respondMeetingSchema }),
  conversationsController.talentRespondMeeting,
);
router.post(
  '/conversations/:id/meetings/:meetingId/cancel',
  validate({ params: conversationMeetingIdParamSchema }),
  conversationsController.talentCancelMeeting,
);

export default router;
