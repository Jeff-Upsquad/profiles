import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
import * as leadController from '../controllers/lead.controller.js';
import * as subscriptionController from '../controllers/subscription.controller.js';
import * as formConfigController from '../controllers/form-config.controller.js';
import * as interviewController from '../controllers/interview.controller.js';
import * as talentAccessController from '../controllers/talent-access.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
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
} from '../validators/admin.validators.js';
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
} from '../validators/lead.validators.js';
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

const router = Router();

// All admin routes require authentication + admin role
router.use(authenticate, requireRole('admin'));

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
// Shortlist Tracking
// ---------------------------------------------------------------------------

router.get('/shortlists', adminController.getShortlistTracking);

// ---------------------------------------------------------------------------
// User Management
// ---------------------------------------------------------------------------

router.get('/users/talent', adminController.getTalentUsers);
router.get('/users/business', adminController.getBusinessUsers);
router.get('/users/:userId', adminController.getUserDetail);
router.patch('/users/:id/suspend', adminController.suspendUser);
router.patch('/users/talent/:id/active', adminController.setTalentUserActive);
router.post('/users/:id/reset-password', adminController.resetUserPassword);
router.delete('/users/:id', adminController.deleteUser);

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
router.get('/subscription-cards/:id/recipients', subscriptionController.adminListRecipients);
router.post(
  '/subscription-cards/:cardId/recipients/:recipientId/remove-from-dashboard',
  subscriptionController.adminRemoveFromBusinessDashboard
);

// ---------------------------------------------------------------------------
// Lead Submissions
// ---------------------------------------------------------------------------

router.get('/leads', leadController.getLeads);
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

// ---------------------------------------------------------------------------
// Public Forms Config
// ---------------------------------------------------------------------------

router.get('/forms', formConfigController.getPublicForms);
router.patch('/forms/:id/toggle', formConfigController.toggleFormEnabled);

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

export default router;
