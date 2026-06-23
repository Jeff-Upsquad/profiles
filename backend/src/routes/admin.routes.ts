import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as leadController from '../controllers/lead.controller.js';
import * as subscriptionController from '../controllers/subscription.controller.js';
import * as requestCardsController from '../controllers/request-cards.controller.js';
import * as formConfigController from '../controllers/form-config.controller.js';
import * as interviewController from '../controllers/interview.controller.js';
import * as talentAccessController from '../controllers/talent-access.controller.js';
import * as trainingController from '../controllers/training.controller.js';
import * as howItWorksController from '../controllers/how-it-works.controller.js';
import * as accessRequestsController from '../controllers/access-requests.controller.js';
import * as savedFilterController from '../controllers/saved-filter.controller.js';
import * as notificationsController from '../controllers/notifications.controller.js';
import * as appInstallController from '../controllers/app-install.controller.js';
import * as staffAdminController from '../controllers/staff-admin.controller.js';
import {
  requireAdminOrStaff,
  enforceModuleAccess,
} from '../middleware/module-access.middleware.js';
import { enforceCandidateScope } from '../middleware/candidate-scope.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createCategorySchema,
  updateCategorySchema,
  createFieldSchema,
  updateFieldSchema,
  createOptionSchema,
  updateOptionSchema,
  reorderSchema,
  setProfileTierSchema,
  adminUpdateTalentUserSchema,
  adminUpdateTalentProfileSchema,
  adminAddPortfolioItemSchema,
  adminReviewPortfolioItemSchema,
  setTalentOnboardingBypassSchema,
} from '../validators/admin.validators.js';
import { updateBasicProfileSchema } from '../validators/talent.validators.js';
import {
  createCourseSchema,
  updateCourseSchema,
  createChapterSchema,
  updateChapterSchema,
  createLessonSchema,
  updateLessonSchema,
} from '../validators/training.validators.js';
import {
  createHowItWorksVideoSchema,
  updateHowItWorksVideoSchema,
} from '../validators/how-it-works.validators.js';
import {
  createInvitationSchema,
  assignCategoriesSchema,
  shareProfilesSchema,
  extendAccessSchema,
} from '../validators/invite.validators.js';
import {
  updateLeadStatusSchema,
  updateLeadProfileTypeSchema,
  createLeadNoteSchema,
  updateLeadNoteSchema,
  autoApprovalConfigSchema,
} from '../validators/lead.validators.js';
import {
  createNotificationSchema,
  previewFiltersSchema,
} from '../validators/notifications.validators.js';
import {
  createInterviewQuestionSchema,
  updateInterviewQuestionSchema,
  reorderInterviewQuestionsSchema,
} from '../validators/interview.validators.js';
import {
  createGrantSchema,
  updateGrantSchema,
  extendGrantSchema,
  listGrantsQuerySchema,
} from '../validators/talent-access.validators.js';
import {
  grantBusinessAccessSchema,
  rejectCourseReopenSchema,
} from '../validators/access-requests.validators.js';
import {
  createStaffSchema,
  updateStaffSchema,
  putGrantsSchema,
} from '../validators/staff-admin.validators.js';

const router = Router();

// Authenticate as a full admin OR a staff user, then gate every request by the
// staff user's per-module grants. Full admins bypass the access middlewares.
// enforceCandidateScope adds the Candidates module's intra-module (category +
// section) gate on top of the module-level tier check.
router.use(requireAdminOrStaff, enforceModuleAccess, enforceCandidateScope);

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------

router.get('/dashboard/stats', adminController.getDashboardStats);

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

router.get('/categories', adminController.getCategories);

router.post(
  '/categories',
  validate({ body: createCategorySchema }),
  adminController.createCategory
);

router.put(
  '/categories/:id',
  validate({ body: updateCategorySchema }),
  adminController.updateCategory
);

router.patch('/categories/:id/archive', adminController.archiveCategory);

