import { Router } from 'express';
import rateLimit from 'express-rate-limit';
import * as interviewController from '../controllers/interview.controller.js';
import { validate } from '../middleware/validate.middleware.js';
import { submitInterviewResponsesSchema } from '../validators/interview.validators.js';

const router = Router();

const publicReadLimiter = rateLimit({
  windowMs: 60_000,
  max: 30,
  message: { error: 'Too many requests. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

const submitLimiter = rateLimit({
  windowMs: 60_000,
  max: 5,
  message: { error: 'Too many submissions. Please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

router.get('/:token', publicReadLimiter, interviewController.getByToken);

router.post(
  '/:token/submit',
  submitLimiter,
  validate({ body: submitInterviewResponsesSchema }),
  interviewController.submitByToken
);

export default router;
