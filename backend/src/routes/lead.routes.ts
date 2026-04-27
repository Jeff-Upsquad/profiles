import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as leadController from '../controllers/lead.controller.js';
import * as formConfigController from '../controllers/form-config.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { createLeadSchema, checkExistingContactSchema } from '../validators/lead.validators.js';

const router = Router();

// Public — rate-limited, no auth
const submitLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const uploadLimiter = rateLimit({
  windowMs: 60_000,
  max: 10,
  message: { error: 'Too many upload requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const checkLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: 'Too many checks. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.post(
  '/submit',
  submitLimiter,
  validate({ body: createLeadSchema }),
  leadController.submitLead
);

// Public duplicate-contact check (no auth, rate-limited)
router.post(
  '/check-existing',
  checkLimiter,
  validate({ body: checkExistingContactSchema }),
  leadController.checkExisting
);

// Public presigned URL for resume upload (no auth, rate-limited)
router.post('/upload-url', uploadLimiter, leadController.getUploadUrl);

// Public — check if a form is enabled
router.get('/form-status/:formType', formConfigController.checkFormStatus);

export default router;