// ---------------------------------------------------------------------------
// Category Fields
// ---------------------------------------------------------------------------

router.get('/categories/:id/fields', adminController.getCategoryFields);

router.post(
  '/categories/:id/fields',
  validate({ body: createFieldSchema }),
  adminController.createField
);

router.put(
  '/categories/:id/fields/:fieldId',
  validate({ body: updateFieldSchema }),
  adminController.updateField
);

router.delete('/categories/:id/fields/:fieldId', adminController.deleteField);

router.patch(
  '/categories/:id/fields/reorder',
  validate({ body: reorderSchema }),
  adminController.reorderFields
);

// ---------------------------------------------------------------------------
// Field Options
// ---------------------------------------------------------------------------

router.get('/fields/:fieldId/options', adminController.getFieldOptions);

router.post(
  '/fields/:fieldId/options',
  validate({ body: createOptionSchema }),
  adminController.createOption
);

router.put(
  '/fields/:fieldId/options/:optId',
  validate({ body: updateOptionSchema }),
  adminController.updateOption
);

router.delete('/fields/:fieldId/options/:optId', adminController.deleteOption);

router.patch(
  '/fields/:fieldId/options/reorder',
  validate({ body: reorderSchema }),
  adminController.reorderOptions
);

// ---------------------------------------------------------------------------
// Profile Reviews
// ---------------------------------------------------------------------------

router.get('/reviews', adminController.getReviewQueue);
router.get('/reviews/:profileId', adminController.getReviewProfile);
router.patch('/reviews/:profileId/approve', adminController.approveProfile);
router.patch('/reviews/:profileId/reject', adminController.rejectProfile);
router.patch('/reviews/bulk-approve', adminController.bulkApproveProfiles);

// ---------------------------------------------------------------------------
// User Approvals
// ---------------------------------------------------------------------------

router.get('/user-approvals', adminController.getPendingApprovals);
router.patch('/user-approvals/:userId/approve', adminController.approveUser);
router.patch('/user-approvals/:userId/reject', adminController.rejectUser);

router.get('/settings/auto-approve', adminController.getAutoApproveSetting);
router.patch('/settings/auto-approve', adminController.setAutoApproveSetting);

// ---------------------------------------------------------------------------
// Template Skill Sets & Tools
// ---------------------------------------------------------------------------

router.get('/categories/:categoryId/skills', adminController.getTemplateSkills);
router.post('/categories/:categoryId/skills', adminController.createTemplateSkill);
router.put('/skills/:skillId', adminController.updateTemplateSkill);
router.delete('/skills/:skillId', adminController.deleteTemplateSkill);

router.get('/categories/:categoryId/tools', adminController.getTemplateTools);
router.post('/categories/:categoryId/tools', adminController.createTemplateTool);
router.put('/tools/:toolId', adminController.updateTemplateTool);
router.delete('/tools/:toolId', adminController.deleteTemplateTool);

// ---------------------------------------------------------------------------
// Template AI Tools
// ---------------------------------------------------------------------------

router.get('/categories/:categoryId/ai-tools', adminController.getTemplateAiTools);
router.post('/categories/:categoryId/ai-tools', adminController.createTemplateAiTool);
router.put('/ai-tools/:toolId', adminController.updateTemplateAiTool);
router.delete('/ai-tools/:toolId', adminController.deleteTemplateAiTool);

// ---------------------------------------------------------------------------
// Template Portfolio Categories (genres)
// ---------------------------------------------------------------------------

router.get(
  '/categories/:categoryId/portfolio-categories',
  adminController.getTemplateCategories,
);
router.post(
  '/categories/:categoryId/portfolio-categories',
  adminController.createTemplateCategory,
);
router.put('/portfolio-categories/:id', adminController.updateTemplateCategory);
router.delete('/portfolio-categories/:id', adminController.deleteTemplateCategory);

