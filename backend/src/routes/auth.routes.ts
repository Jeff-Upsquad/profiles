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
} from '../validators/auth.validators.js';
import { businessLoginSchema, requestAccessSchema } from '../validators/invite.validators.js';

const router = Router();

router.post(
  '/signup/talent',
  validate({ body: signupTalentSchema }),
  authController.signupTalent
);

router.post(
  '/login',
  validate({ body: loginSchema }),
  authController.login
);

// Passwordless business login (email or phone)
router.post(
  '/business-login',
  validate({ body: businessLoginSchema }),
  authController.businessLogin
);

// Request access renewal (public, no auth required)
router.post(
  '/request-access',
  validate({ body: requestAccessSchema }),
  authController.requestAccess
);

router.post('/logout', authController.logout);

router.post('/refresh', authController.refresh);

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
