import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as ctrl from '../controllers/talent-access.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { talentAccessAuth } from '../middleware/talent-access.middleware.js';
import {
  loginSchema,
  profilesQuerySchema,
  filterOptionsQuerySchema,
} from '../validators/talent-access.validators.js';

const router = Router();

// Rate-limit the email login to reduce enumeration risk
const loginLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Too many login attempts. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Public — unauthenticated
router.post('/login', loginLimiter, validate({ body: loginSchema }), ctrl.login);

// Authenticated via talent-access JWT
router.use(talentAccessAuth);

router.get('/me', ctrl.me);
router.get('/profiles', validate({ query: profilesQuerySchema }), ctrl.listProfiles);
router.get('/profiles/:id', ctrl.getProfile);
router.get('/filter-options', validate({ query: filterOptionsQuerySchema }), ctrl.getFilterOptions);

export default router;
