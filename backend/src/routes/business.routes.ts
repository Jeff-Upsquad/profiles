import { Router } from 'express';
import * as businessController from '../controllers/business.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  updateBusinessUserSchema,
  discoverQuerySchema,
  sendInterestSchema,
} from '../validators/business.validators.js';

const router = Router();

// All business routes require authentication + business role
router.use(authenticate, requireRole('business'));

// Business user info
router.get('/me', businessController.getMe);
router.put(
  '/me',
  validate({ body: updateBusinessUserSchema }),
  businessController.updateMe
);

// Discover talent
router.get(
  '/discover/:categorySlug',
  validate({ query: discoverQuerySchema }),
  businessController.discoverProfiles
);
router.get('/discover/:categorySlug/:id', businessController.getProfile);

// Shortlist
router.get('/shortlist', businessController.getShortlist);
router.post('/shortlist/:profileId', businessController.addToShortlist);
router.delete('/shortlist/:profileId', businessController.removeFromShortlist);

// Interest requests
router.get('/interests', businessController.getInterests);
router.post(
  '/interest/:profileId',
  validate({ body: sendInterestSchema }),
  businessController.sendInterest
);

export default router;