// ---------------------------------------------------------------------------
// Talents Module (browse profiles by category)
// ---------------------------------------------------------------------------

router.get('/talents/categories', adminController.getTalentCategories);
router.get('/talents/categories/:categoryId/profiles', adminController.getTalentProfilesByCategory);
router.get('/talents/profiles/:profileId', adminController.getTalentProfile);
router.patch('/talents/profiles/:profileId/active', adminController.setProfileActive);
router.patch(
  '/talents/profiles/:profileId/tier',
  validate({ body: setProfileTierSchema }),
  adminController.setProfileTier,
);
router.delete('/talents/profiles/:profileId', adminController.softDeleteTalentProfile);

// Admin edit (status preserved, full parity with talent self-edit)
router.put(
  '/talents/users/:userId',
  validate({ body: adminUpdateTalentUserSchema }),
  adminController.updateTalentUser,
);
router.put(
  '/talents/profiles/:profileId',
  validate({ body: adminUpdateTalentProfileSchema }),
  adminController.updateTalentProfile,
);
router.get('/talents/profiles/:profileId/portfolio', adminController.getProfilePortfolio);
router.post(
  '/talents/profiles/:profileId/portfolio',
  validate({ body: adminAddPortfolioItemSchema }),
  adminController.addProfilePortfolio,
);
router.patch(
  '/talents/profiles/:profileId/portfolio/:itemId/review',
  validate({ body: adminReviewPortfolioItemSchema }),
  adminController.reviewProfilePortfolio,
);
router.delete(
  '/talents/profiles/:profileId/portfolio/:itemId',
  adminController.deleteProfilePortfolio,
);

// ---------------------------------------------------------------------------
// Invitations
// ---------------------------------------------------------------------------

router.get('/invitations', adminController.getInvitations);
router.post(
  '/invitations',
  validate({ body: createInvitationSchema }),
  adminController.createInvitation
);
router.patch('/invitations/:id/revoke', adminController.revokeInvitation);

// ---------------------------------------------------------------------------
// Talent Access Grants (email-gated public profile browsing)
// ---------------------------------------------------------------------------

router.get(
  '/talent-access',
  validate({ query: listGrantsQuerySchema }),
  talentAccessController.listGrants
);
router.post(
  '/talent-access',
  validate({ body: createGrantSchema }),
  talentAccessController.createGrant
);
router.get('/talent-access/:id', talentAccessController.getGrant);
router.patch(
  '/talent-access/:id',
  validate({ body: updateGrantSchema }),
  talentAccessController.updateGrant
);
router.patch('/talent-access/:id/revoke', talentAccessController.revokeGrant);
router.post(
  '/talent-access/:id/extend',
  validate({ body: extendGrantSchema }),
  talentAccessController.extendGrant
);
router.delete('/talent-access/:id', talentAccessController.deleteGrant);

// ---------------------------------------------------------------------------
// Business Subscriptions (Category Assignments)
// ---------------------------------------------------------------------------

router.get('/business/:businessId/subscriptions', adminController.getBusinessSubscriptions);
router.post(
  '/business/:businessId/subscriptions',
  validate({ body: assignCategoriesSchema }),
  adminController.assignCategories
);
router.delete('/business/:businessId/subscriptions/:categoryId', adminController.removeCategory);

// ---------------------------------------------------------------------------
// Business Shared Profiles
// ---------------------------------------------------------------------------

router.get('/business/:businessId/shared-profiles', adminController.getBusinessSharedProfiles);
router.post(
  '/business/:businessId/shared-profiles',
  validate({ body: shareProfilesSchema }),
  adminController.shareProfiles
);
router.delete('/business/:businessId/shared-profiles/:profileId', adminController.unshareProfile);

// ---------------------------------------------------------------------------
// Business Access Extension
// ---------------------------------------------------------------------------

router.patch(
  '/business/:businessId/extend-access',
  validate({ body: extendAccessSchema }),
  adminController.extendBusinessAccess
);

