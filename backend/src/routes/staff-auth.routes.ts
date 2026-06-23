import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/staff-auth.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { staffAuth } from '../middleware/staff-auth.middleware.js';
import { staffLoginSchema, staffSsoExchangeSchema } from '../validators/staff-auth.validators.js';

const router = Router();

// Rate-limit the password login to reduce brute-force / enumeration risk.
const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public — unauthenticated
router.post('/login', loginLimiter, validate({ body: staffLoginSchema }), ctrl.login);
// Public — "Sign in with SquadHub" one-time code exchange (proven by the code).
router.post('/sso/exchange', loginLimiter, validate({ body: staffSsoExchangeSchema }), ctrl.ssoExchange);

// Authenticated via staff JWT
router.use(staffAuth);
router.get('/me', ctrl.me);
router.post('/logout', ctrl.logout);

export default router;
