import { Router } from 'express';
import * as talentController from '../controllers/talent.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';

const router = Router();

// Public routes — require authentication but no specific role
router.use(authenticate);

router.get('/categories', talentController.getCategories);
router.get('/categories/:slug', talentController.getCategoryBySlug);

export default router;
