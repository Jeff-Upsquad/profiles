import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  signupTalentSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
  changePasswordSchema,
  checkCandidateStatusSchema,
} from '../validators/auth.validators.js';
import {
  businessLoginSchema,
  businessSignupSchema,
  businessChangePasswordSchema,
  requestAccessSchema,
} from '../validators/invite.validators.js';

const router = Router();

router.post(
  '/signup/talent',
  validate({ body: signupTalentSchema }),
  authController.signupTalent
);

router.post(
  '/check-candidate-status',
  validate({ body: checkCandidateStatusSchema }),
  authController.checkCandidateStatus
);

router.post(
  '/login',
  validate({ body: loginSchema }),
  authController.login
);

// Business login (email or phone; password required for accounts on the
// password track, ignored for grandfathered passwordless accounts).
router.post(
  '/business-login',
  validate({ body: businessLoginSchema }),
  authController.businessLogin
);

// First-time business signup / activation: set name + business name + password
// on an already-provisioned/invited account, then log in.
router.post(
  '/business/signup',
  validate({ body: businessSignupSchema }),
  authController.businessSignup
);

// Authenticated business password change (also used for the forced change after
// an admin reset).
router.post(
  '/business/change-password',
  authenticate,
  validate({ body: businessChangePasswordSchema }),
  authController.businessChangePassword
);

// Request access renewal (public, no auth required)
router.post(
  '/request-access',
  validate({ body: requestAccessSchema }),
  authController.requestAccess
);

router.post('/logout', authController.logout);

router.post('/refresh', authController.refresh);

router.post('/business-refresh', authenticate, authController.businessRefresh);

router.post(
  '/forgot-password',
  validate({ body: forgotPasswordSchema }),
  authController.forgotPassword
);

router.post(
  '/reset-password',
  validate({ body: resetPasswordSchema }),
  authController.resetPassword
);

router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);

router.get('/me', authenticate, authController.getMe);

export default router;
