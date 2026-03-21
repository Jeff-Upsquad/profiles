import { Router } from 'express';
import * as authController from '../controllers/auth.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  signupTalentSchema,
  signupBusinessSchema,
  loginSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '../validators/auth.validators.js';

const router = Router();

router.post(
  '/signup/talent',
  validate({ body: signupTalentSchema }),
  authController.signupTalent
);

router.post(
  '/signup/business',
  validate({ body: signupBusinessSchema }),
  authController.signupBusiness
);

router.post(
  '/login',
  validate({ body: loginSchema }),
  authController.login
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

router.get('/me', authenticate, authController.getMe);

export default router;