// ---------------------------------------------------------------------------
// Access Requests (unified queue: business portal + course reopen)
// ---------------------------------------------------------------------------

router.get('/access-requests', accessRequestsController.listPendingRequests);
router.patch(
  '/access-requests/business/:businessId/grant',
  validate({ body: grantBusinessAccessSchema }),
  accessRequestsController.grantBusinessAccess,
);
router.patch(
  '/access-requests/course/:requestId/grant',
  accessRequestsController.grantCourseReopen,
);
router.patch(
  '/access-requests/course/:requestId/reject',
  validate({ body: rejectCourseReopenSchema }),
  accessRequestsController.rejectCourseReopen,
);

// ---------------------------------------------------------------------------
// Shortlist Tracking
// ---------------------------------------------------------------------------

router.get('/shortlists', adminController.getShortlistTracking);

// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------

router.get('/search', adminController.searchUsers);
router.get('/users/talent', adminController.getTalentUsers);
router.get('/users/business', adminController.getBusinessUsers);
router.get('/users/:userId', adminController.getUserDetail);
router.put(
  '/users/:userId/basic-profile',
  validate({ body: updateBasicProfileSchema }),
  adminController.updateUserBasicProfile,
);
router.patch('/users/:id/suspend', adminController.suspendUser);
router.patch('/users/talent/:id/active', adminController.setTalentUserActive);
router.patch(
  '/users/talent/:id/skip-onboarding',
  validate({ body: setTalentOnboardingBypassSchema }),
  adminController.setTalentOnboardingBypass,
);
router.post('/users/:id/reset-password', adminController.resetUserPassword);
router.delete('/users/:id', adminController.deleteUser);

// ---------------------------------------------------------------------------
// Talent App — install/version tracking
// ---------------------------------------------------------------------------

router.get('/talent-app/installs', appInstallController.listInstalls);

// ---------------------------------------------------------------------------
// Recycle Bin
// ---------------------------------------------------------------------------

router.get('/recycle-bin', adminController.getRecycleBin);
router.patch('/recycle-bin/:profileId/restore', adminController.restoreProfile);
router.delete('/recycle-bin/:profileId', adminController.permanentlyDeleteProfile);

// ---------------------------------------------------------------------------
// Subscription Cards (read-only org-wide list)
// ---------------------------------------------------------------------------

router.get('/subscription-cards', subscriptionController.adminListCards);
router.get('/subscription-cards/:id', subscriptionController.adminGetCard);
router.get('/subscription-cards/:id/recipients', subscriptionController.adminListRecipients);
router.post(
  '/subscription-cards/:cardId/recipients/:recipientId/remove-from-dashboard',
  subscriptionController.adminRemoveFromBusinessDashboard
);
router.post('/subscription-cards/:cardId/select', subscriptionController.adminSelectRecipient);
router.post('/subscription-cards/:cardId/undo-selection', subscriptionController.adminUndoSelection);
router.post('/subscription-cards/:cardId/reopen', subscriptionController.reopenCard);

// ---------------------------------------------------------------------------
// Subscription Requests (from upsquad pricing page)
// ---------------------------------------------------------------------------

router.get('/subscription-requests', requestCardsController.listRequests);
router.get('/subscription-requests/:id', requestCardsController.getRequest);
router.post('/subscription-cards/from-request', requestCardsController.createFromRequest);
router.post('/subscription-cards/custom', requestCardsController.createCustom);
router.patch('/subscription-cards/:id/edit', requestCardsController.editCard);
router.post('/subscription-cards/:id/publish', requestCardsController.publishCard);
router.delete('/subscription-cards/:id', requestCardsController.deleteCard);

// ---------------------------------------------------------------------------
// Lead Submissions
// ---------------------------------------------------------------------------

router.get('/leads', leadController.getLeads);
router.get('/leads/form-fields', leadController.getLeadFormFields);
router.get('/leads/onboarding', leadController.getOnboardingLeads);

