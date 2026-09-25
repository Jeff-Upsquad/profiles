import { Router } from 'express';
import * as talentController from '../controllers/talent.controller.js';
import * as squadBotController from '../controllers/squad-bot.controller.js';
import * as trainingController from '../controllers/training.controller.js';
import * as webinarsController from '../controllers/webinars.controller.js';
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
  applyPartnerProgramSchema,
  opportunityPreviewQuerySchema,
} from '../validators/talent.validators.js';
import { requireApprovalOrAutoApprove } from '../middleware/approval.middleware.js';
import { requireProfileAccess, requirePartnerAccess } from '../middleware/work-access.middleware.js';
import { requestCourseReopenSchema } from '../validators/access-requests.validators.js';
import { submitQuizSchema } from '../validators/training.validators.js';
import { appCheckinSchema } from '../validators/app-install.validators.js';
import * as conversationsController from '../controllers/conversations.controller.js';
import * as groupMeetsController from '../controllers/group-meets.controller.js';
import {
  groupMeetIdParamSchema,
  groupMeetMessageSchema,
  groupMeetRespondSchema,
} from '../validators/group-meets.validators.js';
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
router.post('/squadhub/sso/authorize', requirePartnerAccess, talentController.authorizeSquadhubLogin);

// App install/version check-in — fired by the mobile app once per launch so the
// admin panel can see who has the talent app and which build they run.
router.post('/app-checkin', validate({ body: appCheckinSchema }), appInstallController.checkin);

// Squad Bot — the help chat (answers from the Knowledge Center, hands off to the team).
router.get('/squad-bot', squadBotController.getMyChat);
router.post('/squad-bot/messages', squadBotController.sendMyMessage);

// Talent user (self)
router.get('/me', talentController.getMe);
router.put('/me', validate({ body: updateTalentUserSchema }), talentController.updateMe);

// Basic profile
router.get('/me/basic-profile', talentController.getBasicProfile);
router.put('/me/basic-profile', requireProfileAccess, validate({ body: updateBasicProfileSchema }), talentController.updateBasicProfile);
router.patch('/me/basic-profile/resubmit', requireProfileAccess, talentController.resubmitBasic);

// Partner Program — read-only preview of the live broadcast pool, plus the
// standalone application form shown above it. Both are intentionally open to
// any authenticated talent: they exist precisely for people the Partner
// modules are still locked for.
router.get(
  '/opportunity-preview',
  validate({ query: opportunityPreviewQuerySchema }),
  talentController.listOpportunityPreview,
);
router.post(
  '/me/partner-program/apply',
  validate({ body: applyPartnerProgramSchema }),
  talentController.applyForPartnerProgram,
);

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
router.post('/profiles', requireProfileAccess, validate({ body: createProfileSchema }), talentController.createProfile);
router.get('/profiles/:id', talentController.getProfile);
router.put('/profiles/:id', requireProfileAccess, validate({ body: updateProfileSchema }), talentController.updateProfile);
router.patch('/profiles/:id/submit', requireProfileAccess, requireApprovalOrAutoApprove, talentController.submitProfile);
router.patch('/profiles/:id/deactivate', requireProfileAccess, talentController.deactivateProfile);
router.patch('/profiles/:id/reactivate', requireProfileAccess, talentController.reactivateProfile);
router.delete('/profiles/:id', requireProfileAccess, talentController.deleteProfile);

// Portfolio items
router.get('/profiles/:id/portfolio', talentController.getPortfolioItems);
router.post('/profiles/:id/portfolio', requireProfileAccess, talentController.addPortfolioItem);
router.delete('/profiles/:id/portfolio/:itemId', requireProfileAccess, talentController.deletePortfolioItem);
router.patch('/profiles/:id/portfolio/reorder', requireProfileAccess, talentController.reorderPortfolioItems);
router.patch('/profiles/:id/portfolio/:itemId', requireProfileAccess, talentController.updatePortfolioItem);

// Training program. Courses and SOPs are two tracks of the same synced
// content, so both are served from the item endpoints; /training/sops stays
// as its own route because the talent UI lists them separately.
router.get('/training', trainingController.getMyTraining);
router.get('/training/incomplete-count', trainingController.getIncompleteTrainingCount);
router.get('/training/onboarding', trainingController.getOnboardingTraining);
router.get('/training/onboarding-courses', trainingController.getMyOnboardingCourses);
router.get('/training/module-access', trainingController.getModuleAccess);
router.get('/training/profile-gate/:categoryId', trainingController.getProfileGate);
router.post('/training/complete-onboarding', trainingController.completeOnboarding);

router.get('/training/courses/:id', trainingController.getCourseForTalent);
// SOPs are items on the 'sop' track; these aliases keep the talent UI's
// existing SOP paths working against the same handlers.
router.get('/training/sops/:id', trainingController.getCourseForTalent);
router.post('/training/sops/:id/complete', trainingController.completeItem);
router.post('/training/courses/:id/complete', trainingController.completeItem);
router.post('/training/courses/:id/start', trainingController.startCourse);
router.post(
  '/training/courses/:id/request-reopen',
  validate({ body: requestCourseReopenSchema }),
  trainingController.requestCourseReopen,
);

// Progress is recorded per page. The old /lessons/:lessonId routes are kept as
// aliases because a page id IS the lesson id it was migrated from, so an app
// build still on the old path keeps working.
router.post('/training/pages/:pageId/complete', trainingController.markComplete);
router.delete('/training/pages/:pageId/complete', trainingController.markIncomplete);
router.post('/training/lessons/:pageId/complete', trainingController.markComplete);
router.delete('/training/lessons/:pageId/complete', trainingController.markIncomplete);

router.post(
  '/training/blocks/:blockId/quiz',
  validate({ body: submitQuizSchema }),
  trainingController.submitQuiz,
);

// Upcoming webinars (inside Training): list, one-click register/unregister.
// Timed reminders (day-of, T-30m, T-5m) fan out via the sweeper.
router.get('/training/webinars', webinarsController.listForTalent);
router.post('/training/webinars/:id/register', webinarsController.register);
router.delete('/training/webinars/:id/register', webinarsController.unregister);

// Notifications
router.get('/notifications', notificationsController.listTalent);
router.get('/notifications/unread-count', notificationsController.unreadCountTalent);
router.post('/notifications/mark-all-read', notificationsController.markAllReadTalent);
router.post('/notifications/:id/read', notificationsController.markReadTalent);

// Group Meet invites are action-required: the push deep-links here and the
// talent must accept or decline before the room becomes dismissible.
router.get('/group-meets/:meetingId', validate({ params: groupMeetIdParamSchema }), groupMeetsController.talentGet);
router.post('/group-meets/:meetingId/respond', validate({ params: groupMeetIdParamSchema, body: groupMeetRespondSchema }), groupMeetsController.talentRespond);
router.post('/group-meets/:meetingId/messages', validate({ params: groupMeetIdParamSchema, body: groupMeetMessageSchema }), groupMeetsController.talentMessage);
router.post('/group-meets/:meetingId/join', validate({ params: groupMeetIdParamSchema }), groupMeetsController.talentJoin);
router.post('/group-meets/:meetingId/leave', validate({ params: groupMeetIdParamSchema }), groupMeetsController.talentLeave);

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
