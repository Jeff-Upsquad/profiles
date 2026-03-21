import { Router } from 'express';
import * as talentController from '../controllers/talent.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  createProfileSchema,
  updateProfileSchema,
  updateTalentUserSchema,
} from '../validators/talent.validators.js';

const router = Router();

// All talent routes require authentication + talent role
router.use(authenticate, requireRole('talent'));

// Talent user (self)
router.get('/me', talentController.getMe);
router.put('/me', validate({ body: updateTalentUserSchema }), talentController.updateMe);

// Talent profiles
router.get('/profiles', talentController.getProfiles);
router.post('/profiles', validate({ body: createProfileSchema }), talentController.createProfile);
router.get('/profiles/:id', talentController.getProfile);
router.put('/profiles/:id', validate({ body: updateProfileSchema }), talentController.updateProfile);
router.patch('/profiles/:id/submit', talentController.submitProfile);
router.patch('/profiles/:id/deactivate', talentController.deactivateProfile);
router.patch('/profiles/:id/reactivate', talentController.reactivateProfile);
router.delete('/profiles/:id', talentController.deleteProfile);

export default router;