// Saved lead-filter presets (per admin user)
router.get('/lead-filters', savedFilterController.listSavedLeadFilters);
router.post('/lead-filters', savedFilterController.createSavedLeadFilter);
router.patch('/lead-filters/:id', savedFilterController.updateSavedLeadFilter);
router.delete('/lead-filters/:id', savedFilterController.deleteSavedLeadFilter);
router.get('/leads/:id', leadController.getLead);
router.patch(
  '/leads/:id/status',
  validate({ body: updateLeadStatusSchema }),
  leadController.updateLeadStatus
);
router.patch(
  '/leads/:id/profile-type',
  validate({ body: updateLeadProfileTypeSchema }),
  leadController.updateLeadProfileType
);

router.get('/leads/:id/notes', leadController.listLeadNotes);
router.post(
  '/leads/:id/notes',
  validate({ body: createLeadNoteSchema }),
  leadController.createLeadNote
);
router.patch(
  '/leads/notes/:noteId',
  validate({ body: updateLeadNoteSchema }),
  leadController.updateLeadNote
);
router.delete('/leads/notes/:noteId', leadController.deleteLeadNote);

// Soft-delete / restore / permanent delete (recycle bin pattern)
router.delete('/leads/:id', leadController.softDeleteLead);
router.patch('/leads/:id/restore', leadController.restoreLead);
router.delete('/leads/:id/permanent', leadController.permanentlyDeleteLead);

// ---------------------------------------------------------------------------
// Public Forms Config
// ---------------------------------------------------------------------------

router.get('/forms', formConfigController.getPublicForms);
router.patch('/forms/:id/toggle', formConfigController.toggleFormEnabled);
router.get('/forms/:id/auto-approval', formConfigController.getAutoApprovalRules);
router.put(
  '/forms/:id/auto-approval',
  validate({ body: autoApprovalConfigSchema }),
  formConfigController.updateAutoApprovalRules
);

// ---------------------------------------------------------------------------
// Interview Questions (admin)
// ---------------------------------------------------------------------------

router.get('/interview-questions', interviewController.listQuestions);
router.post(
  '/interview-questions',
  validate({ body: createInterviewQuestionSchema }),
  interviewController.createQuestion
);
router.patch(
  '/interview-questions/reorder',
  validate({ body: reorderInterviewQuestionsSchema }),
  interviewController.reorderQuestions
);
router.patch(
  '/interview-questions/:id',
  validate({ body: updateInterviewQuestionSchema }),
  interviewController.updateQuestion
);
router.delete('/interview-questions/:id', interviewController.deleteQuestion);

// ---------------------------------------------------------------------------
// Per-lead Interview Invitations (admin)
// ---------------------------------------------------------------------------

router.get('/interview-invitations', interviewController.listInvitations);
router.patch('/interview-invitations/:id/reviewed', interviewController.setInvitationReviewed);
router.get('/leads/:leadId/interview-invitation', interviewController.getInvitation);
router.post('/leads/:leadId/interview-invitation', interviewController.createInvitation);

// ---------------------------------------------------------------------------
// Training Program
// ---------------------------------------------------------------------------

// Courses
router.get('/training/courses', trainingController.getCourses);
router.get('/training/courses/archived', trainingController.getArchivedCourses);
router.post('/training/courses', validate({ body: createCourseSchema }), trainingController.createCourse);
router.patch('/training/courses/reorder', validate({ body: reorderSchema }), trainingController.reorderCourses);
router.get('/training/courses/:id', trainingController.getCourse);
router.put('/training/courses/:id', validate({ body: updateCourseSchema }), trainingController.updateCourse);
router.delete('/training/courses/:id', trainingController.archiveCourse);
router.post('/training/courses/:id/restore', trainingController.restoreCourse);

// Course enrollment management (reopen expired deadlines)
router.get('/training/users/:userId/enrollments', trainingController.getUserCourseEnrollments);
router.delete('/training/users/:userId/enrollments/:courseId', trainingController.reopenCourse);

