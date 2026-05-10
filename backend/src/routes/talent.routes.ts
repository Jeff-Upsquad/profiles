import { Router } from 'express';
import * as talentController from '../controllers/talent.controller.js';
import * as trainingController from '../controllers/training.controller.js';
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

const router = Router();

// All talent routes require authentication + talent role
router.use(authenticate, requireRole('talent'));

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

// Talent profiles (approval gates submission, not creation)
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
router.post('/training/complete-onboarding', trainingController.completeOnboarding);
router.post('/training/courses/:id/start', trainingController.startCourse);
router.post(
  '/training/courses/:id/request-reopen',
  validate({ body: requestCourseReopenSchema }),
  trainingController.requestCourseReopen,
);
router.get('/training', trainingController.getMyTraining);
router.post('/training/lessons/:lessonId/complete', trainingController.markComplete);
router.delete('/training/lessons/:lessonId/complete', trainingController.markIncomplete);

export default router;
