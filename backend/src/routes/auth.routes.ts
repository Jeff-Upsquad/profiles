import { Router } from 'express';
import rateLimit from 'express-rate-limit';
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
  passwordResetLookupSchema,
  passwordResetSendSchema,
  passwordResetVerifySchema,
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

// ─── Self-serve WhatsApp password reset ──────────────────────────────────────
// Public, unauthenticated. Rate-limited to blunt enumeration (lookup/verify by
// IP) and to stop a number being spammed with WhatsApp temp passwords (send by
// phone). The temp password itself is never returned — only delivered over
// WhatsApp — and each step is gated by a short-lived signed reset_ticket.

const resetLookupLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { message: 'Too many attempts. Please try again in a minute.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetSendLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 4,
  keyGenerator: (req) => String(req.body?.reset_ticket ?? req.ip),
  message: { message: 'Too many temporary passwords requested. Please wait before trying again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const resetVerifyLimiter = rateLimit({
  windowMs: 10 * 60_000,
  max: 8,
  message: { message: 'Too many attempts. Please start the reset again.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/password-reset/lookup',
  resetLookupLimiter,
  validate({ body: passwordResetLookupSchema }),
  authController.passwordResetLookup
);

router.post(
  '/password-reset/send',
  resetSendLimiter,
  validate({ body: passwordResetSendSchema }),
  authController.passwordResetSend
);

router.post(
  '/password-reset/verify',
  resetVerifyLimiter,
  validate({ body: passwordResetVerifySchema }),
  authController.passwordResetVerify
);

router.post(
  '/change-password',
  authenticate,
  validate({ body: changePasswordSchema }),
  authController.changePassword
);

router.get('/me', authenticate, authController.getMe);

export default router;