// Chapters
router.get('/training/chapters', trainingController.getChapters);
router.post('/training/chapters', validate({ body: createChapterSchema }), trainingController.createChapter);
router.get('/training/chapters/:id', trainingController.getChapter);
router.put('/training/chapters/:id', validate({ body: updateChapterSchema }), trainingController.updateChapter);
router.delete('/training/chapters/:id', trainingController.deleteChapter);
router.patch('/training/chapters/reorder', validate({ body: reorderSchema }), trainingController.reorderChapters);

router.get('/training/chapters/:chapterId/lessons', trainingController.getLessons);
router.post('/training/chapters/:chapterId/lessons', validate({ body: createLessonSchema }), trainingController.createLesson);
router.put('/training/lessons/:lessonId', validate({ body: updateLessonSchema }), trainingController.updateLesson);
router.delete('/training/lessons/:lessonId', trainingController.deleteLesson);
router.patch('/training/lessons/reorder', validate({ body: reorderSchema }), trainingController.reorderLessons);

// ---------------------------------------------------------------------------
// How it works videos
// ---------------------------------------------------------------------------

router.get('/how-it-works/videos', howItWorksController.getVideos);
router.post('/how-it-works/videos', validate({ body: createHowItWorksVideoSchema }), howItWorksController.createVideo);
router.put('/how-it-works/videos/:id', validate({ body: updateHowItWorksVideoSchema }), howItWorksController.updateVideo);
router.delete('/how-it-works/videos/:id', howItWorksController.deleteVideo);

// ---------------------------------------------------------------------------
// System Automation
// ---------------------------------------------------------------------------

router.get('/settings/automation', adminController.getAutomationSettings);
router.patch('/settings/automation', adminController.updateAutomationConfig);
router.patch('/settings/automation/templates', adminController.updateAutomationTemplates);
router.get('/automation/events', adminController.getAutomationEvents);
router.post('/automation/sync-leads-crm', adminController.syncLeadsToCrm);

// CRM status mapping ---
router.get('/settings/crm-status-mapping', adminController.getCrmStatusMapping);
router.put('/settings/crm-status-mapping', adminController.updateCrmStatusMapping);
router.get('/settings/crm-status-mapping/stages', adminController.getCrmPipelineStages);

// ---------------------------------------------------------------------------
// Notifications (admin-authored broadcasts to talent users)
// ---------------------------------------------------------------------------

router.get('/notifications', notificationsController.listAdmin);
router.post(
  '/notifications/preview',
  validate({ body: previewFiltersSchema }),
  notificationsController.previewAdmin,
);
router.post(
  '/notifications',
  validate({ body: createNotificationSchema }),
  notificationsController.createAdmin,
);
router.delete('/notifications/:id', notificationsController.deleteAdmin);

// ---------------------------------------------------------------------------
// Team & Access (staff users + per-module grants)
//
// Gated by enforceModuleAccess as the `team-access` module: full admins manage
// the whole roster; staff who hold `admin` on a module may delegate that module
// (staff-account CRUD stays full-admin-only — see the controller).
// ---------------------------------------------------------------------------

router.get('/modules', staffAdminController.listModules);
router.get('/staff', staffAdminController.listStaff);
router.post('/staff', validate({ body: createStaffSchema }), staffAdminController.createStaff);
router.get('/staff/:id', staffAdminController.getStaff);
router.patch('/staff/:id', validate({ body: updateStaffSchema }), staffAdminController.updateStaff);
router.delete('/staff/:id', staffAdminController.deleteStaff);
router.get('/staff/:id/grants', staffAdminController.listGrants);
router.put('/staff/:id/grants', validate({ body: putGrantsSchema }), staffAdminController.putGrants);
router.delete('/staff/:id/grants/:slug', staffAdminController.deleteGrant);

export default router;
