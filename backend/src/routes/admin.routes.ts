import { Router } from 'express';
import * as adminController from '../controllers/admin.controller.js';
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
} from '../validators/admin.validators.js';
import {
  createInvitationSchema,
  assignCategoriesSchema,
  shareProfilesSchema,
} from '../validators/invite.validators.js';

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
// Talents Module (browse profiles by category)
// ---------------------------------------------------------------------------

router.get('/talents/categories', adminController.getTalentCategories);
router.get('/talents/categories/:categoryId/profiles', adminController.getTalentProfilesByCategory);
router.get('/talents/profiles/:profileId', adminController.getTalentProfile);

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
// User Management
// ---------------------------------------------------------------------------

router.get('/users/talent', adminController.getTalentUsers);
router.get('/users/business', adminController.getBusinessUsers);
router.patch('/users/:id/suspend', adminController.suspendUser);
router.delete('/users/:id', adminController.deleteUser);

// ---------------------------------------------------------------------------
// Recycle Bin
// ---------------------------------------------------------------------------

router.get('/recycle-bin', adminController.getRecycleBin);
router.patch('/recycle-bin/:profileId/restore', adminController.restoreProfile);
router.delete('/recycle-bin/:profileId', adminController.permanentlyDeleteProfile);

export default router;
