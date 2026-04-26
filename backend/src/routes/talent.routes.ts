import { Router } from 'express';
import * as talentController from '../controllers/talent.controller.js';
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

export default router;
