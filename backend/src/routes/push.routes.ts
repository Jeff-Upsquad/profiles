import { Router } from 'express';
import * as pushController from '../controllers/push.controller.js';
import { authenticate } from '../middleware/auth.middleware.js';
import { requireRole } from '../middleware/rbac.middleware.js';
import { validate } from '../middleware/validate.middleware.js';
import {
  registerPushTokenSchema,
  unregisterPushTokenSchema,
} from '../validators/push.validators.js';

const router = Router();

router.use(authenticate, requireRole('talent'));

router.post(
  '/register',
  validate({ body: registerPushTokenSchema }),
  pushController.register,
);

router.post(
  '/unregister',
  validate({ body: unregisterPushTokenSchema }),
  pushController.unregister,
);

export default router;
